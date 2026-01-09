// backend/lib/xp.js
// Secure XP management
// - Validates inputs
// - Enforces per-request and per-day caps
// - Uses Redis for persistence if REDIS_URL is provided, otherwise in-memory fallback
// - Provides atomic updates and level calculation helpers
// - Structured audit logging

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let Redis;
try {
  Redis = require("ioredis");
} catch (e) {
  Redis = null;
}

const REDIS_URL = process.env.REDIS_URL || null;
const XP_PER_REQUEST_MAX = Number(process.env.XP_PER_REQUEST_MAX || 10000);
const XP_PER_REQUEST_MIN = Number(process.env.XP_PER_REQUEST_MIN || 1);
const XP_DAILY_LIMIT = Number(process.env.XP_DAILY_LIMIT || 50000); // per player per day
const XP_BASE_PER_LEVEL = Number(process.env.XP_BASE_PER_LEVEL || 1000); // linear base
const PERSISTENCE_FILE = path.join(process.cwd(), "data", "xp_store.json"); // used only for fallback persistence

let redisClient = null;
if (REDIS_URL && Redis) {
  redisClient = new Redis(REDIS_URL);
  redisClient.on("error", (err) => {
    console.error("[xp] Redis error:", err && err.message ? err.message : err);
  });
} else if (REDIS_URL && !Redis) {
  console.warn("[xp] REDIS_URL provided but ioredis is not installed. Install ioredis for persistence.");
} else {
  console.warn("[xp] No REDIS_URL configured — using in-memory XP store (not persistent across restarts) or file fallback.");
}

// In-memory fallback store: Map<player, { total: number, dayKey: string, daily: number }>
const inMemoryStore = new Map();

