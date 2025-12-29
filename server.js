require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const Redis = require('ioredis');
const nacl = require('tweetnacl');

// === FIXED bs58 import for Node 20 ===
const bs58pkg = require('bs58');
const bs58 = bs58pkg.default || bs58pkg;

const {
  Connection,
  Keypair,
  PublicKey,
} = require('@solana/web3.js');

const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} = require('@solana/spl-token');

const { Metaplex } = require('@metaplex-foundation/js');

// === Required ENV Vars ===
const requiredEnv = [
  'SOLANA_RPC',
  'TOKEN_MINT',
  'GAME_VAULT_SECRET',
  'REDIS_URL',
  'SERVER_SECRET_KEY',
];

const missing = requiredEnv.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
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
const connection = new Connection(SOLANA_RPC, 'confirmed');
const MINT_PUBKEY = new PublicKey(TOKEN_MINT);
const GAME_VAULT = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(GAME_VAULT_SECRET))
);
const COOLDOWN = Number(COOLDOWN_SECONDS);
const redis = new Redis(REDIS_URL);

redis.on('error', (err) => console.error('Redis error:', err));

// === Server Ed25519 Keypair ===
const serverSecretKeyUint8 = bs58.decode(SERVER_SECRET_KEY);
if (serverSecretKeyUint8.length !== 64) {
  console.error('SERVER_SECRET_KEY must be a 64-byte Ed25519 secret key (base58)');
  process.exit(1);
}

const serverKeypair = nacl.sign.keyPair.fromSecretKey(serverSecretKeyUint8);
const SERVER_PUBKEY = bs58.encode(serverKeypair.publicKey);

// === Donation Wallet ===
const DONATION_WALLET = 'GtW88raUHJmcFyqDviE1ZNsQxNpZ5US7TMGf5dzac42u';
let DONATION_PUBKEY;
try {
  DONATION_PUBKEY = new PublicKey(DONATION_WALLET);
} catch (e) {
  console.error('Invalid DONATION_WALLET public key:', e);
  process.exit(1);
}

// === Data Loading ===
function safeJsonRead(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('JSON load error:', filePath, e);
    return [];
  }
}

const DATA_DIR = path.join(__dirname, 'data');
const LOCATIONS = safeJsonRead(path.join(DATA_DIR, 'locations.json'));
const QUESTS = safeJsonRead(path.join(DATA_DIR, 'quests.json'));
const MINTABLES = safeJsonRead(path.join(DATA_DIR, 'mintables.json'));

// === Scavenger Marketplace (in-memory v1, Redis v2) ===
let scavengerListings = [];
let nextListingId = 1;

function shortWallet(addr) {
  if (!addr || addr.length < 8) return 'unknown';
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

// === Express App ===
const app = express();
app.use(morgan('combined'));

// === FIXED CSP (Render-safe, Wallet-safe, Map-safe) ===
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", SOLANA_RPC, "https://unpkg.com", "https://cdn.jsdelivr.net", "wss:"],
        mediaSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        frameSrc: ["'self'"],
      },
    },
  })
);

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// === Rate Limits ===
const globalLimiter = rateLimit({ windowMs: 60_000, max: 200 });
const actionLimiter = rateLimit({ windowMs: 60_000, max: 20 });
app.use(globalLimiter);

// === Bot Shield ===
async function botShield(req, res, next) {
  try {
    const ipHeader = req.headers['x-forwarded-for'];
    const ip = (ipHeader ? ipHeader.split(',')[0].trim() : req.ip) || 'unknown';
    const ua = (req.headers['user-agent'] || '').slice(0, 200);

    const ipKey = `rep:ip:${ip}`;
    const uaKey = `rep:ua:${ua || 'none'}`;

    const [ipScore, uaScore] = await Promise.all([
      redis.incr(ipKey),
      redis.incr(uaKey),
    ]);

    if (ipScore === 1) await redis.expire(ipKey, 60);
    if (uaScore === 1) await redis.expire(uaKey, 60);

    if (ipScore > 400 || uaScore > 400) {
      return res.status(429).json({ error: 'Too many actions, slow down.' });
    }

    next();
  } catch (e) {
    console.warn('botShield error:', e);
    next();
  }
}

app.use(
  ['/find-loot', '/shop', '/battle', '/terminal-reward', '/claim-voucher'],
  botShield,
  actionLimiter
);

