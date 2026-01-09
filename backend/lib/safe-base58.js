// backend/lib/safe-base58.js
const bs58 = require("bs58");

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

module.exports = { safeDecodeBase58, isBase58 };
