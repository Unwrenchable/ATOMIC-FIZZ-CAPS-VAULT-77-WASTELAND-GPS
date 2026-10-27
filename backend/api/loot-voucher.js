// backend/api/loot-voucher.js
// Issues LootVoucherV1 (169-byte message). The legacy pipe format in gps.js
// is not used here. CAPS are burned on-chain; they are not part of the voucher.
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const router = require("express").Router();
const nacl = require("tweetnacl");
const rateLimit = require("express-rate-limit");
const { authMiddleware } = require("../lib/auth");
const { encode: bs58encode } = require("../lib/safe-base58");
const { safeDecodeBase58 } = require("../lib/safe-base58");
const {
  buildVoucherMessageV1,
  MAX_VOUCHER_TTL_SECS,
  assertClusterProgramId,
  assertDistinctClusterKeys,
  serverSecretEnv,
  kmsKeyEnv,
  toE6,
} = require("../lib/voucherV1");

const voucherIssueLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { ok: false, error: "Too many voucher requests — slow down, Vault Dweller" },
  standardHeaders: true,
  legacyHeaders: false,
});

const CLUSTER = process.env.SOLANA_CLUSTER;
const PROGRAM_ID = process.env.FIZZCAPS_PROGRAM_ID;

function signingAlgorithm() {
  return process.env.KMS_SIGNING_ALGORITHM || "ED25519_SHA_512";
}

function assertStartupConfig() {
  assertClusterProgramId(CLUSTER, PROGRAM_ID);
  assertDistinctClusterKeys();
  const alg = signingAlgorithm();
  const useKms = !!process.env[kmsKeyEnv(CLUSTER)];
  if ((useKms || process.env.ONCHAIN_VOUCHERS === "true") && alg !== "ED25519_SHA_512") {
    throw new Error("on-chain vouchers require KMS_SIGNING_ALGORITHM=ED25519_SHA_512");
  }
  if (!useKms && !process.env[serverSecretEnv(CLUSTER)]) {
    throw new Error(
      `${serverSecretEnv(CLUSTER)} is not set. Legacy SERVER_SECRET_KEY is ignored for V1 vouchers.`
    );
  }
}

assertStartupConfig();

const USE_KMS = !!process.env[kmsKeyEnv(CLUSTER)];
let SERVER_KEYPAIR = null;
let SERVER_PUBKEY_B58 = null;
let KEY_INIT_ERROR = null;

const VOUCHER_CLAIM_RADIUS = Number(process.env.VOUCHER_CLAIM_RADIUS || 150);

