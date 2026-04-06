/**
 * Fizz.fun API Routes
 * ═══════════════════════════════════════════════════════════════
 * TOKEN LAUNCHPAD for the Atomic Fizz Caps ecosystem
 * Think: pump.fun but integrated into the FIZZ ecosystem
 * ═══════════════════════════════════════════════════════════════
 * 
 * IMPORTANT: Fizz.fun is SEPARATE from the main AFC token!
 * - AFC Token = Main ecosystem token (fixed supply, treasury holds it)
 * - Fizz.fun = Launchpad where CAPS holders can create NEW tokens
 * 
 * How it supports the ecosystem:
 * - CAPS holders get access to launch tokens
 * - Trading fees go to the treasury
 * - Increases utility and demand for CAPS
 * 
 * Features:
 * - CAPS holders can launch tokens (need 1000+ CAPS)
 * - Anyone can trade with SOL (no CAPS required to trade)
 * - Admins can launch with USDC (pre-mainnet bootstrap)
 * - Bonding curve mechanics (like pump.fun)
 * - Graduation to Raydium at 85 SOL
 */

const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { Connection, PublicKey, Transaction: _Transaction } = require("@solana/web3.js");
const { Program: _Program, AnchorProvider: _AnchorProvider, BN: _BN } = require("@coral-xyz/anchor");
const { getAssociatedTokenAddress } = require("@solana/spl-token");
const { requireAdmin, adminRateLimiter } = require("../middleware/adminAuth");

// SEC-008 FIX: Rate limiters for Fizz.fun endpoints (previously had none)
const fizzReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Too many requests to Fizz.fun" },
  standardHeaders: true,
  legacyHeaders: false,
});

const fizzWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many Fizz.fun write requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configuration
// Fizz.fun uses a unified ecosystem design:
//   FIZZ_FUN_PROGRAM_ID defaults to CAPS_MINT / TOKEN_MINT when not explicitly set.
// This means you only need ONE address configured (your CAPS SPL token mint) and
// Fizz.fun will automatically operate under that same identifier.
// Set FIZZ_FUN_PROGRAM_ID explicitly only if you deploy a separate on-chain program.
function requirePublicKey(envName, ...fallbackEnvNames) {
  const value = [envName, ...fallbackEnvNames].map(n => process.env[n]).find(Boolean);
  if (!value) {
    const names = [envName, ...fallbackEnvNames].join(" / ");
    throw new Error(`[fizz-fun] Missing required environment variable(s): ${names}`);
  }
  return new PublicKey(value);
}

let FIZZ_FUN_PROGRAM_ID = null, CAPS_MINT = null, TREASURY = null;
try {
  // Resolve CAPS_MINT first — it is required and anchors the whole ecosystem.
  CAPS_MINT = requirePublicKey("CAPS_MINT", "TOKEN_MINT");
  TREASURY = requirePublicKey("TREASURY_WALLET");
  // FIZZ_FUN_PROGRAM_ID defaults to the already-validated CAPS_MINT PublicKey,
  // unifying the ecosystem under one address.
  // Set FIZZ_FUN_PROGRAM_ID explicitly only for a separate on-chain program.
  FIZZ_FUN_PROGRAM_ID = process.env.FIZZ_FUN_PROGRAM_ID
    ? new PublicKey(process.env.FIZZ_FUN_PROGRAM_ID)
    : CAPS_MINT;
} catch (err) {
  if (process.env.NODE_ENV === "production") {
    // In production, missing Solana config is a fatal error — log clearly so ops can act.
    console.error("[fizz-fun] FATAL: Solana addresses not configured:", err.message);
    console.error("[fizz-fun] Set CAPS_MINT (and TREASURY_WALLET) then restart.");
  } else {
    console.warn("[fizz-fun] Solana addresses not configured:", err.message);
    console.warn("[fizz-fun] Fizz.fun routes will return 503 until env vars are set.");
  }
}

// Constants matching the Solana program
const VIRTUAL_SOL = 30_000_000_000; // 30 SOL in lamports
const TOTAL_SUPPLY = 1_000_000_000_000_000_000; // 1B with 9 decimals
const CURVE_SUPPLY = 800_000_000_000_000_000; // 800M
const GRADUATION_SOL = 85_000_000_000; // 85 SOL
const FEE_BPS = 100; // 1%

