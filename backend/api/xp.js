// backend/api/xp.js
const router = require("express").Router();
const { authMiddleware } = require("../lib/auth");
const xp = require("../lib/xp"); // async module

router.post("/api/xp/award", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const player = req.player; // trusted from JWT

    // awardXp is async and validates inputs internally
    const result = await xp.awardXp(player, amount);

    res.json(result);
  } catch (err) {
    console.error("[api/xp] award error:", err && err.message ? err.message : err);
    // Validation or policy errors -> 400, others -> 500
    const status = err && /limit|invalid|missing/i.test(err.message) ? 400 : 500;
    res.status(status).json({ error: err.message || "Failed to award XP" });
  }
});

module.exports = router;
