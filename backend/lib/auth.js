// backend/lib/auth.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Wallet Auth & Session System
// ------------------------------------------------------------

require("dotenv").config();

const express = require("express");
const rateLimit = require("express-rate-limit");
const nacl = require("tweetnacl");
const crypto = require("crypto");

const { redis, key } = require("./redis");

// Optional: comma-separated list of admin wallets
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || "")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);

// ------------------------------------------------------------
// Base58 helpers
// ------------------------------------------------------------
function loadBs58() {
  try {
    const b = require("bs58");
    if (b && typeof b.decode === "function" && typeof b.encode === "function") {
      return b;
    }
    const baseX = require("base-x");
    const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    return baseX(BASE58);
  } catch (err) {
    throw new Error("Base58 library not available: " + err.message);
  }
}

const bs58 = loadBs58();

function safeDecodeBase58(str, name = "value") {
  if (!str || typeof str !== "string") throw new Error(`${name} missing`);
  if (str.length > 256) throw new Error(`${name} too long`);
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(str)) {
    throw new Error(`${name} contains non-base58 characters`);
  }
  try {
    return bs58.decode(str);
  } catch (err) {
    throw new Error(`${name} decode failed: ${err.message}`);
  }
}

// ------------------------------------------------------------
// Redis key helpers
// ------------------------------------------------------------
function nonceKey(publicKey) {
  return key(`auth:nonce:${publicKey}`);
}

function sessionKey(sessionId) {
  return key(`auth:session:${sessionId}`);
}

// ------------------------------------------------------------
// Nonce + session helpers
// ------------------------------------------------------------
function generateNonce() {
  return bs58.encode(crypto.randomBytes(24));
}

function generateSessionId() {
  return bs58.encode(crypto.randomBytes(32));
}

async function storeNonce(publicKey, nonce, ttlSeconds = 300) {
  const k = nonceKey(publicKey);
  await redis.set(k, nonce, { EX: ttlSeconds });
}

async function getNonce(publicKey) {
  const k = nonceKey(publicKey);
  return redis.get(k);
}

async function deleteNonce(publicKey) {
  const k = nonceKey(publicKey);
  await redis.del(k);
}

async function storeSession(sessionId, payload, ttlSeconds = 60 * 60 * 24) {
  const k = sessionKey(sessionId);
  await redis.set(k, JSON.stringify(payload), { EX: ttlSeconds });
}

async function getSession(sessionId) {
  const k = sessionKey(sessionId);
  const raw = await redis.get(k);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function deleteSession(sessionId) {
  const k = sessionKey(sessionId);
  await redis.del(k);
}

// ------------------------------------------------------------
// Auth middleware
// ------------------------------------------------------------
async function authMiddleware(req, res, next) {
  try {
    const header = req.headers["authorization"] || req.headers["x-session-id"];
    if (!header) {
      return res.status(401).json({ ok: false, error: "Missing session" });
    }

    let sessionId = header;
    if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
      sessionId = header.slice(7).trim();
    }

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 256) {
      return res.status(401).json({ ok: false, error: "Invalid session" });
    }

    const session = await getSession(sessionId);
    if (!session || !session.wallet) {
      return res.status(401).json({ ok: false, error: "Session expired or invalid" });
    }

    const isAdminFlag =
      ADMIN_WALLETS.length > 0 &&
      ADMIN_WALLETS.some((w) => w.toLowerCase() === session.wallet.toLowerCase());

    req.player = {
      wallet: session.wallet,
      role: isAdminFlag ? "admin" : "player",
      sessionId,
    };

    next();
  } catch (err) {
    console.error("[auth] authMiddleware error:", err);
    return res.status(500).json({ ok: false, error: "Auth failure" });
  }
}

function isAdmin(req) {
  return req && req.player && req.player.role === "admin";
}

// ------------------------------------------------------------
// Auth router (mount at /api/auth)
// ------------------------------------------------------------
const router = express.Router();

// Rate limiters
const nonceLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 20,
  message: { ok: false, error: "Too many nonce requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 10,
  message: { ok: false, error: "Too many verify requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/auth/nonce/:publicKey
router.get("/nonce/:publicKey", nonceLimiter, async (req, res) => {
  try {
    const publicKey = req.params.publicKey;

    if (!publicKey || typeof publicKey !== "string" || publicKey.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid publicKey" });
    }

    // Validate base58 shape early
    try {
      safeDecodeBase58(publicKey, "publicKey");
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }

    const nonce = generateNonce();
    await storeNonce(publicKey, nonce);

    return res.json({ ok: true, publicKey, nonce });
  } catch (err) {
    console.error("[auth] nonce error:", err);
    return res.status(500).json({ ok: false, error: "Failed to generate nonce" });
  }
});

// POST /api/auth/verify
// body: { publicKey, signature }
router.post("/verify", verifyLimiter, async (req, res) => {
  try {
    const { publicKey, signature } = req.body || {};

    if (!publicKey || typeof publicKey !== "string" || publicKey.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid publicKey" });
    }

    if (!signature || typeof signature !== "string" || signature.length > 512) {
      return res.status(400).json({ ok: false, error: "Invalid signature" });
    }

    const nonce = await getNonce(publicKey);
    if (!nonce) {
      return res.status(400).json({ ok: false, error: "Nonce expired or missing" });
    }

    let pubKeyBytes;
    let sigBytes;
    try {
      pubKeyBytes = safeDecodeBase58(publicKey, "publicKey");
      sigBytes = safeDecodeBase58(signature, "signature");
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }

    const message = Buffer.from(`Atomic Fizz Caps login: ${nonce}`, "utf8");

    const ok = nacl.sign.detached.verify(
      message,
      sigBytes,
      pubKeyBytes
    );

    if (!ok) {
      return res.status(401).json({ ok: false, error: "Invalid signature" });
    }

    // Signature valid: consume nonce and create session
    await deleteNonce(publicKey);

    const sessionId = generateSessionId();
    const sessionPayload = {
      wallet: publicKey,
      createdAt: Date.now(),
    };

    await storeSession(sessionId, sessionPayload);

    return res.json({
      ok: true,
      sessionId,
      wallet: publicKey,
    });
  } catch (err) {
    console.error("[auth] verify error:", err);
    return res.status(500).json({ ok: false, error: "Failed to verify signature" });
  }
});

// GET /api/auth/session/:sessionId
router.get("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 256) {
      return res.status(400).json({ ok: false, error: "Invalid sessionId" });
    }

    const session = await getSession(sessionId);
    if (!session || !session.wallet) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }

    return res.json({ ok: true, session });
  } catch (err) {
    console.error("[auth] session error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load session" });
  }
});

// POST /api/auth/logout
router.post("/logout", authMiddleware, async (req, res) => {
  try {
    const sessionId = req.player.sessionId;
    if (sessionId) {
      await deleteSession(sessionId);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[auth] logout error:", err);
    return res.status(500).json({ ok: false, error: "Failed to logout" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    return res.json({
      ok: true,
      player: req.player,
    });
  } catch (err) {
    console.error("[auth] me error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load player" });
  }
});

module.exports = {
  authMiddleware,
  isAdmin,
  router,
};
