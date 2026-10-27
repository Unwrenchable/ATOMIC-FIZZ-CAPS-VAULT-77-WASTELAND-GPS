// backend/api/claim-voucher.js
// SIWS gate in front of a LootVoucherV1. The wallet in the JSON body is ignored.
// Coordinates and the location hint come from frontend/data/locations.json.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const nacl = require("tweetnacl");
const rateLimit = require("express-rate-limit");
const { PublicKey } = require("@solana/web3.js");
const redis = require("../lib/redis");
const { toE6 } = require("../lib/voucherV1");
const { issueSignedVoucher, hintBytes } = require("./loot-voucher");

const CLAIM_DOMAIN = "atomicfizzcaps.xyz";
const NONCE_TTL_SECONDS = 120;
const NONCE_PREFIX = "claim-voucher:nonce:";
const COOLDOWN_PREFIX = "claim-voucher:cd:";

function cooldownSeconds() {
  const raw = Number(process.env.CLAIM_VOUCHER_COOLDOWN_SECONDS ?? 300);
  if (!Number.isFinite(raw) || raw < 1) return 300;
  return Math.min(Math.floor(raw), 3600);
}

function ipMax() {
  const raw = Number(process.env.CLAIM_VOUCHER_IP_MAX ?? 8);
  if (!Number.isFinite(raw) || raw < 1) return 8;
  return Math.floor(raw);
}

const router = express.Router();
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: ipMax(),
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "too_many_requests" },
  })
);

