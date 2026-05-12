// backend/api/redeem-voucher.js
const router = require("express").Router();
const { decode: bs58decode } = require("../lib/safe-base58");
const rateLimit = require("express-rate-limit");
// nacl reserved for future signature ops (tweetnacl)
const { authMiddleware } = require("../lib/auth");
const gps = require("../lib/gps"); // serializeVoucherMessage, verifyVoucherSignature
const caps = require("../lib/caps"); // mintCapsToPlayer
const redis = require("../lib/redis"); // use the shared redis wrapper
const { getKeyMeta } = require("../lib/keys"); // load signing keys from Redis

// BUG-044 FIX: call redis.key() here so VOUCHER_USED_KEY returns a
// single-prefixed string (e.g. "afw:voucher:used:<id>").  When passed to
// redis.set/get the wrapper applies key() a second time, yielding the
// double-prefixed "afw:afw:voucher:used:<id>" — the same convention as
// every other app key (caps, players, cooldowns, etc.).  Identical to the
// pattern used in caps.js:  const cooldownKey = key(...) → redis.set(cooldownKey).
// Before this fix VOUCHER_USED_KEY returned the raw "voucher:used:<id>" string;
// the wrapper's single key() call produced only "afw:voucher:used:<id>" —
// a namespace inconsistency that would orphan replay-protection keys during
// a targeted "afw:afw:*" flush, silently allowing voucher replay attacks.
const VOUCHER_USED_KEY = (voucherId) => redis.key(`voucher:used:${voucherId}`);
const NODE_ENV = process.env.NODE_ENV || "development";
const STRICT_REPLAY_PROTECTION = process.env.STRICT_REPLAY_PROTECTION !== "false";

