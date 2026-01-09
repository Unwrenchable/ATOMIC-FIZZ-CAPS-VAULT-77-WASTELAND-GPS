// solana/fizzcaps/voucher.ts
import * as borsh from "@coral-xyz/borsh";
import { LootVoucher, UnsignedLootVoucher } from "./types";

// Message that is signed by the server (no server_signature)
const LOOT_VOUCHER_MESSAGE_LAYOUT = borsh.struct([
  borsh.u64("loot_id"),
  borsh.f64("latitude"),
  borsh.f64("longitude"),
  borsh.i64("timestamp"),
  borsh.str("location_hint"),
]);

// Full struct passed to the on-chain program (includes server_signature)
const LOOT_VOUCHER_LAYOUT = borsh.struct([
  borsh.u64("loot_id"),
  borsh.f64("latitude"),
  borsh.f64("longitude"),
  borsh.i64("timestamp"),
  borsh.str("location_hint"),
  borsh.array(borsh.u8(), 64, "server_signature"),
]);

function toU64(value: bigint | number): bigint {
  return BigInt(value);
}

function toI64(value: bigint | number): bigint {
  return BigInt(value);
}

/**
 * Serialize the unsigned voucher message for Ed25519 signing.
 * Matches the on-chain LootVoucher fields minus `server_signature`.
 */
export function serializeVoucherMessage(
  voucher: UnsignedLootVoucher
): Uint8Array {
  const temp: any = {
    loot_id: toU64(voucher.lootId),
    latitude: voucher.latitude,
    longitude: voucher.longitude,
    timestamp: toI64(voucher.timestamp),
    location_hint: voucher.locationHint,
  };

  const buffer = Buffer.alloc(512);
  const span = LOOT_VOUCHER_MESSAGE_LAYOUT.encode(temp, buffer);
  return buffer.subarray(0, span);
}

/**
 * Serialize the full LootVoucher (including server_signature)
 * to pass as instruction data arg.
 */
export function serializeLootVoucher(voucher: LootVoucher): Uint8Array {
  if (voucher.serverSignature.length !== 64) {
    throw new Error(
      `serverSignature must be 64 bytes, got ${voucher.serverSignature.length}`
    );
  }

  const temp: any = {
    loot_id: toU64(voucher.lootId),
    latitude: voucher.latitude,
    longitude: voucher.longitude,
    timestamp: toI64(voucher.timestamp),
    location_hint: voucher.locationHint,
    server_signature: Array.from(voucher.serverSignature),
  };

  const buffer = Buffer.alloc(600);
  const span = LOOT_VOUCHER_LAYOUT.encode(temp, buffer);
  return buffer.subarray(0, span);
}
