// backend/lib/admin.js

const crypto = require("crypto");
const redis = require("../../redis");
const { PublicKey } = require("@solana/web3.js");
const nacl = require("tweetnacl");

function getAdminWallets() {
  const raw = process.env.ADMIN_WALLETS || "";
  return raw
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

function isAdminWallet(wallet) {
  if (!wallet) return false;
  const admins = getAdminWallets();
  return admins.includes(wallet.toLowerCase());
}

async function issueNonce(wallet) {
  if (!wallet) throw new Error("missing wallet");
  const nonce = crypto.randomBytes(24).toString("hex");
  const key = `admin:nonce:${wallet}`;
  // Short TTL: 5 minutes
  await redis.set(key, nonce, "EX", 300);
  return nonce;
}

async function verifySignedNonce(wallet, signatureBytes) {
  if (!wallet) throw new Error("missing wallet");
  if (!Array.isArray(signatureBytes)) throw new Error("invalid signature");

  const key = `admin:nonce:${wallet}`;
  const nonce = await redis.get(key);
  if (!nonce) {
    throw new Error("nonce expired or missing");
  }

  const pubkey = new PublicKey(wallet);
  const message = new TextEncoder().encode(nonce);
  const signature = Uint8Array.from(signatureBytes);
  const pkBytes = pubkey.toBytes();

  const ok = nacl.sign.detached.verify(message, signature, pkBytes);
  if (!ok) throw new Error("invalid signature");

  // Single-use nonce
  await redis.del(key);
  return true;
}

module.exports = {
  isAdminWallet,
  issueNonce,
  verifySignedNonce,
};
