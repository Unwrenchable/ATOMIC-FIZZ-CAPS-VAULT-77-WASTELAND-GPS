// backend/lib/cooldowns.js
// Hardened cooldowns for crypto projects
// - Atomic check-and-set via Redis Lua script (stores metadata)
// - Redis Streams for audit trail
// - Per-player/action/resource keys
// - Metrics hooks and fail-safe modes
// - Requires ioredis for Redis client

const assert = require("assert");
const crypto = require("crypto");

let Redis;
try {
  Redis = require("ioredis");
} catch (e) {
  Redis = null;
}

const REDIS_URL = process.env.REDIS_URL || null;
const DEFAULT_COOLDOWN_SECONDS = Number(process.env.LOOT_COOLDOWN_SECONDS || 300);
const AUDIT_STREAM = process.env.COOLDOWNS_AUDIT_STREAM || "stream:cooldowns:audit";
const FAIL_SAFE_MODE = process.env.COOLDOWNS_FAIL_SAFE || "deny"; // "deny" or "allow" when Redis down
const METRICS_HOOK = global.__METRICS_HOOK__ || null; // optional function to record metrics

let redisClient = null;
if (REDIS_URL && Redis) {
  // Use TLS if provided in URL; ioredis supports redis+tls:// or rediss://
  redisClient = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
  redisClient.on("error", (err) => {
    console.error("[cooldowns] Redis error:", err && err.message ? err.message : err);
  });
} else {
  console.warn("[cooldowns] No REDIS_URL or ioredis; cooldowns will use in-memory fallback (not for prod).");
}

// In-memory fallback (single-instance dev only)
const inMemory = new Map();

/* -------------------------
   Helpers
   ------------------------- */

function auditLog(event) {
  const base = {
    ts: new Date().toISOString(),
    service: "cooldowns",
    pid: process.pid,
    ...event,
  };
  // Write to Redis Stream if available, otherwise console
  if (redisClient) {
    try {
      // Flatten event to string fields
      const fields = [];
      for (const k of Object.keys(base)) {
        fields.push(k, typeof base[k] === "string" ? base[k] : JSON.stringify(base[k]));
      }
      redisClient.xadd(AUDIT_STREAM, "*", ...fields).catch((e) => {
        console.error("[cooldowns] failed to write audit stream:", e && e.message ? e.message : e);
      });
    } catch (e) {
      console.error("[cooldowns] audit stream error:", e && e.message ? e.message : e);
    }
  } else {
    console.info(JSON.stringify(base));
  }
  // Metrics hook
  if (METRICS_HOOK && typeof METRICS_HOOK === "function") {
    try {
      METRICS_HOOK(base);
    } catch (e) {
      // swallow metrics errors
    }
  }
}

function validatePlayer(player) {
  if (!player || typeof player !== "string") throw new Error("Invalid player identifier");
  if (player.length > 128) throw new Error("Player identifier too long");
}

function validateAction(action) {
  if (!action || typeof action !== "string") throw new Error("Invalid action");
  if (action.length > 64) throw new Error("Action too long");
}

function buildKey(player, action, resourceId) {
  // canonical key: cooldown:player:<player>:action:<action>[:resource:<resourceId>]
  let key = `cooldown:player:${player}:action:${action}`;
  if (resourceId) key += `:resource:${resourceId}`;
  return key;
}

/* -------------------------
   Redis Lua script (atomic check-and-set with metadata)
   Returns:
     { set: 1|0, remaining: seconds, prev_owner: string|null }
   Script logic:
     - if key does not exist: set key with value (owner|nonce) and EX seconds, return set=1, remaining=seconds
     - if key exists: return set=0, remaining=ttl, prev_owner=stored_owner
*/
const LUA_CHECK_AND_SET = `
local key = KEYS[1]
local owner = ARGV[1]
local nonce = ARGV[2]
local seconds = tonumber(ARGV[3])

local v = redis.call("GET", key)
if not v then
  -- store JSON-like value: owner|nonce
  local stored = owner .. "|" .. nonce
  redis.call("SET", key, stored, "EX", seconds)
  return {1, seconds, owner}
else
  local ttl = redis.call("TTL", key)
  if ttl < 0 then ttl = 0 end
  -- parse owner from stored value
  local sep = string.find(v, "|")
  local prev_owner = sep and string.sub(v, 1, sep - 1) or v
  return {0, ttl, prev_owner}
end
`;

/* -------------------------
   Public API
   ------------------------- */

