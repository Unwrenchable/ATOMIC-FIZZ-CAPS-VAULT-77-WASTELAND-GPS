// backend/api/caps-redeem.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Treasury Redemption API
// Mounted at /api/caps/redeem
//
// This route allows players to convert their in-game CAPS balance
// to on-chain CAPS SPL tokens. Players must have a verified session
// and meet minimum redemption requirements.
// ------------------------------------------------------------

"use strict";

const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const redis = require("../lib/redis");
const { getCapsBalance } = require("../lib/caps");

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------
const MIN_REDEMPTION_AMOUNT = 100;  // Minimum CAPS to redeem
const MAX_REDEMPTION_AMOUNT = 10000; // Maximum CAPS per transaction
const REDEMPTION_COOLDOWN_SECONDS = 3600; // 1 hour between redemptions

// Treasury wallet address (from environment or fallback)
const TREASURY_WALLET = process.env.TREASURY_WALLET || null;
const _CAPS_TOKEN_MINT = process.env.CAPS_MINT || null; // Reserved for future SPL transfer implementation (unified with game token)

// Rate limiter: redemption is high-value; limit to 3 per hour per wallet/IP
const redeemLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { ok: false, error: "Too many redemption requests — slow down, Vault Dweller" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// POST /api/caps/redeem
// Redeem in-game CAPS for on-chain CAPS SPL tokens
// ------------------------------------------------------------
router.post("/", redeemLimiter, authMiddleware, async (req, res) => {
  try {
    // Wallet from verified session (NEVER from req.body — IDOR protection)
    const wallet = req.player.wallet;
    const { amount, signature } = req.body || {};

    // Validate amount
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount < MIN_REDEMPTION_AMOUNT) {
      return res.status(400).json({
        ok: false,
        error: `Minimum redemption is ${MIN_REDEMPTION_AMOUNT} CAPS. The Wasteland has standards, smoothskin.`,
      });
    }

    if (amount > MAX_REDEMPTION_AMOUNT) {
      return res.status(400).json({
        ok: false,
        error: `Maximum redemption is ${MAX_REDEMPTION_AMOUNT} CAPS per transaction. Easy there, Mr. House.`,
      });
    }

    // Verify treasury is configured (required for production)
    if (!TREASURY_WALLET) {
      console.error("[caps-redeem] TREASURY_WALLET not configured");
      return res.status(503).json({
        ok: false,
        error: "Treasury redemption service unavailable — the Overseer is working on it.",
      });
    }

    // Acquire distributed lock to prevent concurrent redemptions for same wallet
    const lockKey = `caps:redeem:lock:${wallet}`;
    const lockResult = await redis.set(lockKey, "1", { NX: true, EX: 60 });
    if (!lockResult) {
      return res.status(409).json({
        ok: false,
        error: "Redemption already in progress — patience is a virtue, wastelander.",
      });
    }

    try {
      // Check redemption cooldown
      const cooldownKey = `caps:redeem:cooldown:${wallet}`;
      const lastRedemption = await redis.get(cooldownKey);
      if (lastRedemption) {
        const elapsed = Math.floor((Date.now() - parseInt(lastRedemption, 10)) / 1000);
        const remaining = REDEMPTION_COOLDOWN_SECONDS - elapsed;
        if (remaining > 0) {
          return res.status(429).json({
            ok: false,
            error: `Redemption on cooldown — ${Math.ceil(remaining / 60)} minutes remaining. The caravan will wait.`,
            secondsRemaining: remaining,
          });
        }
      }

      // Get current in-game CAPS balance
      const currentBalance = await getCapsBalance(wallet);
      if (currentBalance < amount) {
        return res.status(400).json({
          ok: false,
          error: `Insufficient CAPS. You have ${currentBalance}, but requested ${amount}. Nice try, raider.`,
          balance: currentBalance,
        });
      }

      // Verify signature if provided (optional for now, but recommended)
      // In production, this would verify that the player signed a message
      // authorizing the redemption
      if (signature) {
        // Signature verification could be added here for extra security
        // For now, session auth is sufficient for MVP
        console.log(`[caps-redeem] Signature provided by ${wallet.slice(0, 8)}...`);
      }

      // Deduct CAPS from player balance atomically
      const profileKey = `player:${wallet}`;
      const profileRaw = await redis.hget(profileKey, "profile");
      if (!profileRaw) {
        return res.status(404).json({
          ok: false,
          error: "Player profile not found — register first, wastelander.",
        });
      }

      const profile = JSON.parse(profileRaw);
      if (typeof profile.caps !== "number" || profile.caps < amount) {
        return res.status(400).json({
          ok: false,
          error: "Insufficient CAPS balance — did someone pick your pocket?",
          balance: profile.caps || 0,
        });
      }

      // Deduct the amount
      profile.caps -= amount;
      await redis.hset(profileKey, "profile", JSON.stringify(profile));

      // Generate a unique transaction ID for tracking
      const txId = crypto.randomBytes(16).toString("hex");

      // Log the redemption request for processing by the treasury worker
      // In a full implementation, this would:
      // 1. Create a pending transaction record
      // 2. Queue for the treasury worker to process
      // 3. Worker would execute SPL token transfer from TREASURY_WALLET to player wallet
      // 4. Update transaction record with on-chain signature
      const redemptionKey = `caps:redeem:tx:${txId}`;
      await redis.set(redemptionKey, JSON.stringify({
        txId,
        wallet,
        amount,
        status: "pending",
        createdAt: Date.now(),
        capsBeforeRedeem: currentBalance,
        capsAfterRedeem: profile.caps,
      }), { EX: 7 * 24 * 60 * 60 }); // Keep for 7 days

      // Set redemption cooldown
      await redis.set(cooldownKey, String(Date.now()), { EX: REDEMPTION_COOLDOWN_SECONDS });

      // In production, this is where you would:
      // 1. Call your Solana treasury service to initiate the SPL transfer
      // 2. Wait for confirmation
      // 3. Return the actual on-chain transaction signature
      //
      // For now, we return a pending status that indicates the redemption
      // has been queued for processing by the treasury worker.

      console.log(`[caps-redeem] Redemption queued: ${wallet.slice(0, 8)}... redeemed ${amount} CAPS (txId: ${txId})`);

      return res.json({
        ok: true,
        txId,
        capsRedeemed: amount,
        capsRemaining: profile.caps,
        status: "pending",
        message: "Redemption queued. Your on-chain CAPS tokens will arrive shortly — the Brahmin are en route.",
        treasury: {
          note: "On-chain transfer pending treasury worker processing",
          estimatedTime: "1-5 minutes",
        },
      });

    } finally {
      // Always release the lock
      await redis.del(lockKey).catch(() => {});
    }

  } catch (err) {
    console.error("[caps-redeem] Error:", err);
    return res.status(500).json({
      ok: false,
      error: "Redemption failed — the Wasteland is harsh today. Try again later.",
    });
  }
});

