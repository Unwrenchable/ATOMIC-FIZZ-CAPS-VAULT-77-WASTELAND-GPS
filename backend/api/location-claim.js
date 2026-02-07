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

const { redis, key } = require("../lib/redis");

// Load locations data for distance validation and rewards
let LOCATIONS = [];
try {
  const locFile = path.join(__dirname, "..", "..", "public", "data", "locations.json");
  if (fs.existsSync(locFile)) {
    LOCATIONS = JSON.parse(fs.readFileSync(locFile, "utf8"));
    console.log(`[location-claim] Loaded ${LOCATIONS.length} locations`);
  }
} catch (e) {
  console.warn("[location-claim] Failed to load locations.json:", e.message);
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
  const locType = location.type || "wasteland";
  
  const rewards = {
    xp: 0,
    caps: 0,
    items: []
  };

  // Base rewards by tier
  switch (tier) {
    case 1:
      rewards.xp = 10 + Math.floor(Math.random() * 15);
      rewards.caps = 5 + Math.floor(Math.random() * 10);
      break;
    case 2:
      rewards.xp = 20 + Math.floor(Math.random() * 25);
      rewards.caps = 10 + Math.floor(Math.random() * 20);
      break;
    case 3:
      rewards.xp = 40 + Math.floor(Math.random() * 40);
      rewards.caps = 20 + Math.floor(Math.random() * 30);
      break;
    default:
      rewards.xp = 5 + Math.floor(Math.random() * 10);
      rewards.caps = 2 + Math.floor(Math.random() * 8);
  }

  // Random item drop chance (30% for tier 1, 50% for tier 2, 70% for tier 3)
  const dropChance = tier === 1 ? 0.3 : tier === 2 ? 0.5 : 0.7;
  if (Math.random() < dropChance) {
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
    
    // Rare loot for higher tiers
    if (tier >= 2 && Math.random() < 0.3) {
      const rareLoot = ["weapon_parts", "armor_plates", "pre_war_money", "nuka_cola"];
      rewards.items.push(rareLoot[Math.floor(Math.random() * rareLoot.length)]);
    } else {
      rewards.items.push(commonLoot[Math.floor(Math.random() * commonLoot.length)]);
    }
  }

  // Location-specific bonus loot
  if (location.loot && Array.isArray(location.loot)) {
    // 50% chance to get location-specific loot
    if (Math.random() < 0.5 && location.loot.length > 0) {
      const bonusItem = location.loot[Math.floor(Math.random() * location.loot.length)];
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
// ------------------------------------------------------------
router.post("/claim", claimLimiter, async (req, res) => {
  try {
    const { wallet, poiId, locationId, playerLat, playerLng } = req.body;
    const locId = locationId || poiId; // Support both field names

    // -----------------------------
    // Input validation
    // -----------------------------
    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

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
    // Find location data
    // -----------------------------
    const location = LOCATIONS.find(loc => 
      loc && (loc.id === locId || loc.slug === locId || loc.name === locId)
    );

    if (!location) {
      console.warn(`[location-claim] Location not found: ${locId}`);
      // Still allow claim but with minimal rewards
    }

    // -----------------------------
    // Distance check
    // -----------------------------
    if (location && typeof location.lat === "number" && typeof location.lng === "number") {
      const distance = getDistance(playerLat, playerLng, location.lat, location.lng);
      const maxDistance = location.claimRadius || 100; // Default 100m radius

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
    // Cooldown check
    // -----------------------------
    const cooldownKey = key(`player:${wallet}:cooldown:${locId}`);
    const lastClaim = await redis.get(cooldownKey);
    
    if (lastClaim) {
      const cooldownTime = location?.cooldown || 3600; // Default 1 hour cooldown
      const timeSince = Date.now() - parseInt(lastClaim);
      const timeRemaining = cooldownTime * 1000 - timeSince;
      
      if (timeRemaining > 0) {
        return res.status(429).json({
          ok: false,
          error: "Location on cooldown",
          cooldownRemaining: Math.ceil(timeRemaining / 1000)
        });
      }
    }

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

    // Award XP and caps
    player.xp = (player.xp || 0) + rewards.xp;
    player.caps = (player.caps || 0) + rewards.caps;

    // Check for level up
    const xpPerLevel = 100;
    while (player.xp >= player.level * xpPerLevel) {
      player.xp -= player.level * xpPerLevel;
      player.level += 1;
    }

    // Add items to inventory
    if (!player.inventory) player.inventory = [];
    rewards.items.forEach(itemId => {
      const existing = player.inventory.find(i => i.id === itemId);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
      } else {
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

    // Mark location as claimed
    const claimedKey = key(`player:${wallet}:claimed`);
    await redis.sAdd(claimedKey, locId);

    // Set cooldown
    const cooldownDuration = location?.cooldown || 3600;
    await redis.set(cooldownKey, Date.now().toString(), { EX: cooldownDuration });

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
        xp: player.xp,
        caps: player.caps,
        level: player.level
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
