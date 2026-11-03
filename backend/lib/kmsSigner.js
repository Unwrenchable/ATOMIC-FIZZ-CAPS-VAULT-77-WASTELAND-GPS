// backend/lib/kmsSigner.js
// On-chain vouchers need Ed25519. The AWS SDK is loaded only when a caller
// actually signs, so unit tests can inject a fake client without the package.
const { encode: bs58encode } = require("./safe-base58");

const REGION = process.env.AWS_REGION || "us-west-2";

let sdkOverride = null;
let clientOverride = null;
let clientMemo = null;

function signingAlgorithm() {
  return process.env.KMS_SIGNING_ALGORITHM || "ED25519_SHA_512";
}

function setKmsSdkForTests(sdk) {
  sdkOverride = sdk;
  clientMemo = null;
}

function setClientForTests(client) {
  clientOverride = client;
}

function loadSdk() {
  if (sdkOverride) return sdkOverride;
  // Lazy: @aws-sdk/client-kms is not a hard dependency of the test suite.
  return require("@aws-sdk/client-kms");
}

function getClient() {
  if (clientOverride) return clientOverride;
  if (!clientMemo) {
    const { KMSClient } = loadSdk();
    clientMemo = new KMSClient({ region: REGION, maxAttempts: 3 });
  }
  return clientMemo;
}

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
 * Sign a raw message. Do not log `messageBuffer` or the signature.
 * Returns { keyIdUsed, signatureBase58, signatureBytes }.
 */
async function signMessageWithKms(messageBuffer, keyId = null) {
  if (!messageBuffer || !Buffer.isBuffer(messageBuffer)) {
    throw new Error("messageBuffer must be a Buffer");
  }
  const useKey = keyId || process.env.KMS_SIGNING_KEY_ID || null;
  if (!useKey) throw new Error("No KMS key configured");

  const signingAlg = signingAlgorithm();
  if (signingAlg !== "ED25519_SHA_512") {
    throw new Error("KMS_SIGNING_ALGORITHM must be ED25519_SHA_512 for on-chain vouchers");
  }

  const { SignCommand } = loadSdk();
  const cmd = new SignCommand({
    KeyId: useKey,
    Message: messageBuffer,
    MessageType: "RAW",
    SigningAlgorithm: signingAlg,
  });

  const res = await retry(() => getClient().send(cmd), 3, 250);
  if (!res || !res.Signature) throw new Error("KMS did not return a signature");

  const sigBytes = Buffer.from(res.Signature);
  return { keyIdUsed: useKey, signatureBase58: bs58encode(sigBytes), signatureBytes: sigBytes };
}

/**
 * Ed25519 SPKI DER from KMS. The raw 32-byte key is the last 32 bytes.
 * publicKeyBase58 is that raw key (what config.server_key must store).
 */
async function getPublicKeyFromKms(keyId) {
  if (!keyId) throw new Error("keyId required");
  const { GetPublicKeyCommand } = loadSdk();
  const cmd = new GetPublicKeyCommand({ KeyId: keyId });
  const res = await retry(() => getClient().send(cmd), 3, 250);
  if (!res || !res.PublicKey) throw new Error("KMS did not return public key");
  const pubDer = Buffer.from(res.PublicKey);
  if (pubDer.length < 32) throw new Error("KMS public key is shorter than 32 bytes");
  const raw = pubDer.subarray(pubDer.length - 32);
  const algorithm = res.SigningAlgorithms ? res.SigningAlgorithms.join(",") : null;
  if (algorithm && !algorithm.includes("ED25519")) {
    throw new Error("KMS key is not an Ed25519 key");
  }
  return {
    keyId,
    publicKeyBase58: bs58encode(raw),
    publicKeyDerBase58: bs58encode(pubDer),
    algorithm,
  };
}

module.exports = {
  signMessageWithKms,
  getPublicKeyFromKms,
  setKmsSdkForTests,
  setClientForTests,
  signingAlgorithm,
};
