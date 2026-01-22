// backend/api/keys-admin.js
const router = require("express").Router();
const { authMiddleware } = require("../lib/auth");

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

// Admin middleware must verify caller has admin role
async function adminOnly(req, res, next) {
  if (!req.player) return res.status(401).end();
  // implement your RBAC check here
  if (!req.playerIsAdmin) return res.status(403).end();
  next();
}

// Helper to respond when keys subsystem is unavailable
function keysUnavailable(res) {
  return res.status(503).json({ ok: false, error: "keys subsystem unavailable" });
}

// Routes are relative so mounting works correctly (e.g., mounted at /api/keys-admin)
router.post("/add", authMiddleware, adminOnly, async (req, res) => {
  const k = loadKeysModule();
  if (!k) return keysUnavailable(res);
  try {
    const { keyId, publicKeyBase58, status, expiresAt, notes } = req.body;
    const meta = await k.addPublicKey(keyId, publicKeyBase58, { status, expiresAt, notes });
    res.json({ ok: true, meta });
  } catch (err) {
    res.status(400).json({ ok: false, error: err && err.message });
  }
});

router.post("/update-status", authMiddleware, adminOnly, async (req, res) => {
  const k = loadKeysModule();
  if (!k) return keysUnavailable(res);
  try {
    const { keyId, status } = req.body;
    const meta = await k.updateKeyStatus(keyId, status);
    res.json({ ok: true, meta });
  } catch (err) {
    res.status(400).json({ ok: false, error: err && err.message });
  }
});

router.get("/list", authMiddleware, adminOnly, async (req, res) => {
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
