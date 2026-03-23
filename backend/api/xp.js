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
  windowMs: 60 * 1000,  // 1 minute window
  max: 3,               // max 3 XP award calls per minute (1500 XP/min max)
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

// BUG-002 FIX: Any authenticated player could call POST /api/xp/award to
// farm XP at 1,500 XP/min (rate limit 3/min × MAX_XP_PER_AWARD=500).
// All legitimate XP awards happen server-side in location-claim.js and
// quests.js.  This endpoint is now restricted to admin-role sessions only
// so it can still be used by privileged internal tooling, but regular
// players can no longer self-award XP.
router.post("/award", authMiddleware, xpLimiter, async (req, res) => {
  try {
    const { amount } = req.body;
    const player = req.player; // trusted from authMiddleware - object { wallet, role, sessionId }

    // Admin-only guard — regular players must not be able to self-award XP.
    if (!player || player.role !== "admin") {
      return res
        .status(403)
        .json({ ok: false, error: "Forbidden: XP award requires admin role" });
    }

    // -----------------------------
    // Input validation
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

    if (!player.wallet || typeof player.wallet !== "string") {
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
