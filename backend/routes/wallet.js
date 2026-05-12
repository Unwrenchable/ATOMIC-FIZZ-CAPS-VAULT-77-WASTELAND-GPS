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
  message: { ok: false, error: "Too many wallet requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

const express = require("express");
const router = express.Router();
const nacl = require("tweetnacl");
const { decode: bs58decode } = require("../lib/safe-base58");
const {
  authMiddleware,
  storeSession,
  getSession,
  generateNonce,
  generateSessionId,
  storeNonce,
  getNonce,
  deleteNonce,
} = require("../lib/auth");

// ------------------------------------------------------------
// Generate a nonce for the wallet to sign
// ------------------------------------------------------------
router.get("/nonce/:publicKey", walletLimiter, async (req, res) => {
  const { publicKey } = req.params;

  if (!publicKey) {
    return res.status(400).json({ ok: false, error: "Missing publicKey" });
  }

  // SECURITY FIX: validate publicKey is a valid base58 Solana address before
  // using it as a Redis key component. Without this check an attacker could
  // inject arbitrary strings (e.g. containing colons or newlines) into the
  // Redis key namespace, potentially colliding with other keys.
  // Solana ed25519 public keys base58-encode to 32-50 characters.
  if (typeof publicKey !== "string" || publicKey.length < 32 || publicKey.length > 50) {
    return res.status(400).json({ ok: false, error: "Invalid publicKey length" });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(publicKey)) {
    return res.status(400).json({ ok: false, error: "Invalid publicKey format" });
  }

  const nonce = generateNonce();

  await storeNonce(publicKey, nonce);

  res.json({ ok: true, nonce });
});

// ------------------------------------------------------------
// Verify signature + create session
// ------------------------------------------------------------
router.post("/verify", walletLimiter, async (req, res) => {
  try {
    const { publicKey, signature } = req.body;

    // Input presence + bounds check (mirrors lib/auth.js rigour)
    if (!publicKey || typeof publicKey !== "string" || publicKey.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid publicKey" });
    }
    if (!signature || typeof signature !== "string" || signature.length > 512) {
      return res.status(400).json({ ok: false, error: "Invalid signature" });
    }

    const nonce = await getNonce(publicKey);
    if (!nonce) {
      return res.status(400).json({ ok: false, error: "Nonce expired" });
    }

    // Decode
    let pubKeyBytes, sigBytes;
    try {
      pubKeyBytes = bs58decode(publicKey);
      sigBytes = bs58decode(signature);
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Invalid encoding" });
    }

    // Explicit byte-length guards — nacl throws on wrong lengths
    if (pubKeyBytes.length !== 32) {
      return res.status(400).json({ ok: false, error: "Invalid public key length" });
    }
    if (sigBytes.length !== 64) {
      return res.status(400).json({ ok: false, error: "Invalid signature length" });
    }

    const msgBytes = Buffer.from(`Atomic Fizz Caps login: ${nonce}`, "utf8");

    // Verify signature (nacl.sign.detached.verify can throw — outer try/catch handles it)
    const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes);

    if (!valid) {
      return res.status(401).json({ ok: false, error: "Invalid signature" });
    }

    // Consume nonce BEFORE creating session (reduces TOCTOU race window)
    await deleteNonce(publicKey);

    // Create session — store in auth:session:* namespace with JSON payload
    // so authMiddleware can verify tokens from either auth path.
    const sessionId = generateSessionId();
    await storeSession(sessionId, { wallet: publicKey, createdAt: Date.now() });

    return res.json({
      ok: true,
      sessionId,
      wallet: publicKey,
    });
  } catch (err) {
    console.error("[wallet] verify error:", err);
    return res.status(500).json({ ok: false, error: "Verification failed" });
  }
});

// ------------------------------------------------------------
// Validate session — requires auth; caller may only look up their own session
// ------------------------------------------------------------
router.get("/session/:sessionId", walletLimiter, authMiddleware, async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId || typeof sessionId !== "string" || sessionId.length > 256) {
    return res.status(400).json({ ok: false, error: "Invalid sessionId" });
  }

  // Prevent cross-session enumeration: only the owning session may look itself up
  if (sessionId !== req.player.sessionId) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  const session = await getSession(sessionId);

  if (!session || !session.wallet) {
    return res.json({ ok: false, valid: false });
  }

  res.json({ ok: true, valid: true, wallet: session.wallet });
});

module.exports = router;
