// backend/api/loot-voucher.js
const router = require("express").Router();
const nacl = require("tweetnacl");
const serializeVoucherMessage = require("../lib/gps").serializeVoucherMessage;

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
    throw new Error("Base58 library not available: " + err.message + ". Install 'bs58' or 'base-x'.");
  }
}

const bs58 = loadBs58();

function safeDecodeBase58(str, name = "key") {
  if (!str || typeof str !== "string") throw new Error(`${name} missing`);
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(str)) throw new Error(`${name} contains non-base58 characters`);
  try {
    return bs58.decode(str);
  } catch (err) {
    throw new Error(`${name} decode failed: ${err.message}`);
  }
}

const USE_KMS = !!process.env.KMS_SIGNING_KEY_ID;  // Use KMS only if explicitly configured
let SERVER_KEYPAIR = null;
let KEY_INIT_ERROR = null;

/**
 * Validate and load SERVER_SECRET_KEY at startup.
 * Enhanced error handling to prevent application outages from misconfigured keys.
 */
function initServerKey() {
  if (USE_KMS) {
    console.log("[loot-voucher] KMS_SIGNING_KEY_ID configured; will use AWS KMS for signing");
    console.log("[loot-voucher] Note: AWS KMS costs $1+/month. See docs/LOCAL_SIGNING_SETUP.md for FREE alternative");
    return;
  }

  console.log("[loot-voucher] Using FREE local signing (see docs/LOCAL_SIGNING_SETUP.md)");
  const secretEnv = process.env.SERVER_SECRET_KEY;

  // Check if key is present
  if (!secretEnv) {
    KEY_INIT_ERROR = "SERVER_SECRET_KEY environment variable is not set";
    console.error(`[loot-voucher] CRITICAL: ${KEY_INIT_ERROR}. Voucher endpoint will be unavailable.`);
    return;
  }

  // Validate key format before attempting decode
  if (typeof secretEnv !== "string" || secretEnv.length < 64) {
    KEY_INIT_ERROR = "SERVER_SECRET_KEY appears to be invalid (too short or wrong format)";
    console.error(`[loot-voucher] CRITICAL: ${KEY_INIT_ERROR}. Expected a 64-byte Ed25519 secret key in base58.`);
    return;
  }

  try {
    const secret = safeDecodeBase58(secretEnv, "SERVER_SECRET_KEY");

    // Validate key length (Ed25519 secret keys should be 64 bytes)
    if (secret.length !== 64) {
      KEY_INIT_ERROR = `SERVER_SECRET_KEY has invalid length (${secret.length} bytes, expected 64)`;
      console.error(`[loot-voucher] CRITICAL: ${KEY_INIT_ERROR}`);
      return;
    }

    SERVER_KEYPAIR = nacl.sign.keyPair.fromSecretKey(secret);
    console.log("[loot-voucher] SERVER_SECRET_KEY loaded successfully (dev mode)");
  } catch (err) {
    KEY_INIT_ERROR = `Failed to initialize SERVER_SECRET_KEY: ${err.message}`;
    console.error(`[loot-voucher] CRITICAL: ${KEY_INIT_ERROR}`);
  }
}

// Initialize key at module load
initServerKey();

// Mounted at /api/loot-voucher
router.post("/", async (req, res) => {
  try {
    const lootId = 1n;
    const latitude = 36.1699;
    const longitude = -115.1398;
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const locationHint = "Vault 77 — Sector C";

    const unsignedVoucher = { lootId, latitude, longitude, timestamp, locationHint };
    const message = serializeVoucherMessage(unsignedVoucher);

    let signatureBytes;
    let serverKeyInfo;

    if (USE_KMS) {
      const { signMessageWithKms } = require("../lib/kmsSigner");
      const { keyIdUsed, signatureBytes: sigBuf } = await signMessageWithKms(Buffer.from(message));
      signatureBytes = sigBuf;
      serverKeyInfo = keyIdUsed;
    } else {
      if (!SERVER_KEYPAIR) {
        // Provide detailed error message for debugging misconfigured environments
        const errorMessage = KEY_INIT_ERROR || "SERVER_SECRET_KEY not configured or invalid";
        console.error(`[loot-voucher] Cannot sign voucher: ${errorMessage}`);
        return res.status(503).json({
          error: "Voucher signing service unavailable",
          reason: process.env.NODE_ENV === "development" ? errorMessage : undefined
        });
      }
      const sig = nacl.sign.detached(message, SERVER_KEYPAIR.secretKey);
      signatureBytes = Buffer.from(sig);
      serverKeyInfo = bs58.encode(Buffer.from(SERVER_KEYPAIR.publicKey));
    }

    res.json({
      lootId: lootId.toString(),
      latitude,
      longitude,
      timestamp: timestamp.toString(),
      locationHint,
      serverSignature: Array.from(signatureBytes),
      serverKey: serverKeyInfo,
    });
  } catch (err) {
    console.error("[loot-voucher] error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: "Failed to generate voucher" });
  }
});

module.exports = router;
