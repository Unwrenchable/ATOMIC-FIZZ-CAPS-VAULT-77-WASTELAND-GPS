// backend/api/cooldowns.js
const router = require("express").Router();
const { authMiddleware } = require("../lib/auth");
const cooldowns = require("../lib/cooldowns");

// POST /api/cooldowns/check
// Body: { action: "loot", resourceId: "vault77-c" }
router.post("/api/cooldowns/check", authMiddleware, async (req, res) => {
  try {
    const player = req.player;
    const { action, resourceId } = req.body;
    if (!action || typeof action !== "string") return res.status(400).json({ ok: false, error: "Missing action" });

    const result = await cooldowns.checkCooldown(player, action, resourceId);
    res.json({ ok: result.ok, remainingSeconds: result.remainingSeconds });
  } catch (err) {
    console.error("[api/cooldowns] check error:", err && err.message ? err.message : err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

// POST /api/cooldowns/set
// Body: { action: "loot", resourceId: "vault77-c", seconds: 300 }
router.post("/api/cooldowns/set", authMiddleware, async (req, res) => {
  try {
    const player = req.player;
    const { action, resourceId, seconds } = req.body;
    if (!action || typeof action !== "string") return res.status(400).json({ ok: false, error: "Missing action" });

    const sec = seconds !== undefined ? Number(seconds) : undefined;
    const result = await cooldowns.setCooldown(player, action, resourceId, sec);
    res.json({ ok: result.ok, remainingSeconds: result.remainingSeconds });
  } catch (err) {
    console.error("[api/cooldowns] set error:", err && err.message ? err.message : err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
