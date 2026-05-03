const express = require("express");
const router = express.Router();
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { redis, key } = require('../lib/redis');
const EventEmitter = require('events');
const { getSession } = require('../lib/auth');
const {
  buildMetadataJson,
  hasMintSigner,
  normalizeLocationHint,
  selectMintable,
} = require('../lib/nft-minting');

// Local event bus to emit mint requests for on-chain workers to pick up
const mintBus = new EventEmitter();
// expose for other modules to listen if they require
router.mintBus = mintBus;

// Very small dev-safe mint endpoint.
// Production mints are queued for a worker that performs the on-chain NFT mint.

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

// Timing-safe comparison of the admin mint secret.
// Returns true if `supplied` matches ADMIN_MINT_SECRET env var.
function checkAdminSecret(supplied) {
  const adminSecret = process.env.ADMIN_MINT_SECRET || '';
  if (!adminSecret || !supplied) return false;
  const h1 = crypto.createHash('sha256').update(String(adminSecret)).digest();
  const h2 = crypto.createHash('sha256').update(String(supplied)).digest();
  return crypto.timingSafeEqual(h1, h2);
}

function parseOptionalCoordinate(value, min, max) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error('invalid_coordinate');
  }
  return parsed;
}

async function readAudit(jobId) {
  const raw = await redis.get(`mint:audit:${jobId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function enqueueJob(job) {
  const queueListKey = 'mint:queue:list';
  const queueListRedisKey = key(queueListKey);
  const streamKey = key('mint:queue:stream');
  const encoded = JSON.stringify(job);

  try {
    if (redis && redis.client && typeof redis.client.sendCommand === 'function') {
      await redis.client.sendCommand(['XADD', streamKey, '*', 'data', encoded]);
      return;
    }
  } catch (err) {
    console.warn('[mint-item] XADD failed, falling back to list queue:', err.message);
  }

  try {
    if (redis && redis.client && typeof redis.client.lPush === 'function') {
      await redis.client.lPush(queueListRedisKey, encoded);
      return;
    }
  } catch (err) {
    console.warn('[mint-item] LPUSH failed, falling back to JSON list:', err.message);
  }

  const existing = await redis.get(queueListKey) || '[]';
  const arr = JSON.parse(existing);
  arr.unshift(job);
  await redis.set(queueListKey, JSON.stringify(arr));
}

router.get('/status/:jobId', async (req, res) => {
  try {
    const audit = await readAudit(req.params.jobId);
    if (!audit) {
      return res.status(404).json({ ok: false, error: 'mint_not_found' });
    }

    return res.json({
      ok: true,
      jobId: audit.jobId,
      status: audit.status || 'queued',
      item: audit.item || null,
      mintAddress: audit.mintAddress || null,
      signature: audit.signature || null,
      error: audit.error || null,
      createdAt: audit.createdAt || null,
      processedAt: audit.processedAt || null,
    });
  } catch (err) {
    console.error('[mint-item] status lookup error:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

router.get('/metadata/:jobId', async (req, res) => {
  try {
    const audit = await readAudit(req.params.jobId);
    if (!audit) {
      return res.status(404).json({ ok: false, error: 'mint_not_found' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json(buildMetadataJson(audit));
  } catch (err) {
    console.error('[mint-item] metadata lookup error:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// POST /api/mint-item
// Authenticated: wallet sourced from verified session (req.player.wallet).
// Admin minting: always requires ADMIN_MINT_SECRET header in all environments.
router.post('/', async (req, res) => {
  try {
    // Always source wallet from the verified session to prevent IDOR.
    // Unauthenticated callers must supply the admin secret.
    if (!req.player || !req.player.wallet) {
      // Allow admin-authenticated minting without a player session
      const supplied = req.headers['x-admin-mint'] || (req.body && req.body.adminSecret);
      if (!checkAdminSecret(supplied)) {
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

    const body = req.body || {};
    const requestedItemId = body.itemId || body.mintableId || null;
    const item = selectMintable(requestedItemId);
    const locationHint = normalizeLocationHint(body.locationHint);
    let latitude = null;
    let longitude = null;

    try {
      latitude = parseOptionalCoordinate(body.latitude, -90, 90);
      longitude = parseOptionalCoordinate(body.longitude, -180, 180);
    } catch {
      return res.status(400).json({ ok: false, error: 'invalid_poi_data' });
    }

    if (!hasMintSigner()) {
      return res.status(503).json({
        ok: false,
        error: 'mint_signer_unavailable',
      });
    }

    // BUG FIX: player-authenticated mints must not require the admin secret.
    // Only the admin path without a player session requires explicit admin auth.
    try {
      const walletKey = `mint:count:${wallet}`;
      const dailyLimit = parseInt(process.env.MINT_DAILY_LIMIT || '5', 10);
      const newCount = await redis.incr(walletKey);
      if (newCount === 1) {
        await redis.expire(walletKey, 24 * 3600).catch(() => {});
      }
      if (newCount > dailyLimit) {
        await redis.decr(walletKey).catch(() => {});
        return res.status(429).json({ ok: false, error: 'mint_limit_reached' });
      }

      const jobId = crypto.randomBytes(12).toString('hex');
      const audit = {
        jobId,
        wallet,
        item,
        itemId: item.id,
        latitude,
        longitude,
        locationHint,
        status: 'queued',
        createdAt: Date.now(),
        requestedBy: req.player ? req.player.wallet : 'admin',
        ip: req.ip || req.connection?.remoteAddress || null,
      };
      await redis.set(`mint:audit:${jobId}`, JSON.stringify(audit), { EX: 7 * 24 * 3600 });

      const job = {
        type: 'mint',
        jobId,
        wallet,
        item,
        itemId: item.id,
        mintableId: item.id,
        latitude,
        longitude,
        locationHint,
        auditKey: `mint:audit:${jobId}`,
      };

      await enqueueJob(job);
      mintBus.emit('mint_request', job);

      console.log(`[mint-item] enqueued on-chain mint for ${wallet}: ${jobId} (${item.id})`);

      return res.json({
        ok: true,
        queued: true,
        jobId,
        itemId: item.id,
        item,
        statusUrl: `/api/mint-item/status/${jobId}`,
      });
    } catch (err) {
      console.error('[mint-item] mint enqueue error:', err && err.stack ? err.stack : err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  } catch (err) {
    console.error('[mint-item] error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

module.exports = router;
