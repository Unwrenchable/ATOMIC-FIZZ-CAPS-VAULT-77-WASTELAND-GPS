// workers/kms.js
// Real KMS signing using Solana keypair for ed25519 signatures.

const nacl = require('tweetnacl');
const fs = require('fs');
const path = require('path');

// Load the server keypair from env or file
const keypairPath = process.env.SERVER_KEYPAIR_PATH || path.join(__dirname, 'server_keypair.json');
let secretKey;
try {
  secretKey = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
} catch (err) {
  console.error('Failed to load server keypair for KMS', err);
  throw err;
}

function signMessage(messageBuffer) {
  const signature = nacl.sign.detached(messageBuffer, new Uint8Array(secretKey));
  return Buffer.from(signature).toString('hex');
}

module.exports = { signMessage };
