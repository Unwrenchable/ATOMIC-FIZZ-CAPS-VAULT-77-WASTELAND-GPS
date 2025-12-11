// server.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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

// --- Config and env validation ---
const {
    SOLANA_RPC,
    TOKEN_MINT,
    MINT_AUTHORITY_SECRET,
    PORT,
    COOLDOWN_SECONDS,
    MINT_AMOUNT_RAW,
    REDIS_URL
} = process.env;

if (!SOLANA_RPC || !TOKEN_MINT || !MINT_AUTHORITY_SECRET) {
    console.error('Missing required environment variables. See README for required .env keys.');
    process.exit(1);
}

const connection = new Connection(SOLANA_RPC, 'confirmed');
const MINT_PUBKEY = new PublicKey(TOKEN_MINT);

// Load authority keypair from JSON array string in env
let AUTHORITY;
try {
    const secretArray = JSON.parse(MINT_AUTHORITY_SECRET);
    AUTHORITY = Keypair.fromSecretKey(Uint8Array.from(secretArray));
} catch (e) {
    console.error('Invalid MINT_AUTHORITY_SECRET. Must be JSON array string of 64 numbers.');
    process.exit(1);
}

// Cooldown config
const COOLDOWN = Number(COOLDOWN_SECONDS || 60); // seconds
const DEFAULT_MINT_AMOUNT = BigInt(MINT_AMOUNT_RAW || '25000000000'); // raw units fallback

// Redis or in-memory store for cooldowns
let redis;
let useRedis = false;
if (REDIS_URL) {
    redis = new Redis(REDIS_URL);
    redis.on('error', (err) => console.error('Redis error', err));
    useRedis = true;
} else {
    console.warn('REDIS_URL not set. Using in-memory cooldown store (not persistent).');
}
const inMemoryCooldown = new Map();

// --- Helpers ---
function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

async function isOnCooldown(wallet) {
    const key = `cooldown:${wallet}`;
    if (useRedis) {
        const ttl = await redis.ttl(key);
        return ttl > 0;
    } else {
        const expires = inMemoryCooldown.get(wallet) || 0;
        return expires > nowSeconds();
    }
}

async function setCooldown(wallet, seconds = COOLDOWN) {
    const key = `cooldown:${wallet}`;
    if (useRedis) {
        await redis.set(key, '1', 'EX', seconds);
    } else {
        inMemoryCooldown.set(wallet, nowSeconds() + seconds);
        // schedule cleanup
        setTimeout(() => inMemoryCooldown.delete(wallet), seconds * 1000 + 1000);
    }
}

function safeJsonRead(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error('Failed to read JSON', filePath, e.message);
        return null;
    }
}

// --- Load static data ---
const DATA_DIR = path.join(process.cwd(), 'data');
const QUESTS = safeJsonRead(path.join(DATA_DIR, 'quests.json')) || [];
const MINTABLES = safeJsonRead(path.join(DATA_DIR, 'mintables.json')) || [];
const LOCATIONS = safeJsonRead(path.join(DATA_DIR, 'locations.json')) || [];

// --- Express app setup ---
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Global rate limiter
const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
});
app.use(globalLimiter);

// Mint endpoint limiter stricter
const mintLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    message: { error: 'Too many mint requests, slow down' },
    standardHeaders: true,
    legacyHeaders: false
});

// --- Utility: verify Solana signature (optional) ---
// Expects base58 signature and base58 publicKey and message string
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

// --- Endpoint: health ---
app.get('/health', (req, res) => {
    res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

// --- Static data endpoints ---
app.get('/api/locations', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(LOCATIONS);
});

app.get('/api/quests', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(QUESTS);
});

app.get('/api/mintables', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(MINTABLES);
});

// --- Core endpoint: mint-loot ---
app.post(
    '/api/mint-loot',
    mintLimiter,
    [
        body('wallet').exists().isString(),
        body('spot').optional().isString(),
        body('signature').optional().isString(),
        body('message').optional().isString()
    ],
    async (req, res) => {
        // Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { wallet, spot, signature, message } = req.body;

        // Basic wallet validation
        let userPubkey;
        try {
            userPubkey = new PublicKey(wallet);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid wallet public key' });
        }

        // Optional signature verification to prove wallet ownership
        if (signature && message) {
            const verified = verifySolanaSignature(message, signature, wallet);
            if (!verified) return res.status(400).json({ error: 'Signature verification failed' });
        }

        // Cooldown per wallet
        try {
            if (await isOnCooldown(wallet)) {
                return res.status(429).json({ error: `Cooldown active. Try again later.` });
            }
        } catch (e) {
            console.warn('Cooldown check failed', e.message);
        }

        // Proceed with minting
        try {
            // Fetch mint info to compute decimals and confirm authority
            const mintInfo = await getMint(connection, MINT_PUBKEY);
            // Check that AUTHORITY is the mint authority
            const mintAuthorityKey = mintInfo.mintAuthority?.toBase58?.();
            if (!mintAuthorityKey || mintAuthorityKey !== AUTHORITY.publicKey.toBase58()) {
                console.error('Authority mismatch: server AUTHORITY is not mint authority');
                return res.status(500).json({ error: 'Server misconfiguration: authority mismatch' });
            }

            // Compute amount using decimals. If MINT_AMOUNT_RAW env provided, use it; else compute 25 tokens using decimals.
            let amountRaw = DEFAULT_MINT_AMOUNT;
            if (!process.env.MINT_AMOUNT_RAW) {
                // default to 25 tokens
                const decimals = Number(mintInfo.decimals || 0);
                amountRaw = BigInt(25) * BigInt(10 ** decimals);
            }

            // Create or get ATA
            const userATA = await getOrCreateAssociatedTokenAccount(connection, AUTHORITY, MINT_PUBKEY, userPubkey);

            // Build mint instruction
            const ix = createMintToInstruction(MINT_PUBKEY, userATA.address, AUTHORITY.publicKey, amountRaw);

            // Build transaction
            const tx = new Transaction().add(ix);
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            tx.recentBlockhash = blockhash;
            tx.feePayer = AUTHORITY.publicKey;
            tx.sign(AUTHORITY);

            // Send and confirm
            const raw = tx.serialize();
            const sig = await connection.sendRawTransaction(raw);
            await connection.confirmTransaction(sig, 'confirmed');

            // Set cooldown
            await setCooldown(wallet);

            return res.json({
                success: true,
                sig,
                explorer: `https://explorer.solana.com/tx/${sig}?cluster=${connection.rpcEndpoint.includes('devnet') ? 'devnet' : 'mainnet-beta'}`,
                message: `+${amountRaw.toString()} raw units minted to ${wallet} at ${spot || 'unknown spot'}`
            });
        } catch (err) {
            console.error('mint-loot error', err);
            // Do not leak sensitive details
            return res.status(500).json({ error: 'Mint failed', details: err.message });
        }
    }
);

// --- 404 handler ---
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// --- Global error handler ---
app.use((err, req, res, next) => {
    console.error('Unhandled error', err);
    res.status(500).json({ error: 'Internal server error' });
});

// --- Start server ---
const port = Number(PORT || 3000);
app.listen(port, () => {
    console.log(`Atomic Fizz backend listening on port ${port}`);
});
