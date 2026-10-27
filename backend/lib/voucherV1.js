"use strict";

const crypto = require("crypto");
const { PublicKey } = require("@solana/web3.js");

// NOT the legacy pipe-format in gps.js. This is the only on-chain voucher message.
const DOMAIN = Buffer.from("FIZZCAPS:LOOT_VOUCHER:v1", "ascii"); // 24 bytes
const VOUCHER_MSG_LEN = 169;
const MAX_VOUCHER_TTL_SECS = 300;
const CLUSTER_TAG = { "mainnet-beta": 1, devnet: 2, localnet: 3 };

const PROGRAM_ID_BY_CLUSTER = {
  "mainnet-beta": "DXxzKfZh6aJCff7sEusMU1E9w4ZDwgJkYGgKStRRGRyP",
  devnet: "GvTeKyGiFqtpJn2cJQxFb2iPVCYotvnMjMZKGAnPgZkc",
  localnet: "HnWTnCKuKhJa6cXj4ZocW2D8Jtf4f5QFb6f6UnkF27FB",
};

function clusterKeySuffix(cluster) {
  if (cluster === "mainnet-beta") return "MAINNET";
  if (cluster === "devnet") return "DEVNET";
  if (cluster === "localnet") return "LOCALNET";
  throw new Error("unknown cluster");
}

function serverSecretEnv(cluster) {
  return `SERVER_SECRET_KEY_${clusterKeySuffix(cluster)}`;
}

function kmsKeyEnv(cluster) {
  return `KMS_SIGNING_KEY_ID_${clusterKeySuffix(cluster)}`;
}

/**
 * Half away from zero. JS Math.round is half toward +inf, which drifts on negatives.
 * @param {number} deg
 */
function toE6(deg) {
  const x = Number(deg) * 1e6;
  if (!Number.isFinite(x)) throw new Error("bad coordinate");
  return x >= 0 ? Math.round(x) : -Math.round(-x);
}

/**
 * Fixed 169-byte little-endian message. Rebuilt on-chain; the client bytes are not trusted.
 * `clusterTag` overrides the name lookup so tests can sign a foreign cluster on purpose.
 */
function buildVoucherMessageV1({
  cluster,
  clusterTag,
  programId,
  player,
  voucherId,
  lootId,
  latE6,
  lngE6,
  locationHint,
  issuedAt,
  expiresAt,
}) {
  const tag = clusterTag == null ? CLUSTER_TAG[cluster] : Number(clusterTag);
  if (!Number.isInteger(tag) || tag < 1 || tag > 3) throw new Error("unknown cluster");
  if (DOMAIN.length !== 24) throw new Error("domain length");
  const buf = Buffer.alloc(VOUCHER_MSG_LEN);
  let o = 0;
  const put = (b) => {
    b.copy(buf, o);
    o += b.length;
  };
  put(DOMAIN);
  put(Buffer.from([tag]));
  put(new PublicKey(programId).toBuffer());
  put(new PublicKey(player).toBuffer());
  const vid = Buffer.isBuffer(voucherId) ? voucherId : Buffer.from(voucherId, "hex");
  if (vid.length !== 16) throw new Error("voucherId");
  put(vid);
  const w64 = (v, signed) => {
    const b = Buffer.alloc(8);
    if (signed) b.writeBigInt64LE(BigInt(v));
    else b.writeBigUInt64LE(BigInt(v));
    return b;
  };
  const w32 = (v) => {
    const b = Buffer.alloc(4);
    b.writeInt32LE(Number(v));
    return b;
  };
  put(w64(lootId, false));
  put(w32(latE6));
  put(w32(lngE6));
  const hint = Buffer.from(String(locationHint), "utf8");
  if (hint.length > 64) throw new Error("location hint longer than 64 bytes");
  put(crypto.createHash("sha256").update(hint).digest());
  put(w64(issuedAt, true));
  put(w64(expiresAt, true));
  if (o !== VOUCHER_MSG_LEN) throw new Error("layout drift");
  return buf;
}

function assertClusterProgramId(cluster, programId) {
  const expected = PROGRAM_ID_BY_CLUSTER[cluster];
  if (!expected) throw new Error(`SOLANA_CLUSTER must be devnet, mainnet-beta, or localnet (got ${cluster || "unset"})`);
  if (!programId || programId !== expected) {
    throw new Error(`FIZZCAPS_PROGRAM_ID does not match SOLANA_CLUSTER ${cluster} (expected ${expected})`);
  }
}

/**
 * One key per cluster. A copied devnet secret must not boot mainnet.
 * Identical material configured for two clusters is refused.
 */
function assertDistinctClusterKeys() {
  const values = [];
  for (const cluster of Object.keys(CLUSTER_TAG)) {
    const secret = process.env[serverSecretEnv(cluster)];
    const kms = process.env[kmsKeyEnv(cluster)];
    if (secret) values.push(secret);
    if (kms) values.push(kms);
  }
  const uniq = new Set(values);
  if (uniq.size !== values.length) {
    throw new Error("per-cluster server keys must be distinct — do not reuse a devnet key on mainnet");
  }
}

module.exports = {
  DOMAIN,
  VOUCHER_MSG_LEN,
  MAX_VOUCHER_TTL_SECS,
  CLUSTER_TAG,
  PROGRAM_ID_BY_CLUSTER,
  buildVoucherMessageV1,
  toE6,
  clusterKeySuffix,
  serverSecretEnv,
  kmsKeyEnv,
  assertClusterProgramId,
  assertDistinctClusterKeys,
};
