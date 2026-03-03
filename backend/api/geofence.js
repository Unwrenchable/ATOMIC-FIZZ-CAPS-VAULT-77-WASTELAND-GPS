// backend/api/geofence.js
// ------------------------------------------------------------
// Atomic Fizz Caps — Real-World Geo-fence Reward System
// Mounted at /api/geofence
//
// Players physically visit real-world Fallout-adjacent locations
// (nuclear museums, missile silos, Trinity Site, etc.) and receive
// unique, geo-locked collector items that cannot be obtained any
// other way. One claim per location per wallet, ever.
//
// Routes:
//   GET  /api/geofence/locations         — List all geo-fence sites (public)
//   POST /api/geofence/claim             — Claim reward for being at a location
//   GET  /api/geofence/collected/:wallet — Get a player's collected badges
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const { redis, key } = require("../lib/redis");

// ------------------------------------------------------------
// Load geo-fence location data
// ------------------------------------------------------------
let GEOFENCE_LOCATIONS = [];
try {
  const dataFile = path.join(__dirname, "..", "..", "public", "data", "geofence-locations.json");
  GEOFENCE_LOCATIONS = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  console.log(`[geofence] Loaded ${GEOFENCE_LOCATIONS.length} geo-fence locations`);
} catch (e) {
  console.error("[geofence] Failed to load geofence-locations.json:", e.message);
}

// Map for fast lookup by id
const LOCATIONS_BY_ID = Object.fromEntries(GEOFENCE_LOCATIONS.map(l => [l.id, l]));

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------
const CLAIM_COOLDOWN_SECONDS = 300; // 5-min anti-spam per wallet (distinct from per-location)
const WALLET_MAX_LEN = 128;

// ------------------------------------------------------------
// Rate limiter (HTTP-level, defense-in-depth alongside redis cooldown)
// ------------------------------------------------------------
const claimLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { ok: false, error: "Too many claim attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// Haversine distance in meters
// ------------------------------------------------------------
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ------------------------------------------------------------
// GET /api/geofence/locations
// Public — returns all sites with name, city, tier, radius,
// promptMessage, but NOT the exact coords (prevents spoofing).
// The client sends its own GPS position and we verify server-side.
// ------------------------------------------------------------
router.get("/locations", (req, res) => {
  const safe = GEOFENCE_LOCATIONS.map(({ id, name, city, tier, radiusMeters, falloutLore, promptMessage, rewardItem }) => ({
    id, name, city, tier, radiusMeters, falloutLore, promptMessage, rewardItem
  }));
  return res.json({ ok: true, locations: safe });
});

// ------------------------------------------------------------
// POST /api/geofence/claim
// Authenticated. Body: { locationId, lat, lng }
// Verifies player GPS is within radiusMeters of the site.
// Awards geo-locked collector item (stored in player profile).
// One claim per location per wallet — permanent.
// ------------------------------------------------------------
router.post("/claim", authMiddleware, claimLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { locationId, lat, lng } = req.body;

    // --- Input validation ---
    if (!locationId || typeof locationId !== "string" || locationId.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid locationId" });
    }
    if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ ok: false, error: "Invalid latitude" });
    }
    if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: "Invalid longitude" });
    }

    // --- Look up location ---
    const location = LOCATIONS_BY_ID[locationId];
    if (!location) {
      return res.status(404).json({ ok: false, error: "Unknown location" });
    }

    // --- Proximity check (server-side — client cannot fake this) ---
    const distanceM = haversineMeters(lat, lng, location.lat, location.lng);
    if (distanceM > location.radiusMeters) {
      return res.status(400).json({
        ok: false,
        error: "Not close enough to location",
        distanceMeters: Math.round(distanceM),
        requiredMeters: location.radiusMeters
      });
    }

    // --- Already claimed check (per-location, per-wallet, permanent) ---
    const claimedKey = key(`geofence:claimed:${wallet}:${locationId}`);
    const alreadyClaimed = await redis.get(claimedKey);
    if (alreadyClaimed) {
      const data = JSON.parse(alreadyClaimed);
      return res.status(409).json({
        ok: false,
        error: "Already claimed",
        claimedAt: data.claimedAt,
        item: location.rewardItem
      });
    }

    // --- Anti-spam cooldown (rate of NEW claims, not per-location) ---
    const cooldownKey = key(`geofence:cooldown:${wallet}`);
    const onCooldown = await redis.get(cooldownKey);
    if (onCooldown) {
      return res.status(429).json({ ok: false, error: "Please wait before claiming another location" });
    }

    // --- Load player profile ---
    const playerKey = key(`player:${wallet}`);
    const raw = await redis.hget(playerKey, "profile");
    if (!raw) {
      return res.status(404).json({ ok: false, error: "Player not found" });
    }
    const profile = JSON.parse(raw);

    // --- Award collector item + record badge (kept in sync) ---
    if (!Array.isArray(profile.inventory)) profile.inventory = [];
    if (!Array.isArray(profile.geofenceCollected)) profile.geofenceCollected = [];

    // Only push both if the item isn't already in inventory, ensuring inventory
    // and geofenceCollected stay consistent even if the profile was edited externally.
    const alreadyHasItem = profile.inventory.some(i => i.id === location.rewardItem);
    if (!alreadyHasItem) {
      profile.inventory.push({
        id: location.rewardItem,
        type: "collector",
        geoLocked: true,
        geoLocation: locationId,
        obtainedAt: Date.now(),
        obtainedAtLocation: location.name
      });

      // Track geofence badge collection (only when item is actually granted)
      profile.geofenceCollected.push({
        locationId,
        locationName: location.name,
        city: location.city,
        tier: location.tier,
        item: location.rewardItem,
        claimedAt: Date.now(),
        distanceMeters: Math.round(distanceM)
      });
    }

    // Award XP and caps to profile directly
    profile.xp = (profile.xp || 0) + (location.rewardXp || 0);
    profile.caps = (profile.caps || 0) + (location.rewardCaps || 0);

    // --- Save updated profile ---
    await redis.hset(playerKey, "profile", JSON.stringify(profile));

    // --- Mark as claimed (permanent, no EX — this is a one-time-ever award) ---
    await redis.set(claimedKey, JSON.stringify({ wallet, locationId, claimedAt: Date.now() }));

    // --- Set anti-spam cooldown ---
    await redis.set(cooldownKey, "1", { EX: CLAIM_COOLDOWN_SECONDS });

    console.log(`[geofence] ${wallet} claimed ${locationId} — ${location.name} (${Math.round(distanceM)}m away)`);

    return res.json({
      ok: true,
      location: {
        id: locationId,
        name: location.name,
        city: location.city,
        tier: location.tier
      },
      reward: {
        item: location.rewardItem,
        xp: location.rewardXp,
        caps: location.rewardCaps,
        message: location.rewardMessage
      }
    });
  } catch (err) {
    console.error("[geofence] claim error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// GET /api/geofence/collected/:wallet
// Public — returns a player's geo-fence collection for display.
// Does not expose any sensitive data.
// ------------------------------------------------------------
router.get("/collected/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    if (!wallet || typeof wallet !== "string" || wallet.length > WALLET_MAX_LEN) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    const playerKey = key(`player:${wallet}`);
    const raw = await redis.hget(playerKey, "profile");
    if (!raw) return res.json({ ok: true, collected: [] });

    const profile = JSON.parse(raw);
    return res.json({
      ok: true,
      collected: profile.geofenceCollected || [],
      total: GEOFENCE_LOCATIONS.length
    });
  } catch (err) {
    console.error("[geofence] collected error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
