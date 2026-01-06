// backend/lib/kmsSigner.js
const { KMSClient, SignCommand, GetPublicKeyCommand } = require("@aws-sdk/client-kms");
const bs58 = require("bs58");

const REGION = process.env.AWS_REGION || "us-west-2";
const KMS_KEY_ID = process.env.KMS_SIGNING_KEY_ID; // ARN or KeyId of the KMS asymmetric key to use by default
if (!KMS_KEY_ID) {
  console.warn("[kmsSigner] KMS_SIGNING_KEY_ID not set. Set this to your KMS asymmetric key ARN or KeyId.");
}

const client = new KMSClient({ region: REGION });

/**
 * signMessageWithKms
 * - messageBuffer: Buffer
 * - keyId: optional KMS key id/arn; falls back to KMS_KEY_ID
 * Returns: { keyIdUsed, signatureBase58 }
 */
async function signMessageWithKms(messageBuffer, keyId = null) {
  if (!messageBuffer || !Buffer.isBuffer(messageBuffer)) {
    throw new Error("messageBuffer must be a Buffer");
  }
  const useKey = keyId || KMS_KEY_ID;
  if (!useKey) throw new Error("No KMS key configured");

  // KMS expects a Uint8Array
  const cmd = new SignCommand({
    KeyId: useKey,
    Message: messageBuffer,
    MessageType: "RAW",
    // SigningAlgorithm must match the key type. For Ed25519 use "ED25519" if supported.
    // For RSA keys use "RSASSA_PKCS1_V1_5_SHA_256" or similar.
    SigningAlgorithm: process.env.KMS_SIGNING_ALGORITHM || "ED25519",
  });

  const res = await client.send(cmd);
  if (!res.Signature) throw new Error("KMS did not return a signature");

  // Signature is ArrayBuffer-like; convert to Uint8Array then base58 for transport
  const sigBytes = Buffer.from(res.Signature);
  const signatureBase58 = bs58.encode(sigBytes);

  return { keyIdUsed: useKey, signatureBase58 };
}

/**
 * getPublicKeyFromKms
 * - keyId: KMS key id or ARN
 * Returns: { keyId, publicKeyBase58, algorithm }
 */
async function getPublicKeyFromKms(keyId) {
  if (!keyId) throw new Error("keyId required");
  const cmd = new GetPublicKeyCommand({ KeyId: keyId });
  const res = await client.send(cmd);
  if (!res.PublicKey) throw new Error("KMS did not return public key");
  const pub = Buffer.from(res.PublicKey);
  const publicKeyBase58 = bs58.encode(pub);
  const algorithm = res.SigningAlgorithms ? res.SigningAlgorithms.join(",") : null;
  return { keyId, publicKeyBase58, algorithm };
}

module.exports = { signMessageWithKms, getPublicKeyFromKms };