const LOCATIONS = new Map();
try {
  const file = path.join(__dirname, "..", "..", "frontend", "data", "locations.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const list = Array.isArray(raw) ? raw : [];
  for (const loc of list) {
    if (loc && loc.id && loc.lat != null && loc.lng != null) LOCATIONS.set(String(loc.id), loc);
  }
} catch (err) {
  console.error("[claim-voucher] locations.json failed to load:", err && err.message);
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

function buildClaimAuthMessage({ wallet, lootId, nonce, issuedAt, latitude, longitude }) {
  return [
    `${CLAIM_DOMAIN} wants you to sign in with your Solana account:`,
    String(wallet),
    "",
    `Claim FizzTec loot ${lootId}.`,
    "",
    `Domain: ${CLAIM_DOMAIN}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Latitude: ${latitude}`,
    `Longitude: ${longitude}`,
  ].join("\n");
}

function parseClaimAuthMessage(message) {
  if (typeof message !== "string") return null;
  const lines = message.split("\n");
  if (lines.length !== 10) return null;
  if (lines[0] !== `${CLAIM_DOMAIN} wants you to sign in with your Solana account:`) return null;
  const wallet = lines[1];
  if (lines[2] !== "" || lines[4] !== "") return null;
  const loot = /^Claim FizzTec loot ([A-Za-z0-9_-]+)\.$/.exec(lines[3]);
  if (!loot) return null;
  if (lines[5] !== `Domain: ${CLAIM_DOMAIN}`) return null;
  if (!lines[6].startsWith("Nonce: ")) return null;
  if (!lines[7].startsWith("Issued At: ")) return null;
  if (!lines[8].startsWith("Latitude: ")) return null;
  if (!lines[9].startsWith("Longitude: ")) return null;
  const nonce = lines[6].slice("Nonce: ".length);
  const issuedAt = lines[7].slice("Issued At: ".length);
  const latitude = lines[8].slice("Latitude: ".length);
  const longitude = lines[9].slice("Longitude: ".length);
  if (!/^[0-9a-f]{64}$/.test(nonce)) return null;
  if (!/^-?\d+$/.test(issuedAt)) return null;
  if (!/^-?\d+(\.\d+)?$/.test(latitude) || !/^-?\d+(\.\d+)?$/.test(longitude)) return null;
  const canonical = buildClaimAuthMessage({
    wallet,
    lootId: loot[1],
    nonce,
    issuedAt,
    latitude,
    longitude,
  });
  if (canonical !== message) return null;
  let pubkey;
  try {
    pubkey = new PublicKey(wallet);
  } catch {
    return null;
  }
  if (pubkey.toBase58() !== wallet) return null;
  return {
    wallet,
    pubkeyBytes: pubkey.toBytes(),
    lootId: loot[1],
    nonce,
    issuedAt: Number(issuedAt),
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
}

function stableLootId(locationId) {
  const hash = crypto.createHash("sha256").update(String(locationId)).digest();
  return hash.readUIntBE(0, 6);
}

function locationHint(loc) {
  let name = typeof loc.name === "string" && loc.name.trim() ? loc.name.trim() : loc.id;
  while (Buffer.byteLength(name, "utf8") > 64) name = name.slice(0, -1);
  return hintBytes(name);
}

router.post("/nonce", async (_req, res) => {
  try {
    const nonce = crypto.randomBytes(32).toString("hex");
    const stored = await redis.set(NONCE_PREFIX + nonce, "1", { EX: NONCE_TTL_SECONDS });
    if (stored !== "OK") {
      return res.status(503).json({ ok: false, error: "nonce_store_failed" });
    }
    res.json({ ok: true, nonce, ttlSeconds: NONCE_TTL_SECONDS, domain: CLAIM_DOMAIN });
  } catch (err) {
    console.error("[claim-voucher] nonce:", err && err.message ? err.message : "failed");
    res.status(500).json({ ok: false, error: "nonce_failed" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const parsed = parseClaimAuthMessage(body.message);
    if (!parsed) return res.status(400).json({ ok: false, error: "bad_message" });

    const now = Math.floor(Date.now() / 1000);
    if (parsed.issuedAt > now + 30 || now - parsed.issuedAt > NONCE_TTL_SECONDS) {
      return res.status(401).json({ ok: false, error: "issued_at_out_of_window" });
    }

    let signature;
    try {
      signature = Buffer.from(String(body.signature || ""), "base64");
    } catch {
      return res.status(401).json({ ok: false, error: "bad_signature" });
    }
    if (signature.length !== 64) return res.status(401).json({ ok: false, error: "bad_signature" });
    const messageBytes = Buffer.from(body.message, "utf8");
    if (!nacl.sign.detached.verify(messageBytes, signature, parsed.pubkeyBytes)) {
      return res.status(401).json({ ok: false, error: "bad_signature" });
    }

    const consumed = await redis.getdel(NONCE_PREFIX + parsed.nonce);
    if (consumed == null) return res.status(401).json({ ok: false, error: "nonce_rejected" });

    const loc = LOCATIONS.get(parsed.lootId);
    if (!loc) return res.status(404).json({ ok: false, error: "unknown_loot" });

    const radius = Number(loc.triggerRadius || loc.claimRadius || 150);
    const distance = haversineMeters(parsed.latitude, parsed.longitude, Number(loc.lat), Number(loc.lng));
    if (!Number.isFinite(distance) || distance > radius) {
      return res.status(403).json({ ok: false, error: "not_near_poi", distanceMeters: Math.round(distance) });
    }

    const cooled = await redis.set(COOLDOWN_PREFIX + parsed.wallet + ":" + parsed.lootId, "1", {
      NX: true,
      EX: cooldownSeconds(),
    });
    if (cooled == null) return res.status(429).json({ ok: false, error: "cooldown" });

    const latE6 = toE6(loc.lat);
    const lngE6 = toE6(loc.lng);
    const issued = await issueSignedVoucher({
      player: parsed.wallet,
      lootId: stableLootId(loc.id),
      latE6,
      lngE6,
      locationHint: locationHint(loc),
    });
    res.json({ ok: true, ...issued });
  } catch (err) {
    const status = err && err.status === 503 ? 503 : 500;
    if (status === 500) {
      console.error("[claim-voucher]", err && err.message ? err.message : "failed");
    }
    res.status(status).json({ ok: false, error: status === 503 ? "signing_unavailable" : "claim_failed" });
  }
});

module.exports = router;
module.exports.buildClaimAuthMessage = buildClaimAuthMessage;
module.exports.CLAIM_DOMAIN = CLAIM_DOMAIN;
module.exports.NONCE_TTL_SECONDS = NONCE_TTL_SECONDS;
module.exports.stableLootId = stableLootId;
