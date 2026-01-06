// backend/api/loot-voucher.js
const router = require("express").Router();
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const { serializeVoucherMessage } = require("../lib/gps");

function isBase58(str) {
  return typeof str === "string" && /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
}
function safeDecodeBase58(str, name = "key") {
  if (!str) throw new Error(`${name} missing`);
  if (!isBase58(str)) throw new Error(`${name} contains non-base58 characters`);
  try {
    return bs58.decode(str);
  } catch (err) {
    throw new Error(`${name} decode failed: ${err.message}`);
  }
}

const USE_KMS = process.env.NODE_ENV === "production";
let SERVER_KEYPAIR = null;

// Dev: decode local secret key (dev only). Production: use KMS signer.
if (!USE_KMS) {
  const secretEnv = process.env.SERVER_SECRET_KEY;
  try {
    const secret = safeDecodeBase58(secretEnv, "SERVER_SECRET_KEY");
    SERVER_KEYPAIR = nacl.sign.keyPair.fromSecretKey(secret);
  } catch (err) {
    // Fail fast with a clear message so logs show the cause
    console.error("[loot-voucher] invalid SERVER_SECRET_KEY:", err.message);
    throw err;
  }
} else {
  // In production we expect to sign via KMS; ensure kmsSigner exists at runtime when needed.
  // Do not decode any private key from env in production.
}

/**
 * POST /api/loot-voucher
 * - Dev: signs with local SERVER_SECRET_KEY and returns public key (base58)
 * - Prod: signs with KMS via lib/kmsSigner and returns keyId used
 */
router.post("/api/loot-voucher", async (req, res) => {
  try {
    // For now, static loot; later tie to world/POIs
    const lootId = 1n;
    const latitude = 36.1699;
    const longitude = -115.1398;
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const locationHint = "Vault 77 — Sector C";

    const unsignedVoucher = {
      lootId,
      latitude,
      longitude,
      timestamp,
      locationHint,
    };

    const message = serializeVoucherMessage(unsignedVoucher);

    let signatureBytes;
    let serverKeyInfo;

    if (USE_KMS) {
      // Production: sign with KMS (lib/kmsSigner.js)
      const { signMessageWithKms } = require("../lib/kmsSigner");
      // signMessageWithKms returns { keyIdUsed, signatureBase58 }
      const { keyIdUsed, signatureBase58 } = await signMessageWithKms(Buffer.from(message));
      signatureBytes = bs58.decode(signatureBase58);
      serverKeyInfo = keyIdUsed; // return keyId so clients know which public key to verify against
    } else {
      // Dev: sign locally with SERVER_KEYPAIR
      const signature = nacl.sign.detached(message, SERVER_KEYPAIR.secretKey);
      signatureBytes = signature;
      serverKeyInfo = bs58.encode(SERVER_KEYPAIR.publicKey);
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
    console.error("Voucher error:", err && err.message ? err.message : err);
    res.status(500).send("Failed to generate voucher");
  }
});

module.exports = router;
