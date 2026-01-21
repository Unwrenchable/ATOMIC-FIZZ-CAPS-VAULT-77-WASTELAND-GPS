// backend/api/redeem-voucher.js
const router = require("express").Router();
const bs58 = require("bs58");
const nacl = require("tweetnacl");
const { authMiddleware } = require("../lib/auth");
const gps = require("../lib/gps"); // serializeVoucherMessage, verifyVoucherSignature
const caps = require("../lib/caps"); // mintCapsToPlayer
const redis = require("../lib/redis"); // use the shared redis wrapper

const VOUCHER_USED_KEY = (voucherId) => `voucher:used:${voucherId}`; // value: JSON { usedBy, usedAt, tx }

if (!redis) {
  console.warn("[redeem-voucher] Redis wrapper not available — voucher replay protection may not persist across restarts.");
}

const PUBLIC_KEYS = {
  // example: "v1": "base58pubkey..."
  // populate at startup or via admin API
};

function getPublicKeyForKeyId(keyId) {
  return PUBLIC_KEYS[keyId] || null;
}

// Mounted at /api/redeem-voucher (server mounts this file at /api/<name>)
router.post("/redeem-voucher", authMiddleware, async (req, res) => {
  try {
    const player = req.player;
    const { voucher, serverKey } = req.body;
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
        signature = bs58.decode(signature);
      } catch (e) {
        return res.status(400).json({ error: "Invalid signature encoding" });
      }
    } else if (Array.isArray(signature)) {
      signature = Uint8Array.from(signature);
    } else if (!(signature instanceof Uint8Array)) {
      return res.status(400).json({ error: "Unsupported signature format" });
    }

    // 2) Resolve public key for keyId
    const pubKeyBase58 = getPublicKeyForKeyId(keyId);
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
    if (redis && typeof redis.set === "function") {
      const usedKey = VOUCHER_USED_KEY(voucherId);
      const value = JSON.stringify({ usedBy: player, usedAt: Date.now() });
      const ttlSeconds = Number(ttl) + 60; // keep a buffer

      // Support both node-redis and fallback wrappers:
      // - node-redis v4: set(key, value, { NX: true, EX: ttlSeconds })
      // - ioredis or simple wrappers: set(key, value, "NX", "EX", ttlSeconds)
      let setRes;
      try {
        if (redis.set.length >= 3) {
          // try node-redis style first
          setRes = await redis.set(usedKey, value, { NX: true, EX: ttlSeconds });
        } else {
          // fallback style
          setRes = await redis.set(usedKey, value, "NX", "EX", ttlSeconds);
        }
      } catch (e) {
        // Some wrappers return null/undefined on NX failure; normalize behavior
        setRes = setRes || null;
      }

      // Normalize check for success
      const alreadyUsed = !(setRes === "OK" || setRes === true);
      if (alreadyUsed) {
        const existingRaw = await redis.get(usedKey);
        const existing = existingRaw ? JSON.parse(existingRaw) : null;
        return res.status(409).json({ error: "Voucher already redeemed", info: existing });
      }
    } else {
      // In-memory fallback not implemented here; reject to be safe
      return res.status(500).json({ error: "Replay protection not available" });
    }

    // 6) Mint CAPS or award loot atomically (call your caps mint)
    const lootId = voucher.lootId;
    const amount = Number(
      process.env.LOOT_ID_TO_CAPS?.split?.(",")?.find?.((s) => s.startsWith(`${lootId}:`))?.split?.(":")[1]
      || process.env.DEFAULT_LOOT_CAPS
      || 100
    );
    const mintResult = await caps.mintCapsToPlayer(player, amount);

    // 7) Audit success (store tx/signature in used key)
    if (redis && typeof redis.set === "function") {
      const usedKey = VOUCHER_USED_KEY(voucherId);
      await redis.set(usedKey, JSON.stringify({ usedBy: player, usedAt: Date.now(), mintResult }), { EX: Number(ttl) + 60 });
    }

    return res.json({ ok: true, voucherId, minted: amount, mintResult });
  } catch (err) {
    console.error("[redeem-voucher] error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
