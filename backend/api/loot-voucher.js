// backend/api/loot-voucher.js
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const router = require("express").Router();
const nacl = require("tweetnacl");
const rateLimit = require("express-rate-limit");
const { authMiddleware } = require("../lib/auth");
const { serializeVoucherMessage } = require("../lib/gps");
const { addPublicKey } = require("../lib/keys");

// SECURITY FIX: rate-limit voucher generation — each successful call produces a
// signed voucher that can be redeemed for CAPS.  Without a rate limit a single
// unauthenticated caller could flood the endpoint and harvest many vouchers.
const voucherIssueLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,              // 5 vouchers per minute per IP
  message: { ok: false, error: "Too many voucher requests — slow down, Vault Dweller" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: robust bs58 loader that works with different package shapes
function loadBs58() {
  try {
    // Try bs58 first (may export default)
    let b = require("bs58");
    if (b) {
      if (typeof b.encode === "function" && typeof b.decode === "function") return b;
      if (b.default && typeof b.default.encode === "function" && typeof b.default.decode === "function") return b.default;
    }

    // Fallback to base-x
    const baseX = require("base-x");
    const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const codec = typeof baseX === 'function' ? baseX(BASE58) : (baseX && baseX.default ? baseX.default(BASE58) : null);
    if (codec && typeof codec.encode === "function" && typeof codec.decode === "function") return codec;
  } catch (err) {
    throw new Error("Base58 library not available: " + err.message + ". Install 'bs58' or 'base-x'.", { cause: err });
  }
}

const bs58 = loadBs58();

function safeDecodeBase58(str, name = "key") {
  if (!str || typeof str !== "string") throw new Error(`${name} missing`);
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(str)) throw new Error(`${name} contains non-base58 characters`);
  try {
    return bs58.decode(str);
  } catch (err) {
    throw new Error(`${name} decode failed: ${err.message}`, { cause: err });  }
}

const USE_KMS = !!process.env.KMS_SIGNING_KEY_ID;  // Use KMS only if explicitly configured
let SERVER_KEYPAIR = null;
let SERVER_KEY_ID = null;
let KEY_INIT_ERROR = null;

// ── GPS proximity validation ────────────────────────────────────────────────
// SEC-AUDIT-006 FIX: validate that the player-supplied GPS coordinates are
// actually near a known POI before signing the voucher.  Without this check
// any player could claim rewards for locations they never visited.

// Maximum allowed distance (metres) between player and nearest POI.
// Falls back to VOUCHER_CLAIM_RADIUS env var → 150 m.
const VOUCHER_CLAIM_RADIUS = Number(process.env.VOUCHER_CLAIM_RADIUS || 150);

