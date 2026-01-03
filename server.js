// server.js
// === Atomic Fizz Caps Vault 77 Wasteland GPS Backend ===
// FIXED VERSION - All paths and imports corrected

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const Redis = require("ioredis");
const nacl = require("tweetnacl");

// bs58 fix for Node 20+
const bs58pkg = require("bs58");
const bs58 = bs58pkg.default || bs58pkg;

const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");

const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getMint,
  getAssociatedTokenAddress,
} = require("@solana/spl-token");

const { Metaplex } = require("@metaplex-foundation/js");

// Required ENV Vars
const requiredEnv = [
  "SOLANA_RPC",
  "TOKEN_MINT",
  "GAME_VAULT_SECRET",
  "REDIS_URL",
  "SERVER_SECRET_KEY",
];

const missing = requiredEnv.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const {
  SOLANA_RPC,
  TOKEN_MINT,
  GAME_VAULT_SECRET,
  REDIS_URL,
  SERVER_SECRET_KEY,
  PORT = 3000,
  COOLDOWN_SECONDS = 60,
} = process.env;

// Solana + Redis Setup
const connection = new Connection(SOLANA_RPC, "confirmed");
const MINT_PUBKEY = new PublicKey(TOKEN_MINT);
const GAME_VAULT = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(GAME_VAULT_SECRET))
);
const COOLDOWN = Number(COOLDOWN_SECONDS);
const redis = new Redis(REDIS_URL);

redis.on("error", (err) => console.error("Redis error:", err));

// Server Ed25519 Keypair
const serverSecretKeyUint8 = bs58.decode(SERVER_SECRET_KEY);
if (serverSecretKeyUint8.length !== 64) {
  console.error("SERVER_SECRET_KEY must be a 64-byte Ed25519 secret key (base58)");
  process.exit(1);
}
const serverKeypair = nacl.sign.keyPair.fromSecretKey(serverSecretKeyUint8);
const SERVER_PUBKEY = bs58.encode(serverKeypair.publicKey);

// Donation Wallet
const DONATION_WALLET = "GtW88raUHJmcFyqDviE1ZNsQxNpZ5US7TMGf5dzac42u";
let DONATION_PUBKEY;
try {
  DONATION_PUBKEY = new PublicKey(DONATION_WALLET);
} catch (e) {
  console.error("Invalid DONATION_WALLET public key:", e);
  process.exit(1);
}

// FIXED: Data Loading helper - corrected path
function safeJsonRead(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error("JSON load error:", filePath, e.message);
    return [];
  }
}

// FIXED: Use public/data directory
const DATA_DIR = path.join(__dirname, "public", "data");
const LOCATIONS = safeJsonRead(path.join(DATA_DIR, "locations.json"));
const QUESTS = safeJsonRead(path.join(DATA_DIR, "quests.json"));
const MINTABLES = safeJsonRead(path.join(DATA_DIR, "mintables.json"));
const EVENTS = safeJsonRead(path.join(DATA_DIR, "events.json"));
const EVENT_LOOT_TABLES = safeJsonRead(path.join(DATA_DIR, "eventLootTables.json"));
const RECIPES = safeJsonRead(path.join(DATA_DIR, "recipes.json"));

// Create lookup maps for events
const eventsById = new Map();
EVENTS.forEach(e => { if (e && e.id) eventsById.set(e.id, e); });

const lootTablesById = new Map();
EVENT_LOOT_TABLES.forEach(t => { if (t && t.id) lootTablesById.set(t.id, t); });

const gameData = {
  locations: LOCATIONS,
  quests: QUESTS,
  mintables: MINTABLES,
  events: EVENTS,
  eventLootTables: EVENT_LOOT_TABLES,
  recipes: RECIPES,
  eventsById,
  lootTablesById
};

console.log("Loaded locations:", LOCATIONS.length);
console.log("Loaded quests:", QUESTS.length);
console.log("Loaded mintables:", MINTABLES.length);
console.log("Loaded events:", EVENTS.length);
console.log("Loaded loot tables:", EVENT_LOOT_TABLES.length);
console.log("Loaded recipes:", RECIPES.length);

// Express App
const app = express();
app.use(morgan("combined"));

// Security middlewares
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net",
        "https://www.gstatic.com",
        "https://www.googletagmanager.com",
        "https://api.phantom.app",
        "https://*.phantom.app",
        "https://wallet.phantom.app"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://unpkg.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "data:"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*.tile.openstreetmap.org",
        "https://*.basemaps.cartocdn.com"
      ],
      connectSrc: [
        "'self'",
        "https://atomicfizzcaps.xyz",
        "https://www.atomicfizzcaps.xyz",
        "https://api.mainnet-beta.solana.com",
        "https://api.devnet.solana.com",
        "https://api.phantom.app",
        "https://*.phantom.app",
        "https://wallet.phantom.app",
        "wss:"
      ],
      mediaSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'"],
      baseUri: ["'self'"],
      workerSrc: ["'self'", "blob:"]
    }
  })
);

