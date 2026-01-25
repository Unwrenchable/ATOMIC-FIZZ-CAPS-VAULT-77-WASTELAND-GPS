const express = require('express');
const router = express.Router();
const { redis, key } = require('../lib/redis');

// This router handles server-side secret checks for quests.
// The idea: client asks the server whether a secret objective has been satisfied
// (e.g. found specific coordinates, solved puzzle, or obtained server-side token).
// The server validates using authoritative data and reveals small pieces of lore only when validated.

// Example: POST /api/quest-secrets/check
// body: { wallet, questId, proof }

// Simple in-memory placeholder for secret definitions (move to Redis or DB in production)
const SECRET_DEFS = {
  'wake_up_secret': {
    id: 'wake_up_secret',
    description: 'Hidden wake-up lore fragment',
    validate: async (proof) => {
      // Proof can be a token, location id, or other validated evidence.
      if (!proof) return false;
      // Example: if proof.type === 'token' and token matches a stored value in Redis
      if (proof.type === 'token' && proof.value) {
        const stored = await redis.get(key(`secret:token:${proof.value}`));
        return !!stored;
      }
      // Example: location-based proof
      if (proof.type === 'location' && proof.id) {
        // Accept if location id equals secret id (example)
        return proof.id === 'vault77';
      }
      return false;
    },
    lore: 'You were not the first to wake here. The Vault remembers.'
  }
};

router.post('/check', async (req, res) => {
  try {
    const { wallet, questId, proof } = req.body || {};
    if (!wallet || !questId) return res.status(400).json({ ok: false, error: 'missing' });

    const def = SECRET_DEFS[questId];
    if (!def) return res.status(404).json({ ok: false, error: 'unknown_secret' });

    const ok = await def.validate(proof);
    if (!ok) return res.json({ ok: false, matched: false });

    // Mark as revealed for this wallet (so client can't re-request unlimited times)
    const revealKey = key(`secret:revealed:${wallet}:${questId}`);
    await redis.set(revealKey, JSON.stringify({ revealedAt: Date.now() }), { EX: 30 * 24 * 3600 });

    // Audit and return minimal lore text
    return res.json({ ok: true, matched: true, lore: def.lore });
  } catch (err) {
    console.error('[quest-secrets] error:', err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;
