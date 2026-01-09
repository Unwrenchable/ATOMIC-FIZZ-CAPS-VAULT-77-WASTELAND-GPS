// backend/api/loot-voucher.js
const router = require("express").Router();
const nacl = require("tweetnacl");
const serializeVoucherMessage = require("../lib/gps").serializeVoucherMessage;

// Helper: robust bs58 loader that works with different package shapes
function loadBs58() {
  try {
    const b = require("bs58");
    // If bs58 exports an object with decode, use it
    if (b && typeof b.decode === "function" && typeof b.encode === "function") {
      return b;
    }
    // Fallback to base-x configured for Base58 alphabet
    const baseX = require("base-x");
    const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    return baseX(BASE58);
  } catch (err) {
    // Re-throw with helpful message
    throw new Error("Base58 library not available: " + err.message);
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

const USE_KMS = process.env.NODE_ENV === "production";
let SERVER_KEYPAIR = null;

if (!USE_KMS) {
  // Dev-only: decode secret at runtime; fail fast with clear message
  try {
    const secretEnv = process.env.SERVER_SECRET_KEY;
    const secret = safeDecodeBase58(secretEnv, "SERVER_SECRET_KEY");
    SERVER_KEYPAIR = nacl.sign.keyPair.fromSecretKey(secret);
    console.log("[loot-voucher] using local SERVER_SECRET_KEY (dev)");
  } catch (err) {
    console.warn("[loot-voucher] no valid SERVER_SECRET_KEY found (dev only). Voucher endpoint will fail until a valid key is provided.", err.message);
    SERVER_KEYPAIR = null;
  }
} else {
  // Production: expect KMS signing; do not decode private key from env
  console.log("[loot-voucher] running in production mode; will use KMS for signing");
}

/**
 * POST /api/loot-voucher
 * - Dev: signs with local SERVER_SECRET_KEY and returns public key (base58)
 * - Prod: signs with KMS via lib/kmsSigner and returns keyId used
 */
router.post("/api/loot-voucher", async (req, res) => {
  try {
    // Basic voucher payload (static for now)
    const lootId = 1n;
    const latitude = 36.1699;
    const longitude = -115.1398;
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const locationHint = "Vault 77 — Sector C";

    const unsignedVoucher = { lootId, latitude, longitude, timestamp, locationHint };
    const message = serializeVoucherMessage(unsignedVoucher); // Buffer

    let signatureBytes;
    let serverKeyInfo;

    if (USE_KMS) {
      // Production: sign with KMS
      const { signMessageWithKms } = require("../lib/kmsSigner");
      const { keyIdUsed, signatureBytes: sigBuf } = await signMessageWithKms(Buffer.from(message));
      signatureBytes = sigBuf;
      serverKeyInfo = keyIdUsed;
    } else {
      // Dev: require a valid local keypair
      if (!SERVER_KEYPAIR) {
        return res.status(500).json({ error: "SERVER_SECRET_KEY not configured or invalid (dev only)" });
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