let VOUCHER_LOCATIONS = [];
try {
  const poiFile = path.join(__dirname, "..", "..", "public", "data", "poi.json");
  if (fs.existsSync(poiFile)) {
    const raw = JSON.parse(fs.readFileSync(poiFile, "utf8"));
    const flat = Array.isArray(raw)
      ? raw
      : Object.values(raw).filter(Array.isArray).flat();
    VOUCHER_LOCATIONS = flat.filter(p => p && p.id && p.lat != null && p.lng != null);
  }
} catch (e) {
  console.warn("[loot-voucher] Could not load POI list for GPS validation:", e.message);
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns the nearest POI within VOUCHER_CLAIM_RADIUS, or null. */
function findNearbyPOI(lat, lng) {
  if (VOUCHER_LOCATIONS.length === 0) return null; // no location data → skip check
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

/**
 * Validate and load SERVER_SECRET_KEY at startup.
 * Enhanced error handling to prevent application outages from misconfigured keys.
 */
async function initServerKey() {
  if (USE_KMS) {
    console.log("[loot-voucher] KMS_SIGNING_KEY_ID configured; will use AWS KMS for signing");
    return;
  }

  console.log("[loot-voucher] Using FREE local signing (see docs/LOCAL_SIGNING_SETUP.md)");
  const secretEnv = process.env.SERVER_SECRET_KEY;

  if (!secretEnv) {
    KEY_INIT_ERROR = "SERVER_SECRET_KEY environment variable is not set";
    console.error(`[loot-voucher] CRITICAL: ${KEY_INIT_ERROR}. Voucher endpoint will be unavailable.`);
    return;
  }

  if (typeof secretEnv !== "string" || secretEnv.length < 64) {
    KEY_INIT_ERROR = "SERVER_SECRET_KEY appears to be invalid (too short or wrong format)";
    console.error(`[loot-voucher] CRITICAL: ${KEY_INIT_ERROR}. Expected a 64-byte Ed25519 secret key in base58.`);
    return;
  }

  try {
    const secret = safeDecodeBase58(secretEnv, "SERVER_SECRET_KEY");

    if (secret.length !== 64) {
      KEY_INIT_ERROR = `SERVER_SECRET_KEY has invalid length (${secret.length} bytes, expected 64)`;
      console.error(`[loot-voucher] CRITICAL: ${KEY_INIT_ERROR}`);
      return;
    }

    SERVER_KEYPAIR = nacl.sign.keyPair.fromSecretKey(secret);
    SERVER_KEY_ID = bs58.encode(Buffer.from(SERVER_KEYPAIR.publicKey));

    // Register the public key in the keys service so redeem-voucher.js can
    // look it up by keyId.  This is idempotent — safe to call on every restart.
    await addPublicKey(SERVER_KEY_ID, SERVER_KEY_ID, { notes: "loot-voucher server key" }).catch(e => {
      // IMPORTANT: if this fails, redeem-voucher.js cannot look up the key by
      // keyId and all voucher redemptions will fail with "Unknown signing key".
      // Treat as fatal during startup and set KEY_INIT_ERROR.
      KEY_INIT_ERROR = `keys.addPublicKey failed — voucher redemption will not work: ${e.message}`;
      console.error(`[loot-voucher] CRITICAL: ${KEY_INIT_ERROR}`);
      SERVER_KEYPAIR = null; // disable signing until key is registered
    });

    console.log("[loot-voucher] SERVER_SECRET_KEY loaded successfully (dev mode)");
  } catch (err) {
    KEY_INIT_ERROR = `Failed to initialize SERVER_SECRET_KEY: ${err.message}`;
    console.error(`[loot-voucher] CRITICAL: ${KEY_INIT_ERROR}`);
  }
}

// Initialize key at module load (async; errors are logged, not thrown)
// Note: initServerKey() is async — the promise is intentionally not awaited
// here because CommonJS module load is synchronous.  The server typically
// takes 100–200ms to bind its port; key init (local key decode + Redis write)
// completes in < 10ms in the normal path, so no request can arrive before
// KEY_INIT_ERROR / SERVER_KEYPAIR are set.  Any error is stored in KEY_INIT_ERROR
// and returned as HTTP 503 to the first caller if it does arrive early.
initServerKey().catch(err => {
  KEY_INIT_ERROR = `initServerKey promise rejected: ${err && err.message ? err.message : err}`;
  console.error(`[loot-voucher] CRITICAL: ${KEY_INIT_ERROR}`);
});

// Mounted at /api/loot-voucher
// BUG-008 FIX: added authMiddleware — previously any unauthenticated caller
// could generate signed vouchers, which could be used with the redemption
// endpoint to claim loot without being an authenticated player.
// SECURITY FIX: require authentication (authMiddleware) so only signed-in players
// can request vouchers, and rate-limit to 5/min to prevent bulk voucher harvesting.
router.post("/", voucherIssueLimiter, authMiddleware, async (req, res) => {
  try {
    // Accept player GPS coordinates from request body; reject missing or out-of-range values.
    const { latitude: rawLat, longitude: rawLng, locationHint: rawHint } = req.body || {};
    const latitude = Number(rawLat);
    const longitude = Number(rawLng);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return res.status(400).json({ ok: false, error: "invalid_latitude" });
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ ok: false, error: "invalid_longitude" });
    }

    // SEC-AUDIT-006 FIX: validate that the player is actually near a known POI
    // before signing. Skip only when locations data is unavailable (warn instead).
    // BUG-040 FIX: declare nearbyPOI in the outer scope so it is accessible after
    // the if/else block.  The original code used `const nearbyPOI` inside the if
    // block; JavaScript block-scopes const/let, so `nearbyPOI` was always
    // ReferenceError on the line below when VOUCHER_LOCATIONS was non-empty.
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

    // BUG-035 FIX: use the lootId from the nearby POI if it has one, falling back
    // to a server-assigned random value. The hardcoded `1n` bypassed the entire
    // location-based loot tier system — every player got identical loot.
    const lootIdNum = (nearbyPOI && nearbyPOI.lootId) ? nearbyPOI.lootId : crypto.randomInt(1, 1000000);
    const lootId = String(lootIdNum);

    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const locationHint = (typeof rawHint === "string")
      ? rawHint.replace(/[^\w\s.,!-]/g, "").trim().slice(0, 64)
      : "Wasteland — Unknown Sector";

    // BUG-036 FIX: include voucherId and keyId so redeem-voucher.js can verify
    // the voucher.  Previously these fields were missing and every redemption
    // attempt returned 400 "Malformed voucher".
    const voucherId = crypto.randomBytes(16).toString("hex");
    const ttlSeconds = Number(process.env.VOUCHER_TTL_SECONDS || 3600);

    const voucher = {
      voucherId,
      keyId: SERVER_KEY_ID || "kms",
      lootId,
      latitude,
      longitude,
      timestamp: timestamp.toString(),
      locationHint,
      ttlSeconds,
    };

    const message = serializeVoucherMessage(voucher);

    let signatureBytes;

    if (USE_KMS) {
      const { signMessageWithKms } = require("../lib/kmsSigner");
      const { signatureBytes: sigBuf } = await signMessageWithKms(Buffer.from(message));
      signatureBytes = sigBuf;
    } else {
      if (!SERVER_KEYPAIR) {
        const errorMessage = KEY_INIT_ERROR || "SERVER_SECRET_KEY not configured or invalid";
        console.error(`[loot-voucher] Cannot sign voucher: ${errorMessage}`);
        return res.status(503).json({
          error: "Voucher signing service unavailable",
          reason: process.env.NODE_ENV === "development" ? errorMessage : undefined,
        });
      }
      const sig = nacl.sign.detached(message, SERVER_KEYPAIR.secretKey);
      signatureBytes = Buffer.from(sig);
    }

    // BUG-036 FIX: return { voucher, signature } structure matching what
    // redeem-voucher.js expects (not the previous flat payload).
    res.json({
      ok: true,
      voucher,
      signature: Array.from(signatureBytes),
    });
  } catch (err) {
    console.error("[loot-voucher] error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to generate voucher" });
  }
});

module.exports = router;
