// backend/api/adminMintables.js
const express = require("express");
const router = express.Router();
const { redis, key } = require("../lib/redis");
const { requireAdmin, adminRateLimiter } = require("../middleware/adminAuth");

// Apply admin auth and rate limiting to all routes in this router
router.use(adminRateLimiter);
router.use(requireAdmin);

// Load all mintables
async function loadMintables() {
  const raw = await redis.get(key("mintables"));
  return raw ? JSON.parse(raw) : [];
}

// Save all mintables
async function saveMintables(list) {
  await redis.set(key("mintables"), JSON.stringify(list));
}

// GET /api/admin/mintables
router.get("/", async (req, res) => {
  try {
    const list = await loadMintables();
    res.json({ ok: true, mintables: list });
  } catch (err) {
    console.error("[adminMintables] load error:", err);
    res.status(500).json({ ok: false, error: "load_failed" });
  }
});

// POST /api/admin/mintables/save
router.post("/save", async (req, res) => {
  try {
    const { mintables } = req.body;
    if (!Array.isArray(mintables)) {
      return res.status(400).json({ ok: false, error: "invalid_format" });
    }

    await saveMintables(mintables);
    console.log("[adminMintables] Mintables updated by admin");
    res.json({ ok: true });
  } catch (err) {
    console.error("[adminMintables] save error:", err);
    res.status(500).json({ ok: false, error: "save_failed" });
  }
});

module.exports = router;
