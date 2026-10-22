// backend/encounters/battle-rewards.js
// Pure rules for server-side battle reward validation (no I/O, unit-tested).
"use strict";

const LIMITS = {
  MAX_ENEMIES: 6,
  MAX_ENEMY_HP: 400,
  MAX_ENEMY_LEVEL: 50,
  XP_PER_HP: 1.5,
  CAPS_PER_HP: 0.5,
  MAX_XP: 600,
  MAX_CAPS: 300,
  MAX_ITEMS: 3,
  MAX_PLAYER_DMG_PER_TURN: 60, // generous: crit + sneak + perks on a strong weapon
  MIN_MS_PER_TURN: 400,        // UI animates each turn; faster means scripted
  TTL_SEC: 60 * 60,
  DAILY_WINS: 120,
};

function n(v, lo, hi, d) {
  const x = Math.floor(Number(v));
  return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d;
}

function sanitizeEnemies(enemies) {
  if (!Array.isArray(enemies) || enemies.length === 0) throw new Error("enemies required");
  return enemies.slice(0, LIMITS.MAX_ENEMIES).map((e) => ({
    id: String((e && e.id) || "enemy").slice(0, 64),
    hp: n(e && e.hp, 1, LIMITS.MAX_ENEMY_HP, 20),
    level: n(e && e.level, 1, LIMITS.MAX_ENEMY_LEVEL, 1),
  }));
}

// Server cap for a battle, derived from what the player must chew through.
function rewardCap(enemies) {
  const totalHp = enemies.reduce((a, e) => a + e.hp, 0);
  const lvl = enemies.reduce((a, e) => a + e.level, 0) / enemies.length;
  const mult = 1 + Math.min(1, (lvl - 1) / 20);
  return {
    xp: Math.min(LIMITS.MAX_XP, Math.round(totalHp * LIMITS.XP_PER_HP * mult)),
    caps: Math.min(LIMITS.MAX_CAPS, Math.round(totalHp * LIMITS.CAPS_PER_HP * mult)),
    items: LIMITS.MAX_ITEMS,
    totalHp,
  };
}

// Requested rewards are clamped to the cap; items are short safe ids only.
function approveRewards(requested, cap) {
  const r = requested || {};
  const items = (Array.isArray(r.items) ? r.items : [])
    .filter((i) => typeof i === "string" && /^[a-z0-9_-]{1,64}$/i.test(i))
    .slice(0, cap.items);
  return {
    xp: n(r.xp, 0, cap.xp, 0),
    caps: n(r.caps, 0, cap.caps, 0),
    items,
  };
}

function minTurns(cap) {
  return Math.max(1, Math.ceil(cap.totalHp / LIMITS.MAX_PLAYER_DMG_PER_TURN));
}

// battle: what /start stored. Returns { ok, error? }.
function checkResolve(battle, { wallet, result, turns, now }) {
  if (!battle) return { ok: false, error: "unknown battle" };
  if (battle.wallet !== wallet) return { ok: false, error: "not your battle" };
  if (battle.resolved) return { ok: false, error: "already resolved" };
  if (result !== "WIN") return { ok: false, error: "only wins are rewarded" };
  const t = n(turns, 0, 10000, 0);
  const need = minTurns(battle.cap);
  if (t < need) return { ok: false, error: `too few turns (${t} < ${need})` };
  const elapsed = (now || Date.now()) - battle.startedAt;
  if (elapsed < t * LIMITS.MIN_MS_PER_TURN) return { ok: false, error: "too fast" };
  if (elapsed > LIMITS.TTL_SEC * 1000) return { ok: false, error: "expired" };
  return { ok: true };
}

module.exports = { LIMITS, sanitizeEnemies, rewardCap, approveRewards, minTurns, checkResolve };
