// lib/walletVerify.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Solana Wallet Signature Verification
// Uses tweetnacl + bs58 to confirm wallet ownership
// ------------------------------------------------------------

const nacl = require("tweetnacl");
const { decode: bs58decode } = require("./safe-base58");

function verifySignature({ publicKey, message, signature }) {
  // Validate input types and lengths before decoding to prevent DoS via huge inputs.
  // Solana base58 public keys: 32 bytes → 43-44 chars (allow 32-50 for edge cases).
  // Solana base58 ed25519 signatures: 64 bytes → 87-88 chars (allow 85-90 for edge cases).
  if (typeof publicKey !== "string" || publicKey.length < 32 || publicKey.length > 50) return false;
  if (typeof message !== "string" || message.length > 10000) return false;
  if (typeof signature !== "string" || signature.length < 85 || signature.length > 90) return false;

  try {
    const pubKeyBytes = bs58decode(publicKey);
    const msgBytes = Buffer.from(message);
    const sigBytes = bs58decode(signature);

    return nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);
  } catch (err) {
    console.warn("[walletVerify] failed:", err);
    return false;
  }
}

module.exports = { verifySignature };