app.use(cors());
app.use(express.json({ limit: "100kb" }));

// Rate Limits
const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  message: { error: "Too many requests, please try again later." },
});
const actionLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: { error: "Action rate limit exceeded." },
});
app.use(globalLimiter);

// Bot Shield
async function botShield(req, res, next) {
  try {
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = (ipHeader ? ipHeader.split(",")[0].trim() : req.ip) || "unknown";
    const ua = (req.headers["user-agent"] || "").slice(0, 200);

    const ipKey = `rep:ip:${ip}`;
    const uaKey = `rep:ua:${ua || "none"}`;

    const [ipScore, uaScore] = await Promise.all([redis.incr(ipKey), redis.incr(uaKey)]);

    if (ipScore === 1) await redis.expire(ipKey, 60);
    if (uaScore === 1) await redis.expire(uaKey, 60);

    if (ipScore > 400 || uaScore > 400) {
      return res.status(429).json({ error: "Too many actions, slow down." });
    }

    next();
  } catch (e) {
    console.warn("botShield error:", e);
    next();
  }
}

// Apply to sensitive endpoints
app.use(
  ["/find-loot", "/shop", "/battle", "/terminal-reward", "/claim-voucher", "/api/craft"],
  botShield,
  actionLimiter
);

// Static Files
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === ".js") {
      res.setHeader("Content-Type", "application/javascript");
    }
  }
}));

// Simple event system (inline since we don't have separate files)
const activeEvents = new Map();
const lastActivation = new Map();

function canActivateEvent(ev, now = new Date()) {
  const hour = now.getHours();
  const { activeWindow, cooldownMinutes, flags = {} } = ev;

  if (activeWindow) {
    const start = activeWindow.startHourLocal;
    const end = activeWindow.endHourLocal;
    if (start < end) {
      if (hour < start || hour >= end) return false;
    } else {
      if (!(hour >= start || hour < end)) return false;
    }
  }

  const last = lastActivation.get(ev.id);
  if (last) {
    const diffMin = (now - last) / 60000;
    if (diffMin < cooldownMinutes) return false;
  }

  if (flags.uniquePerDay && last) {
    const lastDayKey = new Date(last).toISOString().slice(0, 10);
    const todayKey = now.toISOString().slice(0, 10);
    if (lastDayKey === todayKey) return false;
  }

  return true;
}

function activateEvent(ev, now = new Date()) {
  const endsAt = new Date(now.getTime() + ev.durationMinutes * 60000);
  activeEvents.set(ev.id, { startedAt: now, endsAt });
  lastActivation.set(ev.id, now.getTime());
}

function startEventScheduler() {
  const now = new Date();
  for (const ev of EVENTS) {
    if (canActivateEvent(ev, now)) activateEvent(ev, now);
  }

  setInterval(() => {
    const tickNow = new Date();
    // Cleanup expired
    for (const [id, state] of activeEvents.entries()) {
      if (state.endsAt <= tickNow) activeEvents.delete(id);
    }
    // Activate new
    for (const ev of EVENTS) {
      if (!activeEvents.has(ev.id) && canActivateEvent(ev, tickNow)) {
        activateEvent(ev, tickNow);
      }
    }
  }, 60 * 1000);
}

startEventScheduler();

// Events API
app.get("/events/active", (req, res) => {
  const poi = req.query.poi;
  const now = new Date();
  const result = [];

  for (const [id, state] of activeEvents.entries()) {
    const ev = eventsById.get(id);
    if (!ev || state.endsAt <= now) continue;
    if (poi && ev.spawnPOI !== poi) continue;

    result.push({
      id: ev.id,
      type: ev.type,
      displayName: ev.displayName,
      description: ev.description,
      spawnPOI: ev.spawnPOI,
      rarity: ev.rarity,
      endsAt: state.endsAt,
      durationMinutes: ev.durationMinutes
    });
  }

  res.json({ events: result });
});

// Basic Data Endpoints
app.get("/locations", (req, res) => res.json(LOCATIONS));
app.get("/quests", (req, res) => res.json(QUESTS));
app.get("/mintables", (req, res) => res.json(MINTABLES));

// Player endpoints
app.get("/player/:addr", async (req, res) => {
  const { addr } = req.params;
  try { new PublicKey(addr); }
  catch { return res.status(400).json({ error: "Invalid address" }); }

  let playerData = { 
    lvl: 1, hp: 100, caps: 0, gear: [], found: [], 
    xp: 0, xpToNext: 100, rads: 0, inventory: {} 
  };
  
  const redisData = await redis.get(`player:${addr}`);
  if (redisData) {
    try { playerData = JSON.parse(redisData); } catch (e) {}
  }

  res.json(playerData);
});

app.post("/player/:addr", async (req, res) => {
  const { addr } = req.params;
  await redis.set(`player:${addr}`, JSON.stringify(req.body));
  res.json({ success: true });
});

