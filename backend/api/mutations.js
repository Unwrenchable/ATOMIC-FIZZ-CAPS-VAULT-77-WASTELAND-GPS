// backend/api/mutations.js
// ------------------------------------------------------------
// Atomic Fizz Caps — Mutation System API
// Mounted at /api/mutations
//
// Mutations are permanent stat changes from radiation or serum
// injection. Each has a benefit AND a drawback. Max 5 active.
// Serums apply a specific mutation. High radiation exposure
// applies a random one. Suppressant removes one at random.
//
// Routes:
//   GET    /api/mutations/all           — Full mutation catalogue (public)
//   GET    /api/mutations/mine          — Player's active mutations
//   POST   /api/mutations/apply-serum   — Apply serum (uses item from inventory)
//   POST   /api/mutations/rad-check     — Called on rad update; may trigger random mutation
//   POST   /api/mutations/suppress      — Remove one mutation (uses Suppressant serum)
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
// Load mutation definitions
// ------------------------------------------------------------
let MUTATIONS_DATA = { mutations: [], serums: [], radiation_exposure_rules: {} };
try {
  const dataFile = path.join(__dirname, "..", "..", "public", "data", "mutations.json");
  MUTATIONS_DATA = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  console.log(`[mutations] Loaded ${MUTATIONS_DATA.mutations.length} mutations, ${MUTATIONS_DATA.serums.length} serums`);
} catch (e) {
  console.error("[mutations] Failed to load mutations.json:", e.message);
}

const MUTATIONS_BY_ID = Object.fromEntries(MUTATIONS_DATA.mutations.map(m => [m.id, m]));
const SERUMS_BY_ID    = Object.fromEntries(MUTATIONS_DATA.serums.map(s => [s.id, s]));

const MAX_MUTATIONS   = 5;
const RAD_THRESHOLD   = MUTATIONS_DATA.radiation_exposure_rules.threshold_for_random_mutation || 300;
const BASE_RAD_CHANCE = MUTATIONS_DATA.radiation_exposure_rules.mutation_chance_at_threshold || 0.15;

