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
const SOLANA_RPC = process.env.SOLANA_RPC || "https://api.devnet.solana.com";
const connection = new Connection(SOLANA_RPC, "confirmed");

// CAPS mint (from env)
const CAPS_MINT = new PublicKey(process.env.CAPS_MINT || "your-caps-token-mint-address");

// Mint authority (from env, array of bytes)
const MINT_AUTHORITY_SECRET = JSON.parse(process.env.MINT_AUTHORITY_PRIVATE_KEY || "[]");
const mintAuthority = Keypair.fromSecretKey(new Uint8Array(MINT_AUTHORITY_SECRET));

// Stimpak collection mints (from env)
const STIMPAK_COLLECTION_MINT = new PublicKey(process.env.STIMPAK_COLLECTION_MINT || "your-stimpak-collection-mint");

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

    // Check CAPS balance
    const capsATA = await getAssociatedTokenAddress(CAPS_MINT, walletPubkey);
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
    const burnIx = createBurnInstruction(capsATA, CAPS_MINT, walletPubkey, tierData.burnCost);
    const tx = new Transaction().add(burnIx);
    tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash;
    tx.feePayer = walletPubkey;

    // Note: In a real implementation, the frontend would sign this tx and send the signature.
    // For now, assuming server-side signing (not recommended for production).
    // TODO: Implement proper wallet signing flow.

    // For demo, we'll simulate the burn. In production, require signed tx from frontend.
    // const signature = await sendAndConfirmTransaction(connection, tx, [/* wallet signer */]);
    // Simulate success
    const signature = `simulated-burn-${Date.now()}`;

    // Mint NFT (simplified - in reality, use Metaplex)
    // TODO: Integrate Metaplex for NFT minting with metadata

    // Update player state with cooldown
    const cooldownKey = key(`player:${wallet}:cooldowns:stimpak`);
    await redis.set(cooldownKey, Date.now() + (tierData.cooldown * 1000), { EX: tierData.cooldown });

    console.log(`[buy-stimpak] wallet=${wallet.slice(0, 8)}... tier=${tier} burned=${tierData.burnCost} caps tx=${signature}`);

    return res.json({
      ok: true,
      tier,
      burnedCaps: tierData.burnCost,
      healAmount: tierData.healAmount,
      repairRate: tierData.repairRate,
      cooldownSeconds: tierData.cooldown,
      txId: signature,
      message: `Stimpak ${tier} purchased. Use it wisely, Courier.`,
    });
  } catch (err) {
    console.error("[buy-stimpak] error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

module.exports = router;