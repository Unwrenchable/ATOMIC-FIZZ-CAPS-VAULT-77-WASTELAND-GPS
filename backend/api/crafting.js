// backend/api/crafting.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Crafting API
// Mounted at /api/crafting
//
// Server-side enforcement layer for crafting:
//  - Validates recipe exists and player meets level requirement
//  - Enforces per-player per-recipe daily craft limits via Redis
//  - Records audit trail per craft
//
// NOTE: Full ingredient inventory validation requires server-side
// inventory storage (currently kept in localStorage). Until that
// migration lands, the server enforces limits/level only.
// The client (crafting.js) must still verify ingredients locally
// and only call this endpoint after passing canCraft().
// ------------------------------------------------------------

"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { redis, key } = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");

// ------------------------------------------------------------
// Per-route limiter (crafting is value-bearing — items + economy)
// ------------------------------------------------------------
const craftingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // max 10 craft attempts per minute
  message: { ok: false, error: "Too many crafting requests — slow down, smoothskin" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---- Load recipes from authoritative data file ----
let RECIPES = [];
try {
  const recipesFile = path.join(__dirname, "..", "..", "public", "data", "craftables", "recipes.json");
  if (fs.existsSync(recipesFile)) {
    RECIPES = JSON.parse(fs.readFileSync(recipesFile, "utf8"));
    console.log(`[crafting] Loaded ${RECIPES.length} recipes`);
  } else {
    console.error("[crafting] CRITICAL: recipes.json not found — crafting API non-functional");
  }
} catch (e) {
  console.error("[crafting] CRITICAL: Failed to load recipes.json:", e.message);
}

// Index recipes by id for O(1) lookup
const RECIPE_INDEX = {};
RECIPES.forEach(r => { if (r && r.id) RECIPE_INDEX[r.id] = r; });

// ---- Helpers ----

/** Redis key for daily craft count: player:wallet:craft:recipeId:YYYY-MM-DD */
function craftCountKey(wallet, recipeId) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  return key(`craft:${wallet}:${recipeId}:${today}`);
}

/** Redis key for per-recipe cooldown: player:wallet:craftcd:recipeId */
function craftCooldownKey(wallet, recipeId) {
  return key(`craftcd:${wallet}:${recipeId}`);
}

// ---- Routes ----

