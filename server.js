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

// === Event System Imports (CommonJS) ===
const { loadAllGameData } = require("./server/loadData.js");
const { startEventScheduler } = require("./server/eventsScheduler.js");
const { createEventsRouter } = require("./server/eventsRoutes.js");

// === bs58 fix for Node 20+ ===
const bs58pkg = require("bs58");
const bs58 = bs58pkg.default || bs58pkg;

const {
  Connection,
  Keypair,
  PublicKey,
} = require("@solana/web3.js");

const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} = require("@solana/spl-token");

const { Metaplex } = require("@metaplex-foundation/js");

// === Required ENV Vars ===
const requiredEnv = [
  "SOLANA_RPC",
  "TOKEN_MINT",
  "GAME_VAULT_SECRET",
  "REDIS_URL",
  "SERVER_SECRET_KEY",
];

const missing = requiredEnv.filter(v => !process.env[v]);
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

// === Solana + Redis Setup ===
const connection = new Connection(SOLANA_RPC, "confirmed");
const MINT_PUBKEY = new PublicKey(TOKEN_MINT);
const GAME_VAULT = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(GAME_VAULT_SECRET))
);
const COOLDOWN = Number(COOLDOWN_SECONDS);
const redis = new Redis(REDIS_URL);

redis.on("error", (err) => console.error("Redis error:", err));

// === Server Ed25519 Keypair ===
const serverSecretKeyUint8 = bs58.decode(SERVER_SECRET_KEY);
if (serverSecretKeyUint8.length !== 64) {
  console.error("SERVER_SECRET_KEY must be a 64-byte Ed25519 secret key (base58)");
  process.exit(1);
}
const serverKeypair = nacl.sign.keyPair.fromSecretKey(serverSecretKeyUint8);
const SERVER_PUBKEY = bs58.encode(serverKeypair.publicKey);

// === Donation Wallet ===
const DONATION_WALLET = "GtW88raUHJmcFyqDviE1ZNsQxNpZ5US7TMGf5dzac42u";
let DONATION_PUBKEY;
try {
  DONATION_PUBKEY = new PublicKey(DONATION_WALLET);
} catch (e) {
  console.error("Invalid DONATION_WALLET public key:", e);
  process.exit(1);
}

// === Data Loading (legacy JSONs for API endpoints) ===
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

// === Express App ===
const app = express();
app.use(morgan("combined"));

// === Load Game Data + Start Event Scheduler + Mount Event Routes ===
const gameData = loadAllGameData();
console.log("Loaded mintables:", gameData.mintables.length);
console.log("Loaded events:", gameData.events.length);
console.log("Loaded loot tables:", gameData.eventLootTables.length);
console.log("Loaded quests:", gameData.quests.length);
console.log("Loaded locations:", gameData.locations.length);

startEventScheduler(gameData);
app.use("/events", createEventsRouter(gameData));

// === CSP / Security ===
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
        "https://*.basemaps.cartocdn.com"
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

// === Rate Limits ===
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

// === Bot Shield ===
async function botShield(req, res, next) {
  try {
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = (ipHeader ? ipHeader.split(",")[0].trim() : req.ip) || "unknown";
    const ua = (req.headers["user-agent"] || "").slice(0, 200);

    const ipKey = `rep:ip:${ip}`;
    const uaKey = `rep:ua:${ua || "none"}`;

    const [ipScore, uaScore] = await Promise.all([
      redis.incr(ipKey),
      redis.incr(uaKey),
    ]);

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

// === Static Files ===
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === ".js") {
      res.setHeader("Content-Type", "application/javascript");
    }
  }
}));

// === Basic Data Endpoints ===
app.get("/locations", (req, res) => res.json(LOCATIONS));
app.get("/quests", (req, res) => res.json(QUESTS));
app.get("/mintables", (req, res) => res.json(MINTABLES));

// === Player Data ===
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
app.post("/api/terminal-reward", [
  body("wallet").isString().notEmpty(),
  body("amount").isInt({ min: 1 }),
], async (req, res) => {
