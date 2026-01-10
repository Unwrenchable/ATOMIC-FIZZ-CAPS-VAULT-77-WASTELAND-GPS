// backend/api/admin.js

const express = require("express");
const router = express.Router();

const adminLib = require("../../backend/lib/admin");

router.get("/nonce", async (req, res) => {
  try {
    const wallet = req.query.wallet;
    if (!wallet) {
      return res.status(400).json({ error: "missing wallet" });
    }

    if (!adminLib.isAdminWallet(wallet)) {
      return res.status(403).json({ error: "wallet not authorized" });
    }

    const nonce = await adminLib.issueNonce(wallet);
    res.json({ ok: true, nonce });
  } catch (err) {
    console.error("[api/admin] nonce error:", err?.message || err);
    res.status(500).json({ error: "failed to issue nonce" });
  }
});

router.post("/verify", express.json(), async (req, res) => {
  try {
    const { wallet, signature } = req.body || {};

    if (!wallet || !signature) {
      return res.status(400).json({ error: "missing wallet or signature" });
    }

    if (!adminLib.isAdminWallet(wallet)) {
      return res.status(403).json({ error: "wallet not authorized" });
    }

    await adminLib.verifySignedNonce(wallet, signature);

    // You can upgrade this to JWT/session later; for now:
    res.json({ ok: true });
  } catch (err) {
    console.error("[api/admin] verify error:", err?.message || err);
    res.status(401).json({ error: err.message || "verification failed" });
  }
});

module.exports = router;
