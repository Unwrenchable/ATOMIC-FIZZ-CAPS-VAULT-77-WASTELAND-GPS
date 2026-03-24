// backend/api/dungeon.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Dungeon Interior API
// Mounted at /api/dungeon
//
// Routes:
//   POST /api/dungeon/enter  — Log dungeon entry, return seed
//   POST /api/dungeon/loot   — Claim loot from a cleared room
//   POST /api/dungeon/clear  — Mark dungeon as fully cleared, award bonus
// ------------------------------------------------------------

"use strict";

const crypto = require("crypto");
const router = require("express").Router();
const rateLimit = require("express-rate-limit");

const { authMiddleware } = require("../lib/auth");
const { redis, key } = require("../lib/redis");
const { awardCapsToPlayer } = require("../lib/caps");
const { awardXp } = require("../lib/xp");

// ------------------------------------------------------------------
// Validation helpers
// ------------------------------------------------------------------
const VALID_POI_TYPES = new Set([
  "vault", "bunker", "raider_camp", "ruin", "sewer", "office", "military_base",
]);

const MAX_POI_ID_LEN    = 128;
const MAX_DUNGEON_ID_LEN = 200;
const MAX_ROOM_ID       = 20;    // max rooms per dungeon
const MAX_LOOT_CAPS     = 500;   // safety cap on single-room loot award

// TTL constants (seconds)
const SESSION_TTL_SECONDS        = 4 * 3600;         // 4 hours
const ENTRY_TRACKING_TTL_SECONDS = 30 * 24 * 3600;   // 30 days
const LOOT_PERSISTENCE_TTL_SECONDS = 7 * 24 * 3600;  // 7 days

// Loot reward range: 10–60 caps (base, before tier multiplier)
const MIN_LOOT_CAPS  = 10;
const LOOT_CAPS_RANGE = 51;  // crypto.randomInt upper bound, produces 0..50

// Completion bonus by dungeon type (caps + xp)
const COMPLETION_BONUS = {
  vault:         { caps: 120, xp: 80 },
  bunker:        { caps: 150, xp: 100 },
  raider_camp:   { caps: 80,  xp: 50 },
  ruin:          { caps: 60,  xp: 40 },
  sewer:         { caps: 50,  xp: 35 },
  office:        { caps: 70,  xp: 45 },
  military_base: { caps: 180, xp: 120 },
};

// ------------------------------------------------------------------
// Rate limiters
// ------------------------------------------------------------------
const enterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { ok: false, error: "Too many dungeon entries. Slow down, Vault Dweller." },
  standardHeaders: true,
  legacyHeaders: false,
});

const lootLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { ok: false, error: "Too many loot requests." },
  standardHeaders: true,
  legacyHeaders: false,
});

const clearLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { ok: false, error: "Too many clear requests." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------------
// Redis key helpers — return raw key strings (no afw: prefix).
// The redis wrapper functions (redis.get, redis.set, etc.) apply
// key() internally, consistent with the pattern used across the
// rest of the codebase (e.g. geofence.js, player.js).
// ------------------------------------------------------------------
function redisKeyEnter(wallet, poiId) {
  return `dungeon:enter:${wallet}:${poiId}`;
}

function redisKeyLoot(wallet, dungeonId, roomId) {
  return `dungeon:loot:${wallet}:${dungeonId}:${roomId}`;
}

function redisKeyClear(wallet, dungeonId) {
  return `dungeon:clear:${wallet}:${dungeonId}`;
}

function redisKeySession(wallet, dungeonId) {
  return `dungeon:session:${wallet}:${dungeonId}`;
}

// ------------------------------------------------------------------
// POST /api/dungeon/enter
// Body: { poiId, poiType }
// Validates auth, generates a crypto seed, stores session.
// Returns: { ok, dungeonId, seed, poiType, message }
// ------------------------------------------------------------------
router.post("/enter", authMiddleware, enterLimiter, async (req, res) => {
  try {
    const wallet  = req.player.wallet;
    const { poiId, poiType } = req.body || {};

    // Validate poiId
    if (!poiId || typeof poiId !== "string" || poiId.length > MAX_POI_ID_LEN) {
      return res.status(400).json({ ok: false, error: "Invalid poiId" });
    }

    // Validate poiType
    if (!poiType || !VALID_POI_TYPES.has(poiType)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid poiType. Must be one of: ${[...VALID_POI_TYPES].join(", ")}`,
      });
    }

    // Generate a unique dungeon ID (wallet prefix + poi + timestamp)
    const dungeonId = `dng_${crypto.randomBytes(8).toString("hex")}`;

    // Generate a cryptographic seed for the dungeon generator
    const seedBytes = crypto.randomBytes(4);
    const seed = seedBytes.readUInt32BE(0);

    // Store the dungeon session in Redis (TTL: 4 hours)
    const sessionData = JSON.stringify({
      wallet,
      poiId,
      poiType,
      dungeonId,
      seed,
      enteredAt: Date.now(),
    });

    await redis.set(key(redisKeySession(wallet, dungeonId)), sessionData, { EX: SESSION_TTL_SECONDS });

    // Track this entry (for analytics / quest triggers) — non-blocking
    const entryKey = redisKeyEnter(wallet, String(poiId));
    const existing = await redis.get(key(entryKey));
    const entryCount = existing ? parseInt(existing, 10) + 1 : 1;
    await redis.set(key(entryKey), String(entryCount), { EX: ENTRY_TRACKING_TTL_SECONDS }); // 30-day window

    console.log(
      `[dungeon] enter wallet=${wallet.slice(0, 8)}... poiId=${poiId} type=${poiType} dungeonId=${dungeonId}`
    );

    return res.json({
      ok: true,
      dungeonId,
      seed,
      poiType,
      entryCount,
      message: `Entering ${poiType.replace(/_/g, " ")} dungeon. Watch your back, Vault Dweller.`,
    });
  } catch (err) {
    console.error("[dungeon] enter error:", err);
    return res.status(500).json({ ok: false, error: "Failed to enter dungeon" });
  }
});

// ------------------------------------------------------------------
// POST /api/dungeon/loot
// Body: { dungeonId, roomId, caps }
// Idempotent via Redis key — double-claim returns 409.
// Returns: { ok, caps, xp, alreadyLooted }
// ------------------------------------------------------------------
router.post("/loot", authMiddleware, lootLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { dungeonId, roomId } = req.body || {};

    // Validate dungeonId
    if (!dungeonId || typeof dungeonId !== "string" || dungeonId.length > MAX_DUNGEON_ID_LEN) {
      return res.status(400).json({ ok: false, error: "Invalid dungeonId" });
    }

    // Validate roomId (must be a non-negative integer)
    const roomIdInt = parseInt(roomId, 10);
    if (!Number.isFinite(roomIdInt) || roomIdInt < 0 || roomIdInt > MAX_ROOM_ID) {
      return res.status(400).json({ ok: false, error: "Invalid roomId" });
    }

    // Verify dungeon session exists for this wallet
    const session = await redis.get(key(redisKeySession(wallet, dungeonId)));
    if (!session) {
      return res.status(403).json({ ok: false, error: "No active dungeon session" });
    }

    // Parse session to get dungeon type for server-side reward scaling
    let sessionObj;
    try {
      sessionObj = JSON.parse(session);
    } catch {
      return res.status(500).json({ ok: false, error: "Session data corrupted" });
    }

    // Server-side loot reward: based on dungeon type, not client-provided value
    // Room loot ranges 10-80 caps, scaled by dungeon tier
    const tierMultiplier = {
      vault: 1.4, bunker: 1.5, military_base: 1.6,
      raider_camp: 0.9, ruin: 0.8, sewer: 0.7, office: 1.0,
    }[sessionObj.poiType] || 1.0;
    const baseReward   = MIN_LOOT_CAPS + crypto.randomInt(LOOT_CAPS_RANGE); // 10–60
    const capsAwarded  = Math.max(5, Math.min(MAX_LOOT_CAPS, Math.round(baseReward * tierMultiplier)));

    // Idempotency: atomically mark as looted (NX = only set if not already set)
    // This prevents TOCTOU race conditions where two concurrent requests both
    // pass a GET check before either writes the SET.
    const lootKey = redisKeyLoot(wallet, dungeonId, roomIdInt);
    const lootSetResult = await redis.set(key(lootKey), String(Date.now()), { NX: true, EX: LOOT_PERSISTENCE_TTL_SECONDS });
    if (!lootSetResult) {
      return res.status(409).json({
        ok: false,
        alreadyLooted: true,
        error: "This room has already been looted",
      });
    }

    const xpAwarded = Math.max(5, Math.floor(capsAwarded / 6));

    try {
      await awardCapsToPlayer(wallet, capsAwarded);
    } catch (awardErr) {
      console.warn("[dungeon] caps award failed (non-fatal):", awardErr.message);
    }

    try {
      await awardXp({ wallet }, xpAwarded);
    } catch (xpErr) {
      console.warn("[dungeon] xp award failed (non-fatal):", xpErr.message);
    }

    console.log(
      `[dungeon] loot wallet=${wallet.slice(0, 8)}... room=${roomIdInt} caps=${capsAwarded} xp=${xpAwarded}`
    );

    return res.json({
      ok: true,
      caps: capsAwarded,
      xp: xpAwarded,
      roomId: roomIdInt,
      dungeonId,
      message: `Loot secured. +${capsAwarded} caps, +${xpAwarded} XP.`,
    });
  } catch (err) {
    console.error("[dungeon] loot error:", err);
    return res.status(500).json({ ok: false, error: "Failed to process loot" });
  }
});

// ------------------------------------------------------------------
// POST /api/dungeon/clear
// Body: { dungeonId }
// Awards completion bonus. Idempotent — double-clear returns 409.
// Returns: { ok, caps, xp, message }
// ------------------------------------------------------------------
router.post("/clear", authMiddleware, clearLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { dungeonId } = req.body || {};

    // Validate dungeonId
    if (!dungeonId || typeof dungeonId !== "string" || dungeonId.length > MAX_DUNGEON_ID_LEN) {
      return res.status(400).json({ ok: false, error: "Invalid dungeonId" });
    }

    // Verify dungeon session exists
    const sessionRaw = await redis.get(key(redisKeySession(wallet, dungeonId)));
    if (!sessionRaw) {
      return res.status(403).json({ ok: false, error: "No active dungeon session" });
    }

    let sessionData;
    try {
      sessionData = JSON.parse(sessionRaw);
    } catch {
      return res.status(500).json({ ok: false, error: "Session data corrupted" });
    }

    // Idempotency check
    const clearKey = redisKeyClear(wallet, dungeonId);
    const alreadyCleared = await redis.get(key(clearKey));
    if (alreadyCleared) {
      return res.status(409).json({
        ok: false,
        alreadyCleared: true,
        error: "Dungeon already cleared",
      });
    }

    // Mark as cleared
    await redis.set(key(clearKey), String(Date.now()), { EX: LOOT_PERSISTENCE_TTL_SECONDS });

    // Delete session so it can't be reused
    await redis.del(key(redisKeySession(wallet, dungeonId)));

    // Award completion bonus based on dungeon type
    const poiType = sessionData.poiType || "ruin";
    const bonus   = COMPLETION_BONUS[poiType] || COMPLETION_BONUS.ruin;

    try {
      await awardCapsToPlayer(wallet, bonus.caps);
    } catch (awardErr) {
      console.warn("[dungeon] clear caps award failed (non-fatal):", awardErr.message);
    }

    try {
      await awardXp({ wallet }, bonus.xp);
    } catch (xpErr) {
      console.warn("[dungeon] clear xp award failed (non-fatal):", xpErr.message);
    }

    console.log(
      `[dungeon] clear wallet=${wallet.slice(0, 8)}... type=${poiType} caps=${bonus.caps} xp=${bonus.xp}`
    );

    return res.json({
      ok: true,
      caps:    bonus.caps,
      xp:      bonus.xp,
      poiType,
      dungeonId,
      message: `Dungeon cleared! Completion bonus: +${bonus.caps} caps, +${bonus.xp} XP.`,
    });
  } catch (err) {
    console.error("[dungeon] clear error:", err);
    return res.status(500).json({ ok: false, error: "Failed to process dungeon clear" });
  }
});

module.exports = router;
