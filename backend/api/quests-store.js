// backend/api/quests-store.js
// Small server-side quest store and API. Migrates sensitive quest data to server.

const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { redis, key } = require('../lib/redis');
const { authMiddleware } = require('../lib/auth');

// SECURITY: Constant-time comparison to prevent timing attacks
// Uses SHA-256 hashing to ensure both length and content comparison are constant-time
function safeCompare(a, b) {
  const hash1 = crypto.createHash('sha256').update(String(a || "")).digest();
  const hash2 = crypto.createHash('sha256').update(String(b || "")).digest();
  return crypto.timingSafeEqual(hash1, hash2);
}

// Key for storing quests JSON
// BUG-009 FIX: removed key() call — the redis wrapper adds the prefix
// internally, so pre-calling key() caused a double-prefix (afw:afw:quests:store).
// Using the bare string keeps the key at the expected afw:quests:store namespace.
const QUESTS_KEY = 'quests:store';

// ------------------------------------------------------------
// Rate limiters for sensitive endpoints
// ------------------------------------------------------------
// Quest proof submissions (token guessing protection)
const proveRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute per IP
  message: { ok: false, error: 'Too many proof attempts. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin endpoints (heightened security)
const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { ok: false, error: 'Too many admin requests. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General quest operations
const questRateLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 30, // 30 requests per 10 seconds
  message: { ok: false, error: 'Too many quest requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Default minimal public placeholders (client will fetch these)
const DEFAULT_PLACEHOLDERS = [
  { id: 'wake_up', name: 'Wake Up', type: 'objectives', short: 'Tutorial: get your bearings' },
  { id: 'quest_vault77_open', name: 'Open Vault 77', type: 'steps', short: 'Find entry to Vault 77' },
  { id: 'quest_lost_signal', name: 'Lost Signal', type: 'steps', short: 'Investigate a broken beacon' }
  ,{ id: 'saitama_main_arc', name: 'Saitama Echo', type: 'meta', short: 'Learning quest: crypto safety through a token scandal' }
];

// Load detailed quest data from backend/data/quests-expanded.json if present
const fs = require('fs');
const path = require('path');
let DETAILED = {};
try {
  const file = path.join(__dirname, '..', 'data', 'quests-expanded.json');
  if (fs.existsSync(file)) {
    DETAILED = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log('[quests-store] loaded expanded quests from data file');
  }
} catch (e) {
  console.warn('[quests-store] failed to load expanded quests', e && e.message ? e.message : e);
}
// load additional lore files
let SAITAMA_LORE = {};
try {
  const loreFile = path.join(__dirname, '..', 'data', 'lore-saitama.json');
  if (fs.existsSync(loreFile)) {
    SAITAMA_LORE = JSON.parse(fs.readFileSync(loreFile, 'utf8'));
    console.log('[quests-store] loaded saitama lore');
  }
} catch (e) {
  console.warn('[quests-store] failed to load saitama lore', e && e.message ? e.message : e);
}
// load extended lore (tutorials, stories)
try {
  const extFile = path.join(__dirname, '..', 'data', 'lore-saitama-extended.json');
  if (fs.existsSync(extFile)) {
    const ext = JSON.parse(fs.readFileSync(extFile, 'utf8'));
    // merge into SAITAMA_LORE
    SAITAMA_LORE = Object.assign({}, SAITAMA_LORE, ext);
    console.log('[quests-store] loaded saitama extended lore');
  }
} catch (e) {
  console.warn('[quests-store] failed to load extended saitama lore', e && e.message ? e.message : e);
}

// Ensure there's initial data
(async () => {
  try {
    const raw = await redis.get(QUESTS_KEY);
    if (!raw) {
      await redis.set(QUESTS_KEY, JSON.stringify(DETAILED));
      console.log('[quests-store] initialized quest store');
    }
  } catch (e) {
    console.warn('[quests-store] init error', e && e.message ? e.message : e);
  }
})();

// Public: get placeholders (safe to expose to client)
router.get('/placeholders', async (req, res) => {
  return res.json({ ok: true, placeholders: DEFAULT_PLACEHOLDERS });
});

// Test helper: allow setting a secret token in server-side redis (dev only or with admin secret)
router.post('/admin/set-token', adminRateLimiter, async (req, res) => {
  try {
    const { token, value, ttl } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: 'missing' });

    const NODE_ENV = process.env.NODE_ENV || 'development';
    if (NODE_ENV === 'production') {
      const admin = req.headers['x-admin-mint'] || req.body.adminSecret;
      const adminSecret = process.env.ADMIN_MINT_SECRET;
      // SECURITY: Use constant-time comparison to prevent timing attacks
      if (!admin || !adminSecret || !safeCompare(admin, adminSecret)) {
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
    }

    const keyName = `secret:token:${token}`;
    console.log(`[quests-store] admin set-token: ${keyName} ttl=${ttl||3600}`);
    await redis.set(keyName, value || '1', { EX: Number(ttl || 3600) });
    return res.json({ ok: true, token: token });
  } catch (e) {
    console.error('[quests-store] set-token error', e && e.message ? e.message : e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Expose lore by tag (e.g., 'saitama')
router.get('/lore/:tag', async (req, res) => {
  const tag = req.params.tag;
  if (!tag) return res.status(400).json({ ok: false, error: 'missing' });
  if (tag === 'saitama') return res.json({ ok: true, lore: SAITAMA_LORE });
  return res.status(404).json({ ok: false, error: 'unknown' });
});

// Accept proofs for quests that require verification.
// SECURITY: authMiddleware ensures only authenticated players can submit proofs,
// and wallet is taken from the verified session (req.player.wallet) to prevent
// IDOR (one player marking quest progress for any wallet via req.body).
router.post('/prove', authMiddleware, proveRateLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { questId, proof } = req.body || {};
    if (!questId || !proof) return res.status(400).json({ ok: false, error: 'missing' });

    // SECURITY: Do not log proof values as they contain secret tokens
    console.log('[quests-store] prove request', { wallet, questId, proofType: proof?.type });

    // Very small proof validation: if proof.token matches a stored token, accept
    if (proof.type === 'token' && proof.value) {
      // Try standard lookup via redis wrapper
      let stored = await redis.get(`secret:token:${proof.value}`);
      // SECURITY: Do not log stored value or keys containing secret tokens
      // If not found, attempt raw client read (supports cases where code used key(...) earlier)
      if (!stored && redis.client && typeof redis.client.get === 'function') {
        try {
          const rawKey = (typeof redis.key === 'function' ? redis.key(`secret:token:${proof.value}`) : null) || (process.env.REDIS_PREFIX || 'afw:') + `secret:token:${proof.value}`;
          stored = await redis.client.get(rawKey);
        } catch (e) {
          // ignore
        }
      }

      if (stored) {
        // mark quest proof for player
        // BUG FIX: previously stored `{ provenAt, proof }` which embeds the raw
        // proof.value (secret token) into Redis. If Redis is compromised, all
        // secret tokens would be exposed. Only persist audit metadata, not the
        // sensitive token value itself.
        const k = key(`quests:proof:${wallet}:${questId}`);
        await redis.set(k, JSON.stringify({ provenAt: Date.now(), proofType: proof.type }), { EX: 30 * 24 * 3600 });
        return res.json({ ok: true, proven: true });
      }

      return res.status(400).json({ ok: false, proven: false, error: 'invalid_proof' });
    }

    // Location-based proof: accept if proof.id matches a whitelist for quest
    if (proof.type === 'location' && proof.id) {
      // For example, vault77 location proof
      if (questId === 'saitama_main_arc' && proof.id === 'vault77') {
        const k = key(`quests:proof:${wallet}:${questId}`);
        // BUG FIX: same as token proof above — only store audit metadata, not the raw proof.
        await redis.set(k, JSON.stringify({ provenAt: Date.now(), proofType: proof.type }), { EX: 30 * 24 * 3600 });
        return res.json({ ok: true, proven: true });
      }
      return res.status(400).json({ ok: false, proven: false, error: 'invalid_location' });
    }

    return res.status(400).json({ ok: false, error: 'unsupported_proof' });
  } catch (e) {
    console.error('[quests-store] prove error', e && e.message ? e.message : e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Reveal full quest details for the authenticated player.
// SECURITY: authMiddleware + wallet from session prevents IDOR.
router.post('/reveal', authMiddleware, questRateLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { questId } = req.body || {};
    if (!questId) return res.status(400).json({ ok: false, error: 'missing' });

    const raw = await redis.get(QUESTS_KEY);
    const store = raw ? JSON.parse(raw) : {};
    const q = store[questId];
    if (!q) return res.status(404).json({ ok: false, error: 'unknown' });

    // Mark reveal in redis for audit
    const revealKey = key(`quests:revealed:${wallet}:${questId}`);
    await redis.set(revealKey, JSON.stringify({ revealedAt: Date.now() }), { EX: 30 * 24 * 3600 });

    return res.json({ ok: true, quest: q });
  } catch (err) {
    console.error('[quests-store] reveal error', err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Public: fetch specific quest by id (safe for authenticated player)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: 'missing' });
    const raw = await redis.get(QUESTS_KEY);
    const store = raw ? JSON.parse(raw) : {};
    const q = store[id];
    if (!q) return res.status(404).json({ ok: false, error: 'unknown' });
    return res.json({ ok: true, quest: q });
  } catch (e) {
    console.error('[quests-store] fetch error', e && e.message ? e.message : e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;