const { authMiddleware } = require('../lib/auth');

// Admin wallets (from env, comma-separated)
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || "").split(",").filter(Boolean);

// Guard: return 503 if required Solana addresses are not configured
function requireConfig(req, res, next) {
  if (!FIZZ_FUN_PROGRAM_ID || !CAPS_MINT || !TREASURY) {
    return res.status(503).json({
      error: "Fizz.fun is not configured. Set CAPS_MINT and TREASURY_WALLET environment variables."
    });
  }
  next();
}

/**
 * Check if a wallet can access Fizz.fun features
 */
router.get("/access/:wallet", requireConfig, fizzReadLimiter, async (req, res) => {
    try {
        const { wallet } = req.params;
        const walletPubkey = new PublicKey(wallet);
        
        // Get CAPS balance
        const capsBalance = await getCapsBalance(walletPubkey);
        const capsHuman = capsBalance / 1e9;
        
        // Determine access level
        const canTrade = true; // Anyone can trade
        const canLaunch = capsHuman >= 1000;
        const isVeteran = capsHuman >= 10000;
        const isAdmin = ADMIN_WALLETS.includes(wallet);
        
        // Calculate launch fee
        let launchFee = 100; // Default
        if (isVeteran) launchFee = 50;
        
        // Determine tier
        let tier = "outsider";
        if (capsHuman >= 1000000) tier = "overseer";
        else if (capsHuman >= 100000) tier = "elite";
        else if (capsHuman >= 10000) tier = "veteran";
        else if (capsHuman >= 1000) tier = "wastelander";
        
        res.json({
            wallet,
            capsBalance: capsHuman,
            canTrade,
            canLaunch,
            isVeteran,
            isAdmin,
            launchFee,
            tier,
            message: canLaunch 
                ? `Welcome, ${tier}! You can launch tokens.`
                : "Your old world paper money (SOL) is worthless scrap, but we'll take it for trading."
        });
    } catch (err) {
        console.error("[fizz-fun] Access check error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Get all tokens on Fizz.fun
 */
router.get("/tokens", requireConfig, fizzReadLimiter, async (req, res) => {
    try {
        const { sort = "volume", limit = 50 } = req.query;
        
        // Fetch all bonding curves from chain (simplified - in production use indexer)
        let tokens = await fetchAllTokens();
        
        // Sort
        if (sort === "volume") {
            tokens.sort((a, b) => b.solReserve - a.solReserve);
        } else if (sort === "newest") {
            tokens.sort((a, b) => b.createdAt - a.createdAt);
        } else if (sort === "graduating") {
            tokens.sort((a, b) => b.solReserve - a.solReserve);
            tokens = tokens.filter(t => !t.graduated && t.solReserve >= GRADUATION_SOL * 0.8);
        }
        
        res.json({
            tokens: tokens.slice(0, parseInt(limit)),
            total: tokens.length
        });
    } catch (err) {
        console.error("[fizz-fun] Fetch tokens error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Get single token details
 */
router.get("/token/:mint", requireConfig, fizzReadLimiter, async (req, res) => {
    try {
        const { mint } = req.params;
        const mintPubkey = new PublicKey(mint);
        
        const token = await fetchTokenDetails(mintPubkey);
        if (!token) {
            return res.status(404).json({ error: "Token not found" });
        }
        
        // Calculate current price
        const price = calculatePrice(token.solReserve, token.tokenReserve);
        const marketCap = price * TOTAL_SUPPLY / 1e9;
        const progress = (token.solReserve / GRADUATION_SOL) * 100;
        
        res.json({
            ...token,
            price,
            priceFormatted: `${(price * 1e9).toFixed(9)} SOL`,
            marketCap,
            marketCapFormatted: `${(marketCap / 1e9).toFixed(2)} SOL`,
            graduationProgress: Math.min(progress, 100),
            isAdminLaunch: ["AdminUSDC", "AdminFree"].includes(token.launchType)
        });
    } catch (err) {
        console.error("[fizz-fun] Fetch token error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Calculate buy quote
 */
router.get("/quote/buy", requireConfig, fizzReadLimiter, async (req, res) => {
    try {
        const { mint, solAmount } = req.query;
        
        if (!mint || !solAmount) {
            return res.status(400).json({ error: "Missing mint or solAmount" });
        }
        
        const token = await fetchTokenDetails(new PublicKey(mint));
        if (!token) {
            return res.status(404).json({ error: "Token not found" });
        }
        
        const solLamports = parseFloat(solAmount) * 1e9;
        const fee = solLamports * FEE_BPS / 10000;
        const solAfterFee = solLamports - fee;
        
        const tokensOut = calculateBuyReturn(solAfterFee, token.solReserve, token.tokenReserve);
        
        res.json({
            solAmount: parseFloat(solAmount),
            solAmountLamports: solLamports,
            fee: fee / 1e9,
            feeLamports: fee,
            tokensOut: tokensOut / 1e9,
            tokensOutRaw: tokensOut,
            priceImpact: calculatePriceImpact(solAfterFee, token.solReserve),
            newPrice: calculatePrice(token.solReserve + solAfterFee, token.tokenReserve - tokensOut)
        });
    } catch (err) {
        console.error("[fizz-fun] Buy quote error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Calculate sell quote
 */
router.get("/quote/sell", requireConfig, fizzReadLimiter, async (req, res) => {
    try {
        const { mint, tokenAmount } = req.query;
        
        if (!mint || !tokenAmount) {
            return res.status(400).json({ error: "Missing mint or tokenAmount" });
        }
        
        const token = await fetchTokenDetails(new PublicKey(mint));
        if (!token) {
            return res.status(404).json({ error: "Token not found" });
        }
        
        const tokensRaw = parseFloat(tokenAmount) * 1e9;
        const solOutGross = calculateSellReturn(tokensRaw, token.solReserve, token.tokenReserve);
        const fee = solOutGross * FEE_BPS / 10000;
        const solOut = solOutGross - fee;
        
        res.json({
            tokenAmount: parseFloat(tokenAmount),
            tokenAmountRaw: tokensRaw,
            solOutGross: solOutGross / 1e9,
            fee: fee / 1e9,
            solOut: solOut / 1e9,
            solOutLamports: solOut,
            priceImpact: calculatePriceImpact(solOutGross, token.solReserve),
            newPrice: calculatePrice(token.solReserve - solOutGross, token.tokenReserve + tokensRaw)
        });
    } catch (err) {
        console.error("[fizz-fun] Sell quote error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Admin: Launch token with USDC (pre-mainnet bootstrap)
 * SEC-004 FIX: Added authMiddleware so only authenticated sessions can reach
 * this endpoint.  Wallet is now sourced from the verified session (req.player)
 * instead of req.body, preventing an attacker from self-reporting an admin
 * wallet address without actually owning it.
 */
router.post("/admin/launch", requireConfig, authMiddleware, fizzWriteLimiter, async (req, res) => {
    try {
        // SEC-004 FIX: wallet from verified session — never from req.body
        const wallet = req.player.wallet;
        const { name, symbol, uri } = req.body;
        
        // Verify admin status
        if (ADMIN_WALLETS.length === 0) {
            // SEC-004 FIX: warn loudly if ADMIN_WALLETS is not configured —
            // a missing env var would silently deny all admin requests.
            console.warn('[fizz-fun] ADMIN_WALLETS env var is empty — /admin/launch will always be denied');
        }
        if (!ADMIN_WALLETS.includes(wallet)) {
            return res.status(403).json({ error: "Not authorized as admin" });
        }
        
        // Validate inputs
        if (!name || name.length > 32) {
            return res.status(400).json({ error: "Invalid name (max 32 chars)" });
        }
        if (!symbol || symbol.length > 10) {
            return res.status(400).json({ error: "Invalid symbol (max 10 chars)" });
        }
        if (!uri || uri.length > 200) {
            return res.status(400).json({ error: "Invalid URI (max 200 chars)" });
        }
        
        // Log admin action (for transparency)
        console.log(`[fizz-fun] Admin launch by authenticated admin: ${symbol}`);
        
        // In production: verify USDC payment and call create_token_admin
        // For now, return transaction to be signed by admin
        
        res.json({
            ok: true,
            message: `Admin token ${symbol} ready to launch`,
            launchType: "AdminUSDC",
            warning: "This token will be clearly labeled as admin-launched"
        });
    } catch (err) {
        console.error("[fizz-fun] Admin launch error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * Get protocol stats
 */
router.get("/stats", requireConfig, fizzReadLimiter, async (req, res) => {
    try {
        // Fetch config from chain
        const stats = await fetchProtocolStats();
        
        res.json({
            totalTokensLaunched: stats.totalTokensLaunched,
            totalVolumeSol: stats.totalVolumeSol / 1e9,
            totalCapsBurned: stats.totalCapsBurned / 1e9,
            adminUsdcLaunches: stats.adminUsdcLaunches,
            communityLaunches: stats.totalTokensLaunched - stats.adminUsdcLaunches
        });
    } catch (err) {
        console.error("[fizz-fun] Stats error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ============ HELPER FUNCTIONS ============

/**
 * Get CAPS balance for a wallet
 */
async function getCapsBalance(wallet) {
    try {
        const connection = new Connection(process.env.SOLANA_RPC || process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");
        const ata = await getAssociatedTokenAddress(CAPS_MINT, wallet);
        const balance = await connection.getTokenAccountBalance(ata);
        return parseInt(balance.value.amount);
    } catch (err) {
        // Account doesn't exist = 0 balance
        return 0;
    }
}

/**
 * Calculate tokens received for SOL input (constant product AMM)
 * BUG-032 FIX: use BigInt for intermediate calculations because
 * virtualSol (30B) * tokenReserve (800e15) = 2.4e28 >> Number.MAX_SAFE_INTEGER,
 * causing precision loss of ~0.02–0.1% on large trades.
 */
function calculateBuyReturn(solAmount, solReserve, tokenReserve) {
    const virtualSol = BigInt(solReserve) + BigInt(VIRTUAL_SOL);
    const tokenReserveBig = BigInt(Math.floor(tokenReserve));
    const k = virtualSol * tokenReserveBig;
    const newSol = virtualSol + BigInt(Math.floor(solAmount));
    const newTokens = k / newSol; // BigInt integer division
    return Number(tokenReserveBig - newTokens);
}

/**
 * Calculate SOL received for token input
 * BUG-032 FIX: use BigInt for intermediate calculations (same overflow hazard as buy).
 */
function calculateSellReturn(tokenAmount, solReserve, tokenReserve) {
    const virtualSol = BigInt(solReserve) + BigInt(VIRTUAL_SOL);
    const tokenReserveBig = BigInt(Math.floor(tokenReserve));
    const k = virtualSol * tokenReserveBig;
    const newTokens = tokenReserveBig + BigInt(Math.floor(tokenAmount));
    const newSol = k / newTokens; // BigInt integer division
    const solOut = virtualSol - newSol;
    return Math.min(Number(solOut), solReserve);
}

/**
 * Calculate current token price in SOL
 */
function calculatePrice(solReserve, tokenReserve) {
    const virtualSol = solReserve + VIRTUAL_SOL;
    return virtualSol / tokenReserve;
}

/**
 * Calculate price impact percentage
 */
function calculatePriceImpact(amount, reserve) {
    return (amount / (reserve + VIRTUAL_SOL)) * 100;
}

/**
 * Fetch all tokens (placeholder - use indexer in production)
 */
async function fetchAllTokens() {
    // In production: query from indexer or getProgramAccounts
    // For now, return empty array
    return [];
}

/**
 * Fetch single token details
 */
async function fetchTokenDetails(mint) {
    try {
        const connection = new Connection(process.env.SOLANA_RPC || process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");
        
        // Derive bonding curve PDA
        const [bondingCurve] = PublicKey.findProgramAddressSync(
            [Buffer.from("bonding_curve"), mint.toBuffer()],
            FIZZ_FUN_PROGRAM_ID
        );
        
        const accountInfo = await connection.getAccountInfo(bondingCurve);
        if (!accountInfo) return null;
        
        // Decode account data (simplified - use IDL in production)
        // For now, return mock data
        return {
            mint: mint.toBase58(),
            creator: "...",
            name: "Token",
            symbol: "TKN",
            solReserve: 0,
            tokenReserve: CURVE_SUPPLY,
            graduated: false,
            createdAt: Date.now() / 1000,
            launchType: "CapsStandard"
        };
    } catch (err) {
        console.error("[fizz-fun] Fetch token error:", err);
        return null;
    }
}

/**
 * Fetch protocol stats
 */
async function fetchProtocolStats() {
    // In production: fetch from config PDA
    return {
        totalTokensLaunched: 0,
        totalVolumeSol: 0,
        totalCapsBurned: 0,
        adminUsdcLaunches: 0
    };
}

module.exports = router;