let VOUCHER_LOCATIONS = [];
try {
  const poiFile = path.join(__dirname, "..", "..", "public", "data", "poi.json");
  if (fs.existsSync(poiFile)) {
    const raw = JSON.parse(fs.readFileSync(poiFile, "utf8"));
    const flat = Array.isArray(raw)
      ? raw
      : Object.values(raw).filter(Array.isArray).flat();
    VOUCHER_LOCATIONS = flat.filter((p) => p && p.id && p.lat != null && p.lng != null);
  }
} catch (e) {
  console.warn("[loot-voucher] Could not load POI list for GPS validation:", e.message);
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearbyPOI(lat, lng) {
  if (VOUCHER_LOCATIONS.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const loc of VOUCHER_LOCATIONS) {
    const d = haversineMeters(lat, lng, loc.lat, loc.lng);
    const radius = typeof loc.claimRadius === "number" ? loc.claimRadius : VOUCHER_CLAIM_RADIUS;
    if (d <= radius && d < bestDist) {
      best = loc;
      bestDist = d;
    }
  }
  return best;
}

function voucherTtlSeconds() {
  const raw = Number(process.env.VOUCHER_TTL_SECONDS ?? MAX_VOUCHER_TTL_SECS);
  if (!Number.isFinite(raw) || raw < 1) return MAX_VOUCHER_TTL_SECS;
  return Math.min(Math.floor(raw), MAX_VOUCHER_TTL_SECS);
}

function selfCheckKeypair(keypair) {
  const probe = Buffer.from("fizzcaps-voucher-v1-selfcheck");
  const sig = nacl.sign.detached(probe, keypair.secretKey);
  if (!nacl.sign.detached.verify(probe, sig, keypair.publicKey)) {
    throw new Error("ed25519 startup self-check failed");
  }
}

async function initServerKey() {
  if (USE_KMS) {
    const alg = signingAlgorithm();
    if (alg !== "ED25519_SHA_512") {
      throw new Error("KMS signing algorithm is not ED25519_SHA_512");
    }
    const { getPublicKeyFromKms, signMessageWithKms } = require("../lib/kmsSigner");
    const keyId = process.env[kmsKeyEnv(CLUSTER)];
    const pub = await getPublicKeyFromKms(keyId);
    const probe = Buffer.from("fizzcaps-voucher-v1-selfcheck");
    const { signatureBytes } = await signMessageWithKms(probe, keyId);
    const { decode } = require("../lib/safe-base58");
    const raw = decode(pub.publicKeyBase58);
    if (raw.length !== 32 || signatureBytes.length !== 64) {
      throw new Error("KMS self-check returned an unexpected key or signature length");
    }
    if (!nacl.sign.detached.verify(probe, signatureBytes, raw)) {
      throw new Error("KMS ed25519 startup self-check failed");
    }
    SERVER_PUBKEY_B58 = pub.publicKeyBase58;
    console.log("[loot-voucher] KMS ed25519 self-check ok");
    return;
  }

  const secretEnvName = serverSecretEnv(CLUSTER);
  const secretEnv = process.env[secretEnvName];
  const secret = safeDecodeBase58(secretEnv, secretEnvName);
  if (secret.length !== 64) {
    throw new Error(`${secretEnvName} must be a 64-byte ed25519 secret (got ${secret.length})`);
  }
  SERVER_KEYPAIR = nacl.sign.keyPair.fromSecretKey(secret);
  selfCheckKeypair(SERVER_KEYPAIR);
  SERVER_PUBKEY_B58 = bs58encode(Buffer.from(SERVER_KEYPAIR.publicKey));
  console.log("[loot-voucher] local ed25519 self-check ok");
}

const ready = initServerKey().catch((err) => {
  KEY_INIT_ERROR = err && err.message ? err.message : String(err);
  console.error("[loot-voucher] startup self-check failed:", KEY_INIT_ERROR);
  process.exit(1);
});

function hintBytes(rawHint) {
  const text = (typeof rawHint === "string" ? rawHint : "Wasteland — Unknown Sector")
    .replace(/[^\w\s.,!-]/g, "")
    .trim();
  const buf = Buffer.from(text || "Wasteland", "utf8");
  if (buf.length > 64) {
    const err = new Error("location hint longer than 64 bytes");
    err.status = 400;
    throw err;
  }
  return buf.toString("utf8");
}

router.post("/", voucherIssueLimiter, authMiddleware, async (req, res) => {
  try {
    if (KEY_INIT_ERROR || (!USE_KMS && !SERVER_KEYPAIR) || !SERVER_PUBKEY_B58) {
      return res.status(503).json({ error: "Voucher signing service unavailable" });
    }

    const player = req.player && req.player.wallet;
    if (!player) return res.status(401).json({ ok: false, error: "player wallet missing" });

    const { latitude: rawLat, longitude: rawLng, locationHint: rawHint } = req.body || {};
    const latitude = Number(rawLat);
    const longitude = Number(rawLng);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({ ok: false, error: "invalid_latitude" });
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ ok: false, error: "invalid_longitude" });
    }

    let nearbyPOI = null;
    if (VOUCHER_LOCATIONS.length > 0) {
      nearbyPOI = findNearbyPOI(latitude, longitude);
      if (!nearbyPOI) {
        return res.status(403).json({
          ok: false,
          error: "not_near_poi",
          message: "Vault Dweller, no registered Wasteland site detected at your coordinates.",
        });
      }
    } else {
      console.warn("[loot-voucher] GPS validation skipped — no POI data loaded");
    }

    const lootIdNum = nearbyPOI && nearbyPOI.lootId ? nearbyPOI.lootId : crypto.randomInt(1, 2 ** 48);
    const lootId = String(lootIdNum);
    const latE6 = toE6(latitude);
    const lngE6 = toE6(longitude);
    if (latE6 < -90_000_000 || latE6 > 90_000_000 || lngE6 < -180_000_000 || lngE6 > 180_000_000) {
      return res.status(400).json({ ok: false, error: "coordinate_out_of_range" });
    }

    const locationHint = hintBytes(rawHint);
    const issued = await issueSignedVoucher({
      player,
      lootId,
      latE6,
      lngE6,
      locationHint,
    });
    res.json({ ok: true, ...issued });
  } catch (err) {
    const status = err && err.status === 400 ? 400 : 500;
    if (status === 500) {
      console.error("[loot-voucher] error:", err && err.message ? err.message : "failed");
    }
    res.status(status).json({
      ok: false,
      error: status === 400 ? err.message : "Failed to generate voucher",
    });
  }
});

async function issueSignedVoucher({ player, lootId, latE6, lngE6, locationHint }) {
  await ready;
  if (KEY_INIT_ERROR || (!USE_KMS && !SERVER_KEYPAIR) || !SERVER_PUBKEY_B58) {
    const err = new Error("Voucher signing service unavailable");
    err.status = 503;
    throw err;
  }
  const voucherId = crypto.randomBytes(16).toString("hex");
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + voucherTtlSeconds();
  const message = buildVoucherMessageV1({
    cluster: CLUSTER,
    programId: PROGRAM_ID,
    player,
    voucherId,
    lootId,
    latE6,
    lngE6,
    locationHint,
    issuedAt,
    expiresAt,
  });
  if (message.length !== 169) {
    throw new Error("voucher message length drifted");
  }

  let signatureBytes;
  if (USE_KMS) {
    const { signMessageWithKms } = require("../lib/kmsSigner");
    const signed = await signMessageWithKms(message, process.env[kmsKeyEnv(CLUSTER)]);
    signatureBytes = signed.signatureBytes;
  } else {
    signatureBytes = Buffer.from(nacl.sign.detached(message, SERVER_KEYPAIR.secretKey));
  }
  if (signatureBytes.length !== 64) {
    throw new Error("signature length");
  }
  return {
    voucher: {
      v: 2,
      voucherId,
      lootId: String(lootId),
      latE6,
      lngE6,
      locationHint,
      issuedAt,
      expiresAt,
    },
    signature: signatureBytes.toString("base64"),
    serverPubkey: SERVER_PUBKEY_B58,
    programId: PROGRAM_ID,
    cluster: CLUSTER,
  };
}

module.exports = router;
module.exports.ready = ready;
module.exports.findNearbyPOI = findNearbyPOI;
module.exports.issueSignedVoucher = issueSignedVoucher;
module.exports.hintBytes = hintBytes;
