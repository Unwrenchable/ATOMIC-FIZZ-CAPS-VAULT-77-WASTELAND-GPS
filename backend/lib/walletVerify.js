// lib/walletVerify.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Solana Wallet Signature Verification
// Uses tweetnacl + bs58 to confirm wallet ownership
// ------------------------------------------------------------

const nacl = require("tweetnacl");
const bs58 = require("bs58");

function verifySignature({ publicKey, message, signature }) {
  // Validate input types and lengths before decoding to prevent DoS via huge inputs
  if (typeof publicKey !== "string" || publicKey.length < 32 || publicKey.length > 128) return false;
  if (typeof message !== "string" || message.length > 10000) return false;
  if (typeof signature !== "string" || signature.length < 64 || signature.length > 256) return false;

  try {
    const pubKeyBytes = bs58.decode(publicKey);
    const msgBytes = Buffer.from(message);
    const sigBytes = bs58.decode(signature);

    return nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
  } catch (err) {
    console.warn("[walletVerify] failed:", err);
    return false;
  }
}

module.exports = { verifySignature };
