// backend/api/xp.js
// ------------------------------------------------------------
// Atomic Fizz Caps – XP Awarding API
// Mounted at /api/xp
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const xp = require("../lib/xp");

// ------------------------------------------------------------
// Per-route limiter (XP is value-bearing)
// ------------------------------------------------------------
const xpLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 10,
  message: { ok: false, error: "Too many XP award requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// POST /api/xp/award
// ------------------------------------------------------------
// Maximum XP a player may award themselves per API call.
// Keeps the endpoint useful for legitimate game events (quest completion,
// exploration bonuses, etc.) while preventing a player from awarding
// themselves astronomical amounts in a single request.
const MAX_XP_PER_AWARD = 500;

router.post("/award", authMiddleware, xpLimiter, async (req, res) => {
  try {
    const { amount } = req.body;
    const player = req.player; // trusted from authMiddleware - object { wallet, role, sessionId }

    // -----------------------------
    // Input validation
    // SECURITY FIX: cap was 1,000,000 — far too high for a player-callable
    // endpoint.  An authenticated player could award themselves a million XP
    // per request (10 req/10s = 10M XP/s).  Capped to MAX_XP_PER_AWARD.
    // -----------------------------
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > MAX_XP_PER_AWARD
    ) {
      return res
        .status(400)
        .json({ ok: false, error: `Invalid XP amount (max ${MAX_XP_PER_AWARD})` });
    }

    if (!player || !player.wallet || typeof player.wallet !== "string") {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid player identity" });
    }

    // -----------------------------
    // Award XP
    // -----------------------------
    const result = await xp.awardXp(player, amount);

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[api/xp] award error:", err?.message || err);

    const status =
      err && /limit|invalid|missing/i.test(err.message) ? 400 : 500;

    return res
      .status(status)
      .json({ ok: false, error: err.message || "Failed to award XP" });
  }
});

module.exports = router;
