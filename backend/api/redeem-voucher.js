// backend/api/redeem-voucher.js
const router = require("express").Router();
const bs58 = require("bs58");
const nacl = require("tweetnacl");
const { authMiddleware } = require("../lib/auth");
const gps = require("../lib/gps"); // serializeVoucherMessage, verifyVoucherSignature
const caps = require("../lib/caps"); // mintCapsToPlayer
const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || null;
const redis = REDIS_URL ? new Redis(REDIS_URL) : null;
const VOUCHER_USED_KEY = (voucherId) => `voucher:used:${voucherId}`; // value: JSON { usedBy, usedAt, tx }

if (!redis) {
  console.warn("[redeem-voucher] No REDIS_URL configured — voucher replay protection will not persist across restarts.");
}

// key registry: map keyId -> base58 public key
// In production, store this in DB or config service and cache it.
const PUBLIC_KEYS = {
  // example: "v1": "base58pubkey..."
  // populate at startup or via admin API
};

function getPublicKeyForKeyId(keyId) {
  return PUBLIC_KEYS[keyId] || null;
}

router.post("/api/redeem-voucher", authMiddleware, async (req, res) => {
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
    const signature = req.body.signature; // expect Array<number> or Uint8Array
    if (!signature) return res.status(400).json({ error: "Missing signature" });

    // 2) Resolve public key for keyId
    const pubKeyBase58 = getPublicKeyForKeyId(keyId);
    if (!pubKeyBase58) return res.status(400).json({ error: "Unknown signing key" });

    // 3) Recreate message and verify signature
    const message = gps.serializeVoucherMessage(voucher);
    const okSig = gps.verifyVoucherSignature(message, signature, pubKeyBase58);
    if (!okSig) {
      // audit and reject
      console.warn(`[redeem-voucher] signature verification failed for voucher ${voucherId}`);
      return res.status(400).json({ error: "Invalid voucher signature" });
    }

    // 4) Check expiry
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const ts = BigInt(timestamp);
    const ttl = BigInt(ttlSeconds || Number(process.env.VOUCHER_TTL_SECONDS || 3600));
    if (ts + ttl < nowSec) return res.status(400).json({ error: "Voucher expired" });

    // 5) Replay protection: atomically mark voucher used in Redis
    if (redis) {
      // Use SET NX with a value containing usedBy and usedAt; set a TTL slightly longer than voucher TTL
      const usedKey = VOUCHER_USED_KEY(voucherId);
      const value = JSON.stringify({ usedBy: player, usedAt: Date.now() });
      const ttlSeconds = Number(ttl) + 60; // keep a buffer
      const setRes = await redis.set(usedKey, value, "NX", "EX", ttlSeconds);
      if (setRes !== "OK") {
        // already used
        const existing = await redis.get(usedKey);
        return res.status(409).json({ error: "Voucher already redeemed", info: existing ? JSON.parse(existing) : null });
      }
    } else {
      // In-memory fallback (not safe across restarts)
      // Implement a simple Map if needed; here we reject to be safe
      return res.status(500).json({ error: "Replay protection not available" });
    }

    // 6) Mint CAPS or award loot atomically (call your caps mint)
    // Decide amount based on voucher. For example, map lootId -> amount
    const lootId = voucher.lootId;
    const amount = Number(process.env.LOOT_ID_TO_CAPS?.split?.(",")?.find?.((s)=>s.startsWith(`${lootId}:`))?.split?.(":")[1] || process.env.DEFAULT_LOOT_CAPS || 100);
    // call mintCapsToPlayer (already validates player and amount)
    const mintResult = await caps.mintCapsToPlayer(player, amount);

    // 7) Audit success (store tx/signature in used key)
    if (redis) {
      const usedKey = VOUCHER_USED_KEY(voucherId);
      await redis.set(usedKey, JSON.stringify({ usedBy: player, usedAt: Date.now(), mintResult }), "EX", Number(ttl) + 60);
    }

    return res.json({ ok: true, voucherId, minted: amount, mintResult });
  } catch (err) {
    console.error("[redeem-voucher] error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
