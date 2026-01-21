// backend/api/quests.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Quests API
// Mounted at /api/quests
// ------------------------------------------------------------

const router = require("express").Router();
const rateLimit = require("express-rate-limit");

// If a listQuests helper exists in backend/lib/quests.js, import it
let listQuests;
try {
  // require may throw if the module doesn't export listQuests; handle gracefully
  const questsLib = require("../lib/quests");
  listQuests = questsLib && questsLib.listQuests ? questsLib.listQuests : undefined;
} catch (e) {
  // no-op: keep listQuests undefined so fallback behavior returns an empty array
  listQuests = undefined;
}

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

// ------------------------------------------------------------
// GET /api/quests
// ------------------------------------------------------------
router.get("/", questsLimiter, async (req, res) => {
  try {
    if (typeof listQuests === "function") {
      const data = await listQuests(req);
      return res.json(Array.isArray(data) ? data : data || []);
    }
    // Fallback: return an empty array so the endpoint always responds with JSON
    return res.json([]);
  } catch (err) {
    console.error("[api/quests] GET / error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "internal" });
  }
});

module.exports = router;
