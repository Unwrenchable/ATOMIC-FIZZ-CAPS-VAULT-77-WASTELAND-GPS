// backend/api/claim-survival.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Survival Reward Claim Endpoint
// Mounted at /api/claim-survival
//
// Route:
//   POST /api/claim-survival
//     Body: { sessionId }
//     Requires: auth
//
// A player who has survived a dangerous wasteland encounter
// (radiation storm, nuke zone, combat session, etc.) calls this
// endpoint to claim their survival bonus: caps + XP.
//
// Idempotent — double-claiming the same sessionId returns 409.
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
// Constants
// ------------------------------------------------------------------

// Valid encounter types that generate a survival claim.
const VALID_ENCOUNTER_TYPES = new Set([
  "radiation_storm",
  "nuke_zone",
  "combat",
  "dungeon_escape",
  "hazard_zone",
]);

// Reward table by encounter type (server-authoritative, not client-supplied).
const ENCOUNTER_REWARDS = {
  radiation_storm: { caps: 40,  xp: 30 },
  nuke_zone:       { caps: 80,  xp: 60 },
  combat:          { caps: 30,  xp: 20 },
  dungeon_escape:  { caps: 60,  xp: 45 },
  hazard_zone:     { caps: 50,  xp: 35 },
};

const SESSION_ID_MAX_LEN = 128;

// Claimed sessions are tracked for 30 days (prevents double-claim replays).
const CLAIM_TTL_SECONDS = 30 * 24 * 3600;

// ------------------------------------------------------------------
// Rate limiter — survival rewards are value-bearing
// ------------------------------------------------------------------
const claimLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { ok: false, error: "Too many survival claim requests. Breathe, Vault Dweller." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------------
// POST /api/claim-survival
// ------------------------------------------------------------------
router.post("/", authMiddleware, claimLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { sessionId, encounterType } = req.body || {};

    // Validate sessionId
    if (
      !sessionId ||
      typeof sessionId !== "string" ||
      sessionId.length > SESSION_ID_MAX_LEN ||
      !/^[a-zA-Z0-9_-]+$/.test(sessionId)
    ) {
      return res.status(400).json({ ok: false, error: "Invalid sessionId" });
    }

    // Validate encounterType
    if (!encounterType || !VALID_ENCOUNTER_TYPES.has(encounterType)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid encounterType. Must be one of: ${[...VALID_ENCOUNTER_TYPES].join(", ")}`,
      });
    }

    // Idempotency: use NX so only the first claim wins atomically.
    // Key is scoped to this wallet + sessionId combination so one player
    // cannot claim another player's session (IDOR protection).
    const claimKey = key(`survival:claim:${wallet}:${sessionId}`);
    const claimed = await redis.set(claimKey, String(Date.now()), {
      NX: true,
      EX: CLAIM_TTL_SECONDS,
    });

    if (claimed === null) {
      return res.status(409).json({
        ok: false,
        error: "Survival reward already claimed for this session.",
        alreadyClaimed: true,
      });
    }

    // Look up server-side reward (client-provided amounts are ignored).
    const reward = ENCOUNTER_REWARDS[encounterType];

    // Apply small random jitter (+/- 20%) so each claim feels unique.
    // crypto.randomInt(min, max) is [min, max) exclusive-upper-bound, so (-20, 21) → -20…20 → divides cleanly.
    const jitter = () => 1 + crypto.randomInt(-20, 21) / 100; // 0.80 – 1.20
    const capsAwarded = Math.max(1, Math.round(reward.caps * jitter()));
    const xpAwarded   = Math.max(1, Math.round(reward.xp  * jitter()));

    // Award caps and XP (non-blocking — failures are logged, not fatal).
    // Note: awardCapsToPlayer takes (wallet, amount) while awardXp takes (playerObj, amount) —
    // this is a pre-existing inconsistency in the codebase; we call each with the correct shape.
    let capsResult = null;
    let xpResult   = null;
    try {
      capsResult = await awardCapsToPlayer(wallet, capsAwarded);
    } catch (capsErr) {
      console.error("[claim-survival] caps award error:", capsErr);
    }
    try {
      xpResult = await awardXp(req.player, xpAwarded);
    } catch (xpErr) {
      console.error("[claim-survival] xp award error:", xpErr);
    }

    console.log(
      `[claim-survival] wallet=${wallet.slice(0, 8)}... ` +
      `type=${encounterType} session=${sessionId} caps=${capsAwarded} xp=${xpAwarded}`
    );

    return res.json({
      ok: true,
      caps: capsAwarded,
      xp: xpAwarded,
      encounterType,
      newCapsTotal: capsResult?.newBalance ?? null,
      leveledUp: xpResult?.leveledUp ?? false,
      message: `You survived the ${encounterType.replace(/_/g, " ")}. Collect your scrap and move out.`,
    });
  } catch (err) {
    console.error("[claim-survival] error:", err);
    return res.status(500).json({ ok: false, error: "Failed to process survival claim" });
  }
});

module.exports = router;
