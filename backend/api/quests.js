// backend/api/quests.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Quests API
// Mounted at /api/quests
// ------------------------------------------------------------

const router = require("express").Router();
const rateLimit = require("express-rate-limit");

// ------------------------------------------------------------
// Per-route limiter (quests endpoints will expand later)
// ------------------------------------------------------------
const questsLimiter = rateLimit({
  windowMs: 5 * 1000,
  max: 20,
  message: { ok: false, error: "Too many quest requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// GET /api/quests/health
// ------------------------------------------------------------
router.get("/health", questsLimiter, (req, res) => {
  try {
    return res.json({
      ok: true,
      msg: "quests placeholder",
    });
  } catch (err) {
    console.error("[api/quests] health error:", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: "Quest health check failed",
    });
  }
});

module.exports = router;

/* Minimal GET / handler added to ensure API responds with JSON */
router.get('/', async (req, res) => {
  try {
    if (typeof listQuests === 'function') {
      const data = await listQuests();
      return res.json(data);
    }
    return res.json([]);
  } catch (err) {
    console.error('[quests] GET / error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'internal' });
  }
});
