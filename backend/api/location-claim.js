// backend/api/location-claim.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Location Claim API
// Mounted at /api/location-claim
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { redis, key } = require("../lib/redis");

// ------------------------------------------------------------
// Per-route limiter (claiming is high-value & spam-sensitive)
// ------------------------------------------------------------
const claimLimiter = rateLimit({
  windowMs: 5 * 1000,
  max: 5,
  message: { ok: false, error: "Too many claim attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// POST /api/location-claim/claim
// ------------------------------------------------------------
router.post("/claim", claimLimiter, async (req, res) => {
  try {
    const { wallet, poiId, lat, lng } = req.body;

    // -----------------------------
    // Input validation
    // -----------------------------
    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    if (!poiId || typeof poiId !== "string" || poiId.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid poiId" });
    }

    if (typeof lat !== "number" || !Number.isFinite(lat)) {
      return res.status(400).json({ ok: false, error: "Invalid latitude" });
    }

    if (typeof lng !== "number" || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, error: "Invalid longitude" });
    }

    // Earth sanity bounds
    if (lat < -90 || lat > 90) {
      return res.status(400).json({ ok: false, error: "Latitude out of range" });
    }

    if (lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: "Longitude out of range" });
    }

    // -----------------------------
    // TODO: real distance check vs POI coordinates
    // TODO: cooldowns, XP, caps, rewards
    // -----------------------------

    const redisKey = key(`player:${wallet}:claimed`);
    await redis.sAdd(redisKey, poiId.trim());

    return res.json({
      ok: true,
      poiId,
    });
  } catch (err) {
    console.error("[api/location-claim] claim error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to process claim" });
  }
});

module.exports = router;
