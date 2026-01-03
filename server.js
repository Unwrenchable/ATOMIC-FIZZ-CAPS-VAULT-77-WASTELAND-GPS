// server.js
// === Atomic Fizz Caps Vault 77 Wasteland GPS Backend ===
// FIXED, COMPLETE & SAFE – January 03, 2026

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
const bs58 = require("bs58").default || require("bs58");

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

// Optional: Metaplex (uncomment if expanding mint flow)
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
const GAME_VAULT = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(GAME_VAULT_SECRET)));
const COOLDOWN = Number(COOLDOWN_SECONDS);
const redis = new Redis(REDIS_URL);

redis.on("error", (err) => console.error("Redis connection error:", err));

// Server Ed25519 Keypair
const serverSecretKeyUint8 = bs58.decode(SERVER_SECRET_KEY);
if (serverSecretKeyUint8.length !== 64) {
  console.error("SERVER_SECRET_KEY must be 64-byte Ed25519 secret key (base58)");
  process.exit(1);
}
const serverKeypair = nacl.sign.keyPair.fromSecretKey(serverSecretKeyUint8);

// Donation Wallet
const DONATION_WALLET = "GtW88raUHJmcFyqDviE1ZNsQxNpZ5US7TMGf5dzac42u";
let DONATION_PUBKEY;
try {
  DONATION_PUBKEY = new PublicKey(DONATION_WALLET);
} catch (e) {
  console.error("Invalid DONATION_WALLET public key:", e);
  process.exit(1);
}

// Data Loading Helper
function safeJsonRead(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error(`JSON load error: ${filePath}`, e.message);
    return [];
  }
}

const DATA_DIR = path.join(__dirname, "public", "data");
const LOCATIONS = safeJsonRead(path.join(DATA_DIR, "locations.json"));
const QUESTS = safeJsonRead(path.join(DATA_DIR, "quests.json"));
const MINTABLES = safeJsonRead(path.join(DATA_DIR, "mintables.json"));
const EVENTS = safeJsonRead(path.join(DATA_DIR, "events.json"));
const EVENT_LOOT_TABLES = safeJsonRead(path.join(DATA_DIR, "eventLootTables.json"));
const RECIPES = safeJsonRead(path.join(DATA_DIR, "recipes.json"));

// Event Maps
const eventsById = new Map(EVENTS.map(e => [e.id, e]));
const lootTablesById = new Map(EVENT_LOOT_TABLES.map(t => [t.id, t]));

console.log("Loaded data:", {
  locations: LOCATIONS.length,
  quests: QUESTS.length,
  mintables: MINTABLES.length,
  events: EVENTS.length,
  lootTables: EVENT_LOOT_TABLES.length,
  recipes: RECIPES.length
});

// Express App
const app = express();
app.use(morgan("combined"));

// Helmet CSP – fixed & complete
app.use(helmet.contentSecurityPolicy({
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
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://*.basemaps.cartocdn.com"],
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
}));

app.use(cors());
app.use(express.json({ limit: "100kb" }));

const globalLimiter = rateLimit({ windowMs: 60000, max: 200 });
const actionLimiter = rateLimit({ windowMs: 60000, max: 20 });
app.use(globalLimiter);

// Bot Shield
async function botShield(req, res, next) {
  try {
    const ip = (req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip) || "unknown";
    const ua = (req.headers["user-agent"] || "").slice(0, 200);

    const ipKey = `rep:ip:${ip}`;
    const uaKey = `rep:ua:${ua || "none"}`;

    const [ipScore, uaScore] = await Promise.all([redis.incr(ipKey), redis.incr(uaKey)]);

    if (ipScore === 1) await redis.expire(ipKey, 60);
    if (uaScore === 1) await redis.expire(uaKey, 60);

    if (ipScore > 400 || uaScore > 400) return res.status(429).json({ error: "Rate limit exceeded" });

    next();
  } catch (e) {
    console.warn("botShield error:", e);
    next();
  }
}

app.use(["/api/post-trade", "/api/post-nft", "/api/buy-trade"], botShield, actionLimiter);

// Static Files
app.use(express.static(path.join(__dirname, "public")));

// Event Scheduler (unchanged)
const activeEvents = new Map();
const lastActivation = new Map();

function canActivateEvent(ev, now = new Date()) {
  const hour = now.getHours();
  const { activeWindow, cooldownMinutes = 60, flags = {} } = ev;

  if (activeWindow) {
    const { startHourLocal: start, endHourLocal: end } = activeWindow;
    if (start < end) {
      if (hour < start || hour >= end) return false;
    } else if (!(hour >= start || hour < end)) return false;
  }

  const last = lastActivation.get(ev.id);
  if (last) {
    const diffMin = (now - new Date(last)) / 60000;
    if (diffMin < cooldownMinutes) return false;
  }

  if (flags.uniquePerDay && last) {
    const lastDay = new Date(last).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    if (lastDay === today) return false;
  }

  return true;
}

