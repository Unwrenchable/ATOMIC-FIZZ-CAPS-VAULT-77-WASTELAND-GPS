// backend/api/quest-endings.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Quest Ending Selection API
// Mounted at /api/quest-endings
// ------------------------------------------------------------

const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { authMiddleware } = require("../lib/auth");
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
// SECURITY FIX: added authMiddleware — previously any unauthenticated caller
// could POST any wallet address and trigger quest endings for any player,
// altering progression state without owning the account.
// ------------------------------------------------------------
router.post("/", authMiddleware, endingLimiter, async (req, res) => {
  try {
    // SECURITY FIX: player wallet from verified session, not from req.body.player
    const player = req.player.wallet;
    const { questId, endingId } = req.body;

    // -----------------------------
    // Input validation
    // -----------------------------
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
      player,
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
