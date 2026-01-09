// backend/lib/kmsSigner.js
const { KMSClient, SignCommand, GetPublicKeyCommand } = require("@aws-sdk/client-kms");
const bs58 = require("bs58");

const REGION = process.env.AWS_REGION || "us-west-2";
const DEFAULT_SIGNING_ALG = process.env.KMS_SIGNING_ALGORITHM || "ED25519";
const KMS_KEY_ID = process.env.KMS_SIGNING_KEY_ID || null;

if (!KMS_KEY_ID) {
  console.warn("[kmsSigner] KMS_SIGNING_KEY_ID not set. Set this to your KMS asymmetric key ARN or KeyId for production signing.");
}

const client = new KMSClient({ region: REGION, maxAttempts: 3 });

async function retry(fn, attempts = 3, delayMs = 200) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

/**
 * signMessageWithKms
 * - messageBuffer: Buffer
 * - keyId: optional KMS key id/arn; falls back to KMS_KEY_ID
 * Returns: { keyIdUsed, signatureBase58, signatureBytes: Buffer }
 */
async function signMessageWithKms(messageBuffer, keyId = null) {
  if (!messageBuffer || !Buffer.isBuffer(messageBuffer)) {
    throw new Error("messageBuffer must be a Buffer");
  }
  const useKey = keyId || KMS_KEY_ID;
  if (!useKey) throw new Error("No KMS key configured (KMS_SIGNING_KEY_ID missing)");

  const signingAlg = DEFAULT_SIGNING_ALG;
  if (!signingAlg) throw new Error("KMS_SIGNING_ALGORITHM not configured");

  const cmd = new SignCommand({
    KeyId: useKey,
    Message: messageBuffer,
    MessageType: "RAW",
    SigningAlgorithm: signingAlg,
  });

  const res = await retry(() => client.send(cmd), 3, 250);
  if (!res || !res.Signature) throw new Error("KMS did not return a signature");

  const sigBytes = Buffer.from(res.Signature);
  const signatureBase58 = bs58.encode(sigBytes);

  return { keyIdUsed: useKey, signatureBase58, signatureBytes: sigBytes };
}

/**
 * getPublicKeyFromKms
 * - keyId: KMS key id or ARN
 * Returns: { keyId, publicKeyBase58 (SPKI DER), algorithm }
 */
async function getPublicKeyFromKms(keyId) {
  if (!keyId) throw new Error("keyId required");
  const cmd = new GetPublicKeyCommand({ KeyId: keyId });
  const res = await retry(() => client.send(cmd), 3, 250);
  if (!res || !res.PublicKey) throw new Error("KMS did not return public key");
  const pubDer = Buffer.from(res.PublicKey); // SPKI DER
  const publicKeyBase58 = bs58.encode(pubDer);
  const algorithm = res.SigningAlgorithms ? res.SigningAlgorithms.join(",") : null;
  return { keyId, publicKeyBase58, algorithm };
}

module.exports = { signMessageWithKms, getPublicKeyFromKms };
