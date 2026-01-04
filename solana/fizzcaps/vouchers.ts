// solana/fizzcaps/voucher.ts
import { LootVoucher, UnsignedLootVoucher } from "./types";

/**
 * Serialize the message that the server signs:
 * loot_id | latitude | longitude | timestamp | location_hint
 */
export function serializeVoucherMessage(v: UnsignedLootVoucher): Buffer {
  const locationHintBytes = Buffer.from(v.locationHint, "utf8");
  const totalLen =
    8 + // loot_id u64
    8 + // latitude f64
    8 + // longitude f64
    8 + // timestamp i64
    4 + // location_hint length u32
    locationHintBytes.length;

  const buf = Buffer.alloc(totalLen);
  let offset = 0;

  buf.writeBigUInt64LE(v.lootId, offset);
  offset += 8;

  buf.writeDoubleLE(v.latitude, offset);
  offset += 8;

  buf.writeDoubleLE(v.longitude, offset);
  offset += 8;

  buf.writeBigInt64LE(v.timestamp, offset);
  offset += 8;

  buf.writeUInt32LE(locationHintBytes.length, offset);
  offset += 4;

  locationHintBytes.copy(buf, offset);

  return buf;
}

/**
 * Full LootVoucher struct as the program expects it in args:
 * loot_id | latitude | longitude | timestamp | location_hint | server_signature[64]
 */
export function serializeLootVoucher(v: LootVoucher): Buffer {
  const msgBuf = serializeVoucherMessage(v);
  if (v.serverSignature.length !== 64) {
    throw new Error("serverSignature must be 64 bytes");
  }
  return Buffer.concat([msgBuf, Buffer.from(v.serverSignature)]);
}
