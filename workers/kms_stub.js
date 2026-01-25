// workers/kms_stub.js
// Simple KMS signing stub for demo purposes only.
// Replace with real KMS/HSM integration in production.

function signMessageStub(messageBuffer) {
  // Return a fake signature (hex) based on timestamp and random
  const sig = `sig-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return sig;
}

module.exports = { signMessageStub };
