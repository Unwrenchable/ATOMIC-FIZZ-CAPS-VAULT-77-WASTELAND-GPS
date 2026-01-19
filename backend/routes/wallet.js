// routes/wallet.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Wallet Authentication Route
// Solana signature verification + Redis session storage
// ------------------------------------------------------------
const rateLimit = require("express-rate-limit");

const walletLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 5,              // only 5 requests per 10 seconds
  message: { success: false, error: "Too many wallet requests" }
});

const express = require("express");
const router = express.Router();
const redis = require("../lib/redis");
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const { v4: uuidv4 } = require("uuid");

// ------------------------------------------------------------
// Generate a nonce for the wallet to sign
// ------------------------------------------------------------
router.get("/nonce/:publicKey", async (req, res) => {
  const { publicKey } = req.params;

  if (!publicKey) {
    return res.status(400).json({ success: false, error: "Missing publicKey" });
  }

  const nonce = uuidv4();

  await redis.set(`wallet:nonce:${publicKey}`, nonce, { EX: 300 });

  res.json({ success: true, nonce });
});

// ------------------------------------------------------------
// Verify signature + create session
// ------------------------------------------------------------
router.post("/verify", async (req, res) => {
  const { publicKey, signature } = req.body;

  if (!publicKey || !signature) {
    return res.status(400).json({ success: false, error: "Missing fields" });
  }

  const nonce = await redis.get(`wallet:nonce:${publicKey}`);

  if (!nonce) {
    return res.status(400).json({ success: false, error: "Nonce expired" });
  }

  // Decode
  let pubKeyBytes, sigBytes;
  try {
    pubKeyBytes = bs58.decode(publicKey);
    sigBytes = bs58.decode(signature);
  } catch (err) {
    return res.status(400).json({ success: false, error: "Invalid encoding" });
  }

  const msgBytes = Buffer.from(nonce);

  // Verify signature
  const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);

  if (!valid) {
    return res.status(401).json({ success: false, error: "Invalid signature" });
  }

  // Create session
  const sessionId = uuidv4();

  await redis.set(`wallet:session:${sessionId}`, publicKey, { EX: 86400 });

  // Cleanup nonce
  await redis.del(`wallet:nonce:${publicKey}`);

  res.json({
    success: true,
    session: sessionId,
    wallet: publicKey,
  });
});

// ------------------------------------------------------------
// Validate session
// ------------------------------------------------------------
router.get("/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  const wallet = await redis.get(`wallet:session:${sessionId}`);

  if (!wallet) {
    return res.json({ success: false, valid: false });
  }

  res.json({ success: true, valid: true, wallet });
});

module.exports = router;
