// backend/api/keys-admin.js
const router = require("express").Router();
const keys = require("../lib/keys");
const { authMiddleware } = require("../lib/auth");

// Admin middleware must verify caller has admin role
async function adminOnly(req, res, next) {
  if (!req.player) return res.status(401).end();
  // implement your RBAC check here
  if (!req.playerIsAdmin) return res.status(403).end();
  next();
}

router.post("/api/keys/add", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { keyId, publicKeyBase58, status, expiresAt, notes } = req.body;
    const meta = await keys.addPublicKey(keyId, publicKeyBase58, { status, expiresAt, notes });
    res.json({ ok: true, meta });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/api/keys/update-status", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { keyId, status } = req.body;
    const meta = await keys.updateKeyStatus(keyId, status);
    res.json({ ok: true, meta });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/api/keys/list", authMiddleware, adminOnly, async (req, res) => {
  const list = await keys.listKeys();
  res.json({ ok: true, keys: list });
});

module.exports = router;