// Rate limiter: voucher redemption is value-bearing; cap at 10 per 5 minutes per IP
// to mitigate flooding and enumeration attacks (CodeQL js/missing-rate-limiting fix).
const redeemLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { ok: false, error: "Too many redemption requests — slow down, Vault Dweller" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validate Redis availability at startup
if (!redis || typeof redis.set !== "function") {
  console.error("[redeem-voucher] CRITICAL: Redis wrapper not available!");
  console.error("[redeem-voucher] Voucher replay protection will NOT function properly.");
  if (NODE_ENV === "production" && STRICT_REPLAY_PROTECTION) {
    console.error("[redeem-voucher] Set STRICT_REPLAY_PROTECTION=false to disable this check (NOT RECOMMENDED).");
  }
}

// Resolve public key for a keyId by querying the keys service (Redis-backed).
// Returns the base58-encoded public key, or null if the key is unknown/inactive.
async function getPublicKeyForKeyId(keyId) {
  const meta = await getKeyMeta(keyId);
  if (!meta || meta.status !== "active") return null;
  return meta.publicKey || meta.publicKeyBase58 || null;
}

// Mounted at /api/redeem-voucher (server mounts this file at /api/<name>)
// BUG-001 FIX: route was "/redeem-voucher" causing effective URL to be
// /api/redeem-voucher/redeem-voucher (404 for every client call).  Corrected to "/".
router.post("/", redeemLimiter, authMiddleware, async (req, res) => {
  try {
    const player = req.player;
    const { voucher } = req.body;
    // voucher: { voucherId, keyId, lootId, latitude, longitude, timestamp, ttlSeconds, locationHint }
    // serverKey: optional base58 public key (not trusted unless matches server registry)

    if (!voucher || typeof voucher !== "object") return res.status(400).json({ error: "Missing voucher" });

    // Basic fields
    const { voucherId, keyId, timestamp, ttlSeconds } = voucher;
    if (!voucherId || !keyId || !timestamp) return res.status(400).json({ error: "Malformed voucher" });

    // 1) Verify signature presence
    let signature = req.body.signature; // expect Array<number> or Uint8Array or base58 string
    if (!signature) return res.status(400).json({ error: "Missing signature" });

    // Accept a base58-encoded signature string as well
    if (typeof signature === "string") {
      try {
        signature = bs58decode(signature);
      } catch (e) {
        return res.status(400).json({ error: "Invalid signature encoding" });
      }
    } else if (Array.isArray(signature)) {
      signature = Uint8Array.from(signature);
    } else if (!(signature instanceof Uint8Array)) {
      return res.status(400).json({ error: "Unsupported signature format" });
    }

    // 2) Resolve public key for keyId (async — reads from Redis via keys service)
    const pubKeyBase58 = await getPublicKeyForKeyId(keyId);
    if (!pubKeyBase58) return res.status(400).json({ error: "Unknown signing key" });

    // 3) Recreate message and verify signature
    const message = gps.serializeVoucherMessage(voucher);
    const okSig = gps.verifyVoucherSignature(message, signature, pubKeyBase58);
    if (!okSig) {
      console.warn(`[redeem-voucher] signature verification failed for voucher ${voucherId}`);
      return res.status(400).json({ error: "Invalid voucher signature" });
    }

    // 4) Check expiry
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const ts = BigInt(timestamp);
    const ttl = BigInt(ttlSeconds || Number(process.env.VOUCHER_TTL_SECONDS || 3600));
    if (ts + ttl < nowSec) return res.status(400).json({ error: "Voucher expired" });

    // 5) Replay protection: atomically mark voucher used in Redis
    // CRITICAL: This protection is mandatory for production environments
    if (!redis || typeof redis.set !== "function") {
      if (NODE_ENV === "production" && STRICT_REPLAY_PROTECTION) {
        console.error("[redeem-voucher] CRITICAL: Redis unavailable for replay protection in production!");
        return res.status(503).json({
          error: "Replay protection service unavailable",
          reason: "Redis is required for voucher redemption in production"
        });
      }
      console.warn("[redeem-voucher] WARNING: Proceeding without replay protection (development mode only)");
      // In development mode without strict protection, allow proceeding (for testing)
    } else {
      // Check if we're using the in-memory fallback (not safe for production)
      if (redis.usingFallback && redis.usingFallback() && NODE_ENV === "production" && STRICT_REPLAY_PROTECTION) {
        console.error("[redeem-voucher] CRITICAL: Using in-memory Redis fallback in production!");
        return res.status(503).json({
          error: "Replay protection insufficient",
          reason: "Redis in-memory fallback is not safe for production voucher redemption"
        });
      }

      const usedKey = VOUCHER_USED_KEY(voucherId);
      // SECURITY: only store wallet address in audit log, not the full player session
      // object (which would include sessionId, allowing session hijacking from Redis).
      const value = JSON.stringify({ usedBy: player.wallet, usedAt: Date.now() });
      const ttlSecondsValue = Number(ttl) + 60; // keep a buffer

      // Support both node-redis and fallback wrappers:
      // - node-redis v4: set(key, value, { NX: true, EX: ttlSeconds })
      // - ioredis or simple wrappers: set(key, value, "NX", "EX", ttlSeconds)
      let setRes;
      try {
        if (redis.set.length >= 3) {
          // try node-redis style first
          setRes = await redis.set(usedKey, value, { NX: true, EX: ttlSecondsValue });
        } else {
          // fallback style
          setRes = await redis.set(usedKey, value, "NX", "EX", ttlSecondsValue);
        }
      } catch (e) {
        console.error("[redeem-voucher] Redis set error:", e.message);
        // Some wrappers return null/undefined on NX failure; normalize behavior
        setRes = null;
      }

      // Normalize check for success
      const alreadyUsed = !(setRes === "OK" || setRes === true);
      if (alreadyUsed) {
        const existingRaw = await redis.get(usedKey);
        const existing = existingRaw ? JSON.parse(existingRaw) : null;
        console.warn(`[redeem-voucher] Replay attack blocked: voucher ${voucherId} already redeemed`);
        return res.status(409).json({ error: "Voucher already redeemed", info: existing });
      }
    }

    // 6) Mint CAPS or award loot atomically (call your caps mint)
    // BUG-042 FIX: use the caps value signed into the voucher by the server at
    // issue time (based on POI rarity).  This value is covered by the NaCl
    // signature verified above and cannot be tampered by the client.
    // Fall back to DEFAULT_LOOT_CAPS (or 100) for vouchers issued before this
    // change that lack the caps field.
    const rawCaps = voucher.caps !== undefined && voucher.caps !== null
      ? Number(voucher.caps)
      : Number(process.env.DEFAULT_LOOT_CAPS || 100);
    // Sanity-clamp: must be a positive integer within a reasonable server-defined range.
    const MAX_VOUCHER_CAPS = Number(process.env.MAX_VOUCHER_CAPS || 10000);
    const amount = Number.isFinite(rawCaps) && rawCaps > 0 && rawCaps <= MAX_VOUCHER_CAPS
      ? Math.floor(rawCaps)
      : Number(process.env.DEFAULT_LOOT_CAPS || 100);
    const mintResult = await caps.mintCapsToPlayer(player.wallet, amount);

    // 7) Audit success — store wallet only, not full session object
    if (redis && typeof redis.set === "function") {
      const usedKey = VOUCHER_USED_KEY(voucherId);
      await redis.set(usedKey, JSON.stringify({ usedBy: player.wallet, usedAt: Date.now(), mintResult }), { EX: Number(ttl) + 60 });
    }

    return res.json({ ok: true, voucherId, minted: amount, mintResult });
  } catch (err) {
    console.error("[redeem-voucher] error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