// Lua script handling for crafting
const luaPath = path.join(__dirname, "server", "redis_scripts", "craft_atomic.lua");
let craftLuaSha = null;

async function loadLuaScripts() {
  try {
    if (fs.existsSync(luaPath)) {
      const script = fs.readFileSync(luaPath, "utf8");
      craftLuaSha = await redis.script("load", script);
      console.log("Loaded craft Lua script SHA:", craftLuaSha);
    } else {
      console.warn("Craft Lua script not found at:", luaPath);
    }
  } catch (e) {
    console.warn("Could not load craft Lua script:", e.message);
  }
}
loadLuaScripts();

// Utility functions
function parseHumanAmountToBase(amountStr, decimals) {
  if (typeof amountStr === "number") amountStr = amountStr.toString();
  if (typeof amountStr !== "string") throw new Error("Amount must be a string or number");
  amountStr = amountStr.trim();
  if (/^\d+$/.test(amountStr)) return BigInt(amountStr);
  if (!/^\d+(\.\d+)?$/.test(amountStr)) throw new Error("Amount must be a non-negative decimal number");
  const parts = amountStr.split(".");
  const intPart = parts[0] || "0";
  const fracPart = parts[1] || "";
  if (fracPart.length > decimals) throw new Error("Amount has more decimal places than the token supports");
  const fracPadded = fracPart.padEnd(decimals, "0");
  const baseStr = (intPart + fracPadded).replace(/^0+(?=\d)|^$/, "0");
  return BigInt(baseStr);
}

// Terminal Reward endpoint
app.post(
  "/api/terminal-reward",
  [
    body("wallet").isString().notEmpty(),
    body("amount").not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid request", details: errors.array() });
    }

    const wallet = String(req.body.wallet).trim();
    const amountInput = req.body.amount;

    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(wallet);
    } catch (e) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const cooldownKey = `terminal:cooldown:${wallet}`;

    try {
      const setOk = await redis.set(cooldownKey, "1", "NX", "EX", COOLDOWN);
      if (!setOk) {
        return res.status(429).json({ error: "Cooldown active. Try again later." });
      }

      const mintInfo = await getMint(connection, MINT_PUBKEY);
      const decimals = Number(mintInfo.decimals || 0);

      let baseAmount;
      try {
        baseAmount = parseHumanAmountToBase(amountInput, decimals);
      } catch (parseErr) {
        await redis.del(cooldownKey);
        return res.status(400).json({ error: "Invalid amount", details: parseErr.message });
      }

      if (baseAmount <= 0n) {
        await redis.del(cooldownKey);
        return res.status(400).json({ error: "Amount must be greater than zero" });
      }

      const vaultAta = await getOrCreateAssociatedTokenAccount(
        connection,
        GAME_VAULT,
        MINT_PUBKEY,
        GAME_VAULT.publicKey
      );

      const vaultBalance = BigInt(vaultAta.amount ? vaultAta.amount.toString() : "0");
      if (vaultBalance < baseAmount) {
        await redis.del(cooldownKey);
        return res.status(400).json({ error: "Vault has insufficient token balance" });
      }

      const recipientAta = await getOrCreateAssociatedTokenAccount(
        connection,
        GAME_VAULT,
        MINT_PUBKEY,
        recipientPubkey
      );

      const transferIx = createTransferInstruction(
        vaultAta.address,
        recipientAta.address,
        GAME_VAULT.publicKey,
        baseAmount
      );

      const tx = new Transaction().add(transferIx);
      tx.feePayer = GAME_VAULT.publicKey;
      const latest = await connection.getLatestBlockhash("finalized");
      tx.recentBlockhash = latest.blockhash;

      const txSig = await sendAndConfirmTransaction(connection, tx, [GAME_VAULT], {
        commitment: "confirmed",
      });

      try {
        const playerKey = `player:${wallet}`;
        const raw = await redis.get(playerKey);
        if (raw) {
          const pd = JSON.parse(raw);
          pd.caps = (pd.caps || 0) + Number(baseAmount);
          await redis.set(playerKey, JSON.stringify(pd));
        }
      } catch (e) {
        console.warn("Failed to update player caps in Redis:", e);
      }

      return res.json({
        success: true,
        tx: txSig,
        amount: {
          human: String(amountInput),
          base: baseAmount.toString(),
          decimals: decimals,
        },
        message: "Reward transferred. Transaction confirmed.",
      });
    } catch (err) {
      try { await redis.del(cooldownKey); } catch (e) {}
      console.error("Terminal reward error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    data: {
      locations: LOCATIONS.length,
      quests: QUESTS.length,
      events: EVENTS.length
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Atomic Fizz Caps server running on port ${PORT}`);
  console.log(`📍 Visit: http://localhost:${PORT}`);
  console.log(`💾 Redis: ${REDIS_URL}`);
  console.log(`⛓️  Solana: ${SOLANA_RPC}`);
  console.log(`🎮 Game vault: ${GAME_VAULT.publicKey.toBase58()}\n`);
});
