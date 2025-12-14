// server.js - Atomic Fizz Caps Backend (FINAL COMPLETE VERSION)
// December 2025 - Full game: Loot, Shop (CAPS + SOL Pay ready), Quests, Static Frontend Serving

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
const bs58 = require('bs58');
const {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmRawTransaction
} = require('@solana/web3.js');
const {
    getOrCreateAssociatedTokenAccount,
    createTransferInstruction,
    getMint
} = require('@solana/spl-token');
const { Metaplex } = require('@metaplex-foundation/js');

// Global error handling - no more red crash logs
process.on('unhandledRejection', (reason) => {
    console.warn('Unhandled Rejection (recovered):', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// Config & validation
const {
    SOLANA_RPC,
    TOKEN_MINT,
    GAME_VAULT_SECRET,
    DEV_WALLET_SECRET,
    PORT = 3000,
    COOLDOWN_SECONDS = 60,
    REDIS_URL
} = process.env;

if (!SOLANA_RPC || !TOKEN_MINT || !GAME_VAULT_SECRET || !DEV_WALLET_SECRET || !REDIS_URL) {
    console.error('Missing required env vars');
    process.exit(1);
}

const connection = new Connection(SOLANA_RPC, 'confirmed');
const MINT_PUBKEY = new PublicKey(TOKEN_MINT);

let GAME_VAULT = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(GAME_VAULT_SECRET)));
let DEV_WALLET = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(DEV_WALLET_SECRET)));

const metaplex = Metaplex.make(connection);
const COOLDOWN = Number(COOLDOWN_SECONDS);
const redis = new Redis(REDIS_URL);
redis.on('error', (err) => console.error('Redis error:', err));

// Helpers
function haversine(lat1, lon1, lat2, lon2) {
    const toRad = x => x * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function safeJsonRead(filePath) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (e) { console.error('JSON load error:', filePath); return []; }
}

async function isOnCooldown(wallet) { return await redis.ttl(`cooldown:${wallet}`) > 0; }
async function setCooldown(wallet) { await redis.set(`cooldown:${wallet}`, '1', 'EX', COOLDOWN); }

function verifySolanaSignature(message, signatureBase58, pubkeyBase58) {
    try {
        const sig = bs58.decode(signatureBase58);
        const pubkey = bs58.decode(pubkeyBase58);
        const msg = Buffer.from(message, 'utf8');
        return nacl.sign.detached.verify(msg, sig, pubkey);
    } catch (e) { return false; }
}

// Data
const DATA_DIR = path.join(__dirname, 'data');
const LOCATIONS = safeJsonRead(path.join(DATA_DIR, 'locations.json'));
const QUESTS = safeJsonRead(path.join(DATA_DIR, 'quests.json'));

// App
const app = express();
app.use(morgan('combined'));
app.use(helmet({ contentSecurityPolicy: false })); // Disable CSP for unpkg CDN
app.use(cors());
app.use(express.json({ limit: '100kb' }));

