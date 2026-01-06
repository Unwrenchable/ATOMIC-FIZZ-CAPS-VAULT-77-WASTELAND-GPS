// backend/lib/gps.js
// Secure GPS utilities and voucher serialization
// - Deterministic voucher serialization (includes voucherId, keyId, ttlSeconds)
// - Haversine distance check
// - Server-side POI registry (in-memory; replace with DB for persistence)
// - Input validation and safe error messages
// - Signature verification helper (Ed25519 / tweetnacl compatible)

const crypto = require("crypto");
const bs58 = require("bs58");
const nacl = require("tweetnacl");

const DEFAULT_MAX_DISTANCE_METERS = Number(process.env.GPS_MAX_DISTANCE_METERS || 50);
const DEFAULT_VOUCHER_TTL_SECONDS = Number(process.env.VOUCHER_TTL_SECONDS || 3600);

// POI store: { poiId: { lat, lng, name } }
// Replace with DB-backed store for production multi-instance deployments.
const POIS = new Map();

/* -------------------------
   Helpers and validation
   ------------------------- */

function _isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function validateLatLng(lat, lng) {
  if (!_isFiniteNumber(lat) || !_isFiniteNumber(lng)) {
    throw new Error("Invalid latitude or longitude");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error("Latitude or longitude out of range");
  }
}

/* -------------------------
   POI management
   ------------------------- */

/**
 * Register a POI on the server.
 * poiId must be a string unique identifier.
 * lat/lng are numbers.
 */
exports.registerPoi = function (poiId, lat, lng, name = "") {
  if (!poiId || typeof poiId !== "string") {
    throw new Error("Invalid poiId");
  }
  validateLatLng(lat, lng);
  POIS.set(poiId, { lat: Number(lat), lng: Number(lng), name: String(name) });
};

/**
 * Get POI by id. Returns null if not found.
 */
exports.getPoi = function (poiId) {
  return POIS.get(poiId) || null;
};

/* -------------------------
   Haversine distance
   ------------------------- */

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Compute distance in meters between two lat/lng pairs.
 */
exports.distanceMeters = function (lat1, lon1, lat2, lon2) {
  validateLatLng(lat1, lon1);
  validateLatLng(lat2, lon2);

  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const distance = 2 * R * Math.asin(Math.sqrt(a));
  return distance;
};

/**
 * Check whether player coordinates are within allowed distance of a POI.
 * Uses server-side POI coordinates (poiId).
 */
exports.isWithinDistanceToPoi = function (playerLat, playerLng, poiId, maxDistanceMeters = DEFAULT_MAX_DISTANCE_METERS) {
  validateLatLng(playerLat, playerLng);

  const poi = POIS.get(poiId);
  if (!poi) {
    throw new Error("Unknown POI");
  }

  const distance = exports.distanceMeters(playerLat, playerLng, poi.lat, poi.lng);
  return { ok: distance <= Number(maxDistanceMeters), distance };
};

/* -------------------------
   Voucher serialization
   ------------------------- */

/**
 * Voucher schema:
 * {
 *   voucherId: string (UUID or random hex),
 *   keyId: string (signing key identifier),
 *   lootId: number | bigint,
 *   latitude: number,
 *   longitude: number,
 *   timestamp: bigint (seconds since epoch),
 *   ttlSeconds: number,
 *   locationHint: string
 * }
 *
 * serializeVoucherMessage(voucher) -> Buffer
 * Deterministic, unambiguous binary layout suitable for Ed25519 signing.
 */