// === Static Files with MIME-type fix for .js (fixes 415 on Render) ===
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === '.js') {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Optional: log 404s for static files to help debug
app.use((req, res, next) => {
  if (req.method === 'GET' && !res.headersSent) {
    console.log(`Static file not found: ${req.path}`);
  }
  next();
});

// === Basic Data Endpoints ===
app.get('/locations', (req, res) => res.json(LOCATIONS));
app.get('/quests', (req, res) => res.json(QUESTS));
app.get('/mintables', (req, res) => res.json(MINTABLES));

// === Player Data ===
app.get('/player/:addr', async (req, res) => {
  const { addr } = req.params;

  try { new PublicKey(addr); }
  catch { return res.status(400).json({ error: 'Invalid address' }); }

  let playerData = {
    lvl: 1,
    hp: 100,
    caps: 0,
    gear: [],
    found: [],
    xp: 0,
    xpToNext: 100,
    rads: 0,
  };

  const redisData = await redis.get(`player:${addr}`);
  if (redisData) playerData = JSON.parse(redisData);

  try {
    const metaplex = Metaplex.make(connection);
    await metaplex.nfts().findAllByOwner({ owner: new PublicKey(addr) });
  } catch (e) {
    console.warn('NFT fetch failed:', e);
  }

  res.json(playerData);
});

app.post('/player/:addr', async (req, res) => {
  const { addr } = req.params;
  await redis.set(`player:${addr}`, JSON.stringify(req.body));
  res.json({ success: true });
});

// === Terminal Reward ===
app.post('/api/terminal-reward', [
  body('wallet').isString().notEmpty(),
  body('amount').isInt({ min: 1 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { wallet, amount } = req.body;

  try { new PublicKey(wallet); }
  catch { return res.status(400).json({ error: 'Invalid wallet' }); }

  let playerData = { caps: 0 };
  const data = await redis.get(`player:${wallet}`);
  if (data) playerData = JSON.parse(data);

  playerData.caps = (playerData.caps || 0) + Number(amount);
  await redis.set(`player:${wallet}`, JSON.stringify(playerData));

  res.json({ success: true, newCaps: playerData.caps });
});

// === Battle Placeholder ===
app.post('/battle', [
  body('wallet').notEmpty(),
  body('gearPower').isInt({ min: 1 }),
  body('signature').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  res.json({ success: true, result: 'Battle logic placeholder' });
});

// === Claim Voucher ===
app.post('/claim-voucher', [
  body('wallet').isString().notEmpty(),
  body('loot_id').isInt({ min: 1 }),
  body('latitude').isFloat(),
  body('longitude').isFloat(),
  body('timestamp').isInt(),
  body('location_hint').isString().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { wallet, loot_id, latitude, longitude, timestamp, location_hint } = req.body;

  try { new PublicKey(wallet); }
  catch { return res.status(400).json({ error: 'Invalid wallet' }); }

  const lastClaim = await redis.get(`claim_cooldown:${wallet}`);
  if (lastClaim && Date.now() - Number(lastClaim) < COOLDOWN * 1000) {
    return res.status(429).json({ error: 'Cooldown active' });
  }

  const message = serializeLootVoucher({
    loot_id: Number(loot_id),
    latitude,
    longitude,
    timestamp: Number(timestamp),
    location_hint,
  });

  const signature = nacl.sign.detached(message, serverKeypair.secretKey);

  await redis.set(`claim_cooldown:${wallet}`, Date.now());

  res.json({
    success: true,
    voucher: {
      loot_id: Number(loot_id),
      latitude,
      longitude,
      timestamp: Number(timestamp),
      location_hint,
      server_signature: Array.from(signature),
    },
    server_pubkey: SERVER_PUBKEY,
  });
});

// === Simple Claim Endpoint (frontend expects /api/claim) ===
app.post('/api/claim', async (req, res) => {
  const { wallet } = req.body;

  if (!wallet) {
    return res.status(400).json({ error: 'Missing wallet' });
  }

  console.log(`[CLAIM] Wallet ${wallet} requested a claim.`);

  // v1: off-chain success, later can hook into claim-voucher / on-chain logic
  return res.json({
    ok: true,
    message: 'Claim successful. Loot recorded.',
    loot: {
      capsReward: 100,
      items: [
        { id: 'test-crate', name: 'Atomic Test Crate', rarity: 'rare' }
      ]
    }
  });
});

// === Simple Mint Endpoint (frontend expects /api/mint) ===
app.post('/api/mint', async (req, res) => {
  const { wallet, itemId } = req.body;

  if (!wallet) {
    return res.status(400).json({ error: 'Missing wallet' });
  }

  console.log(`[MINT] Wallet ${wallet} requested mint for item: ${itemId}`);

  // v1: simulate mint; v2 can use Metaplex + GAME_VAULT
  return res.json({
    ok: true,
    message: `Mint request accepted for ${shortWallet(wallet)}.`,
    itemId: itemId || null,
    fakeTxSignature: 'FAKE_TX_' + Date.now(),
  });
});

// === Scavenger Marketplace Endpoints ===

// Get all listings
app.get('/api/scavengers/listings', (req, res) => {
  res.json({ listings: scavengerListings });
});

// Create a listing
app.post('/api/scavengers/list', async (req, res) => {
  const { wallet, name, priceCaps } = req.body;

  if (!wallet || !name || priceCaps === undefined) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const priceNumber = Number(priceCaps);
  if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
    return res.status(400).json({ error: 'Invalid priceCaps' });
  }

  const listing = {
    id: nextListingId++,
    name,
    priceCaps: priceNumber,
    seller: wallet,
    sellerShort: shortWallet(wallet),
    createdAt: new Date().toISOString(),
  };

  scavengerListings.push(listing);

  console.log(`[SCAV-LIST] ${wallet} listed ${name} for ${priceNumber} CAPS`);

  res.json({ ok: true, listing });
});

// Buy a listing
app.post('/api/scavengers/buy', async (req, res) => {
  const { wallet, listingId } = req.body;

  if (!wallet || listingId === undefined) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const idNum = Number(listingId);
  if (!Number.isInteger(idNum)) {
    return res.status(400).json({ error: 'Invalid listingId' });
  }

  const idx = scavengerListings.findIndex(l => l.id === idNum);
  if (idx === -1) {
    return res.status(404).json({ error: 'Listing not found' });
  }

  const listing = scavengerListings[idx];
  scavengerListings.splice(idx, 1);

  console.log(`[SCAV-BUY] ${wallet} bought ${listing.name} for ${listing.priceCaps} CAPS from ${listing.seller}`);

  // v2: hook Solana transfers here
  res.json({
    ok: true,
    message: 'Purchase successful.',
    listing,
  });
});

// === Funding Endpoint ===
app.get('/funding', (req, res) => {
  res.json({
    success: true,
    donation_wallet: DONATION_WALLET,
    network: 'solana',
    ui_hint: {
      title: 'Support Vault 77 Operations',
      description: 'Send a few caps (SOL) to keep the Wasteland GPS online.',
      suggested_unit: 'SOL',
    },
  });
});

// === Voucher Serialization ===
function serializeLootVoucher(v) {
  const buf = Buffer.alloc(200);
  let offset = 0;

  buf.writeBigUInt64LE(BigInt(v.loot_id), offset); offset += 8;
  buf.writeDoubleLE(v.latitude, offset); offset += 8;
  buf.writeDoubleLE(v.longitude, offset); offset += 8;
  buf.writeBigInt64LE(BigInt(v.timestamp), offset); offset += 8;

  const hintBytes = Buffer.from(v.location_hint, 'utf8');
  buf.writeUInt32LE(hintBytes.length, offset); offset += 4;
  hintBytes.copy(buf, offset); offset += hintBytes.length;

  return buf.slice(0, offset);
}

// === SPA Catch-all (must be LAST) ===
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// === Start Server ===
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Atomic Fizz Caps Server LIVE on port ${PORT}`);
  console.log(`Vault: ${GAME_VAULT.publicKey.toBase58()}`);
  console.log(`Server signing key: ${SERVER_PUBKEY}`);
  console.log(`Donation wallet: ${DONATION_WALLET}`);
  console.log('WASTELAND GPS ONLINE ☢️');
});

process.on('unhandledRejection', (r) => console.warn('Unhandled Rejection:', r));
process.on('uncaughtException', (e) => console.error('Uncaught Exception:', e));
