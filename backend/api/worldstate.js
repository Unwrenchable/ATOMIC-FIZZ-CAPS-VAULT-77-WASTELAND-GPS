// backend/api/worldstate.js — Vault-77 live worldstate endpoint
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  try {
    const worldstate = req.app.get('worldstate') || {};
    res.json({ ok: true, worldstate });
  } catch (err) {
    console.error('[worldstate]', err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
