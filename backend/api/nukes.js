// backend/api/nukes.js
// ------------------------------------------------------------
// Atomic Fizz Caps — Nuke Silo & Keycard System API
// Mounted at /api/nukes
//
// Players collect nuclear keycards and launch code fragments.
// With 3 keycards + a complete 8-char code + proximity to a
// silo, they can launch a tactical nuke at any GPS zone.
// Nuke zones persist for 3 hours with unique loot and bosses.
//
// Routes:
//   GET  /api/nukes/zones              — Active nuke zones (public)
//   GET  /api/nukes/zone-catalog       — Full zone definitions (public)
//   GET  /api/nukes/my-keycards        — Player's keycard + code fragment inventory
//   POST /api/nukes/claim-fragment     — Claim a code fragment from a location
//   POST /api/nukes/launch             — Launch a nuke (validate keycards + code + proximity)
//   GET  /api/nukes/launch-code-status — Current week's fragment discovery status (public)
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const { redis, key } = require("../lib/redis");

// ------------------------------------------------------------
// Load nuke zone definitions
// ------------------------------------------------------------
let NUKE_DATA = { silos: [], nuke_zones: [], keycards: [] };
try {
  const dataFile = path.join(__dirname, "..", "..", "public", "data", "nuke-zones.json");
  NUKE_DATA = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  console.log(`[nukes] Loaded ${NUKE_DATA.silos.length} silos, ${NUKE_DATA.nuke_zones.length} zones`);
} catch (e) {
  console.error("[nukes] Failed to load nuke-zones.json:", e.message);
}

const SILOS_BY_ID = Object.fromEntries(NUKE_DATA.silos.map(s => [s.id, s]));
const ZONES_BY_ID = Object.fromEntries(NUKE_DATA.nuke_zones.map(z => [z.id, z]));

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------
const ZONE_DURATION_MS     = (NUKE_DATA.nuke_zone_duration_hours || 3) * 3600 * 1000;
const KEYCARDS_REQUIRED    = NUKE_DATA.keycard_cost_per_launch || 3;
const LAUNCH_CODE_LENGTH   = 8;
const SILO_LAUNCH_RADIUS_M = 200; // must be within 200m of silo to launch
const _WALLET_MAX           = 128;

// ------------------------------------------------------------
// Rate limiters
// ------------------------------------------------------------
const launchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 2,
  message: { ok: false, error: "Too many launch attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

const fragmentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { ok: false, error: "Too many fragment claims" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// Weekly launch code generation (deterministic from week number)
// Code is server-generated; fragments are distributed by zone
// ------------------------------------------------------------
function getCurrentWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now - start) / (7 * 24 * 3600 * 1000));
}

function getWeeklyLaunchCode() {
  const week = getCurrentWeekNumber();
  // Deterministic from week + secret (HMAC). Server only ever exposes fragments.
  const secret = process.env.NUKE_CODE_SECRET || "vault77-nuke-secret-default";
  return crypto.createHmac("sha256", secret)
    .update(`launch-code-week-${week}`)
    .digest("hex")
    .slice(0, LAUNCH_CODE_LENGTH)
    .toUpperCase();
}

// Returns the 4 fragment zones for the current week (rotation based on week)
function getFragmentZoneIds() {
  const zones = NUKE_DATA.nuke_zones.filter(z => z.targetable).map(z => z.id);
  if (zones.length < 4) return zones;
  const week = getCurrentWeekNumber();
  // Rotate starting index by week
  const start = week % zones.length;
  const result = [];
  for (let i = 0; i < 4; i++) result.push(zones[(start + i) % zones.length]);
  return result;
}

