"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { handleEncounterCheck } = require("../encounters/controller");
const { authMiddleware } = require("../lib/auth");
const { redis, key, getJSON, setJSON } = require("../lib/redis");
const R = require("../encounters/battle-rewards");

const router = express.Router();

const encounterLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 30,
  message: { ok: false, error: "Pocket-Boy chatter overload. Hold position a moment." },
  standardHeaders: true,
  legacyHeaders: false
});

router.post("/check", encounterLimiter, handleEncounterCheck);

// ------------------------------------------------------------
// Server-side battle reward validation
// POST /api/encounter/battle/start   { encounterId, enemies[], rewards }
//   -> { battleId, cap, approved }  (stored per wallet, 1h TTL)
// POST /api/encounter/battle/resolve { battleId, result: "WIN", turns }
//   -> { rewards }  credited to the server profile once; client mirrors only these
// ------------------------------------------------------------
const battleLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 20,
  message: { ok: false, error: "Too many battle requests" },
  standardHeaders: true,
  legacyHeaders: false
});

router.post("/battle/start", authMiddleware, battleLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const enemies = R.sanitizeEnemies(req.body && req.body.enemies);
    const cap = R.rewardCap(enemies);
    const approved = R.approveRewards(req.body && req.body.rewards, cap);
    const battleId = crypto.randomBytes(12).toString("hex");
    await setJSON(`battle:${battleId}`, { wallet, enemies, cap, approved, startedAt: Date.now(), resolved: false }, { EX: R.LIMITS.TTL_SEC });
    return res.json({ ok: true, battleId, cap: { xp: cap.xp, caps: cap.caps, items: cap.items }, approved, minTurns: R.minTurns(cap) });
  } catch (err) {
    const bad = /required/.test(err.message);
    if (!bad) console.error("[encounter] battle/start error:", err);
    return res.status(bad ? 400 : 500).json({ ok: false, error: bad ? err.message : "Battle registration failed" });
  }
});

router.post("/battle/resolve", authMiddleware, battleLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const battleId = String((req.body && req.body.battleId) || "");
    if (!/^[a-f0-9]{24}$/.test(battleId)) return res.status(400).json({ ok: false, error: "bad battleId" });
    const battle = await getJSON(`battle:${battleId}`);
    const verdict = R.checkResolve(battle, { wallet, result: req.body && req.body.result, turns: req.body && req.body.turns, now: Date.now() });
    if (!verdict.ok) return res.status(verdict.error === "unknown battle" ? 404 : 409).json({ ok: false, error: verdict.error });

    // one-shot: mark resolved before crediting
    battle.resolved = true;
    await setJSON(`battle:${battleId}`, battle, { EX: R.LIMITS.TTL_SEC });

    const day = new Date().toISOString().slice(0, 10);
    const dailyKey = key(`battle:wins:${wallet}:${day}`);
    const wins = await redis.incr(dailyKey);
    if (wins === 1) await redis.expire(dailyKey, 26 * 3600);
    const rewards = wins > R.LIMITS.DAILY_WINS ? { xp: 0, caps: 0, items: [], capped: true } : battle.approved;

    const playerKey = key(`player:${wallet}`);
    const raw = await redis.hget(playerKey, "profile");
    if (raw && (rewards.xp || rewards.caps)) {
      const profile = JSON.parse(raw);
      profile.xp = (profile.xp || 0) + rewards.xp;
      profile.caps = Math.min(999999999, (profile.caps || 0) + rewards.caps);
      await redis.hset(playerKey, "profile", JSON.stringify(profile));
    }
    await redis.hincrby(playerKey, "battleWins", 1);
    return res.json({ ok: true, rewards });
  } catch (err) {
    console.error("[encounter] battle/resolve error:", err);
    return res.status(500).json({ ok: false, error: "Battle resolve failed" });
  }
});

module.exports = router;
