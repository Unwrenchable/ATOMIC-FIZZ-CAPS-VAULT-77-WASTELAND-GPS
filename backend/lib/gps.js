// backend/lib/gps.js

// Borsh-compatible serialization of unsigned voucher message
exports.serializeVoucherMessage = function (v) {
  const encoder = new TextEncoder();

  const lootIdBuf = Buffer.alloc(8);
  lootIdBuf.writeBigUInt64LE(BigInt(v.lootId));

  const timestampBuf = Buffer.alloc(8);
  timestampBuf.writeBigInt64LE(BigInt(v.timestamp));

  const hintBytes = encoder.encode(v.locationHint);
  const hintLen = Buffer.alloc(4);
  hintLen.writeUInt32LE(hintBytes.length);

  return Buffer.concat([
    lootIdBuf,
    Buffer.from(new Float64Array([v.latitude]).buffer),
    Buffer.from(new Float64Array([v.longitude]).buffer),
    timestampBuf,
    hintLen,
    Buffer.from(hintBytes),
  ]);
};

// Haversine distance + max radius check
exports.isWithinDistance = function (lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const distance = 2 * R * Math.asin(Math.sqrt(a));

  return distance <= Number(process.env.GPS_MAX_DISTANCE_METERS || 50);
};
