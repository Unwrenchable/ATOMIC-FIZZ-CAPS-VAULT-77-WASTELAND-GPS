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
router.post("/award", authMiddleware, xpLimiter, async (req, res) => {
  try {
    const { amount } = req.body;
    const player = req.player; // trusted from authMiddleware

    // -----------------------------
    // Input validation
    // -----------------------------
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1_000_000
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid XP amount" });
    }

    if (!player || typeof player !== "string" || player.length > 128) {
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