// ------------------------------------------------------------
// GET /api/caps/redeem/status/:txId
// Check status of a pending redemption
// ------------------------------------------------------------
router.get("/status/:txId", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { txId } = req.params;

    if (!txId || typeof txId !== "string" || txId.length !== 32) {
      return res.status(400).json({ ok: false, error: "Invalid transaction ID" });
    }

    const redemptionKey = `caps:redeem:tx:${txId}`;
    const raw = await redis.get(redemptionKey);

    if (!raw) {
      return res.status(404).json({ ok: false, error: "Transaction not found or expired" });
    }

    const tx = JSON.parse(raw);

    // Only allow the owner to check their own transaction
    if (tx.wallet !== wallet) {
      return res.status(403).json({ ok: false, error: "Access denied — not your transaction, scavenger." });
    }

    return res.json({
      ok: true,
      txId: tx.txId,
      wallet: tx.wallet,
      amount: tx.amount,
      status: tx.status,
      createdAt: tx.createdAt,
      completedAt: tx.completedAt || null,
      onChainSignature: tx.onChainSignature || null,
    });

  } catch (err) {
    console.error("[caps-redeem] status error:", err);
    return res.status(500).json({ ok: false, error: "Failed to check transaction status" });
  }
});

// ------------------------------------------------------------
// GET /api/caps/redeem/history
// Get redemption history for the authenticated player
// ------------------------------------------------------------
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;

    // Scan for redemption transactions belonging to this wallet
    // Note: In production, you'd want an index or sorted set for this
    // redis.keys() returns keys with the afw: prefix included (e.g., "afw:caps:redeem:tx:abc123")
    const keys = await redis.keys("caps:redeem:tx:*");
    const history = [];

    for (const fullKey of (keys || [])) {
      // redis.keys() returns full keys with prefix (afw:caps:redeem:tx:<txId>)
      // Extract just the transaction ID and pass the raw key to redis.get()
      // which will add the prefix internally
      const txIdMatch = fullKey.match(/caps:redeem:tx:([a-f0-9]+)$/);
      if (!txIdMatch) continue;

      const txId = txIdMatch[1];
      const raw = await redis.get(`caps:redeem:tx:${txId}`);
      if (!raw) continue;

      try {
        const tx = JSON.parse(raw);
        if (tx.wallet === wallet) {
          history.push({
            txId: tx.txId,
            amount: tx.amount,
            status: tx.status,
            createdAt: tx.createdAt,
            completedAt: tx.completedAt || null,
          });
        }
      } catch {
        // Skip malformed entries
      }
    }

    // Sort by creation date, newest first
    history.sort((a, b) => b.createdAt - a.createdAt);

    return res.json({
      ok: true,
      history: history.slice(0, 20), // Limit to last 20 transactions
    });

  } catch (err) {
    console.error("[caps-redeem] history error:", err);
    return res.status(500).json({ ok: false, error: "Failed to fetch redemption history" });
  }
});

module.exports = router;
