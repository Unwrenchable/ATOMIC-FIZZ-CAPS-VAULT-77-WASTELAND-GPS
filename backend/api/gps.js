// backend/api/gps.js
// ------------------------------------------------------------
// Atomic Fizz Caps – GPS Update API
// Mounted at /api/gps
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const gps = require("../lib/gps");

// ------------------------------------------------------------
// Per-route limiter (GPS is spam-sensitive)
// ------------------------------------------------------------
const gpsLimiter = rateLimit({
  windowMs: 5 * 1000,
  max: 10,
  message: { ok: false, error: "Too many GPS updates" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// POST /api/gps/update
// ------------------------------------------------------------
router.post("/update", authMiddleware, gpsLimiter, async (req, res) => {
  try {
    const player = req.player;
    const { lat, lng } = req.body;

    // -----------------------------
    // Input validation
    // -----------------------------
    if (typeof lat !== "number" || !Number.isFinite(lat)) {
      return res.status(400).json({ ok: false, error: "Invalid latitude" });
    }

    if (typeof lng !== "number" || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, error: "Invalid longitude" });
    }

    // Optional: sanity bounds (Earth)
    if (lat < -90 || lat > 90) {
      return res.status(400).json({ ok: false, error: "Latitude out of range" });
    }

    if (lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: "Longitude out of range" });
    }

    // -----------------------------
    // Update GPS
    // -----------------------------
    const result = await gps.updateLocation(player, lat, lng);

    return res.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[api/gps] update error:", err?.message || err);
    return res
      .status(400)
      .json({ ok: false, error: err.message || "Failed to update GPS" });
  }
});

module.exports = router;
