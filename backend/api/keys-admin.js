// backend/api/keys-admin.js
const router = require("express").Router();
const { requireAdmin, adminRateLimiter } = require("../middleware/adminAuth");

// Apply admin auth and rate limiting to all routes in this router
router.use(adminRateLimiter);
router.use(requireAdmin);

// Try to require the keys library lazily so missing optional deps don't crash startup
let keys;
function loadKeysModule() {
  if (keys) return keys;
  try {
    keys = require("../lib/keys");
    return keys;
  } catch (err) {
    // keep keys undefined and let handlers return 503
    console.warn("[keys-admin] keys module not available:", err && err.message);
    keys = null;
    return null;
  }
}

// Helper to respond when keys subsystem is unavailable
function keysUnavailable(res) {
  return res.status(503).json({ ok: false, error: "keys subsystem unavailable" });
}

// Routes are relative so mounting works correctly (e.g., mounted at /api/admin/keys)
router.post("/add", async (req, res) => {
  const k = loadKeysModule();
  if (!k) return keysUnavailable(res);
  try {
    const { keyId, publicKeyBase58, status, expiresAt, notes } = req.body;
    const meta = await k.addPublicKey(keyId, publicKeyBase58, { status, expiresAt, notes });
    console.log(`[keys-admin] Key ${keyId} added by admin`);
    res.json({ ok: true, meta });
  } catch (err) {
    res.status(400).json({ ok: false, error: err && err.message });
  }
});

router.post("/update-status", async (req, res) => {
  const k = loadKeysModule();
  if (!k) return keysUnavailable(res);
  try {
    const { keyId, status } = req.body;
    const meta = await k.updateKeyStatus(keyId, status);
    console.log(`[keys-admin] Key ${keyId} status updated to ${status} by admin`);
    res.json({ ok: true, meta });
  } catch (err) {
    res.status(400).json({ ok: false, error: err && err.message });
  }
});

router.get("/list", async (req, res) => {
  const k = loadKeysModule();
  if (!k) return keysUnavailable(res);
  try {
    const list = await k.listKeys();
    res.json({ ok: true, keys: list });
  } catch (err) {
    res.status(500).json({ ok: false, error: err && err.message });
  }
});

module.exports = router;
