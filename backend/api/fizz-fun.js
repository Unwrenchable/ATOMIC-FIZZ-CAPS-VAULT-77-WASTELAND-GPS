/**
 * Fizz.fun API Routes
 * Token launchpad for the Atomic Fizz Caps ecosystem
 * 
 * Features:
 * - CAPS holders can launch tokens
 * - Anyone can trade with SOL (no CAPS required)
 * - Admins can launch with USDC (pre-mainnet bootstrap)
 */

const router = require("express").Router();
const { Connection, PublicKey, Transaction } = require("@solana/web3.js");
const { Program, AnchorProvider, BN } = require("@coral-xyz/anchor");
const { getAssociatedTokenAddress } = require("@solana/spl-token");

// Configuration
const FIZZ_FUN_PROGRAM_ID = new PublicKey(process.env.FIZZ_FUN_PROGRAM_ID || "FizzFun111111111111111111111111111111111111");
const CAPS_MINT = new PublicKey(process.env.CAPS_MINT || "CAPSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
const TREASURY = new PublicKey(process.env.TREASURY_WALLET || "TREASxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

// Constants matching the Solana program
const VIRTUAL_SOL = 30_000_000_000; // 30 SOL in lamports
const TOTAL_SUPPLY = 1_000_000_000_000_000_000; // 1B with 9 decimals
const CURVE_SUPPLY = 800_000_000_000_000_000; // 800M
const GRADUATION_SOL = 85_000_000_000; // 85 SOL
const FEE_BPS = 100; // 1%

// Admin wallets (from env, comma-separated)
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || "").split(",").filter(Boolean);

/**
 * Check if a wallet can access Fizz.fun features
 */
router.get("/api/fizz-fun/access/:wallet", async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get all tokens on Fizz.fun
 */
router.get("/api/fizz-fun/tokens", async (req, res) => {
    try {
        const { sort = "volume", limit = 50 } = req.query;
        
        // Fetch all bonding curves from chain (simplified - in production use indexer)
        const tokens = await fetchAllTokens();
        
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
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get single token details
 */
router.get("/api/fizz-fun/token/:mint", async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

/**
 * Calculate buy quote
 */
router.get("/api/fizz-fun/quote/buy", async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

/**
 * Calculate sell quote
 */
router.get("/api/fizz-fun/quote/sell", async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

/**
 * Admin: Launch token with USDC (pre-mainnet bootstrap)
 */
router.post("/api/fizz-fun/admin/launch", async (req, res) => {
    try {
        const { wallet, name, symbol, uri, signature } = req.body;
        
        // Verify admin status
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
        console.log(`[fizz-fun] Admin launch: ${wallet} launching ${symbol}`);
        
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
        res.status(500).json({ error: err.message });
    }
});

/**
 * Get protocol stats
 */
router.get("/api/fizz-fun/stats", async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

// ============ HELPER FUNCTIONS ============

/**
 * Get CAPS balance for a wallet
 */
async function getCapsBalance(wallet) {
    try {
        const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");
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
 */
function calculateBuyReturn(solAmount, solReserve, tokenReserve) {
    const virtualSol = solReserve + VIRTUAL_SOL;
    const k = virtualSol * tokenReserve;
    const newSol = virtualSol + solAmount;
    const newTokens = k / newSol;
    return Math.floor(tokenReserve - newTokens);
}

/**
 * Calculate SOL received for token input
 */
function calculateSellReturn(tokenAmount, solReserve, tokenReserve) {
    const virtualSol = solReserve + VIRTUAL_SOL;
    const k = virtualSol * tokenReserve;
    const newTokens = tokenReserve + tokenAmount;
    const newSol = k / newTokens;
    const solOut = virtualSol - newSol;
    return Math.min(Math.floor(solOut), solReserve);
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
        const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com");
        
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
