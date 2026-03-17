// workers/kms_stub.js
// Simple KMS signing stub for demo purposes only.
// Replace with real KMS/HSM integration in production.

const crypto = require('crypto');

function signMessageStub(messageBuffer) {
  // Return a fake signature (hex) based on timestamp and crypto-random bytes
  const sig = `sig-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  return sig;
}

module.exports = { signMessageStub };
