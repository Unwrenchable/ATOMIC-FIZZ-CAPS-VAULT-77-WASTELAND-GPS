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
const { Connection, PublicKey } = require("@solana/web3.js");
const { getAssociatedTokenAddress } = require("@solana/spl-token");
const { requireAdmin: _requireAdmin, adminRateLimiter: _adminRateLimiter } = require("../middleware/adminAuth");

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
// Devnet defaults to the deployed program in Anchor.toml.
const DEFAULT_FIZZ_FUN_PROGRAM_ID = "GvTeKyGiFqtpJn2cJQxFb2iPVCYotvnMjMZKGAnPgZkc";
function requirePublicKey(envName, ...fallbackEnvNames) {
  const value = [envName, ...fallbackEnvNames].map(n => process.env[n]).find(Boolean);
  if (!value) {
    const names = [envName, ...fallbackEnvNames].join(" / ");
    throw new Error(`[fizz-fun] Missing required environment variable(s): ${names}`);
  }
  return new PublicKey(value);
}

let FIZZ_FUN_PROGRAM_ID = new PublicKey(
  process.env.FIZZ_FUN_PROGRAM_ID || DEFAULT_FIZZ_FUN_PROGRAM_ID
);
let CAPS_MINT = null, TREASURY = null;
try {
  // Resolve CAPS_MINT first — it is required and anchors the whole ecosystem.
  CAPS_MINT = requirePublicKey("CAPS_MINT", "TOKEN_MINT");
  TREASURY = requirePublicKey("TREASURY_WALLET");
} catch (err) {
  if (process.env.NODE_ENV === "production") {
    // In production, missing Solana config is a fatal error — log clearly so ops can act.
    console.error("[fizz-fun] FATAL: Solana addresses not configured:", err.message);
    console.error("[fizz-fun] Set CAPS_MINT, TREASURY_WALLET, and FIZZ_FUN_PROGRAM_ID then restart.");
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
const BONDING_CURVE_DATA_SIZE = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
const CONFIG_DATA_SIZE = 8 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1;
const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function getSolanaRpc() {
  return process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC || "https://api.devnet.solana.com";
}

function readPubkey(buf, offset) {
  return new PublicKey(buf.subarray(offset, offset + 32));
}

function readU64(buf, offset) {
  return Number(buf.readBigUInt64LE(offset));
}

function readI64(buf, offset) {
  return Number(buf.readBigInt64LE(offset));
}

function decodeLaunchType(raw) {
  switch (raw) {
    case 0: return "CapsStandard";
    case 1: return "CapsVeteran";
    case 2: return "AdminUSDC";
    case 3: return "AdminFree";
    default: return "CapsStandard";
  }
}

function decodeBondingCurve(accountInfo) {
  if (!accountInfo || !accountInfo.data || accountInfo.data.length < BONDING_CURVE_DATA_SIZE) {
    return null;
  }
  const data = accountInfo.data;
  let offset = 8;
  const authority = readPubkey(data, offset); offset += 32;
  const tokenMint = readPubkey(data, offset); offset += 32;
  const tokenVault = readPubkey(data, offset); offset += 32;
  const solVault = readPubkey(data, offset); offset += 32;
  const totalSupply = readU64(data, offset); offset += 8;
  const lpReserve = readU64(data, offset); offset += 8;
  const tokenReserve = readU64(data, offset); offset += 8;
  const solReserve = readU64(data, offset); offset += 8;
  const graduatedAt = readI64(data, offset); offset += 8;
  const launchType = decodeLaunchType(data.readUInt8(offset)); offset += 1;
  const bump = data.readUInt8(offset);
  return {
    authority: authority.toBase58(),
    tokenMint: tokenMint.toBase58(),
    tokenVault: tokenVault.toBase58(),
    solVault: solVault.toBase58(),
    totalSupply,
    lpReserve,
    tokenReserve,
    tokenReserveRaw: String(tokenReserve),
    solReserve,
    graduated: graduatedAt > 0,
    graduatedAt: graduatedAt > 0 ? graduatedAt : null,
    createdAt: 0,
    launchType,
    bump,
  };
}

function decodeFizzConfig(accountInfo) {
  if (!accountInfo || !accountInfo.data || accountInfo.data.length < CONFIG_DATA_SIZE) {
    return null;
  }
  const data = accountInfo.data;
  let offset = 8;
  const authority = readPubkey(data, offset); offset += 32;
  const treasury = readPubkey(data, offset); offset += 32;
  const capsMint = readPubkey(data, offset); offset += 32;
  const serverKey = readPubkey(data, offset); offset += 32;
  const totalTokensLaunched = readU64(data, offset); offset += 8;
  const totalVolumeSol = readU64(data, offset); offset += 8;
  const totalCapsBurned = readU64(data, offset); offset += 8;
  const adminUsdcLaunches = readU64(data, offset); offset += 8;
  const bump = data.readUInt8(offset);
  return {
    authority: authority.toBase58(),
    treasury: treasury.toBase58(),
    capsMint: capsMint.toBase58(),
    serverKey: serverKey.toBase58(),
    totalTokensLaunched,
    totalVolumeSol,
    totalCapsBurned,
    adminUsdcLaunches,
    bump,
  };
}

function decodeMetadata(accountInfo) {
  if (!accountInfo || !accountInfo.data || accountInfo.data.length < 100) {
    return null;
  }
  const data = accountInfo.data;
  let offset = 1 + 32 + 32;
  const readString = () => {
    const len = data.readUInt32LE(offset);
    offset += 4;
    const value = data.toString("utf8", offset, offset + len).replace(/\0+$/g, "");
    offset += len;
    return value;
  };
  const name = readString();
  const symbol = readString();
  const uri = readString();
  return { name, symbol, uri };
}

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
        res.status(500).json({ ok: false, error: "Internal server error" });
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
        res.status(500).json({ ok: false, error: "Internal server error" });
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
            return res.status(404).json({ ok: false, error: "Token not found" });
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
        res.status(500).json({ ok: false, error: "Internal server error" });
    }
});

