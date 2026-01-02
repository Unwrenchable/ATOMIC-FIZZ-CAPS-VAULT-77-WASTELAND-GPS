// server.js
// === Atomic Fizz Caps Vault 77 Wasteland GPS Backend ===
// Node 20+ / Render-safe / CommonJS

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

// Event system imports (CommonJS)
const { loadAllGameData } = require("./server/loadData.js");
const { startEventScheduler } = require("./server/eventsScheduler.js");
const { createEventsRouter } = require("./server/eventsRoutes.js");

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

// Data Loading helper
function safeJsonRead(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error("JSON load error:", filePath, e);
    return [];
  }
}
const DATA_DIR = path.join(__dirname, "data");
const LOCATIONS = safeJsonRead(path.join(DATA_DIR, "locations.json"));
const QUESTS = safeJsonRead(path.join(DATA_DIR, "quests.json"));
const MINTABLES = safeJsonRead(path.join(DATA_DIR, "mintables.json"));

// Express App
const app = express();
app.use(morgan("combined"));

// Security middlewares (order matters)
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://tile.openstreetmap.org",
        "https://*.basemaps.cartocdn.com",
      ],
      connectSrc: ["'self'", SOLANA_RPC, "https://api.devnet.solana.com", "https://api.mainnet-beta.solana.com", "wss:", "https://*"],
      mediaSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'"],
      baseUri: ["'self'"],
    },
  })
);

app.use(cors());
// JSON body parser must be registered before routes that read req.body
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

// Apply botShield + actionLimiter to sensitive endpoints
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

// Load Game Data + Start Event Scheduler + Mount Event Routes
const gameData = loadAllGameData();
console.log("Loaded mintables:", (gameData.mintables || []).length);
console.log("Loaded events:", (gameData.events || []).length);
console.log("Loaded loot tables:", (gameData.eventLootTables || []).length);
console.log("Loaded quests:", (gameData.quests || []).length);
console.log("Loaded locations:", (gameData.locations || []).length);
console.log("Loaded recipes:", (gameData.recipes || []).length);

startEventScheduler(gameData);
app.use("/events", createEventsRouter(gameData));

/* -------------------------
   Lua script loader & runner
   ------------------------- */
const luaPath = path.join(__dirname, "server", "redis_scripts", "craft_atomic.lua");
let craftLuaSha = null;

async function loadLuaScripts() {
  try {
    const script = fs.readFileSync(luaPath, "utf8");
    craftLuaSha = await redis.script("load", script);
    console.log("Loaded craft Lua script SHA:", craftLuaSha);
  } catch (e) {
    console.warn("Could not load craft Lua script at startup:", e.message || e);
    craftLuaSha = null;
  }
}
loadLuaScripts().catch((err) => console.error("Lua load error", err));

async function runCraftLua(wallet, recipe, amount) {
  const playerKey = `player:${wallet}`;
  const cdKey = `craft:cd:${wallet}:${recipe.id}`;
  const recipeJson = JSON.stringify(recipe);
  const nowTs = String(Date.now());

  const keys = [playerKey, cdKey];
  const args = [recipeJson, String(amount), nowTs];

  try {
    if (craftLuaSha) {
      const res = await redis.evalsha(craftLuaSha, keys.length, ...keys, ...args);
      return JSON.parse(res);
    } else {
      const script = fs.readFileSync(luaPath, "utf8");
      const res = await redis.eval(script, keys.length, ...keys, ...args);
      return JSON.parse(res);
    }
  } catch (err) {
    if (err && err.message && err.message.includes("NOSCRIPT")) {
      const script = fs.readFileSync(luaPath, "utf8");
      craftLuaSha = await redis.script("load", script);
      const res = await redis.evalsha(craftLuaSha, keys.length, ...keys, ...args);
      return JSON.parse(res);
    }
    throw err;
  }
}

/* -------------------------
   Utility helpers
   ------------------------- */
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

function mintpubToString(mintPubkey) {
  try { return mintPubkey.toBase58(); } catch (e) { return String(mintPubkey); }
}

async function verifyTokenTransferTx(txSig, walletPubkeyStr, requiredBaseAmount, mintPubkey, expectedDestAta) {
  const parsed = await connection.getParsedTransaction(txSig, { commitment: "confirmed" });
  if (!parsed) throw new Error("tx_not_found_or_unconfirmed");
  const meta = parsed.meta;
  if (!meta || meta.err) throw new Error("tx_failed");

  let found = null;
  const inner = meta.innerInstructions || [];
  for (const group of inner) {
    for (const ix of group.instructions || []) {
      if (ix.program === "spl-token" && ix.parsed && ix.parsed.type === "transfer") {
        const info = ix.parsed.info;
        if (info.mint === mintpubToString(mintPubkey)) {
          found = { source: info.source, dest: info.destination, amount: BigInt(info.amount) };
          break;
        }
      }
    }
    if (found) break;
  }

  if (!found) {
    const topIns = parsed.transaction.message.instructions || [];
    for (const ix of topIns) {
      if (ix.program === "spl-token" && ix.parsed && ix.parsed.type === "transfer") {
        const info = ix.parsed.info;
        if (info.mint === mintpubToString(mintPubkey)) {
          found = { source: info.source, dest: info.destination, amount: BigInt(info.amount) };
          break;
        }
      }
    }
  }

  if (!found) throw new Error("no_valid_token_transfer_found");

  if (expectedDestAta && found.dest !== expectedDestAta.toBase58()) throw new Error("destination_mismatch");

  if (found.amount < BigInt(requiredBaseAmount)) throw new Error("insufficient_amount_in_tx");

  const expectedSourceAta = await getAssociatedTokenAddress(mintPubkey, new PublicKey(walletPubkeyStr));
  if (found.source !== expectedSourceAta.toBase58()) throw new Error("source_not_player_ata");

  return true;
}

