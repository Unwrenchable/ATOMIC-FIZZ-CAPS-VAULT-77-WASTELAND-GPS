const express = require("express");
const router = express.Router();
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { redis, key } = require('../lib/redis');
const EventEmitter = require('events');
const { getSession } = require('../lib/auth');

// Local event bus to emit mint requests for on-chain workers to pick up
const mintBus = new EventEmitter();
// expose for other modules to listen if they require
router.mintBus = mintBus;

// Very small dev-safe mint endpoint.
// This does NOT perform any on-chain minting or token transfers.
// It is intended as a development helper so the frontend "claim" flow can proceed.

const limiter = rateLimit({ windowMs: 10*1000, max: 8, standardHeaders: true, legacyHeaders: false });
router.use(limiter);

// Optional session attachment: populate req.player if a valid session header is present.
// Does not block the request if no session exists (auth is enforced per-env below).
async function tryAttachSession(req, res, next) {
  try {
    const header = req.headers['authorization'] || req.headers['x-session-id'];
    if (header) {
      let sessionId = header;
      if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
        sessionId = header.slice(7).trim();
      }
      if (sessionId && typeof sessionId === 'string' && sessionId.length <= 256) {
        const session = await getSession(sessionId);
        if (session && session.wallet) {
          req.player = { wallet: session.wallet, sessionId };
        }
      }
    }
  } catch (_) { /* non-fatal */ }
  next();
}

router.use(tryAttachSession);