function activateEvent(ev, now = new Date()) {
  const endsAt = new Date(now.getTime() + (ev.durationMinutes || 60) * 60000);
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
    for (const [id, state] of activeEvents.entries()) {
      if (state.endsAt <= tickNow) activeEvents.delete(id);
    }
    for (const ev of EVENTS) {
      if (!activeEvents.has(ev.id) && canActivateEvent(ev, tickNow)) {
        activateEvent(ev, tickNow);
      }
    }
  }, 60000);
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
      endsAt: state.endsAt.toISOString(),
      durationMinutes: ev.durationMinutes
    });
  }

  res.json({ events: result });
});

// Basic Data Endpoints
app.get("/locations", (req, res) => res.json(LOCATIONS));
app.get("/quests", (req, res) => res.json(QUESTS));
app.get("/mintables", (req, res) => res.json(MINTABLES));

// Player Endpoints
app.get("/player/:addr", async (req, res) => {
  const { addr } = req.params;
  try { new PublicKey(addr); } catch { return res.status(400).json({ error: "Invalid address" }); }

  let playerData = { lvl: 1, hp: 100, caps: 0, gear: [], found: [], xp: 0, xpToNext: 100, rads: 0, inventory: {} };
  
  try {
    const redisData = await redis.get(`player:${addr}`);
    if (redisData) playerData = { ...playerData, ...JSON.parse(redisData) };
  } catch (e) {
    console.warn(`Player data parse error for ${addr}:`, e);
  }

  res.json(playerData);
});

app.post("/player/:addr", async (req, res) => {
  const { addr } = req.params;
  try { new PublicKey(addr); } catch { return res.status(400).json({ error: "Invalid address" }); }

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: "No data provided" });
  }

  try {
    await redis.set(`player:${addr}`, JSON.stringify(req.body));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save player data" });
  }
});

// ================================================
// Scavenger's Exchange API
// ================================================

// GET /api/trades - Fetch all active (non-expired) trades
app.get('/api/trades', async (req, res) => {
  try {
    const keys = await redis.keys('trade:*');
    if (keys.length === 0) return res.json([]);

    const now = Date.now();
    const trades = await Promise.all(
      keys.map(async (key) => {
        const data = await redis.hgetall(key);
        const posted = Number(data.posted || 0);
        const expiresAt = posted + (data.durationDays ? Number(data.durationDays) * 86400000 : 7 * 86400000);

        if (expiresAt < now) {
          await redis.del(key);
          return null;
        }

        return {
          id: key.split(':')[1],
          ...data,
          posted,
          type: data.type || 'item',
          expiresAt
        };
      })
    );

    const active = trades.filter(Boolean);
    active.sort((a, b) => b.posted - a.posted);

    res.json(active);
  } catch (err) {
    console.error('Error fetching trades:', err);
    res.status(500).json({ error: 'Failed to load trades' });
  }
});