/**
 * Calculate buy quote
 */
router.get("/quote/buy", requireConfig, fizzReadLimiter, async (req, res) => {
    try {
        const { mint, solAmount } = req.query;
        
        if (!mint || !solAmount) {
            return res.status(400).json({ ok: false, error: "Missing mint or solAmount" });
        }
        
        const token = await fetchTokenDetails(new PublicKey(mint));
        if (!token) {
            return res.status(404).json({ ok: false, error: "Token not found" });
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
        res.status(500).json({ ok: false, error: "Internal server error" });
    }
});

/**
 * Calculate sell quote
 */
router.get("/quote/sell", requireConfig, fizzReadLimiter, async (req, res) => {
    try {
        const { mint, tokenAmount } = req.query;
        
        if (!mint || !tokenAmount) {
            return res.status(400).json({ ok: false, error: "Missing mint or tokenAmount" });
        }
        
        const token = await fetchTokenDetails(new PublicKey(mint));
        if (!token) {
            return res.status(404).json({ ok: false, error: "Token not found" });
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
        res.status(500).json({ ok: false, error: "Internal server error" });
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
            return res.status(403).json({ ok: false, error: "Not authorized as admin" });
        }
        
        // Validate inputs
        if (!name || name.length > 32) {
            return res.status(400).json({ ok: false, error: "Invalid name (max 32 chars)" });
        }
        if (!symbol || symbol.length > 10) {
            return res.status(400).json({ ok: false, error: "Invalid symbol (max 10 chars)" });
        }
        if (!uri || uri.length > 200) {
            return res.status(400).json({ ok: false, error: "Invalid URI (max 200 chars)" });
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
        res.status(500).json({ ok: false, error: "Internal server error" });
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
        res.status(500).json({ ok: false, error: "Internal server error" });
    }
});

// ============ HELPER FUNCTIONS ============

/**
 * Get CAPS balance for a wallet
 */
async function getCapsBalance(wallet) {
    try {
        const connection = new Connection(getSolanaRpc(), "confirmed");
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
    try {
        const connection = new Connection(getSolanaRpc(), "confirmed");
        const accounts = await connection.getProgramAccounts(FIZZ_FUN_PROGRAM_ID, {
            filters: [{ dataSize: BONDING_CURVE_DATA_SIZE }],
        });
        return await Promise.all(accounts.map(async ({ pubkey, account }) => {
                const decoded = decodeBondingCurve(account);
                if (!decoded) return null;
                const [metadataPda] = PublicKey.findProgramAddressSync(
                    [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), new PublicKey(decoded.tokenMint).toBuffer()],
                    TOKEN_METADATA_PROGRAM_ID
                );
                const metadataInfo = await connection.getAccountInfo(metadataPda);
                const metadata = decodeMetadata(metadataInfo);
                return {
                    mint: decoded.tokenMint,
                    creator: decoded.authority,
                    name: metadata?.name || "Token",
                    symbol: metadata?.symbol || "TKN",
                    uri: metadata?.uri || "",
                    solReserve: decoded.solReserve,
                    tokenReserve: decoded.tokenReserve,
                    graduated: decoded.graduated,
                    graduatedAt: decoded.graduatedAt,
                    createdAt: decoded.createdAt,
                    launchType: decoded.launchType,
                    bondCurve: pubkey.toBase58(),
                    metadataPda: metadataPda.toBase58(),
                };
            })).then((rows) => rows.filter(Boolean));
    } catch (err) {
        console.error("[fizz-fun] fetchAllTokens error:", err);
        return [];
    }
}

/**
 * Fetch single token details
 */
async function fetchTokenDetails(mint) {
    try {
        const connection = new Connection(getSolanaRpc(), "confirmed");
        const [bondingCurve] = PublicKey.findProgramAddressSync(
            [Buffer.from("fizz-curve"), mint.toBuffer()],
            FIZZ_FUN_PROGRAM_ID
        );
        const accountInfo = await connection.getAccountInfo(bondingCurve);
        if (!accountInfo) return null;
        const decoded = decodeBondingCurve(accountInfo);
        if (!decoded) return null;
        const [metadataPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
            TOKEN_METADATA_PROGRAM_ID
        );
        const metadataInfo = await connection.getAccountInfo(metadataPda);
        const metadata = decodeMetadata(metadataInfo);
        return {
            mint: mint.toBase58(),
            creator: decoded.authority,
            name: metadata?.name || "Token",
            symbol: metadata?.symbol || "TKN",
            uri: metadata?.uri || "",
            solReserve: decoded.solReserve,
            tokenReserve: decoded.tokenReserve,
            tokenReserveRaw: decoded.tokenReserveRaw,
            lpReserve: decoded.lpReserve,
            totalSupply: decoded.totalSupply,
            graduated: decoded.graduated,
            graduatedAt: decoded.graduatedAt,
            createdAt: decoded.createdAt,
            launchType: decoded.launchType,
            bondCurve: bondingCurve.toBase58(),
            metadataPda: metadataPda.toBase58(),
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
    try {
        const connection = new Connection(getSolanaRpc(), "confirmed");
        const [configPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("fizz-config")],
            FIZZ_FUN_PROGRAM_ID
        );
        const accountInfo = await connection.getAccountInfo(configPda);
        const decoded = decodeFizzConfig(accountInfo);
        if (!decoded) {
            return {
                totalTokensLaunched: 0,
                totalVolumeSol: 0,
                totalCapsBurned: 0,
                adminUsdcLaunches: 0,
            };
        }
        return decoded;
    } catch (err) {
        console.error("[fizz-fun] fetchProtocolStats error:", err);
        return {
            totalTokensLaunched: 0,
            totalVolumeSol: 0,
            totalCapsBurned: 0,
            adminUsdcLaunches: 0,
        };
    }
}

module.exports = router;