// POST /api/crafting/craft
// Body: { recipeId: string }
// Auth: Bearer session required
router.post("/craft", craftingLimiter, authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet; // from authMiddleware — never from body (IDOR)
    const { recipeId } = req.body;

    if (!recipeId || typeof recipeId !== "string" || recipeId.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid recipeId" });
    }

    // 1. Recipe must exist
    const recipe = RECIPE_INDEX[recipeId];
    if (!recipe) {
      return res.status(404).json({ ok: false, error: "Recipe not found" });
    }

    // 2. Level requirement check (read from Redis player profile)
    // BUG-001 FIX: must pre-call key() to match the double-prefix convention used
    // by every other writer (player.js, xp.js, quests.js, etc.).  Without it the
    // hget hits afw:player:<wallet> while all writers store at afw:afw:player:<wallet>,
    // so profileRaw is always null and all level gates are bypassed at level 1.
    const profileRaw = await redis.hget(key(`player:${wallet}`), "profile");
    const profile = profileRaw ? JSON.parse(profileRaw) : null;
    const playerLevel = profile?.level ?? 1;
    const requiredLevel = recipe.requiresLevel ?? 1;
    if (playerLevel < requiredLevel) {
      return res.status(403).json({
        ok: false,
        error: `Requires level ${requiredLevel} (you are level ${playerLevel})`,
      });
    }

    // BUG-016 FIX: acquire an NX lock before the cooldown check/write to close
    // the race window where two simultaneous requests both pass step 3 (cooldown
    // read) before either reaches step 5 (cooldown write), allowing the same
    // recipe to be crafted twice within the same cooldown period.
    const craftLockKey = key(`craft:lock:${wallet}:${recipeId}`);
    const lock = await redis.set(craftLockKey, "1", { NX: true, EX: 30 });
    if (!lock) {
      return res.status(409).json({ ok: false, error: "Craft already in progress — try again shortly" });
    }

    try {
    // 3. Per-recipe cooldown check (seconds since last craft)
    const cdKey = craftCooldownKey(wallet, recipeId);
    const lastCraftTime = await redis.get(cdKey);
    if (lastCraftTime) {
      const elapsedSec = (Date.now() - parseInt(lastCraftTime, 10)) / 1000;
      const cooldownSec = recipe.cooldownSeconds ?? 0;
      if (elapsedSec < cooldownSec) {
        const remaining = Math.ceil(cooldownSec - elapsedSec);
        return res.status(429).json({
          ok: false,
          error: `Cooldown active — ${remaining}s remaining`,
          secondsRemaining: remaining,
        });
      }
    }

    // 4. Daily craft limit check — use atomic INCR to avoid TOCTOU race condition.
    // Increment first; if we exceed the limit, decrement and reject.
    // This ensures concurrent requests never both pass the check before either increments.
    const maxPerDay = recipe.maxPerDay ?? Infinity;
    let countKey = null;
    if (maxPerDay !== Infinity) {
      countKey = craftCountKey(wallet, recipeId);
      const newCount = await redis.incr(countKey);
      if (newCount === 1) {
        // First craft today — set expiry (25 hours covers UTC day rollover)
        await redis.expire(countKey, 90000);
      }
      if (newCount > maxPerDay) {
        // Over limit — undo the increment and reject
        await redis.decr(countKey);
        return res.status(429).json({
          ok: false,
          error: `Daily limit reached (${maxPerDay}/day for ${recipe.name || recipeId})`,
        });
      }
    }

    // 5. All checks passed — record the craft
    const now = Date.now();

    // Update cooldown timestamp
    if ((recipe.cooldownSeconds ?? 0) > 0) {
      // TTL = cooldown + 60s buffer
      await redis.set(cdKey, String(now), { EX: (recipe.cooldownSeconds + 60) });
    }

    return res.json({
      ok: true,
      recipeId,
      recipeName: recipe.name || recipeId,
      output: recipe.output || { itemId: recipeId, qty: 1 },
      message: `Crafted ${recipe.name || recipeId} successfully`,
    });
    } finally {
      await redis.del(craftLockKey).catch(() => {});
    }
  } catch (err) {
    console.error("[crafting] craft error:", err);
    return res.status(500).json({ ok: false, error: "Crafting failed" });
  }
});

// GET /api/crafting/cooldowns
// Returns current cooldown/limit status for all recipes for this wallet
// Useful for the UI to show which recipes are available
router.get("/cooldowns", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const result = {};

    for (const recipe of RECIPES) {
      const cdKey = craftCooldownKey(wallet, recipe.id);
      const lastCraftRaw = await redis.get(cdKey);
      let onCooldown = false;
      let secondsRemaining = 0;

      if (lastCraftRaw && (recipe.cooldownSeconds ?? 0) > 0) {
        const elapsed = (Date.now() - parseInt(lastCraftRaw, 10)) / 1000;
        if (elapsed < recipe.cooldownSeconds) {
          onCooldown = true;
          secondsRemaining = Math.ceil(recipe.cooldownSeconds - elapsed);
        }
      }

      let dailyCount = 0;
      const maxPerDay = recipe.maxPerDay ?? null;
      if (maxPerDay !== null) {
        const countKey = craftCountKey(wallet, recipe.id);
        dailyCount = parseInt((await redis.get(countKey)) || "0", 10);
      }

      result[recipe.id] = {
        onCooldown,
        secondsRemaining,
        dailyCount,
        maxPerDay: maxPerDay ?? null,
        dailyLimitReached: maxPerDay !== null && dailyCount >= maxPerDay,
      };
    }

    return res.json({ ok: true, cooldowns: result });
  } catch (err) {
    console.error("[crafting] cooldowns error:", err);
    return res.status(500).json({ ok: false, error: "Failed to fetch cooldowns" });
  }
});

module.exports = router;