// ------------------------------------------------------------
// Haversine distance in meters
// ------------------------------------------------------------
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ------------------------------------------------------------
// GET /api/nukes/zones
// Public — returns all CURRENTLY ACTIVE nuke zones with time remaining
// ------------------------------------------------------------
router.get("/zones", async (req, res) => {
  try {
    const activeZonesKey = key("nukes:active_zones");
    const raw = await redis.get(activeZonesKey);
    const activeZones = raw ? JSON.parse(raw) : {};

    const now = Date.now();
    const result = [];
    for (const [zoneId, data] of Object.entries(activeZones)) {
      if (data.expiresAt > now) {
        const def = ZONES_BY_ID[zoneId];
        result.push({
          id: zoneId,
          name: def?.name || zoneId,
          center_lat: def?.center_lat,
          center_lng: def?.center_lng,
          radius_km: def?.radius_km,
          launchedBy: data.launchedBy,
          launchedAt: data.launchedAt,
          expiresAt: data.expiresAt,
          minutesRemaining: Math.max(0, Math.floor((data.expiresAt - now) / 60000)),
          active_effects: def?.active_effects,
          unique_loot: def?.unique_loot
        });
      }
    }

    return res.json({ ok: true, activeZones: result, total: result.length });
  } catch (err) {
    console.error("[nukes] zones error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// GET /api/nukes/zone-catalog
// Public — returns full zone definitions (for map display, not active status)
// ------------------------------------------------------------
router.get("/zone-catalog", (req, res) => {
  const safe = NUKE_DATA.nuke_zones.map(z => ({
    id: z.id, name: z.name, targetable: z.targetable,
    center_lat: z.center_lat, center_lng: z.center_lng,
    radius_km: z.radius_km, description: z.description,
    active_effects: z.active_effects, unique_loot: z.unique_loot,
    mutated_crafting_materials: z.mutated_crafting_materials
  }));
  return res.json({ ok: true, zones: safe, silos: NUKE_DATA.silos.map(s => ({ id: s.id, name: s.name, codename: s.codename, description: s.description, faction_claim: s.faction_claim })) });
});

// ------------------------------------------------------------
// GET /api/nukes/my-keycards
// Authenticated — returns player's keycards and code fragments
// ------------------------------------------------------------
router.get("/my-keycards", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const playerKey = key(`player:${wallet}`);
    const raw = await redis.hget(playerKey, "profile");
    if (!raw) return res.status(404).json({ ok: false, error: "Player not found" });
    const profile = JSON.parse(raw);
    const inv = profile.inventory || [];

    const keycards = inv.filter(i => i.type === "keycard");
    const fragments = inv.filter(i => i.id === "launch_code_fragment");

    // Check if player has a complete code
    const fullCode = fragments.length >= 4
      ? fragments.slice(0, 4).map(f => f.fragment_chars || "??").join("")
      : null;
    const currentCode = getWeeklyLaunchCode();
    const codeValid = fullCode && fullCode.toUpperCase() === currentCode;

    return res.json({
      ok: true,
      keycards,
      keycardsCount: keycards.length,
      fragments,
      fragmentsCount: fragments.length,
      canLaunch: keycards.length >= KEYCARDS_REQUIRED && codeValid,
      codeValid,
      keycardsRequired: KEYCARDS_REQUIRED
    });
  } catch (err) {
    console.error("[nukes] my-keycards error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// POST /api/nukes/claim-fragment
// Authenticated. Body: { zoneId, lat, lng }
// Player must be physically in the zone. Awards one code fragment.
// ------------------------------------------------------------
router.post("/claim-fragment", authMiddleware, fragmentLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { zoneId, lat, lng } = req.body;

    if (!zoneId || typeof zoneId !== "string" || zoneId.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid zoneId" });
    }
    if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
        typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, error: "Invalid coordinates" });
    }

    const zone = ZONES_BY_ID[zoneId];
    if (!zone) return res.status(404).json({ ok: false, error: "Unknown zone" });

    // Check proximity (player must be within zone radius)
    const distM = haversineMeters(lat, lng, zone.center_lat, zone.center_lng);
    const radiusM = (zone.radius_km || 1) * 1000;
    if (distM > radiusM) {
      return res.status(400).json({
        ok: false,
        error: "Not inside zone",
        distanceMeters: Math.round(distM),
        radiusMeters: Math.round(radiusM)
      });
    }

    // Check if this zone has a fragment this week
    const fragmentZones = getFragmentZoneIds();
    const fragmentIdx = fragmentZones.indexOf(zoneId);
    if (fragmentIdx === -1) {
      return res.status(400).json({ ok: false, error: "No code fragment in this zone this week" });
    }

    // One fragment per zone per wallet per week
    const week = getCurrentWeekNumber();
    const claimedKey = key(`nukes:fragment_claimed:${wallet}:${zoneId}:week${week}`);
    const alreadyClaimed = await redis.get(claimedKey);
    if (alreadyClaimed) {
      return res.status(409).json({ ok: false, error: "Fragment already collected from this zone this week" });
    }

    // Get the fragment chars for this zone position
    const fullCode = getWeeklyLaunchCode();
    const fragmentChars = fullCode.slice(fragmentIdx * 2, (fragmentIdx + 1) * 2);

    // Add fragment to inventory
    const playerKey = key(`player:${wallet}`);
    const rawProfile = await redis.hget(playerKey, "profile");
    if (!rawProfile) return res.status(404).json({ ok: false, error: "Player not found" });
    const profile = JSON.parse(rawProfile);

    if (!Array.isArray(profile.inventory)) profile.inventory = [];
    profile.inventory.push({
      id: "launch_code_fragment",
      type: "questItem",
      fragment_chars: fragmentChars,
      fragment_position: fragmentIdx + 1,
      zone: zoneId,
      week: week,
      obtainedAt: Date.now()
    });

    await redis.hset(playerKey, "profile", JSON.stringify(profile));

    // Mark as claimed (expires at end of week: 7 days)
    await redis.set(claimedKey, "1", { EX: 7 * 24 * 3600 });

    const fragmentsInInventory = profile.inventory.filter(i => i.id === "launch_code_fragment");

    return res.json({
      ok: true,
      fragment: { chars: fragmentChars, position: fragmentIdx + 1, total: 4 },
      fragmentsCollected: fragmentsInInventory.length,
      message: `Fragment ${fragmentIdx + 1}/4 recovered: "${fragmentChars}". Collect all 4 to assemble the launch code.`
    });
  } catch (err) {
    console.error("[nukes] claim-fragment error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// POST /api/nukes/launch
// Authenticated. Body: { siloId, targetZoneId, launchCode, lat, lng }
// Full launch sequence validation. Consumes 3 keycards + complete code.
// ------------------------------------------------------------
router.post("/launch", authMiddleware, launchLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { siloId, targetZoneId, launchCode, lat, lng } = req.body;

    // --- Input validation ---
    if (!siloId || typeof siloId !== "string" || siloId.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid siloId" });
    }
    if (!targetZoneId || typeof targetZoneId !== "string" || targetZoneId.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid targetZoneId" });
    }
    if (!launchCode || typeof launchCode !== "string") {
      return res.status(400).json({ ok: false, error: "Missing launch code" });
    }
    if (typeof lat !== "number" || !Number.isFinite(lat) ||
        typeof lng !== "number" || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, error: "Invalid coordinates" });
    }

    const silo = SILOS_BY_ID[siloId];
    if (!silo) return res.status(404).json({ ok: false, error: "Unknown silo" });

    const targetZone = ZONES_BY_ID[targetZoneId];
    if (!targetZone || !targetZone.targetable) {
      return res.status(400).json({ ok: false, error: "Zone cannot be targeted" });
    }

    // --- Silo proximity check ---
    const siloDistM = haversineMeters(lat, lng, silo.lat, silo.lng);
    if (siloDistM > SILO_LAUNCH_RADIUS_M) {
      return res.status(400).json({
        ok: false,
        error: `Must be within ${SILO_LAUNCH_RADIUS_M}m of silo to launch`,
        distanceMeters: Math.round(siloDistM)
      });
    }

    // --- Launch code validation (timing-safe compare) ---
    const correctCode = getWeeklyLaunchCode();
    const submittedCode = launchCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    let codeValid = false;
    if (submittedCode.length === LAUNCH_CODE_LENGTH && correctCode.length === LAUNCH_CODE_LENGTH) {
      codeValid = crypto.timingSafeEqual(
        Buffer.from(submittedCode, "utf8"),
        Buffer.from(correctCode, "utf8")
      );
    }
    if (!codeValid) {
      return res.status(400).json({ ok: false, error: "Invalid launch code" });
    }

    // --- Keycard check ---
    const playerKey = key(`player:${wallet}`);
    const rawProfile = await redis.hget(playerKey, "profile");
    if (!rawProfile) return res.status(404).json({ ok: false, error: "Player not found" });
    const profile = JSON.parse(rawProfile);

    if (!Array.isArray(profile.inventory)) profile.inventory = [];
    const keycards = profile.inventory.filter(i => i.type === "keycard");
    if (keycards.length < KEYCARDS_REQUIRED) {
      return res.status(400).json({
        ok: false,
        error: `Insufficient keycards. Have: ${keycards.length}, need: ${KEYCARDS_REQUIRED}`
      });
    }

    // --- Consume 3 keycards and all code fragments ---
    let keycardsConsumed = 0;
    profile.inventory = profile.inventory.filter(i => {
      if (i.type === "keycard" && keycardsConsumed < KEYCARDS_REQUIRED) {
        keycardsConsumed++;
        return false; // remove from inventory
      }
      if (i.id === "launch_code_fragment") return false; // consume fragments
      return true;
    });

    await redis.hset(playerKey, "profile", JSON.stringify(profile));

    // --- Activate nuke zone ---
    const activeZonesKey = key("nukes:active_zones");
    const rawActive = await redis.get(activeZonesKey);
    const activeZones = rawActive ? JSON.parse(rawActive) : {};

    const now = Date.now();
    activeZones[targetZoneId] = {
      launchedBy: wallet,
      launchedAt: now,
      expiresAt: now + ZONE_DURATION_MS,
      siloId
    };

    // Store active zones with TTL slightly longer than zone duration
    await redis.set(activeZonesKey, JSON.stringify(activeZones), { EX: Math.ceil(ZONE_DURATION_MS / 1000) + 300 });

    console.log(`[nukes] LAUNCH: ${wallet} → ${targetZoneId} via ${siloId}`);

    return res.json({
      ok: true,
      launched: true,
      targetZone: { id: targetZoneId, name: targetZone.name },
      silo: { id: siloId, name: silo.name },
      expiresAt: now + ZONE_DURATION_MS,
      durationHours: NUKE_DATA.nuke_zone_duration_hours,
      message: `LAUNCH CONFIRMED. ${targetZone.name} is now a nuclear zone. Duration: ${NUKE_DATA.nuke_zone_duration_hours} hours. Unique loot and bosses are now accessible. Rads rising.`
    });
  } catch (err) {
    console.error("[nukes] launch error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// GET /api/nukes/launch-code-status
// Public — returns which fragment zones are active this week
// (not the code itself — just which zones have fragments)
// ------------------------------------------------------------
router.get("/launch-code-status", (req, res) => {
  const fragmentZones = getFragmentZoneIds();
  const week = getCurrentWeekNumber();
  return res.json({
    ok: true,
    week,
    fragmentZones: fragmentZones.map((zoneId, i) => ({
      position: i + 1,
      zoneId,
      zoneName: ZONES_BY_ID[zoneId]?.name || zoneId
    })),
    totalFragments: 4,
    codeLength: LAUNCH_CODE_LENGTH,
    note: "Collect one fragment from each zone this week to assemble the complete launch code."
  });
});

module.exports = router;