// POST /api/mint-item
// Authenticated: wallet sourced from verified session (req.player.wallet).
// Admin minting: always requires ADMIN_MINT_SECRET header in all environments.
router.post('/', async (req, res) => {
  try {
    // Always source wallet from the verified session to prevent IDOR.
    // Unauthenticated callers must supply the admin secret.
    if (!req.player || !req.player.wallet) {
      // Allow admin-authenticated minting without a player session
      const adminSecret = process.env.ADMIN_MINT_SECRET || '';
      const supplied = req.headers['x-admin-mint'] || (req.body && req.body.adminSecret);
      const secretOk = adminSecret && supplied && (() => {
        const h1 = crypto.createHash('sha256').update(String(adminSecret)).digest();
        const h2 = crypto.createHash('sha256').update(String(supplied)).digest();
        return crypto.timingSafeEqual(h1, h2);
      })();
      if (!secretOk) {
        return res.status(401).json({ ok: false, error: 'authentication_required' });
      }
    }

    // Prefer authenticated session wallet to prevent IDOR
    let wallet;
    if (req.player && req.player.wallet) {
      wallet = req.player.wallet;
    } else {
      // Admin path: wallet from body (validated by admin secret above)
      wallet = (req.body && req.body.wallet) || req.query.wallet;
      if (!wallet) {
        return res.status(400).json({ ok: false, error: 'wallet_required' });
      }
    }

    // Simple validation to avoid abuse
    if (typeof wallet !== 'string' || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: 'invalid_wallet' });
    }

    const NODE_ENV = process.env.NODE_ENV || 'development';

    if (NODE_ENV === 'production') {
      // Require admin secret for production mints. This prevents public abuse.
      const adminSecret = process.env.ADMIN_MINT_SECRET || '';
      const supplied = req.headers['x-admin-mint'] || req.body.adminSecret;
      // BUG FIX: was using `supplied !== adminSecret` which is vulnerable to timing
      // attacks (an attacker can measure response time to enumerate the secret byte
      // by byte). Use crypto.timingSafeEqual on SHA-256 digests for constant-time
      // comparison, mirroring the pattern used in quests-store.js.
      const secretOk = adminSecret && supplied && (() => {
        const h1 = crypto.createHash('sha256').update(String(adminSecret)).digest();
        const h2 = crypto.createHash('sha256').update(String(supplied)).digest();
        return crypto.timingSafeEqual(h1, h2);
      })();
      if (!secretOk) {
        console.warn('[mint-item] blocked production mint attempt - missing or invalid admin secret');
        return res.status(403).json({ ok: false, error: 'forbidden' });
      }
      // Production flow: perform per-wallet rate limiting, audit and enqueue mint job for worker
      try {
        // per-wallet daily limit key
        const walletKey = key(`mint:count:${wallet}`);
        const cur = parseInt(await redis.get(walletKey) || '0', 10);
        const DAILY_LIMIT = parseInt(process.env.MINT_DAILY_LIMIT || '5', 10);
        if (cur >= DAILY_LIMIT) {
          return res.status(429).json({ ok: false, error: 'mint_limit_reached' });
        }

        // increment and set expiry (24h)
        await redis.set(walletKey, String(cur + 1), { EX: 24 * 3600 });

        const prodItemId = `mint-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

        // Audit record in Redis (list)
        const audit = {
          itemId: prodItemId,
          wallet,
          createdAt: Date.now(),
          requestedBy: req.player ? req.player.wallet : 'admin',
          ip: req.ip || req.connection?.remoteAddress || null
        };
        const auditKey = key(`mint:audit:${prodItemId}`);
        await redis.set(auditKey, JSON.stringify(audit), { EX: 7 * 24 * 3600 });

        // push job to a queue (Redis list) for on-chain worker to pick up
        const queueListKey = key('mint:queue:list');
        const streamKey = key('mint:queue:stream');
        const job = { type: 'mint', itemId: prodItemId, wallet, auditKey };
        // Prefer Redis Stream (XADD) for robust queueing; fall back to list
        try {
          if (redis && redis.client && typeof redis.client.sendCommand === 'function') {
            try {
              // XADD streamKey * data <json>
              await redis.client.sendCommand(['XADD', streamKey, '*', 'data', JSON.stringify(job)]);
            } catch (e) {
              // if XADD fails, try list push
              if (typeof redis.client.lPush === 'function') {
                await redis.client.lPush(queueListKey, JSON.stringify(job));
              } else {
                const existing = await redis.get(queueListKey) || '[]';
                const arr = JSON.parse(existing);
                arr.push(job);
                await redis.set(queueListKey, JSON.stringify(arr));
              }
            }
          } else if (redis && redis.client && typeof redis.client.lPush === 'function') {
            await redis.client.lPush(queueListKey, JSON.stringify(job));
          } else {
            // fallback: store as JSON array under the key (not ideal for concurrency)
            const existing = await redis.get(queueListKey) || '[]';
            const arr = JSON.parse(existing);
            arr.push(job);
            await redis.set(queueListKey, JSON.stringify(arr));
          }
        } catch (e) {
          // best-effort fallback
          const existing = await redis.get(queueListKey) || '[]';
          const arr = JSON.parse(existing);
          arr.push(job);
          await redis.set(queueListKey, JSON.stringify(arr));
        }

        // Emit local event for in-process workers
        mintBus.emit('mint_request', job);

        console.log(`[mint-item] enqueued production mint for ${wallet}: ${prodItemId}`);

        return res.json({ ok: true, success: true, itemId: prodItemId, queued: true });
      } catch (err) {
        console.error('[mint-item] production flow error:', err && err.stack ? err.stack : err);
        return res.status(500).json({ ok: false, error: 'server_error' });
      }
    }

    // Development fallback: return a fake mint result
    const fakeItemId = `dev-item-${Date.now()}`;
    const fakeItem = {
      itemId: fakeItemId,
      name: 'DEV: Starter Ration',
      description: 'A developer-issued starter item (dev only).',
      mintedFor: wallet,
      mintedAt: Date.now(),
    };

    // In dev we can log the action
    console.log(`[mint-item] dev mint simulated for ${wallet}: ${fakeItemId}`);

    return res.json({ ok: true, success: true, itemId: fakeItemId, item: fakeItem });
  } catch (err) {
    console.error('[mint-item] error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;