exports.serializeVoucherMessage = function (v) {
  if (!v || typeof v !== "object") throw new Error("Invalid voucher object");

  // Basic validation
  if (!v.voucherId || typeof v.voucherId !== "string") throw new Error("Missing voucherId");
  if (!v.keyId || typeof v.keyId !== "string") throw new Error("Missing keyId");
  if (v.lootId === undefined || v.lootId === null) throw new Error("Missing lootId");
  validateLatLng(Number(v.latitude), Number(v.longitude));
  if (v.timestamp === undefined || v.timestamp === null) throw new Error("Missing timestamp");
  if (v.ttlSeconds === undefined || v.ttlSeconds === null) v.ttlSeconds = DEFAULT_VOUCHER_TTL_SECONDS;
  if (!v.locationHint) v.locationHint = "";

  const encoder = new TextEncoder();

  // voucherId length + bytes
  const voucherIdBytes = encoder.encode(v.voucherId);
  const voucherIdLen = Buffer.alloc(2);
  voucherIdLen.writeUInt16LE(voucherIdBytes.length);

  // keyId length + bytes
  const keyIdBytes = encoder.encode(v.keyId);
  const keyIdLen = Buffer.alloc(2);
  keyIdLen.writeUInt16LE(keyIdBytes.length);

  // lootId as 8 bytes little-endian
  const lootBuf = Buffer.alloc(8);
  lootBuf.writeBigUInt64LE(BigInt(v.lootId));

  // latitude and longitude as Float64 LE
  const latBuf = Buffer.from(new Float64Array([Number(v.latitude)]).buffer);
  const lngBuf = Buffer.from(new Float64Array([Number(v.longitude)]).buffer);

  // timestamp as 8 bytes little-endian (seconds)
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigInt64LE(BigInt(v.timestamp));

  // ttlSeconds as 4 bytes little-endian
  const ttlBuf = Buffer.alloc(4);
  ttlBuf.writeUInt32LE(Number(v.ttlSeconds));

  // locationHint length + bytes
  const hintBytes = encoder.encode(String(v.locationHint));
  const hintLen = Buffer.alloc(4);
  hintLen.writeUInt32LE(hintBytes.length);

  return Buffer.concat([
    voucherIdLen,
    Buffer.from(voucherIdBytes),
    keyIdLen,
    Buffer.from(keyIdBytes),
    lootBuf,
    latBuf,
    lngBuf,
    tsBuf,
    ttlBuf,
    hintLen,
    Buffer.from(hintBytes),
  ]);
};

/* -------------------------
   Voucher verification helper
   ------------------------- */

/**
 * verifyVoucherSignature(messageBuffer, signatureArray, publicKeyBase58)
 * - messageBuffer: Buffer produced by serializeVoucherMessage
 * - signatureArray: Array<number> or Uint8Array
 * - publicKeyBase58: base58-encoded public key string
 *
 * Returns true/false.
 */
exports.verifyVoucherSignature = function (messageBuffer, signatureArray, publicKeyBase58) {
  if (!messageBuffer || !Buffer.isBuffer(messageBuffer)) throw new Error("Invalid message buffer");
  if (!signatureArray) throw new Error("Missing signature");
  if (!publicKeyBase58 || typeof publicKeyBase58 !== "string") throw new Error("Missing public key");

  const signature = Uint8Array.from(signatureArray);
  const publicKey = bs58.decode(publicKeyBase58);

  try {
    return nacl.sign.detached.verify(new Uint8Array(messageBuffer), signature, publicKey);
  } catch (err) {
    return false;
  }
};

/* -------------------------
   Utility: create voucher helper
   ------------------------- */

/**
 * createVoucherPayload(options)
 * - Generates voucherId if not provided
 * - Normalizes fields and returns the voucher object ready for serialization/signing
 */
exports.createVoucherPayload = function (opts) {
  if (!opts || typeof opts !== "object") throw new Error("Invalid options");
  const voucherId = opts.voucherId || crypto.randomUUID();
  const keyId = opts.keyId || (process.env.VOUCHER_KEY_ID || "v1");
  const lootId = opts.lootId;
  const latitude = Number(opts.latitude);
  const longitude = Number(opts.longitude);
  const timestamp = opts.timestamp !== undefined ? BigInt(opts.timestamp) : BigInt(Math.floor(Date.now() / 1000));
  const ttlSeconds = opts.ttlSeconds !== undefined ? Number(opts.ttlSeconds) : DEFAULT_VOUCHER_TTL_SECONDS;
  const locationHint = opts.locationHint || "";

  validateLatLng(latitude, longitude);

  return {
    voucherId,
    keyId,
    lootId,
    latitude,
    longitude,
    timestamp,
    ttlSeconds,
    locationHint,
  };
};