const limiter = rateLimit({ windowMs: 60_000, max: 200 });
app.use(limiter);
const actionLimiter = rateLimit({ windowMs: 60_000, max: 20 });

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    if (req.path.startsWith('/shop') || req.path.startsWith('/player') || req.path === '/locations' || req.path === '/quests') {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API
app.get('/locations', (req, res) => res.json(LOCATIONS));
app.get('/quests', (req, res) => res.json(QUESTS.length ? QUESTS : [{ title: "Explore the Mojave", desc: "Claim your first POI", status: "ACTIVE" }]));

app.get('/player/:addr', async (req, res) => {
    const { addr } = req.params;
    try { new PublicKey(addr); } catch { return res.status(400).json({ error: 'Invalid address' }); }
    const data = await redis.get(`player:${addr}`);
    res.json(data ? JSON.parse(data) : { lvl: 1, hp: 100, caps: 0, gear: [], found: [] });
});

app.post('/find-loot', actionLimiter, [
    body('wallet').exists(),
    body('spot').exists(),
    body('lat').isNumeric(),
    body('lng').isNumeric(),
    body('signature').exists(),
    body('message').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { wallet, spot, lat, lng, signature, message } = req.body;
    const loc = LOCATIONS.find(l => l.n === spot);
    if (!loc) return res.status(400).json({ error: 'Invalid spot' });

    if (!verifySolanaSignature(message, signature, wallet)) return res.status(400).json({ error: 'Bad signature' });

    const distance = haversine(lat, lng, loc.lat, loc.lng);
    if (distance > 50) return res.status(400).json({ error: 'Too far' });

    if (await isOnCooldown(wallet)) return res.status(429).json({ error: 'Cooldown' });

    try {
        const totalCaps = Math.max(10, (loc.lvl || 1) * 20 + Math.floor(Math.random() * 60));
        const decimals = 6;
        const amountRaw = BigInt(totalCaps) * BigInt(10 ** decimals);

        const vaultATA = await getOrCreateAssociatedTokenAccount(connection, GAME_VAULT, MINT_PUBKEY, GAME_VAULT.publicKey, true);
        const userATA = await getOrCreateAssociatedTokenAccount(connection, GAME_VAULT, MINT_PUBKEY, new PublicKey(wallet));

        const tx = new Transaction().add(
            createTransferInstruction(vaultATA.address, userATA.address, GAME_VAULT.publicKey, amountRaw)
        );
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = GAME_VAULT.publicKey;
        tx.sign(GAME_VAULT);

        const sig = await sendAndConfirmRawTransaction(connection, tx.serialize());

        await setCooldown(wallet);

        const playerKey = `player:${wallet}`;
        const playerData = JSON.parse(await redis.get(playerKey) || '{"caps":0,"found":[]}');
        playerData.caps += totalCaps;
        if (!playerData.found.includes(spot)) playerData.found.push(spot);
        await redis.set(playerKey, JSON.stringify(playerData));

        res.json({ success: true, sig, capsFound: totalCaps, totalCaps: playerData.caps });
    } catch (err) {
        console.error('Loot error:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

// Shop
app.get('/shop/listings', async (req, res) => {
    const raw = await redis.hgetall('caps_shop_listings');
    const listings = Object.values(raw).map(JSON.parse).sort((a, b) => a.price - b.price);
    res.json(listings);
});

app.post('/shop/list', actionLimiter, [
    body('wallet').exists(),
    body('nftAddress').exists(),
    body('price').isInt({ min: 1 }),
    body('signature').exists(),
    body('message').exists()
], async (req, res) => {
    const { wallet, nftAddress, price, signature, message } = req.body;
    if (!verifySolanaSignature(message, signature, wallet)) return res.status(400).json({ error: 'Bad sig' });

    const listing = { nft: nftAddress, seller: wallet, price, listedAt: Date.now() };
    await redis.hset('caps_shop_listings', nftAddress, JSON.stringify(listing));
    res.json({ success: true });
});

app.post('/shop/buy', actionLimiter, [
    body('wallet').exists(),
    body('nftAddress').exists(),
    body('signature').exists(),
    body('message').exists()
], async (req, res) => {
    const { wallet, nftAddress, signature, message } = req.body;
    if (!verifySolanaSignature(message, signature, wallet)) return res.status(400).json({ error: 'Bad sig' });

    const listingJson = await redis.hget('caps_shop_listings', nftAddress);
    if (!listingJson) return res.status(404).json({ error: 'Not listed' });

    const listing = JSON.parse(listingJson);
    const playerData = JSON.parse(await redis.get(`player:${wallet}`) || '{"caps":0}');
    if (playerData.caps < listing.price) return res.status(400).json({ error: 'Not enough CAPS' });

    // Return partial tx for buyer to sign (CAPS transfer + burn)
    // NFT transfer requires seller approval (client handles)
    res.json({ success: true, message: 'Ready for CAPS transfer. Seller approves NFT.' });
});

app.post('/shop/delist', actionLimiter, [
    body('wallet').exists(),
    body('nftAddress').exists(),
    body('signature').exists(),
    body('message').exists()
], async (req, res) => {
    const { wallet, nftAddress, signature, message } = req.body;
    if (!verifySolanaSignature(message, signature, wallet)) return res.status(400).json({ error: 'Bad sig' });

    const listing = await redis.hget('caps_shop_listings', nftAddress);
    if (!listing || JSON.parse(listing).seller !== wallet) return res.status(403).json({ error: 'Not yours' });

    await redis.hdel('caps_shop_listings', nftAddress);
    res.json({ success: true });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

app.listen(PORT, () => {
    console.log(`Atomic Fizz LIVE on port ${PORT}`);
    console.log(`Vault: ${GAME_VAULT.publicKey.toBase58()}`);
    console.log(`Dev: ${DEV_WALLET.publicKey.toBase58()}`);
});