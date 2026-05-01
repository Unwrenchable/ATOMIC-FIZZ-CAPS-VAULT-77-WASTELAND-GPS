// backend/api/battles.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Battle API
// Mounted at /api/battles
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { redis, key } = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");

// ------------------------------------------------------------
// Per-route limiter (battles are frequent)
// ------------------------------------------------------------
const battleLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 20,
  message: { ok: false, error: "Too many battle requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// POST /api/battles/win
// Records a battle win for the authenticated player.
// Uses HINCRBY to atomically increment the dedicated battleWins
// hash field — no full profile JSON parse/stringify round-trip.
// ------------------------------------------------------------
router.post("/win", authMiddleware, battleLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const playerKey = key(`player:${wallet}`);

    // Verify the player profile exists before touching the counter
    const profileRaw = await redis.hget(playerKey, "profile");
    if (!profileRaw) {
      return res.status(404).json({ ok: false, error: "Player not found" });
    }

    // Atomically increment the dedicated battleWins hash field.
    // This avoids a full JSON parse + stringify of the entire profile
    // for every win event (which can fire up to 20 times per 10 seconds).
    const newCount = await redis.hincrby(playerKey, "battleWins", 1);

    console.log(`[battles] ${wallet.slice(0, 8)} recorded battle win. Total: ${newCount}`);

    return res.json({ ok: true, battleWins: newCount });
  } catch (err) {
    console.error("[battles] win error:", err);
    return res.status(500).json({ ok: false, error: "Failed to record battle win" });
  }
});

module.exports = router;