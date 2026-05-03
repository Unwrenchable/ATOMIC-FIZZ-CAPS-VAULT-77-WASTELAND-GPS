// backend/api/buy-stimpak.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Buy Stimpak Endpoint
// Mounted at /api/buy-stimpak
//
// Route:
//   POST /api/buy-stimpak
//     Body: { tier: "common" | "rare" | "epic" | "legendary" }
//     Requires: auth
//
// Burns CAPS from player's wallet and mints a Stimpak NFT.
// Tiers have different burn costs and effects.
// ------------------------------------------------------------

"use strict";

const crypto = require("crypto");
const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { getAssociatedTokenAddress, createBurnInstruction, getTokenAccountBalance } = require("@solana/spl-token");
const { authMiddleware } = require("../lib/auth");
const { redis, key } = require("../lib/redis");

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

// Solana connection (switch to mainnet-beta for production)
const SOLANA_RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const connection = new Connection(SOLANA_RPC, "confirmed");

// CAPS mint (from env) — lazy-evaluated so missing env vars don't crash module load
let CAPS_MINT, mintAuthority, STIMPAK_COLLECTION_MINT;
function getSolanaConfig() {
  if (!CAPS_MINT) {
    if (!process.env.CAPS_MINT) throw new Error("CAPS_MINT env var not set");
    CAPS_MINT = new PublicKey(process.env.CAPS_MINT);
  }
  if (!mintAuthority) {
    const secret = JSON.parse(process.env.MINT_AUTHORITY_PRIVATE_KEY || "[]");
    if (!secret.length) throw new Error("MINT_AUTHORITY_PRIVATE_KEY env var not set");
    mintAuthority = Keypair.fromSecretKey(new Uint8Array(secret));
  }
  if (!STIMPAK_COLLECTION_MINT) {
    if (!process.env.STIMPAK_COLLECTION_MINT) throw new Error("STIMPAK_COLLECTION_MINT env var not set");
    STIMPAK_COLLECTION_MINT = new PublicKey(process.env.STIMPAK_COLLECTION_MINT);
  }
  return { CAPS_MINT, mintAuthority, STIMPAK_COLLECTION_MINT };
}

// Tier definitions
const STIMPAK_TIERS = {
  common: { burnCost: 10, healAmount: 25, repairRate: 10, cooldown: 300 }, // 5 min
  rare: { burnCost: 25, healAmount: 50, repairRate: 25, cooldown: 600 }, // 10 min
  epic: { burnCost: 50, healAmount: 75, repairRate: 50, cooldown: 1200 }, // 20 min
  legendary: { burnCost: 100, healAmount: 100, repairRate: 100, cooldown: 1800 } // 30 min
};

// ------------------------------------------------------------------
// Rate limiter
// ------------------------------------------------------------------
const buyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { ok: false, error: "Too many Stimpak purchases. Rest, Courier." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------------
// POST /api/buy-stimpak
// ------------------------------------------------------------------
router.post("/", authMiddleware, buyLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { tier } = req.body || {};

    // Validate tier
    if (!tier || !STIMPAK_TIERS[tier]) {
      return res.status(400).json({
        ok: false,
        error: `Invalid tier. Must be one of: ${Object.keys(STIMPAK_TIERS).join(", ")}`,
      });
    }

    const tierData = STIMPAK_TIERS[tier];
    const walletPubkey = new PublicKey(wallet);

    // Load Solana config — returns 503 if env vars not set
    let solanaConfig;
    try {
      solanaConfig = getSolanaConfig();
    } catch (cfgErr) {
      return res.status(503).json({ ok: false, error: "Stimpak vending machine offline. Check back later." });
    }
    const { CAPS_MINT: capsMint } = solanaConfig;

    // Check CAPS balance
    const capsATA = await getAssociatedTokenAddress(capsMint, walletPubkey);
    let balance;
    try {
      const accountInfo = await getTokenAccountBalance(connection, capsATA);
      balance = parseInt(accountInfo.value.amount);
    } catch (err) {
      return res.status(400).json({ ok: false, error: "No CAPS token account found. Mint some CAPS first." });
    }

    if (balance < tierData.burnCost) {
      return res.status(400).json({
        ok: false,
        error: `Insufficient CAPS. Need ${tierData.burnCost}, have ${balance}.`,
      });
    }

    // Burn CAPS
    const burnIx = createBurnInstruction(capsATA, capsMint, walletPubkey, tierData.burnCost);
    const tx = new Transaction().add(burnIx);
    tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    tx.feePayer = walletPubkey;

    // Note: In a real implementation, the frontend would sign this tx and send the signature.
    // For now, return the serialized tx for frontend signing.

    // Serialize the transaction for frontend to sign
    const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');

    // Simulate txId for now; in production, frontend submits and returns real signature
    const signature = `prepared-${Date.now()}`;

    console.log(`[buy-stimpak] wallet=${wallet.slice(0, 8)}... tier=${tier} prepared burn tx for ${tierData.burnCost} caps`);

    return res.json({
      ok: true,
      tier,
      burnedCaps: tierData.burnCost,
      healAmount: tierData.healAmount,
      repairRate: tierData.repairRate,
      cooldownSeconds: tierData.cooldown,
      serializedTx,
      message: `Stimpak ${tier} transaction prepared. Sign and submit to complete purchase.`,
    });
  } catch (err) {
    console.error("[buy-stimpak] error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

module.exports = router;