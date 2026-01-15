const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const cooldowns = require("../lib/cooldowns");

// Mounted at /api/cooldowns
router.post("/check", authMiddleware, async (req, res) => {
  try {
    const player = req.player;
    const { action } = req.body;

    const result = await cooldowns.check(player, action);
    res.json(result);
  } catch (err) {
    console.error("[api/cooldowns] check error:", err?.message || err);
    res.status(400).json({ error: err.message || "Cooldown check failed" });
  }
});

module.exports = router;
