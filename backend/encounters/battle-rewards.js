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
  // Rewarded wins per wallet per UTC day. Was 120 (~36k caps/day at the old cap).
  DAILY_WINS: Number(process.env.BATTLE_DAILY_WINS) > 0 ? Math.floor(Number(process.env.BATTLE_DAILY_WINS)) : 30,
};

// Server-side enemy stats. Client-sent hp/level are NEVER trusted for rewards:
// the roster is rebuilt from this table by enemy type/id. Mirrors the HP the
// frontend uses (dungeon.js ENEMY_HP, encounters.js, loop.js).
const DEFAULT_ENEMY = { hp: 20, level: 1 };
const ENEMY_STATS = {
  radroach: { hp: 10, level: 1 }, bloatfly: { hp: 8, level: 1 }, mole_rat: { hp: 15, level: 1 },
  rat: { hp: 10, level: 1 }, ghoul: { hp: 20, level: 2 }, feral_ghoul: { hp: 28, level: 3 },
  eyebot: { hp: 18, level: 2 }, zombie_executive: { hp: 22, level: 2 }, raider: { hp: 30, level: 3 },
  propagandabot: { hp: 25, level: 3 }, vault_ghoul: { hp: 30, level: 3 }, raider_psycho: { hp: 35, level: 4 },
  rad_scorpion: { hp: 40, level: 5 }, red_trooper: { hp: 40, level: 5 }, security_bot: { hp: 45, level: 5 },
  robobrain: { hp: 50, level: 6 }, enclave_soldier: { hp: 55, level: 7 }, glowing_one: { hp: 60, level: 8 },
  raider_boss: { hp: 70, level: 9 }, overseer_mk2: { hp: 80, level: 10 }, red_assaultron: { hp: 85, level: 11 },
  sentry_bot: { hp: 90, level: 12 }, deathclaw_alpha: { hp: 120, level: 15 }, vault_zero_commissar: { hp: 150, level: 18 },
};

// "Raider 2" / "raider_1" / "rat0" -> known type key, else null.
function enemyType(e) {
  for (const raw of [e && e.type, e && e.id]) {
    if (typeof raw !== "string") continue;
    const k = raw.toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/_?\d+$/, "").slice(0, 64);
    if (Object.prototype.hasOwnProperty.call(ENEMY_STATS, k)) return k;
  }
  return null;
}

function n(v, lo, hi, d) {
  const x = Math.floor(Number(v));
  return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d;
}

// Builds the authoritative roster stored at /battle/start. Only the enemy
// identity comes from the client; hp/level come from ENEMY_STATS (unknown
// types get the weak DEFAULT_ENEMY), so tampered stats can't raise rewards.
function sanitizeEnemies(enemies) {
  if (!Array.isArray(enemies) || enemies.length === 0) throw new Error("enemies required");
  return enemies.slice(0, LIMITS.MAX_ENEMIES).map((e) => {
    const type = enemyType(e);
    const stats = type ? ENEMY_STATS[type] : DEFAULT_ENEMY;
    return {
      id: String((e && (e.id || e.type)) || "enemy").slice(0, 64),
      type: type || "unknown",
      hp: Math.min(LIMITS.MAX_ENEMY_HP, stats.hp),
      level: Math.min(LIMITS.MAX_ENEMY_LEVEL, stats.level),
    };
  });
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

// XP/caps are derived from the server roster (the cap IS the reward); the
// client's requested xp/caps are ignored. Items are short safe ids only.
function approveRewards(requested, cap) {
  const r = requested || {};
  const items = (Array.isArray(r.items) ? r.items : [])
    .filter((i) => typeof i === "string" && /^[a-z0-9_-]{1,64}$/i.test(i))
    .slice(0, cap.items);
  return { xp: cap.xp, caps: cap.caps, items };
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

module.exports = { LIMITS, ENEMY_STATS, DEFAULT_ENEMY, enemyType, sanitizeEnemies, rewardCap, approveRewards, minTurns, checkResolve };
