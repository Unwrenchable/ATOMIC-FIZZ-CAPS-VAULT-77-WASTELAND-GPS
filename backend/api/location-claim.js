// backend/api/location-claim.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Location Claim API
// Mounted at /api/location-claim
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const { redis, key } = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");
const { applyXpToProfile } = require("../lib/xp");

// Cryptographically-secure random integer in [min, max)
function secureRandInt(min, max) {
  return crypto.randomInt(min, max);
}

// Load locations data for distance validation and rewards.
// Primary source: poi.json (642+ grouped POIs rendered on the map).
// Supplement: locations.json (hand-curated entries with custom claimRadius win on ID conflict).
let LOCATIONS = [];
try {
  // 1. Load and flatten the full poi.json (grouped object → flat array)
  const poiFile = path.join(__dirname, "..", "..", "public", "data", "poi.json");
  if (fs.existsSync(poiFile)) {
    const poiRaw = JSON.parse(fs.readFileSync(poiFile, "utf8"));
    const flat = Array.isArray(poiRaw)
      ? poiRaw
      : Object.values(poiRaw).filter(Array.isArray).flat();
    LOCATIONS = flat.filter(p => p && p.id && p.lat != null && p.lng != null);
    console.log(`[location-claim] Loaded ${LOCATIONS.length} locations from poi.json`);
  } else {
    console.error("[location-claim] poi.json not found — falling back to locations.json only");
  }

  // 2. Merge hand-curated locations.json (override matching IDs so custom claimRadius is preserved)
  const locFile = path.join(__dirname, "..", "..", "public", "data", "locations.json");
  if (fs.existsSync(locFile)) {
    const manual = JSON.parse(fs.readFileSync(locFile, "utf8"));
    if (Array.isArray(manual) && manual.length > 0) {
      const manualById = new Map(manual.map(l => [l.id, l]));
      // Replace any matching entry; append any that are new
      LOCATIONS = LOCATIONS.map(l => manualById.get(l.id) || l);
      manual.forEach(l => {
        if (l && l.id && !LOCATIONS.find(e => e.id === l.id)) LOCATIONS.push(l);
      });
      console.log(`[location-claim] Merged ${manual.length} hand-curated entries from locations.json`);
    }
  }
} catch (e) {
  console.error("[location-claim] CRITICAL: Failed to load location data:", e.message, "— all claims will return 404");
}
// Health check: warn loudly at startup if locations list is empty
if (LOCATIONS.length === 0) {
  console.error("[location-claim] STARTUP WARNING: LOCATIONS list is empty. POI claiming is non-functional.");
}