/* -------------------------
   Basic Data Endpoints
   ------------------------- */
app.get("/locations", (req, res) => res.json(LOCATIONS));
app.get("/quests", (req, res) => res.json(QUESTS));
app.get("/mintables", (req, res) => res.json(MINTABLES));

/* -------------------------
   Player endpoints
   ------------------------- */
app.get("/player/:addr", async (req, res) => {
  const { addr } = req.params;
  try { new PublicKey(addr); }
  catch { return res.status(400).json({ error: "Invalid address" }); }

  let playerData = { lvl: 1, hp: 100, caps: 0, gear: [], found: [], xp: 0, xpToNext: 100, rads: 0, inventory: {} };
  const redisData = await redis.get(`player:${addr}`);
  if (redisData) {
    try { playerData = JSON.parse(redisData); } catch (e) { /* ignore parse error */ }
  }

  try {
    const metaplex = Metaplex.make(connection);
    await metaplex.nfts().findAllByOwner({ owner: new PublicKey(addr) });
  } catch (e) {
    console.warn("NFT fetch failed:", e);
  }

  res.json(playerData);
});

app.post("/player/:addr", async (req, res) => {
  const { addr } = req.params;
  await redis.set(`player:${addr}`, JSON.stringify(req.body));
  res.json({ success: true });
});

/* -------------------------
   Crafting endpoint (with Lua atomic update and optional txSig verification)
   ------------------------- */
// POST /api/craft
// Body: { wallet: string, recipeId: string, amount?: number, txSig?: string }
app.post(
  "/api/craft",
  [
    body("wallet").isString().notEmpty(),
    body("recipeId").isString().notEmpty(),
    body("amount").optional().isInt({ min: 1, max: 100 }),
    body("txSig").optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Invalid request", details: errors.array() });

    const wallet = String(req.body.wallet).trim();
    const recipeId = String(req.body.recipeId).trim();
    const amount = Number(req.body.amount || 1);
    const txSig = req.body.txSig;

    try { new PublicKey(wallet); } catch (e) { return res.status(400).json({ error: "Invalid wallet address" }); }

    const recipe = (gameData.recipes || []).find(r => r.id === recipeId);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });

    // Load player data (best-effort)
    const playerKey = `player:${wallet}`;
    let playerData = { lvl: 1, caps: 0, gear: [], inventory: {} };
    try {
      const raw = await redis.get(playerKey);
      if (raw) playerData = JSON.parse(raw);
    } catch (e) {
      console.warn("Redis read player failed:", e);
    }

    if (recipe.requiresLevel && (playerData.lvl || 0) < recipe.requiresLevel) {
      return res.status(403).json({ error: "Player level too low for this recipe" });
    }

    // If recipe requires token payment, verify client-signed txSig first
    if (recipe.tokenCost) {
      if (!txSig) return res.status(400).json({ error: "txSig required for token-cost recipes" });

      try {
        const mintInfo = await getMint(connection, MINT_PUBKEY);
        const decimals = Number(mintInfo.decimals || 0);
        const requiredBase = parseHumanAmountToBase(recipe.tokenCost, decimals) * BigInt(amount);

        const vaultAtaAddress = await getAssociatedTokenAddress(MINT_PUBKEY, GAME_VAULT.publicKey);

        await verifyTokenTransferTx(txSig, wallet, requiredBase, MINT_PUBKEY, vaultAtaAddress);

        const usedKey = `usedTx:${txSig}`;
        const used = await redis.set(usedKey, "1", "NX", "EX", 60 * 60 * 24);
        if (!used) return res.status(400).json({ error: "txSig already used" });
      } catch (e) {
        return res.status(400).json({ error: "tx verification failed", details: e.message });
      }
    }

    // Run atomic Lua script to check/deduct materials, add output, set cooldown
    try {
      const luaResult = await runCraftLua(wallet, recipe, amount);
      if (!luaResult.ok) {
        if (luaResult.error === "cooldown") return res.status(429).json({ error: "Recipe cooldown active" });
        if (luaResult.error === "insufficient") return res.status(400).json({ error: "Insufficient materials", missing: luaResult.missing });
        return res.status(400).json({ error: "Craft failed", details: luaResult.error });
      }

      try {
        const evt = { type: "craft", wallet, recipeId: recipe.id, amount, txSig: txSig || null, time: Date.now() };
        await redis.lpush("game:events", JSON.stringify(evt));
      } catch (e) {
        console.warn("Failed to emit craft event:", e);
      }

      return res.json({ success: true, recipe: recipe.id, amount, inventory: luaResult.inventory });
    } catch (err) {
      console.error("Craft Lua error", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/* -------------------------
   Terminal Reward endpoint
   Accepts human-readable amounts (e.g., "0.5") or base units.
   ------------------------- */
app.post(
  "/api/terminal-reward",
  [
    body("wallet").isString().notEmpty(),
    body("amount").not().isEmpty(), // accept string or number; we'll validate below
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

    function parseHumanAmountToBaseLocal(amountStr, decimals) {
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
        baseAmount = parseHumanAmountToBaseLocal(amountInput, decimals);
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
      try { await redis.del(cooldownKey); } catch (e) { /* ignore */ }
      console.error("Terminal reward error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
