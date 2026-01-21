// backend/lib/loot-voucher.js
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const serializeVoucherMessage = require("./gps").serializeVoucherMessage;
const redis = require('../lib/redis');

/**
 * Validate a voucher payload from the client.
 * This does NOT mint NFTs or award CAPS — it only verifies the signature
 * and returns a structured voucher object for the Solana client.
 */
async function validateVoucher(voucher) {
  if (!voucher) throw new Error("Missing voucher");

  const {
    lootId,
    latitude,
    longitude,
    timestamp,
    locationHint,
    serverSignature,
    serverKey
  } = voucher;

  if (!lootId) throw new Error("Missing lootId");
  if (!latitude || !longitude) throw new Error("Missing coordinates");
  if (!timestamp) throw new Error("Missing timestamp");
  if (!serverSignature) throw new Error("Missing serverSignature");
  if (!serverKey) throw new Error("Missing serverKey");

  // Convert fields
  const lootIdBig = BigInt(lootId);
  const timestampBig = BigInt(timestamp);
  const signatureBytes = Uint8Array.from(serverSignature);
  const pubkeyBytes = bs58.decode(serverKey);

  // Recreate message
  const unsignedVoucher = {
    lootId: lootIdBig,
    latitude: Number(latitude),
    longitude: Number(longitude),
    timestamp: timestampBig,
    locationHint: locationHint || ""
  };

  const message = serializeVoucherMessage(unsignedVoucher);

  // Verify signature
  const ok = nacl.sign.detached.verify(message, signatureBytes, pubkeyBytes);
  if (!ok) throw new Error("Invalid server signature");

  return {
    lootId: lootIdBig,
    latitude: Number(latitude),
    longitude: Number(longitude),
    timestamp: timestampBig,
    locationHint,
    serverSignature: signatureBytes,
    serverKey: pubkeyBytes
  };
}

/**
 * Main entry point used by the API route.
 * This does NOT mint NFTs — it only validates the voucher and
 * ensures the player is allowed to claim it.
 */
async function claimVoucher(player, voucher) {
  if (!player) throw new Error("Missing player");
  const validated = await validateVoucher(voucher);

  // Optional: cooldown check
  const cooldownKey = `loot_cooldown:${player.id}:${validated.lootId}`;
  const last = await redis.get(cooldownKey);
  if (last) throw new Error("Loot already claimed recently");

  // Set cooldown (60 seconds default)
  await redis.set(cooldownKey, "1", "EX", 60);

  // Return validated voucher for the client to use on-chain
  return {
    ok: true,
    voucher: validated
  };
}

module.exports = {
  validateVoucher,
  claimVoucher
};
