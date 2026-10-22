"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { handleEncounterCheck } = require("../encounters/controller");
const { authMiddleware } = require("../lib/auth");
const { redis, key, getJSON, setJSON } = require("../lib/redis");
const R = require("../encounters/battle-rewards");
const { resolveBattle } = require("../encounters/battle-resolve");

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
    const body = req.body || {};
    const out = await resolveBattle({ redis, key, getJSON, setJSON }, {
      wallet,
      battleId: String(body.battleId || ""),
      result: body.result,
      turns: body.turns,
      now: Date.now(),
    });
    return res.status(out.status).json(out.body);
  } catch (err) {
    console.error("[encounter] battle/resolve error:", err);
    return res.status(500).json({ ok: false, error: "Battle resolve failed" });
  }
});

module.exports = router;
