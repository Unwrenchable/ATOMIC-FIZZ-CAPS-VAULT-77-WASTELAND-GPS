// backend/api/caps.js
// ------------------------------------------------------------
// Atomic Fizz Caps – IN-GAME Caps API
// Awards in-game caps (virtual currency) to players
// Mounted at /api/caps
// ------------------------------------------------------------
// 
// ⚠️ IMPORTANT: This API manages IN-GAME caps (virtual game currency)
// NOT the actual AFC token. The real token has FIXED SUPPLY on mainnet.
// See the distinction in backend/lib/caps.js
// ------------------------------------------------------------

const crypto = require("crypto");
const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { awardCapsToPlayer, getCapsBalance } = require("../lib/caps");
const redis = require("../lib/redis");

// Per-route limiter for admin caps endpoints
const capsAwardLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5,
  message: { ok: false, error: "Too many caps requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Verify the request carries a valid ADMIN_MINT_SECRET header.
// Uses constant-time comparison to prevent timing attacks.
function requireAdminSecret(req, res, next) {
  const adminSecret = process.env.ADMIN_MINT_SECRET || "";
  const supplied = req.headers["x-admin-mint"] || req.body?.adminSecret || "";
  if (!adminSecret || !supplied) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  const h1 = crypto.createHash("sha256").update(String(adminSecret)).digest();
  const h2 = crypto.createHash("sha256").update(String(supplied)).digest();
  if (!crypto.timingSafeEqual(h1, h2)) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
}

// POST /api/caps/award - Admin-only: award in-game caps to a specific wallet.
// SECURITY: requires ADMIN_MINT_SECRET header. Players must never be able to
// call this endpoint directly — caps are awarded server-side as a side-effect
// of verified game events (quest completion, location claim, battle victory).
router.post("/award", requireAdminSecret, capsAwardLimiter, async (req, res) => {
  try {
    const { wallet, amount } = req.body;

    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1_000_000
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid amount" });
    }

    const result = await awardCapsToPlayer(wallet, amount);

    return res.json({ 
      ok: true, 
      newBalance: result.newBalance,
      txId: result.txId
    });
  } catch (err) {
    console.error("[caps] award error:", err);
    return res.status(500).json({ ok: false, error: "Failed to award caps" });
  }
});

// POST /api/caps/mint - Admin-only alias for /award (kept for backward compat)
router.post("/mint", requireAdminSecret, capsAwardLimiter, async (req, res) => {
  try {
    const { wallet, amount } = req.body;

    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1_000_000
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid amount" });
    }

    const result = await awardCapsToPlayer(wallet, amount);

    return res.json({ 
      ok: true, 
      newBalance: result.newBalance,
      txId: result.txId
    });
  } catch (err) {
    console.error("[caps] mint error:", err);
    return res.status(500).json({ ok: false, error: "Failed to award caps" });
  }
});

// GET /api/caps/leaderboard - Public leaderboard ranked by caps, xp, or claims
router.get("/leaderboard", async (req, res) => {
  try {
    const metric = ["caps", "xp", "claims"].includes(req.query.metric) ? req.query.metric : "caps";
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

    // BUG FIX: removed double-prefix pattern. Redis wrappers add afw: prefix internally.
    // Pass raw "player:*" to redis.keys() → results in afw:player:* matching actual storage.
    const playerKeys = await redis.keys("player:*");
    // Returned keys: ["afw:player:<wallet>", ...]
    // Strip "afw:player:" to get the wallet address.
    const PLAYER_PREFIX = "afw:player:"; // e.g. "afw:player:"

    // Collect wallet addresses first, then fetch all profiles in batches to avoid
    // bursting Redis with thousands of concurrent hget commands when there are
    // many players. Cap total profiles scanned to a reasonable upper bound.
    const wallets = (playerKeys || [])
      .filter(k => k.startsWith(PLAYER_PREFIX))
      .map(k => k.slice(PLAYER_PREFIX.length))
      .filter(Boolean);

    const SCAN_CAP = Math.min(limit * 20, 500); // never scan more than this many profiles
    const CHUNK_SIZE = 50;
    const cappedWallets = wallets.slice(0, SCAN_CAP);
    const rawProfiles = [];
    for (let i = 0; i < cappedWallets.length; i += CHUNK_SIZE) {
      const chunk = cappedWallets.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        // BUG FIX: removed key() wrapper — redis wrappers add prefix internally.
        chunk.map(w => redis.hget(`player:${w}`, "profile").catch(() => null))
      );
      rawProfiles.push(...results);
    }

    const entries = [];
    for (let idx = 0; idx < cappedWallets.length; idx++) {
      try {
        const raw = rawProfiles[idx];
        if (!raw) continue;
        const profile = JSON.parse(raw);
        const wallet = cappedWallets[idx];
        const score =
          metric === "xp"
            ? (typeof profile.xp === "number" ? profile.xp : 0)
            : metric === "claims"
            ? (Array.isArray(profile.claimed) ? profile.claimed.length : 0)
            : (typeof profile.caps === "number" ? profile.caps : 0);
        entries.push({
          wallet,
          name: profile.name || "WANDERER",
          level: profile.level || 1,
          score,
        });
      } catch (profileErr) {
        console.warn("[caps] leaderboard: skipping malformed profile for wallet", cappedWallets[idx], profileErr.message);
      }
    }

    entries.sort((a, b) => b.score - a.score);
    const top = entries.slice(0, limit).map((e, i) => ({
      rank: i + 1,
      ...e,
      // Truncate wallet to first 4 + last 4 chars for privacy (e.g. "5Ht7...dKmZ")
      wallet: e.wallet.length > 10
        ? `${e.wallet.slice(0, 4)}...${e.wallet.slice(-4)}`
        : e.wallet,
    }));

    return res.json({ ok: true, metric, leaderboard: top });
  } catch (err) {
    console.error("[caps] leaderboard error:", err);
    return res.status(500).json({ ok: false, error: "Failed to fetch leaderboard" });
  }
});

// GET /api/caps/:wallet - Get player's in-game caps balance
router.get("/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;

    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid wallet" });
    }

    const balance = await getCapsBalance(wallet);
    return res.json({ ok: true, balance });
  } catch (err) {
    console.error("[caps] balance error:", err);
    return res.status(500).json({ ok: false, error: "Failed to get balance" });
  }
});

module.exports = router;
