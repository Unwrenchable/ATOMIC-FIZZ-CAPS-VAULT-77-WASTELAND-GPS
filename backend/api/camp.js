// backend/api/camp.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Camp / Settlement System API
// Mounted at /api/camp
// ------------------------------------------------------------
// Routes:
//   POST   /api/camp/set     – Set up camp at current GPS location
//   POST   /api/camp/rest    – Collect rest bonus (must be near camp)
//   GET    /api/camp/:wallet – Get a player's camp (public, for map display)
//   DELETE /api/camp/break   – Break down camp
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const { redis, key } = require("../lib/redis");

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------
const CAMP_TTL_SECONDS    = 7 * 24 * 3600; // 7 days
const CAMP_SET_COOLDOWN   = 300;            // 5 minutes between set calls
const REST_COOLDOWN       = 6 * 3600;       // 6 hours between rest calls
const REST_RADIUS_METERS  = 500;
const REST_XP_BONUS       = 50;
const REST_CAPS_BONUS     = 25;
const CAMP_NAME_MAX       = 40;
const WALLET_PARAM_MAX    = 128;

const CAMP_BUFFS = {
  restBonus:          REST_CAPS_BONUS, // caps awarded per rest
  encounterReduction: 0.3,             // 30 % fewer random encounters
  craftingBonus:      0.1,             // +10 % crafting success rate
};

// ------------------------------------------------------------
// Rate limiters
// ------------------------------------------------------------
const setCampLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { ok: false, error: "Too many camp requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

const restLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { ok: false, error: "Too many rest requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// Haversine distance helper (metres between two GPS coords)
// ------------------------------------------------------------
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ------------------------------------------------------------
// Input helpers
// ------------------------------------------------------------
function isValidLatLng(lat, lng) {
  return (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

// Strip angle brackets and trim to maxLen — removes individual < > characters
// so no tag structure can survive (regex-based tag stripping is bypassable).
function sanitizeName(raw, maxLen) {
  const stripped = String(raw == null ? "" : raw)
    .replace(/[<>]/g, "")
    .trim();
  return stripped.slice(0, maxLen) || "Wasteland Camp";
}

// ------------------------------------------------------------
// POST /api/camp/set
// Body: { lat: number, lng: number, name?: string }
// ------------------------------------------------------------
router.post("/set", authMiddleware, setCampLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { lat, lng, name } = req.body;

    // --- Validate lat/lng ---
    if (!isValidLatLng(lat, lng)) {
      return res.status(400).json({ ok: false, error: "Invalid or out-of-range coordinates" });
    }

    // --- Per-player cooldown (1 set per 5 minutes) ---
    const cooldownKey = key(`camp:cooldown:${wallet}`);
    const onCooldown = await redis.get(cooldownKey);
    if (onCooldown) {
      return res.status(429).json({
        ok: false,
        error: "Camp cooldown active – wait before moving your camp",
      });
    }

    // --- Build camp object ---
    const campName = sanitizeName(name, CAMP_NAME_MAX);
    const camp = {
      wallet,
      lat,
      lng,
      name: campName,
      createdAt: new Date().toISOString(),
      buffs: { ...CAMP_BUFFS },
    };

    // --- Persist camp (7-day TTL) ---
    const campKey = key(`camp:${wallet}`);
    await redis.set(campKey, JSON.stringify(camp), { EX: CAMP_TTL_SECONDS });

    // --- Set set-cooldown (5 minutes) ---
    await redis.set(cooldownKey, "1", { EX: CAMP_SET_COOLDOWN });

    console.log(`[api/camp] Camp set by ${wallet} at (${lat}, ${lng}) name="${campName}"`);
    return res.json({ ok: true, camp });
  } catch (err) {
    console.error("[api/camp] set error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to set camp" });
  }
});

// ------------------------------------------------------------
// POST /api/camp/rest
// Body: { lat: number, lng: number }
// ------------------------------------------------------------
router.post("/rest", authMiddleware, restLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { lat, lng } = req.body;

    // --- Validate lat/lng ---
    if (!isValidLatLng(lat, lng)) {
      return res.status(400).json({ ok: false, error: "Invalid or out-of-range coordinates" });
    }

    // --- Load camp ---
    const campKey = key(`camp:${wallet}`);
    const campRaw = await redis.get(campKey);
    if (!campRaw) {
      return res.status(404).json({ ok: false, error: "No active camp found" });
    }

    let camp;
    try {
      camp = JSON.parse(campRaw);
    } catch (_) {
      return res.status(500).json({ ok: false, error: "Camp data corrupted" });
    }

    // --- Distance check ---
    const distMeters = haversineMeters(lat, lng, camp.lat, camp.lng);
    if (distMeters > REST_RADIUS_METERS) {
      return res.status(400).json({
        ok: false,
        error: `Too far from camp (${Math.round(distMeters)}m – must be within ${REST_RADIUS_METERS}m)`,
      });
    }

    // --- Rest cooldown check ---
    const restCooldownKey = key(`camp:rest:${wallet}`);
    const restTs = await redis.get(restCooldownKey);
    if (restTs) {
      const nextRestAt = new Date(Number(restTs) + REST_COOLDOWN * 1000).toISOString();
      return res.status(409).json({
        ok: false,
        error: "Already rested recently",
        nextRestAt,
      });
    }

    // --- Award bonuses (client calls /api/xp and /api/caps separately) ---
    const now = Date.now();
    const nextRestAt = new Date(now + REST_COOLDOWN * 1000).toISOString();

    // Store cooldown – keyed on current timestamp so we can compute nextRestAt
    await redis.set(restCooldownKey, String(now), { EX: REST_COOLDOWN });

    console.log(`[api/camp] Rest bonus claimed by ${wallet} at (${lat}, ${lng})`);
    return res.json({
      ok: true,
      xpBonus:    REST_XP_BONUS,
      capsBonus:  REST_CAPS_BONUS,
      nextRestAt,
    });
  } catch (err) {
    console.error("[api/camp] rest error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to collect rest bonus" });
  }
});

// ------------------------------------------------------------
// GET /api/camp/:wallet  (public – no auth required)
// ------------------------------------------------------------
router.get("/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;

    // --- Validate wallet param ---
    if (
      typeof wallet !== "string" ||
      wallet.length === 0 ||
      wallet.length > WALLET_PARAM_MAX
    ) {
      return res.status(400).json({ ok: false, error: "Invalid wallet parameter" });
    }

    const campKey = key(`camp:${wallet}`);
    const campRaw = await redis.get(campKey);

    if (!campRaw) {
      return res.json({ ok: true, camp: null });
    }

    let camp;
    try {
      camp = JSON.parse(campRaw);
    } catch (_) {
      return res.json({ ok: true, camp: null });
    }

    return res.json({ ok: true, camp });
  } catch (err) {
    console.error("[api/camp] get error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to retrieve camp" });
  }
});

// ------------------------------------------------------------
// DELETE /api/camp/break
// ------------------------------------------------------------
router.delete("/break", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;

    const campKey = key(`camp:${wallet}`);
    await redis.del(campKey);

    console.log(`[api/camp] Camp broken down by ${wallet}`);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[api/camp] break error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to break camp" });
  }
});

module.exports = router;
