const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const cooldowns = require("../lib/cooldowns");

// Mounted at /api/cooldowns
router.post("/check", authMiddleware, async (req, res) => {
  try {
    const player = req.player;
    const { action } = req.body;

    if (!player || !player.wallet) {
      return res.status(401).json({ error: "Unauthorized: missing player" });
    }

    if (!action || typeof action !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'action' in request body" });
    }

    const result = await cooldowns.check(player, action);
    return res.json(result);
  } catch (err) {
    console.error("[api/cooldowns] check error:", err && err.stack ? err.stack : err);
    return res.status(400).json({ error: err?.message || "Cooldown check failed" });
  }
});

module.exports = router;