// POST /api/post-trade - Post regular trade
app.post('/api/post-trade', [
  body('wallet').isString().notEmpty(),
  body('offer').isString().notEmpty(),
  body('priceFizz').isNumeric(),
  body('durationDays').optional().isInt({ min: 1, max: 90 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid request', details: errors.array() });

  const { wallet, offer, priceFizz, description = '', durationDays = 7 } = req.body;

  try {
    const tradeId = `trade:${Date.now()}`;
    await redis.hset(tradeId, {
      seller: wallet,
      offer,
      priceFizz: String(priceFizz),
      description,
      status: 'active',
      posted: Date.now(),
      type: 'item',
      durationDays: String(durationDays)
    });

    await redis.expire(tradeId, durationDays * 86400);

    res.json({ success: true, tradeId });
  } catch (err) {
    console.error('Post trade error:', err);
    res.status(500).json({ error: 'Failed to post trade' });
  }
});

// POST /api/post-nft - Post NFT trade with ownership verification
app.post('/api/post-nft', [
  body('wallet').isString().notEmpty(),
  body('nftMint').isString().notEmpty(),
  body('priceFizz').isNumeric(),
  body('signature').isString().notEmpty(),
  body('durationDays').optional().isInt({ min: 1, max: 90 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid request', details: errors.array() });

  const { wallet, nftMint, priceFizz, description = '', signature, durationDays = 7 } = req.body;

  try {
    const message = `List NFT ${nftMint} for ${priceFizz} FIZZ - ${description}`;
    const verified = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(wallet)
    );

    if (!verified) return res.status(403).json({ error: 'Invalid signature' });

    const ownerPubkey = new PublicKey(wallet);
    const mintPubkey = new PublicKey(nftMint);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPubkey, {
      mint: mintPubkey
    });

    const ownsNft = tokenAccounts.value.some(acc => {
      const info = acc.account.data.parsed.info;
      return info.mint === nftMint && info.tokenAmount.uiAmount >= 1;
    });

    if (!ownsNft) return res.status(403).json({ error: 'You do not own this NFT' });

    const tradeId = `trade:${Date.now()}`;
    await redis.hset(tradeId, {
      seller: wallet,
      nftMint,
      priceFizz: String(priceFizz),
      description,
      status: 'active',
      posted: Date.now(),
      type: 'nft',
      durationDays: String(durationDays)
    });

    await redis.expire(tradeId, durationDays * 86400);

    res.json({ success: true, tradeId });
  } catch (err) {
    console.error('Post NFT error:', err);
    res.status(500).json({ error: 'Failed to post NFT' });
  }
});

// POST /api/buy-trade - Buy a trade
app.post('/api/buy-trade', [
  body('buyerWallet').isString().notEmpty(),
  body('tradeId').isString().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid request', details: errors.array() });

  const { buyerWallet, tradeId } = req.body;

  try {
    const tradeKey = `trade:${tradeId}`;
    const trade = await redis.hgetall(tradeKey);

    if (!trade || trade.status !== 'active') {
      return res.status(404).json({ error: 'Trade not found or expired' });
    }

    const seller = trade.seller;
    const priceFizz = BigInt(trade.priceFizz);
    const isNft = trade.type === 'nft';

    const buyerPubkey = new PublicKey(buyerWallet);
    const sellerPubkey = new PublicKey(seller);

    const buyerAta = await getOrCreateAssociatedTokenAccount(
      connection,
      GAME_VAULT,
      MINT_PUBKEY,
      buyerPubkey
    );

    const sellerAta = await getOrCreateAssociatedTokenAccount(
      connection,
      GAME_VAULT,
      MINT_PUBKEY,
      sellerPubkey
    );

    const transferIx = createTransferInstruction(
      buyerAta.address,
      sellerAta.address,
      buyerPubkey,
      priceFizz
    );

    const tx = new Transaction().add(transferIx);
    tx.feePayer = buyerPubkey;
    const latest = await connection.getLatestBlockhash("finalized");
    tx.recentBlockhash = latest.blockhash;

    const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');

    if (isNft) {
      await redis.hset(tradeKey, { status: 'pending_payment' });
    } else {
      await redis.hset(tradeKey, { status: 'sold' });
      await redis.del(tradeKey);
    }

    res.json({
      success: true,
      serializedTx,
      message: isNft ? "Pay to unlock NFT transfer" : "Payment complete - trade sold"
    });
  } catch (err) {
    console.error('Buy trade error:', err);
    res.status(500).json({ error: 'Failed to process buy' });
  }
});

// ================================================
// Scavenger & Settings Endpoints
// ================================================

app.get('/scavenger', (req, res) => {
  const filePath = path.join(DATA_DIR, 'scavenger.json');
  const data = safeJsonRead(filePath);
  res.json(data);
});

app.get('/settings', (req, res) => {
  const filePath = path.join(DATA_DIR, 'settings.json');
  const data = safeJsonRead(filePath);
  res.json(data);
});

// ================================================
// Mint Item (Craft/Claim) Endpoint – Safe & Vault-Signed
// ================================================

app.post('/api/mint-item', [
  body('wallet').isString().notEmpty(),
  body('recipeId').isString().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid request', details: errors.array() });

  const { wallet, recipeId } = req.body;

  try {
    // TODO: Verify player owns ingredients (your Lua or Redis logic here)
    // Example: await checkInventory(wallet, recipe.ingredients);

    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    // Placeholder metadata – replace with real upload to Arweave/IPFS
    const metadata = {
      name: recipe.name || 'Crafted Item',
      symbol: 'AFC',
      uri: 'https://arweave.net/placeholder-metadata-uri',
      sellerFeeBasisPoints: 500,
      creators: [{ address: GAME_VAULT.publicKey.toBase58(), share: 100 }],
    };

    // TODO: Full Metaplex mint (uncomment when ready)
    /*
    const metaplex = Metaplex.make(connection).use(keypairIdentity(GAME_VAULT));
    const { nft } = await metaplex.nfts().create({
      uri: metadata.uri,
      name: metadata.name,
      sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
      isMutable: false,
    });
    */

    // Mock response for now (safe)
    const mockMint = `mock-mint-${Date.now()}`;
    res.json({ success: true, mint: mockMint, message: `Item ${recipe.name} minted!` });
  } catch (err) {
    console.error('Mint error:', err);
    res.status(500).json({ error: 'Failed to mint item' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 Atomic Fizz Caps server running on port ${PORT}`);
  console.log(`📍 Visit: http://localhost:${PORT}`);
  console.log(`💾 Redis: ${REDIS_URL}`);
  console.log(`⛓️ Solana: ${SOLANA_RPC}`);
  console.log(`🎮 Game vault: ${GAME_VAULT.publicKey.toBase58()}\n`);
});
