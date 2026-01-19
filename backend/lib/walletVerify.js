// lib/walletVerify.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Solana Wallet Signature Verification
// Uses tweetnacl + bs58 to confirm wallet ownership
// ------------------------------------------------------------

const nacl = require("tweetnacl");
const bs58 = require("bs58");

function verifySignature({ publicKey, message, signature }) {
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
