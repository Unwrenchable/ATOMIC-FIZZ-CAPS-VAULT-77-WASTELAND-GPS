// routes/wallet.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Wallet Authentication Route
// Solana signature verification + Redis session storage
//
// SEC-002 FIX: sessions now use the same key namespace and JSON
// format as lib/auth.js so tokens from either auth path are
// accepted by authMiddleware without a JSON parse error.
// ------------------------------------------------------------
const rateLimit = require("express-rate-limit");

const walletLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 5,              // only 5 requests per 10 seconds
  message: { success: false, error: "Too many wallet requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

const express = require("express");
const router = express.Router();
const redis = require("../lib/redis");
const { storeSession } = require("../lib/auth");
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const { v4: uuidv4 } = require("uuid");

// ------------------------------------------------------------
// Generate a nonce for the wallet to sign
// ------------------------------------------------------------
router.get("/nonce/:publicKey", walletLimiter, async (req, res) => {
  const { publicKey } = req.params;

  if (!publicKey) {
    return res.status(400).json({ success: false, error: "Missing publicKey" });
  }

  // SECURITY FIX: validate publicKey is a valid base58 Solana address before
  // using it as a Redis key component. Without this check an attacker could
  // inject arbitrary strings (e.g. containing colons or newlines) into the
  // Redis key namespace, potentially colliding with other keys.
  // Solana ed25519 public keys base58-encode to 32-50 characters.
  if (typeof publicKey !== "string" || publicKey.length < 32 || publicKey.length > 50) {
    return res.status(400).json({ success: false, error: "Invalid publicKey length" });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(publicKey)) {
    return res.status(400).json({ success: false, error: "Invalid publicKey format" });
  }

  const nonce = uuidv4();

  await redis.set(`wallet:nonce:${publicKey}`, nonce, { EX: 300 });

  res.json({ success: true, nonce });
});

// ------------------------------------------------------------
// Verify signature + create session
// ------------------------------------------------------------
router.post("/verify", walletLimiter, async (req, res) => {
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

  // Create session — store in auth:session:* namespace with JSON payload
  // so authMiddleware can verify tokens from either auth path.
  const sessionId = uuidv4();
  await storeSession(sessionId, { wallet: publicKey, createdAt: Date.now() });

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
router.get("/session/:sessionId", walletLimiter, async (req, res) => {
  const { sessionId } = req.params;
  const { getSession } = require("../lib/auth");

  const session = await getSession(sessionId);

  if (!session || !session.wallet) {
    return res.json({ success: false, valid: false });
  }

  res.json({ success: true, valid: true, wallet: session.wallet });
});

module.exports = router;
