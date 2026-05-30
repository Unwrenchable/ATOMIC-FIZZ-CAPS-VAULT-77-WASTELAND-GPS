// backend/lib/safe-base58.js
// bs58 v6+ ships as an ESM module; its CJS entry (`src/cjs/index.cjs`) exposes
// the codec under `exports.default` rather than directly on `exports`.  This
// loader handles both shapes so any consumer can safely require this file
// regardless of which bs58 version or interop quirk is in play.
function loadBs58() {
  const b = require("bs58");
  if (b && typeof b.encode === "function" && typeof b.decode === "function") return b;
  if (b && b.default && typeof b.default.encode === "function" && typeof b.default.decode === "function") return b.default;
  throw new Error("bs58 encode/decode not found — ensure the 'bs58' package is installed correctly");
}

const { encode, decode } = loadBs58();

function isBase58(str) {
  return typeof str === "string" && /^[1-9A-HJ-NP-Za-km-z]+$/.test(str);
}

function safeDecodeBase58(str, name = "key") {
  if (!str) throw new Error(`${name} missing`);
  if (!isBase58(str)) throw new Error(`${name} contains non-base58 characters`);
  try {
    return decode(str);
  } catch (err) {
    throw new Error(`${name} decode failed: ${err.message}`, { cause: err });
  }
}

module.exports = { encode, decode, safeDecodeBase58, isBase58 };