/**
 * checkCooldown(player, action, resourceId)
 * - Returns { ok: boolean, remainingSeconds: number }
 */
exports.checkCooldown = async function (player, action, resourceId = null) {
  validatePlayer(player);
  validateAction(action);
  const key = buildKey(player, action, resourceId);

  if (redisClient) {
    try {
      const ttl = await redisClient.ttl(key);
      if (ttl === -2) return { ok: true, remainingSeconds: 0 };
      const remaining = ttl > 0 ? ttl : 0;
      return { ok: remaining === 0, remainingSeconds: remaining };
    } catch (err) {
      console.error("[cooldowns] Redis check error:", err && err.message ? err.message : err);
      // Fail-safe behavior
      if (FAIL_SAFE_MODE === "allow") return { ok: true, remainingSeconds: 0 };
      return { ok: false, remainingSeconds: Number.MAX_SAFE_INTEGER };
    }
  } else {
    const now = Date.now();
    const expiry = inMemory.get(key) || 0;
    const remainingMs = Math.max(0, expiry - now);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    return { ok: remainingSeconds === 0, remainingSeconds };
  }
};

/**
 * setCooldown(player, action, resourceId, seconds, opts)
 * - opts: { nonce: string (optional), metadata: object (optional) }
 * - Returns { ok: boolean, remainingSeconds: number, owner: string|null }
 *
 * Uses Lua script for atomic check-and-set and stores owner|nonce as value.
 */
exports.setCooldown = async function (player, action, resourceId = null, seconds = DEFAULT_COOLDOWN_SECONDS, opts = {}) {
  validatePlayer(player);
  validateAction(action);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("Invalid cooldown seconds");

  const key = buildKey(player, action, resourceId);
  const owner = opts.owner || player; // owner metadata (who set it)
  const nonce = opts.nonce || crypto.randomBytes(8).toString("hex");

  if (redisClient) {
    try {
      // Load script and execute atomically
      const sha = await redisClient.script("LOAD", LUA_CHECK_AND_SET);
      const res = await redisClient.evalsha(sha, 1, key, owner, nonce, Math.ceil(seconds));
      // res is array: [setFlag, remaining, prev_owner]
      const setFlag = Number(res[0]);
      const remaining = Number(res[1]);
      const prevOwner = res[2] || null;

      // Write audit event with metadata
      auditLog({
        event: setFlag === 1 ? "cooldown_set" : "cooldown_conflict",
        player,
        action,
        resourceId,
        seconds,
        owner,
        nonce,
        prevOwner,
        result: setFlag === 1 ? "set" : "conflict",
      });

      return { ok: setFlag === 1, remainingSeconds: remaining, owner: prevOwner };
    } catch (err) {
      console.error("[cooldowns] Redis set error:", err && err.message ? err.message : err);
      // Fail-safe
      if (FAIL_SAFE_MODE === "allow") {
        auditLog({ event: "cooldown_set_fallback", player, action, resourceId, seconds, owner, nonce });
        return { ok: true, remainingSeconds: seconds, owner: null };
      }
      return { ok: false, remainingSeconds: Number.MAX_SAFE_INTEGER, owner: null };
    }
  } else {
    // In-memory fallback (not atomic across instances)
    const now = Date.now();
    const expiry = inMemory.get(key) || 0;
    if (expiry > now) {
      const remainingSeconds = Math.ceil((expiry - now) / 1000);
      auditLog({ event: "cooldown_conflict", player, action, resourceId, seconds, owner, nonce, prevOwner: null });
      return { ok: false, remainingSeconds, owner: null };
    }
    inMemory.set(key, now + seconds * 1000);
    auditLog({ event: "cooldown_set", player, action, resourceId, seconds, owner, nonce });
    return { ok: true, remainingSeconds: seconds, owner: null };
  }
};

/**
 * clearCooldown(player, action, resourceId)
 * - Admin or test helper
 */
exports.clearCooldown = async function (player, action, resourceId = null) {
  validatePlayer(player);
  validateAction(action);
  const key = buildKey(player, action, resourceId);
  if (redisClient) {
    try {
      await redisClient.del(key);
      auditLog({ event: "cooldown_cleared", player, action, resourceId });
      return { ok: true };
    } catch (err) {
      console.error("[cooldowns] Redis clear error:", err && err.message ? err.message : err);
      return { ok: false };
    }
  } else {
    inMemory.delete(key);
    auditLog({ event: "cooldown_cleared", player, action, resourceId });
    return { ok: true };
  }
};
