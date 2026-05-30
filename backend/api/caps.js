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
const { redis, key } = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");

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

// GET /api/caps/:wallet - Get player's in-game caps balance
// BUG-046 FIX: add rate limiting to prevent bulk wallet enumeration.
// Without this, any script could loop over all known wallet addresses and
// map the entire game economy in seconds.
const capsBalanceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 balance checks per minute per IP
  message: { ok: false, error: "Too many balance requests — slow down, Vault Dweller" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/:wallet", capsBalanceLimiter, async (req, res) => {
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

// POST /api/caps/redeem
// Authenticated player-facing route: deducts in-game caps from the player's balance
// and records a redemption request in Redis for treasury processing.
//
// ⚠️ IMPORTANT: This route does NOT transfer on-chain AFC tokens itself.
// The AFC token supply is FIXED — there are no minting instructions.
// This route records a *redemption request* (amount, wallet, timestamp) that the
// treasury operator can fulfil via a manual or automated airdrop from the treasury
// wallet.  On-chain settlement is out-of-scope here.
//
// Rate limit: 3 redemptions per 10 minutes per IP to prevent flooding.
const redeemLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  message: { ok: false, error: "Too many redemption requests — please wait before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Minimum in-game caps required per redemption request (prevent dust spam)
const MIN_REDEEM_AMOUNT = Number(process.env.MIN_REDEEM_CAPS || 100);
// Maximum in-game caps per single redemption (anti-abuse)
const MAX_REDEEM_AMOUNT = Number(process.env.MAX_REDEEM_CAPS || 10_000);
// Cooldown between redemptions per wallet (seconds) — 24 hours default
const REDEEM_COOLDOWN_SECONDS = Number(process.env.REDEEM_COOLDOWN_SECONDS || 86400);
// How long to retain fulfilled redemption request records in Redis (30 days)
const REDEEM_REQUEST_TTL_SECONDS = 30 * 24 * 3600;

router.post("/redeem", redeemLimiter, authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { amount } = req.body;

    // Input validation
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount < MIN_REDEEM_AMOUNT ||
      amount > MAX_REDEEM_AMOUNT ||
      Math.floor(amount) !== amount
    ) {
      return res.status(400).json({
        ok: false,
        error: `Amount must be a whole number between ${MIN_REDEEM_AMOUNT} and ${MAX_REDEEM_AMOUNT}`,
      });
    }

    // Per-wallet cooldown: prevent multiple redemptions within the cooldown window.
    // Uses NX so the check + lock is atomic (no TOCTOU).
    // The redis wrapper returns "OK" on NX success, null when the key already exists.
    const cooldownKey = key(`caps:redeem:cooldown:${wallet}`);
    const nxResult = await redis.set(cooldownKey, "1", { NX: true, EX: REDEEM_COOLDOWN_SECONDS });
    if (nxResult === null) {
      const ttlRaw = await redis.ttl(cooldownKey);
      const wait = ttlRaw > 0 ? ttlRaw : REDEEM_COOLDOWN_SECONDS;
      const hours = Math.ceil(wait / 3600);
      return res.status(429).json({
        ok: false,
        error: `Redemption on cooldown — please wait ${hours}h before your next redemption.`,
        cooldownSeconds: wait,
      });
    }

    // Per-wallet lock: prevent concurrent redemption race condition.
    // Same NX semantics: "OK" = acquired, null = already held by another request.
    const lockKey = key(`caps:redeem:lock:${wallet}`);
    const lockResult = await redis.set(lockKey, "1", { NX: true, EX: 15 });
    if (lockResult === null) {
      // Release cooldown so the player can retry
      await redis.del(cooldownKey).catch(() => {});
      return res.status(409).json({ ok: false, error: "Redemption already in progress — please retry." });
    }

    try {
      // Verify the player has enough in-game caps
      const currentBalance = await getCapsBalance(wallet);
      if (currentBalance < amount) {
        // Release cooldown so the player can retry after earning more caps
        await redis.del(cooldownKey).catch(() => {});
        return res.status(400).json({
          ok: false,
          error: `Insufficient caps. You have ${currentBalance}, need ${amount}.`,
          balance: currentBalance,
        });
      }

      // Deduct the caps from the player's in-game balance
      const profileKey = key(`player:${wallet}`);
      const profileRaw = await redis.hget(profileKey, "profile");
      if (!profileRaw) {
        await redis.del(cooldownKey).catch(() => {});
        return res.status(404).json({ ok: false, error: "Player profile not found." });
      }
      const profile = JSON.parse(profileRaw);
      profile.caps = Math.max(0, (profile.caps || 0) - amount);
      await redis.hset(profileKey, "profile", JSON.stringify(profile));

      // Record the redemption request for treasury processing.
      // Uses a Redis Set to track pending request IDs so treasury tooling can
      // efficiently scan and process them (sadd is available in the redis wrapper).
      const requestId = crypto.randomBytes(16).toString("hex");
      const requestRecord = {
        requestId,
        wallet,
        amount,
        status: "pending",
        requestedAt: Date.now(),
      };

      // Store the request individually for lookup by requestId (30-day TTL)
      const reqKey = key(`caps:redeem:req:${requestId}`);
      await redis.set(reqKey, JSON.stringify(requestRecord), { EX: REDEEM_REQUEST_TTL_SECONDS });

      // Track in a pending-IDs set so the treasury can enumerate open requests
      const pendingSetKey = key("caps:redeem:pending");
      await redis.sadd(pendingSetKey, requestId);

      console.log(`[caps] Redemption request ${requestId}: ${wallet.slice(0, 8)} → ${amount} caps`);

      return res.json({
        ok: true,
        requestId,
        amount,
        newBalance: profile.caps,
        message: "Redemption request recorded. The treasury will process your AFC token distribution shortly.",
        estimatedProcessingTime: "24–72 hours",
      });
    } finally {
      await redis.del(lockKey).catch(() => {});
    }
  } catch (err) {
    console.error("[caps] redeem error:", err);
    return res.status(500).json({ ok: false, error: "Failed to process redemption" });
  }
});

module.exports = router;
