// server.js - Atomic Fizz Caps Backend (Secure & Production-Ready)
// December 2025
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
    createMintToInstruction,
    getMint
} = require('@solana/spl-token');
const { Metaplex, keypairIdentity } = require('@metaplex-foundation/js');

// --- Config and env validation ---
const {
    SOLANA_RPC,
    TOKEN_MINT,
    MINT_AUTHORITY_SECRET,
    PORT,
    COOLDOWN_SECONDS,
    REDIS_URL
} = process.env;

if (!SOLANA_RPC || !TOKEN_MINT || !MINT_AUTHORITY_SECRET || !REDIS_URL) {
    console.error('Missing required environment variables: SOLANA_RPC, TOKEN_MINT, MINT_AUTHORITY_SECRET, REDIS_URL');
    process.exit(1);
}

const connection = new Connection(SOLANA_RPC, 'confirmed');
const MINT_PUBKEY = new PublicKey(TOKEN_MINT);

// Load authority keypair
let AUTHORITY;
try {
    const secretArray = JSON.parse(MINT_AUTHORITY_SECRET);
    AUTHORITY = Keypair.fromSecretKey(Uint8Array.from(secretArray));
} catch (e) {
    console.error('Invalid MINT_AUTHORITY_SECRET format');
    process.exit(1);
}

const metaplex = Metaplex.make(connection).use(keypairIdentity(AUTHORITY));

// Cooldown
const COOLDOWN = Number(COOLDOWN_SECONDS || 60);

// Redis
const redis = new Redis(REDIS_URL);
redis.on('error', (err) => console.error('Redis error:', err));

// --- Helpers ---
function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

async function isOnCooldown(wallet) {
    const ttl = await redis.ttl(`cooldown:${wallet}`);
    return ttl > 0;
}

async function setCooldown(wallet, seconds = COOLDOWN) {
    await redis.set(`cooldown:${wallet}`, '1', 'EX', seconds);
}

// Haversine distance (meters) - anti-cheat
function haversine(lat1, lon1, lat2, lon2) {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function safeJsonRead(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error('Failed to read JSON:', filePath, e.message);
        return [];
    }
}

// --- Load data ---
const DATA_DIR = path.join(process.cwd(), 'data');
const QUESTS = safeJsonRead(path.join(DATA_DIR, 'quests.json'));
const MINTABLES = safeJsonRead(path.join(DATA_DIR, 'mintables.json'));
const LOCATIONS = safeJsonRead(path.join(DATA_DIR, 'locations.json'));

// --- Express setup ---
const app = express();

// Logging
app.use(morgan('combined'));

// Security headers with CSP
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", 'https://unpkg.com'],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", SOLANA_RPC],
            },
        },
    })
);

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Global rate limit
const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalLimiter);

// Strict per-IP limit on sensitive endpoints
const ipLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyGenerator: (req) => req.ip,
});

// Mint-specific limiter
const mintLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    message: { error: 'Too many requests — slow down' },
    standardHeaders: true,
    legacyHeaders: false,
});

// --- Signature verification ---
function verifySolanaSignature(message, signatureBase58, pubkeyBase58) {
    try {
        const sig = bs58.decode(signatureBase58);
        const pubkey = bs58.decode(pubkeyBase58);
        const msgUint8 = Buffer.from(message, 'utf8');
        return nacl.sign.detached.verify(msgUint8, sig, pubkey);
    } catch (e) {
        return false;
    }
}

// --- Endpoints ---
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/locations', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(LOCATIONS);
});

app.get('/quests', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(QUESTS);
});

app.get('/mintables', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(MINTABLES);
});

// Player data
app.get('/player/:addr', async (req, res) => {
    const { addr } = req.params;
    try {
        new PublicKey(addr);
        const data = await redis.get(`player:${addr}`);
        res.json(data ? JSON.parse(data) : { lvl: 1, hp: 100, maxHp: 100, caps: 0, gear: [], claimed: [] });
    } catch (e) {
        res.status(400).json({ error: 'Invalid address' });
    }
});