// ------------------------------------------------------------
// Rate limiters
// ------------------------------------------------------------
const serumLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5,
  message: { ok: false, error: "Too many serum requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

const radCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { ok: false, error: "Too many rad checks" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// Cryptographically-secure random integer
// ------------------------------------------------------------
function secureRandInt(min, max) {
  return crypto.randomInt(min, max);
}
function secureRandFloat() {
  return crypto.randomBytes(4).readUInt32BE(0) / 0x100000000;
}

// ------------------------------------------------------------
// GET /api/mutations/all
// Public — returns full mutation catalogue and serum list
// ------------------------------------------------------------
router.get("/all", (req, res) => {
  return res.json({
    ok: true,
    mutations: MUTATIONS_DATA.mutations,
    serums: MUTATIONS_DATA.serums,
    rules: MUTATIONS_DATA.radiation_exposure_rules
  });
});

// ------------------------------------------------------------
// GET /api/mutations/mine
// Authenticated — returns player's active mutations
// ------------------------------------------------------------
router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const mutKey = key(`mutations:active:${wallet}`);
    const raw = await redis.get(mutKey);
    const active = raw ? JSON.parse(raw) : [];
    // Enrich with full definition for client
    const enriched = active.map(id => MUTATIONS_BY_ID[id]).filter(Boolean);
    return res.json({ ok: true, mutations: enriched, count: enriched.length, max: MAX_MUTATIONS });
  } catch (err) {
    console.error("[mutations] mine error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// POST /api/mutations/apply-serum
// Authenticated. Body: { serumId }
// Applies a specific mutation via serum. Removes serum from
// player inventory. Respects conflict rules.
// ------------------------------------------------------------
router.post("/apply-serum", authMiddleware, serumLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { serumId } = req.body;

    if (!serumId || typeof serumId !== "string" || serumId.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid serumId" });
    }

    const serum = SERUMS_BY_ID[serumId];
    if (!serum) return res.status(404).json({ ok: false, error: "Unknown serum" });

    // Load player profile
    const playerKey = key(`player:${wallet}`);
    const rawProfile = await redis.hget(playerKey, "profile");
    if (!rawProfile) return res.status(404).json({ ok: false, error: "Player not found" });
    const profile = JSON.parse(rawProfile);

    // Check player has this serum in inventory
    if (!Array.isArray(profile.inventory)) profile.inventory = [];
    const serumIdx = profile.inventory.findIndex(i => i.id === serumId);
    if (serumIdx === -1) {
      return res.status(400).json({ ok: false, error: "Serum not in inventory" });
    }

    // Load active mutations
    const mutKey = key(`mutations:active:${wallet}`);
    const rawMut = await redis.get(mutKey);
    let active = rawMut ? JSON.parse(rawMut) : [];

    // Suppressant: remove one mutation at random
    if (serum.removes_mutation) {
      if (active.length === 0) {
        return res.status(400).json({ ok: false, error: "No mutations to suppress" });
      }
      const removeIdx = secureRandInt(0, active.length);
      const removed = active.splice(removeIdx, 1)[0];

      // Consume serum from inventory
      if (profile.inventory[serumIdx].quantity && profile.inventory[serumIdx].quantity > 1) {
        profile.inventory[serumIdx].quantity -= 1;
      } else {
        profile.inventory.splice(serumIdx, 1);
      }

      await redis.set(mutKey, JSON.stringify(active));
      await redis.hset(playerKey, "profile", JSON.stringify(profile));

      return res.json({
        ok: true,
        action: "suppressed",
        removed,
        remainingMutations: active,
        message: `Mutation suppressed: ${MUTATIONS_BY_ID[removed]?.name || removed}`
      });
    }

    // Regular serum: apply specific mutation
    const targetMutId = serum.applies;
    if (!targetMutId) return res.status(400).json({ ok: false, error: "Serum has no target mutation" });

    const targetMut = MUTATIONS_BY_ID[targetMutId];
    if (!targetMut) return res.status(404).json({ ok: false, error: "Target mutation definition not found" });

    // Already have this mutation
    if (active.includes(targetMutId)) {
      return res.status(409).json({ ok: false, error: "Already have this mutation", mutation: targetMutId });
    }

    // Check conflicts
    const conflicts = targetMut.conflicts || [];
    const conflictFound = active.find(id => conflicts.includes(id));
    if (conflictFound) {
      const conflictDef = MUTATIONS_BY_ID[conflictFound];
      return res.status(400).json({
        ok: false,
        error: `Conflicts with active mutation: ${conflictDef?.name || conflictFound}`,
        conflictId: conflictFound
      });
    }

    // Max mutations check
    if (active.length >= MAX_MUTATIONS) {
      return res.status(400).json({
        ok: false,
        error: `Maximum mutations reached (${MAX_MUTATIONS}). Use a suppressant to remove one.`
      });
    }

    active.push(targetMutId);

    // Consume serum
    if (profile.inventory[serumIdx].quantity && profile.inventory[serumIdx].quantity > 1) {
      profile.inventory[serumIdx].quantity -= 1;
    } else {
      profile.inventory.splice(serumIdx, 1);
    }

    await redis.set(mutKey, JSON.stringify(active));
    await redis.hset(playerKey, "profile", JSON.stringify(profile));

    return res.json({
      ok: true,
      action: "applied",
      mutation: targetMut,
      totalActive: active.length,
      message: `${targetMut.name} mutation applied. ${targetMut.benefit} // ${targetMut.drawback}`
    });
  } catch (err) {
    console.error("[mutations] apply-serum error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// POST /api/mutations/rad-check
// Authenticated. Body: { rads: number }
// Called when player's rad level updates. May trigger random mutation.
// ------------------------------------------------------------
router.post("/rad-check", authMiddleware, radCheckLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { rads } = req.body;

    if (typeof rads !== "number" || !Number.isFinite(rads) || rads < 0) {
      return res.status(400).json({ ok: false, error: "Invalid rads value" });
    }

    if (rads < RAD_THRESHOLD) {
      return res.json({ ok: true, mutationTriggered: false });
    }

    // Calculate chance
    const overThreshold = rads - RAD_THRESHOLD;
    const addlChance = Math.floor(overThreshold / 100) * 0.05;
    const totalChance = Math.min(0.60, BASE_RAD_CHANCE + addlChance);

    if (secureRandFloat() > totalChance) {
      return res.json({ ok: true, mutationTriggered: false, rads, chance: totalChance });
    }

    // Load active mutations
    const mutKey = key(`mutations:active:${wallet}`);
    const rawMut = await redis.get(mutKey);
    let active = rawMut ? JSON.parse(rawMut) : [];

    if (active.length >= MAX_MUTATIONS) {
      return res.json({ ok: true, mutationTriggered: false, reason: "at_max" });
    }

    // Pick random mutation avoiding: already-active, conflicts
    const pool = MUTATIONS_DATA.mutations.filter(m => {
      if (active.includes(m.id)) return false;
      const conflicts = m.conflicts || [];
      if (active.some(id => conflicts.includes(id))) return false;
      // Also check reverse conflicts
      if (active.some(id => (MUTATIONS_BY_ID[id]?.conflicts || []).includes(m.id))) return false;
      return true;
    });

    if (pool.length === 0) {
      return res.json({ ok: true, mutationTriggered: false, reason: "no_valid_mutations" });
    }

    const chosen = pool[secureRandInt(0, pool.length)];
    active.push(chosen.id);
    await redis.set(mutKey, JSON.stringify(active));

    return res.json({
      ok: true,
      mutationTriggered: true,
      mutation: chosen,
      totalActive: active.length,
      message: `Radiation exposure triggered: ${chosen.name}. ${chosen.benefit} // ${chosen.drawback}`
    });
  } catch (err) {
    console.error("[mutations] rad-check error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