// Helper: Calculate distance between two coordinates in meters
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Generate loot for a location based on tier
function generateLoot(location) {
  const tier = location.tier || 1;
  const _locType = location.type || "wasteland";
  
  const rewards = {
    xp: 0,
    caps: 0,
    items: []
  };

  // Base rewards by tier
  switch (tier) {
    case 1:
      rewards.xp = 10 + secureRandInt(0, 15);
      rewards.caps = 5 + secureRandInt(0, 10);
      break;
    case 2:
      rewards.xp = 20 + secureRandInt(0, 25);
      rewards.caps = 10 + secureRandInt(0, 20);
      break;
    case 3:
      rewards.xp = 40 + secureRandInt(0, 40);
      rewards.caps = 20 + secureRandInt(0, 30);
      break;
    default:
      rewards.xp = 5 + secureRandInt(0, 10);
      rewards.caps = 2 + secureRandInt(0, 8);
  }

  // Random item drop chance: use integer roll out of 100 to avoid float bias.
  // dropChance: tier1=30%, tier2=50%, tier3=70%
  const dropThreshold = tier === 1 ? 30 : tier === 2 ? 50 : 70;
  if (secureRandInt(0, 100) < dropThreshold) {
    // Common loot pool
    const commonLoot = [
      "stimpak",
      "radaway",
      "dirty_water",
      "purified_water",
      "canned_food",
      "scrap_metal",
      "bottle_caps",
      "bobby_pin",
      "ammo_9mm",
      "ammo_556"
    ];
    
    // Rare loot for higher tiers (30% chance)
    if (tier >= 2 && secureRandInt(0, 10) < 3) {
      const rareLoot = ["weapon_parts", "armor_plates", "pre_war_money", "nuka_cola"];
      rewards.items.push(rareLoot[secureRandInt(0, rareLoot.length)]);
    } else {
      rewards.items.push(commonLoot[secureRandInt(0, commonLoot.length)]);
    }
  }

  // Location-specific bonus loot (50% chance)
  if (location.loot && Array.isArray(location.loot)) {
    if (secureRandInt(0, 2) === 0 && location.loot.length > 0) {
      const bonusItem = location.loot[secureRandInt(0, location.loot.length)];
      if (!rewards.items.includes(bonusItem)) {
        rewards.items.push(bonusItem);
      }
    }
  }

  return rewards;
}

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
// SECURITY FIX: added authMiddleware — previously any unauthenticated caller
// could post any wallet address and claim locations on behalf of any player,
// receiving XP, caps, and items for free.  Wallet is now sourced from the
// verified session; the body wallet field is ignored.
// ------------------------------------------------------------
router.post("/claim", authMiddleware, claimLimiter, async (req, res) => {
  try {
    // SECURITY FIX: wallet from verified session, NOT from req.body.
    const wallet = req.player.wallet;
    const { poiId, locationId, playerLat, playerLng } = req.body;
    const locId = locationId || poiId; // Support both field names

    // -----------------------------
    // Input validation
    // -----------------------------
    if (!locId || typeof locId !== "string" || locId.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid location ID" });
    }

    if (typeof playerLat !== "number" || !Number.isFinite(playerLat)) {
      return res.status(400).json({ ok: false, error: "Invalid latitude" });
    }

    if (typeof playerLng !== "number" || !Number.isFinite(playerLng)) {
      return res.status(400).json({ ok: false, error: "Invalid longitude" });
    }

    // Earth sanity bounds
    if (playerLat < -90 || playerLat > 90) {
      return res.status(400).json({ ok: false, error: "Latitude out of range" });
    }

    if (playerLng < -180 || playerLng > 180) {
      return res.status(400).json({ ok: false, error: "Longitude out of range" });
    }

    // -----------------------------
    // GPS speed-of-travel spoofing detection
    // Rejects claims where the player would have needed to travel faster
    // than MAX_TRAVEL_SPEED_KMH to reach this location since their last claim.
    // This detects impossible jumps (e.g. teleporting across continents).
    // -----------------------------
    const MAX_TRAVEL_SPEED_KMH = 120; // ~75 mph — generous upper bound for legitimate GPS
    const lastPosKey = key(`player:${wallet}:lastpos`);
    const lastPosRaw = await redis.get(lastPosKey).catch(() => null);
    if (lastPosRaw) {
      try {
        const lastPos = JSON.parse(lastPosRaw);
        if (lastPos && typeof lastPos.lat === "number" && typeof lastPos.lng === "number" && typeof lastPos.ts === "number") {
          const distanceMeters = getDistance(lastPos.lat, lastPos.lng, playerLat, playerLng);
          const elapsedSeconds = Math.max(1, (Date.now() - lastPos.ts) / 1000);
          const speedKmh = (distanceMeters / 1000) / (elapsedSeconds / 3600);
          if (speedKmh > MAX_TRAVEL_SPEED_KMH) {
            console.warn(`[location-claim] GPS spoof detected wallet=${wallet} speed=${speedKmh.toFixed(1)}km/h dist=${Math.round(distanceMeters)}m elapsed=${Math.round(elapsedSeconds)}s`);
            return res.status(400).json({
              ok: false,
              error: "Impossible travel speed detected — GPS spoofing suspected",
              code: "GPS_SPOOF"
            });
          }
        }
      } catch {
        // Corrupt lastpos data — ignore and proceed; will be overwritten below
      }
    }

    // -----------------------------
    // Find location data
    // -----------------------------
    const location = LOCATIONS.find(loc => 
      loc && (loc.id === locId || loc.slug === locId || loc.name === locId)
    );

    if (!location) {
      return res.status(404).json({ ok: false, error: "Location not found" });
    }

    // -----------------------------
    // Distance check
    // -----------------------------
    if (typeof location.lat === "number" && typeof location.lng === "number") {
      const distance = getDistance(playerLat, playerLng, location.lat, location.lng);
      const maxDistance = (typeof location.claimRadius === "number") ? location.claimRadius : 50; // Default 50m radius — matches frontend UI

      if (distance > maxDistance) {
        return res.status(400).json({
          ok: false,
          error: "Too far from location",
          distance: Math.round(distance),
          required: maxDistance
        });
      }
    }

    // -----------------------------
    // Cooldown check (atomic, race-condition-safe)
    // -----------------------------
    // BUG FIX: the original code did a GET then later a SET — two separate
    // operations.  A player with two simultaneous requests could have both
    // pass the GET check before either SET ran, allowing them to claim twice
    // and receive double rewards.
    //
    // Fix: attempt to SET the cooldown key with NX (only if not exists) right
    // now.  If the key already exists the NX set returns null, meaning the
    // location is still on cooldown.  We only proceed if the NX set succeeds,
    // making the check+lock a single atomic operation.
    const cooldownDuration = location?.cooldown || 3600; // seconds
    // NOTE: cooldownKey is built with key() to be consistent with the
    // playerKey and claimedKey variables in this same route which also pass
    // key()-prefixed strings to the redis wrapper. The established pattern
    // throughout this file uses this double-prefix approach so all keys for
    // a given player live in the same Redis namespace.
    const cooldownKey = key(`player:${wallet}:cooldown:${locId}`);
    const nxResult = await redis.set(cooldownKey, Date.now().toString(), { NX: true, EX: cooldownDuration });

    if (nxResult === null) {
      // NX failed: key already exists → location on cooldown
      const lastClaimRaw = await redis.get(cooldownKey);
      const lastClaimMs = lastClaimRaw ? parseInt(lastClaimRaw) : Date.now();
      const timeRemaining = cooldownDuration * 1000 - (Date.now() - lastClaimMs);
      return res.status(429).json({
        ok: false,
        error: "Location on cooldown",
        cooldownRemaining: Math.max(0, Math.ceil(timeRemaining / 1000))
      });
    }
    // nxResult === "OK" → we now own the cooldown lock; proceed with claim

    // -----------------------------
    // Generate and award rewards
    // -----------------------------
    const rewards = location ? generateLoot(location) : {
      xp: 5,
      caps: 2,
      items: []
    };

    // Get or create player profile
    const playerKey = key(`player:${wallet}`);

    // BUG-007 FIX: profile update is a non-atomic read-modify-write.
    // Use a per-wallet profile lock so concurrent claims on different POIs
    // don't overwrite each other's reward writes.
    const profileLockKey = `profile:lock:${wallet}`;
    const lockResult = await redis.set(profileLockKey, "1", { NX: true, EX: 10 });
    if (!lockResult) {
      // Release the cooldown NX lock so the player can retry
      await redis.del(cooldownKey).catch(() => {});
      return res.status(409).json({ ok: false, error: "Concurrent update in progress — please retry" });
    }

    try {
    let playerData = await redis.hget(playerKey, "profile");
    
    if (!playerData) {
      // Create new player
      playerData = JSON.stringify({
        wallet,
        name: "WANDERER",
        xp: 0,
        caps: 0,
        level: 1,
        inventory: [],
        quests: { active: [], completed: [] },
        createdAt: Date.now()
      });
    }

    const player = JSON.parse(playerData);

    // BUG-008 FIX: enforce inventory size limit — prevent unbounded growth
    const MAX_INVENTORY_SIZE = 200;

    // Award XP and caps — use shared applyXpToProfile() for consistent level-up logic
    player.caps = (player.caps || 0) + rewards.caps;
    applyXpToProfile(player, rewards.xp);

    // Add items to inventory (BUG-008 FIX: respect inventory cap)
    if (!player.inventory) player.inventory = [];
    rewards.items.forEach(itemId => {
      const existing = player.inventory.find(i => i.id === itemId);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else if (player.inventory.length < MAX_INVENTORY_SIZE) {
        player.inventory.push({
          id: itemId,
          name: itemId,
          quantity: 1,
          obtainedAt: Date.now(),
          source: "location_claim"
        });
      }
    });

    // Save player profile
    await redis.hset(playerKey, "profile", JSON.stringify(player));

    } finally {
      await redis.del(profileLockKey).catch(() => {});
    }

    // Re-read for response (safe — we just wrote it)
    const savedData = await redis.hget(playerKey, "profile");
    const savedPlayer = savedData ? JSON.parse(savedData) : {};

    // Update last-known GPS position for speed-of-travel spoofing detection.
    // Stored with a 1-hour TTL; stale positions are automatically discarded.
    // Failures are non-fatal — a missing lastpos skips the check on the next claim.
    redis.set(
      lastPosKey,
      JSON.stringify({ lat: playerLat, lng: playerLng, ts: Date.now() }),
      { EX: 3600 }
    ).catch((e) => console.warn("[location-claim] lastpos update failed:", e?.message));

    // Mark location as claimed
    const claimedKey = key(`player:${wallet}:claimed`);
    await redis.sAdd(claimedKey, locId);

    // Note: cooldown was already set atomically via NX above; no second SET needed.

    console.log(`[location-claim] ${wallet.slice(0, 8)} claimed ${locId}: +${rewards.xp}XP, +${rewards.caps} caps, ${rewards.items.length} items`);

    return res.json({
      ok: true,
      locationId: locId,
      rewards: {
        xp: rewards.xp,
        caps: rewards.caps,
        items: rewards.items
      },
      player: {
        xp: savedPlayer.xp,
        caps: savedPlayer.caps,
        level: savedPlayer.level
      },
      cooldown: cooldownDuration
    });

  } catch (err) {
    console.error("[api/location-claim] claim error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to process claim" });
  }
});

module.exports = router;