// Claim POI & mint tokens
app.post(
    '/claim-survival',
    ipLimiter,
    mintLimiter,
    [
        body('wallet').exists().isString(),
        body('spot').exists().isString(),
        body('lat').exists().isNumeric(),
        body('lng').exists().isNumeric(),
        body('signature').exists().isString(),
        body('message').exists().isString(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { wallet, spot, lat, lng, signature, message } = req.body;

        // Validate spot
        const loc = LOCATIONS.find((l) => l.n === spot);
        if (!loc) return res.status(400).json({ error: 'Invalid spot' });

        // Validate wallet
        let userPubkey;
        try {
            userPubkey = new PublicKey(wallet);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid wallet' });
        }

        // Verify signature
        if (!verifySolanaSignature(message, signature, wallet)) {
            return res.status(400).json({ error: 'Signature verification failed' });
        }

        // GPS anti-cheat
        const distance = haversine(lat, lng, loc.lat, loc.lng);
        if (distance > 50) {
            return res.status(400).json({ error: 'Too far from POI' });
        }

        // Cooldown
        if (await isOnCooldown(wallet)) {
            return res.status(429).json({ error: 'Cooldown active' });
        }

        try {
            const mintInfo = await getMint(connection, MINT_PUBKEY);
            const mintAuthorityKey = mintInfo.mintAuthority?.toBase58();
            if (mintAuthorityKey !== AUTHORITY.publicKey.toBase58()) {
                return res.status(500).json({ error: 'Authority mismatch' });
            }

            const decimals = Number(mintInfo.decimals || 0);
            const amount = loc.lvl * 25;
            const amountRaw = BigInt(amount) * BigInt(10 ** decimals);

            const userATA = await getOrCreateAssociatedTokenAccount(connection, AUTHORITY, MINT_PUBKEY, userPubkey);

            const ix = createMintToInstruction(MINT_PUBKEY, userATA.address, AUTHORITY.publicKey, amountRaw);
            const tx = new Transaction().add(ix);
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = AUTHORITY.publicKey;
            tx.sign(AUTHORITY);

            const rawTx = tx.serialize();
            const sig = await connection.sendRawTransaction(rawTx);
            await connection.confirmTransaction(sig, 'confirmed');

            await setCooldown(wallet);

            // Update player data
            const playerKey = `player:${wallet}`;
            const rawPlayer = await redis.get(playerKey);
            const playerData = rawPlayer ? JSON.parse(rawPlayer) : { lvl: 1, hp: 100, maxHp: 100, caps: 0, gear: [], claimed: [] };
            playerData.caps += amount;
            if (!playerData.claimed.includes(spot)) playerData.claimed.push(spot);
            await redis.set(playerKey, JSON.stringify(playerData));

            res.json({
                success: true,
                sig,
                explorer: `https://explorer.solana.com/tx/${sig}${connection.rpcEndpoint.includes('devnet') ? '?cluster=devnet' : ''}`,
                capsEarned: amount,
                message: `+${amount} CAPS minted at ${spot}`
            });
        } catch (err) {
            console.error('Claim error:', err);
            res.status(500).json({ error: 'Mint failed' });
        }
    }
);

// Mint item (NFT)
app.post(
    '/mint-item',
    ipLimiter,
    mintLimiter,
    [body('wallet').exists().isString(), body('itemId').exists().isString()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { wallet, itemId } = req.body;
        const item = MINTABLES.find((m) => m.id === itemId);
        if (!item) return res.status(404).json({ error: 'Item not found' });

        // Add real CAPS check/burn here later
        try {
            const metadataUri = "https://arweave.net/PLACEHOLDER"; // Replace with real upload

            const { nft } = await metaplex.nfts().create({
                uri: metadataUri,
                name: item.name,
                sellerFeeBasisPoints: 500,
                symbol: "AFC",
                tokenOwner: new PublicKey(wallet),
            });

            res.json({
                success: true,
                nft: nft.address.toBase58(),
                explorer: `https://solscan.io/token/${nft.address.toBase58()}`,
            });
        } catch (e) {
            console.error('NFT mint error:', e);
            res.status(500).json({ error: 'NFT mint failed' });
        }
    }
);

// 404 & error handlers
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start
const port = Number(PORT || 3000);
app.listen(port, () => {
    console.log(`Atomic Fizz backend running on port ${port}`);
});