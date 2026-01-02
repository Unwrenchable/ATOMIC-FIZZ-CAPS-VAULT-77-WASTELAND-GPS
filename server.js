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

// Data Loading (legacy JSONs for API endpoints)
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

// Load Game Data + Start Event Scheduler + Mount Event Routes
const gameData = loadAllGameData();
console.log("Loaded mintables:", gameData.mintables.length);
console.log("Loaded events:", gameData.events.length);
console.log("Loaded loot tables:", gameData.eventLootTables.length);
console.log("Loaded quests:", gameData.quests.length);
console.log("Loaded locations:", gameData.locations.length);

startEventScheduler(gameData);
app.use("/events", createEventsRouter(gameData));

// CSP / Security
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

app.use(
  ["/find-loot", "/shop", "/battle", "/terminal-reward", "/claim-voucher"],
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

// Basic Data Endpoints
app.get("/locations", (req, res) => res.json(LOCATIONS));
app.get("/quests", (req, res) => res.json(QUESTS));
app.get("/mintables", (req, res) => res.json(MINTABLES));

// Player Data
app.get("/player/:addr", async (req, res) => {
  const { addr } = req.params;
  try { new PublicKey(addr); }
  catch { return res.status(400).json({ error: "Invalid address" }); }

  let playerData = { lvl: 1, hp: 100, caps: 0, gear: [], found: [], xp: 0, xpToNext: 100, rads: 0 };
  const redisData = await redis.get(`player:${addr}`);
  if (redisData) playerData = JSON.parse(redisData);

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

// === Terminal Reward ===
// POST /api/terminal-reward
// Accepts human-readable amounts (e.g., "0.5") or base units (integer string/number).
// Enforces cooldown per wallet via Redis and transfers SPL tokens from GAME_VAULT to recipient.

app.post(
  "/api/terminal-reward",
  [
    body("wallet").isString().notEmpty(),
    body("amount").not().isEmpty(), // accept string or number; we'll validate below
  ],
  async (req, res) => {
    // Basic validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid request", details: errors.array() });
    }

    const wallet = String(req.body.wallet).trim();
    const amountInput = req.body.amount;

    // Validate Solana address
    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(wallet);
    } catch (e) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // Helper: parse human amount string into base units (BigInt) using decimals
    function parseHumanAmountToBase(amountStr, decimals) {
      if (typeof amountStr === "number") {
        amountStr = amountStr.toString();
      }
      if (typeof amountStr !== "string") throw new Error("Amount must be a string or number");

      amountStr = amountStr.trim();
      // Accept integer strings (base units) as well
      if (/^\d+$/.test(amountStr)) {
        return BigInt(amountStr);
      }
      if (!/^\d+(\.\d+)?$/.test(amountStr)) throw new Error("Amount must be a non-negative decimal number");

      var parts = amountStr.split(".");
      var intPart = parts[0] || "0";
      var fracPart = parts[1] || "";

      if (fracPart.length > decimals) {
        throw new Error("Amount has more decimal places than the token supports");
      }

      var fracPadded = fracPart.padEnd(decimals, "0");
      var baseStr = intPart + fracPadded;
      baseStr = baseStr.replace(/^0+(?=\d)|^$/, "0");
      return BigInt(baseStr);
    }

    const cooldownKey = `terminal:cooldown:${wallet}`;

    try {
      // Atomically claim cooldown (SET NX EX)
      const setOk = await redis.set(cooldownKey, "1", "NX", "EX", COOLDOWN);
      if (!setOk) {
        return res.status(429).json({ error: "Cooldown active. Try again later." });
      }

      // Fetch mint info to get decimals
      const mintInfo = await getMint(connection, MINT_PUBKEY);
      const decimals = Number(mintInfo.decimals || 0);

      // Parse amount input into base units (BigInt)
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

      // Ensure GAME_VAULT ATA exists and check balance
      const vaultAta = await getOrCreateAssociatedTokenAccount(
        connection,
        GAME_VAULT, // payer / signer
        MINT_PUBKEY,
        GAME_VAULT.publicKey
      );

      const vaultBalance = BigInt(vaultAta.amount ? vaultAta.amount.toString() : "0");
      if (vaultBalance < baseAmount) {
        await redis.del(cooldownKey);
        return res.status(400).json({ error: "Vault has insufficient token balance" });
      }

      // Ensure recipient ATA exists (GAME_VAULT pays fees)
      const recipientAta = await getOrCreateAssociatedTokenAccount(
        connection,
        GAME_VAULT,
        MINT_PUBKEY,
        recipientPubkey
      );

      // Build transfer instruction
      const transferIx = createTransferInstruction(
        vaultAta.address,
        recipientAta.address,
        GAME_VAULT.publicKey,
        baseAmount
      );

      // Build transaction
      const tx = new Transaction().add(transferIx);
      tx.feePayer = GAME_VAULT.publicKey;
      const latest = await connection.getLatestBlockhash("finalized");
      tx.recentBlockhash = latest.blockhash;

      // Send and confirm transaction signed by GAME_VAULT
      const txSig = await sendAndConfirmTransaction(connection, tx, [GAME_VAULT], {
        commitment: "confirmed",
      });

      // Best-effort: update player state in Redis (non-fatal)
      try {
        const playerKey = `player:${wallet}`;
        const raw = await redis.get(playerKey);
        if (raw) {
          const pd = JSON.parse(raw);
          // Note: storing base units as Number may overflow for very large amounts; adapt schema if needed
          pd.caps = (pd.caps || 0) + Number(baseAmount);
          await redis.set(playerKey, JSON.stringify(pd));
        }
      } catch (e) {
        console.warn("Failed to update player caps in Redis:", e);
      }

      // Success response
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
      // Remove cooldown so user can retry (policy choice)
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