// Ensure data directory exists for file persistence fallback
try {
  const dataDir = path.dirname(PERSISTENCE_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
} catch (e) {
  // ignore
}

/* -------------------------
   Helpers
   ------------------------- */

function _dayKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

function auditLog(event) {
  const base = {
    ts: new Date().toISOString(),
    service: "xp",
    pid: process.pid,
    ...event,
  };
  console.info(JSON.stringify(base));
}

function validatePlayerId(player) {
  if (!player || typeof player !== "string") {
    throw new Error("Invalid player identifier");
  }
  // optional: enforce allowed charset/length
  if (player.length > 128) throw new Error("Player identifier too long");
}

function validateAmount(amount) {
  if (amount === undefined || amount === null) throw new Error("Missing amount");
  const n = Number(amount);
  if (!Number.isFinite(n) || Number.isNaN(n)) throw new Error("Amount must be a finite number");
  if (!Number.isInteger(n)) throw new Error("Amount must be an integer");
  if (n < XP_PER_REQUEST_MIN) throw new Error(`Amount must be at least ${XP_PER_REQUEST_MIN}`);
  if (n > XP_PER_REQUEST_MAX) throw new Error(`Amount exceeds per-request maximum of ${XP_PER_REQUEST_MAX}`);
  return n;
}

/* -------------------------
   Level curve helpers
   ------------------------- */

/**
 * Simple linear level curve:
 * totalXP -> level = floor(totalXP / XP_BASE_PER_LEVEL)
 * You can replace with exponential or custom curve later.
 */
function xpToLevel(totalXp) {
  return Math.floor(totalXp / XP_BASE_PER_LEVEL);
}

function levelToXp(level) {
  return level * XP_BASE_PER_LEVEL;
}

/* -------------------------
   Persistence helpers
   ------------------------- */

async function _getTotalXpRedis(player) {
  const key = `xp:total:${player}`;
  const val = await redisClient.get(key);
  return val ? Number(val) : 0;
}

async function _incrTotalXpRedis(player, amount) {
  const key = `xp:total:${player}`;
  const newTotal = await redisClient.incrby(key, Number(amount));
  return Number(newTotal);
}

async function _getDailyRedis(player) {
  const day = _dayKey();
  const key = `xp:daily:${player}:${day}`;
  const val = await redisClient.get(key);
  return val ? Number(val) : 0;
}

async function _incrDailyRedis(player, amount) {
  const day = _dayKey();
  const key = `xp:daily:${player}:${day}`;
  const newTotal = await redisClient.incrby(key, Number(amount));
  // set expiry to 48 hours to avoid stale keys
  await redisClient.expire(key, 60 * 60 * 48);
  return Number(newTotal);
}

/* File fallback persistence (best-effort single-instance) */
function _loadFileStore() {
  try {
    if (!fs.existsSync(PERSISTENCE_FILE)) return {};
    const raw = fs.readFileSync(PERSISTENCE_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch (e) {
    console.error("[xp] Failed to load XP file store:", e && e.message ? e.message : e);
    return {};
  }
}

function _saveFileStore(obj) {
  try {
    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    console.error("[xp] Failed to save XP file store:", e && e.message ? e.message : e);
  }
}

function _getFromMemoryOrFile(player) {
  if (inMemoryStore.has(player)) {
    const entry = inMemoryStore.get(player);
    return { total: entry.total || 0, daily: entry.daily || 0, dayKey: entry.dayKey || _dayKey() };
  }
  // try file
  try {
    const store = _loadFileStore();
    const entry = store[player] || { total: 0, daily: 0, dayKey: _dayKey() };
    // sync into memory
    inMemoryStore.set(player, { total: entry.total, daily: entry.daily, dayKey: entry.dayKey });
    return { total: entry.total, daily: entry.daily, dayKey: entry.dayKey };
  } catch (e) {
    return { total: 0, daily: 0, dayKey: _dayKey() };
  }
}

function _saveToFileStore(player, total, daily, dayKey) {
  try {
    const store = _loadFileStore();
    store[player] = { total, daily, dayKey };
    _saveFileStore(store);
  } catch (e) {
    // already logged in helpers
  }
}

/* -------------------------
   Public API
   ------------------------- */

/**
 * awardXp(player, amount)
 * - Validates inputs
 * - Enforces per-request and per-day caps
 * - Updates total XP atomically (Redis) or best-effort (in-memory/file)
 * - Returns { ok: true, player, awarded, totalXp, level, levelProgress }
 * - Throws Error on validation or policy failure
 */
exports.awardXp = async function (player, amount) {
  validatePlayerId(player);
  const n = validateAmount(amount);

  // Check daily allowance and increment atomically
  if (redisClient) {
    // increment daily first
    const newDaily = await _incrDailyRedis(player, n);
    if (newDaily > XP_DAILY_LIMIT) {
      // revert daily increment
      await redisClient.decrby(`xp:daily:${player}:${_dayKey()}`, n);
      const allowed = Math.max(0, XP_DAILY_LIMIT - (newDaily - n));
      throw new Error(`Daily XP limit exceeded. Remaining today: ${allowed}`);
    }

    // increment total XP atomically
    let newTotal;
    try {
      newTotal = await _incrTotalXpRedis(player, n);
    } catch (err) {
      // revert daily increment on failure
      await redisClient.decrby(`xp:daily:${player}:${_dayKey()}`, n);
      auditLog({ action: "xp_increment_failed", player, amount: n, error: err.message || String(err) });
      throw new Error("Failed to award XP");
    }

    const level = xpToLevel(newTotal);
    const levelProgress = {
      level,
      xpForLevel: levelToXp(level),
      xpToNextLevel: levelToXp(level + 1) - newTotal,
    };

    auditLog({ action: "xp_awarded", player, awarded: n, totalXp: newTotal, dailyTotal: newDaily });

    return { ok: true, player, awarded: n, totalXp: newTotal, level, levelProgress };
  } else {
    // In-memory / file fallback
    const entry = _getFromMemoryOrFile(player);
    const today = _dayKey();
    if (entry.dayKey !== today) {
      entry.dayKey = today;
      entry.daily = 0;
    }
    entry.daily += n;
    if (entry.daily > XP_DAILY_LIMIT) {
      // revert
      entry.daily -= n;
      throw new Error(`Daily XP limit exceeded. Remaining today: ${Math.max(0, XP_DAILY_LIMIT - entry.daily)}`);
    }
    entry.total = (entry.total || 0) + n;
    inMemoryStore.set(player, entry);
    // persist to file best-effort
    _saveToFileStore(player, entry.total, entry.daily, entry.dayKey);

    const level = xpToLevel(entry.total);
    const levelProgress = {
      level,
      xpForLevel: levelToXp(level),
      xpToNextLevel: levelToXp(level + 1) - entry.total,
    };

    auditLog({ action: "xp_awarded", player, awarded: n, totalXp: entry.total, dailyTotal: entry.daily });

    return { ok: true, player, awarded: n, totalXp: entry.total, level, levelProgress };
  }
};

/**
 * getPlayerXp(player)
 * - Returns { player, totalXp, level, dailyTotal }
 */
exports.getPlayerXp = async function (player) {
  validatePlayerId(player);
  if (redisClient) {
    const total = await _getTotalXpRedis(player);
    const daily = await _getDailyRedis(player);
    const level = xpToLevel(total);
    return { player, totalXp: total, level, dailyTotal: daily };
  } else {
    const entry = _getFromMemoryOrFile(player);
    const level = xpToLevel(entry.total || 0);
    return { player, totalXp: entry.total || 0, level, dailyTotal: entry.daily || 0 };
  }
};

/**
 * resetPlayerXp(player)
 * - Administrative helper for tests or moderation
 */
exports.resetPlayerXp = async function (player) {
  validatePlayerId(player);
  if (redisClient) {
    await redisClient.del(`xp:total:${player}`);
    await redisClient.del(`xp:daily:${player}:${_dayKey()}`);
  } else {
    inMemoryStore.delete(player);
    _saveToFileStore(player, 0, 0, _dayKey());
  }
  auditLog({ action: "xp_reset", player });
  return { ok: true, player };
};

/* -------------------------
   Pluggable hooks
   ------------------------- */

/**
 * setLevelCurve(fn)
 * - Replace xpToLevel and levelToXp with custom functions if needed.
 * - fn should be an object: { xpToLevel: (totalXp) => level, levelToXp: (level) => xp }
 */
exports.setLevelCurve = function (fn) {
  assert(fn && typeof fn.xpToLevel === "function" && typeof fn.levelToXp === "function", "Invalid level curve");
  exports.xpToLevel = fn.xpToLevel;
  exports.levelToXp = fn.levelToXp;
};
