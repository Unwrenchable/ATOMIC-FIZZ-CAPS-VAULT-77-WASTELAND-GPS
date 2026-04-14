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
// Records a battle win for the authenticated player
// ------------------------------------------------------------
router.post("/win", authMiddleware, battleLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;

    const playerKey = key(`player:${wallet}`);
    let playerData = await redis.hget(playerKey, "profile");

    if (!playerData) {
      return res.status(404).json({ ok: false, error: "Player not found" });
    }

    const player = JSON.parse(playerData);
    player.battleWins = (player.battleWins || 0) + 1;

    await redis.hset(playerKey, "profile", JSON.stringify(player));

    console.log(`[battles] ${wallet.slice(0, 8)} recorded battle win. Total: ${player.battleWins}`);

    return res.json({ ok: true, battleWins: player.battleWins });
  } catch (err) {
    console.error("[battles] win error:", err);
    return res.status(500).json({ ok: false, error: "Failed to record battle win" });
  }
});

module.exports = router;