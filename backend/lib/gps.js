// backend/lib/gps.js

const redis = require('./redis');

async function updateLocation(player, lat, lng) {
  if (!player || !player.wallet) {
    throw new Error("missing player");
  }

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    throw new Error("invalid coordinates");
  }

  // BUG FIX: removed key() wrapper — redis wrappers add afw: prefix internally.
  // Passing key()-prefixed strings resulted in double-prefixed keys (afw:afw:...).
  const playerKey = `player:${player.wallet}`;
  const raw = await redis.hget(playerKey, "profile");
  if (!raw) throw new Error("player not found");

  const profile = JSON.parse(raw);
  profile.lastLocation = {
    lat,
    lng,
    updatedAt: Date.now(),
  };

  await redis.hset(playerKey, "profile", JSON.stringify(profile));

  return {
    ok: true,
    lastLocation: profile.lastLocation,
  };
}

// ------------------------------------------------------------
// Voucher serialization — used by loot-voucher.js and redeem-voucher.js
// BUG FIX: these functions were imported from gps.js but never defined here,
// causing the loot-voucher and redeem-voucher endpoints to crash at startup.
// ------------------------------------------------------------

/**
 * Serialize a voucher object to a deterministic byte buffer for signing/verification.
 * Fields are joined with "|" to avoid ambiguity across fields.
 *
 * @param {Object} voucher
 * @returns {Buffer}
 */
function serializeVoucherMessage(voucher) {
  const parts = [
    String(voucher.lootId !== undefined ? voucher.lootId : ""),
    String(voucher.latitude !== undefined ? voucher.latitude : ""),
    String(voucher.longitude !== undefined ? voucher.longitude : ""),
    String(voucher.timestamp !== undefined ? voucher.timestamp : ""),
    String(voucher.locationHint || ""),
    String(voucher.voucherId || ""),
    String(voucher.keyId || ""),
    String(voucher.ttlSeconds || ""),
  ];
  return Buffer.from(parts.join("|"), "utf8");
}

/**
 * Verify a NaCl Ed25519 detached signature over a serialized voucher message.
 *
 * @param {Buffer} message       - serialized message bytes
 * @param {Uint8Array|Buffer|Array} signature - raw signature bytes (64 bytes)
 * @param {string|Uint8Array} pubKeyBase58   - Ed25519 public key (base58 or raw bytes)
 * @returns {boolean}
 */
function verifyVoucherSignature(message, signature, pubKeyBase58) {
  try {
    const nacl = require("tweetnacl");
    const bs58 = require("bs58");

    let pubKeyBytes;
    if (typeof pubKeyBase58 === "string") {
      pubKeyBytes = bs58.decode(pubKeyBase58);
    } else if (pubKeyBase58 instanceof Uint8Array || Buffer.isBuffer(pubKeyBase58)) {
      pubKeyBytes = pubKeyBase58;
    } else {
      return false;
    }

    let sigBytes;
    if (signature instanceof Uint8Array || Buffer.isBuffer(signature)) {
      sigBytes = signature;
    } else if (Array.isArray(signature)) {
      sigBytes = Uint8Array.from(signature);
    } else {
      return false;
    }

    return nacl.sign.detached.verify(
      message instanceof Uint8Array ? message : new Uint8Array(message),
      sigBytes instanceof Uint8Array ? sigBytes : new Uint8Array(sigBytes),
      pubKeyBytes instanceof Uint8Array ? pubKeyBytes : new Uint8Array(pubKeyBytes)
    );
  } catch (err) {
    console.warn("[gps] verifyVoucherSignature error:", err && err.message ? err.message : err);
    return false;
  }
}

module.exports = {
  updateLocation,
  serializeVoucherMessage,
  verifyVoucherSignature,
};
