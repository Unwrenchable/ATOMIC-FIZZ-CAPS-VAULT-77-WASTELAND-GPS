// backend/api/quest-endings.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Quest Ending Selection API
// Mounted at /api/quest-endings
// ------------------------------------------------------------

const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { chooseEnding } = require("../lib/quests");

// ------------------------------------------------------------
// Per-route limiter (quest endings are progression-critical)
// ------------------------------------------------------------
const endingLimiter = rateLimit({
  windowMs: 5 * 1000,
  max: 10,
  message: { ok: false, error: "Too many quest ending requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// POST /api/quest-endings/
// ------------------------------------------------------------
router.post("/", endingLimiter, async (req, res) => {
  try {
    const { player, questId, endingId } = req.body;

    // -----------------------------
    // Input validation
    // -----------------------------
    if (!player || typeof player !== "string" || player.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid player" });
    }

    if (!questId || typeof questId !== "string" || questId.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid questId" });
    }

    if (!endingId || typeof endingId !== "string" || endingId.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid endingId" });
    }

    // -----------------------------
    // Execute ending selection
    // -----------------------------
    const result = await chooseEnding(
      player.trim(),
      questId.trim(),
      endingId.trim()
    );

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[api/quest-endings] error:", err?.message || err);
    return res
      .status(400)
      .json({ ok: false, error: err.message || "Failed to choose ending" });
  }
});

module.exports = router;
