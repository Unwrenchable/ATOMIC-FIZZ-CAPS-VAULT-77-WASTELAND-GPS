// backend/lib/redis.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Redis Client Wrapper
// Resilient connector: uses real Redis when available, falls back
// to a small in-memory store when Redis is not configured or fails.
// Exports a consistent API so the rest of the codebase can use it
// without change: get, set, hget, hset, del, incr, expire, smembers, sadd, srem, on, quit, ping, key, getJSON, setJSON.
// ------------------------------------------------------------

const PREFIX = process.env.REDIS_PREFIX || "afw:";
// Sanitize and validate REDIS_URL - trim whitespace and check protocol
let REDIS_URL = (process.env.REDIS_URL || process.env.REDIS || "").trim();
// Validate protocol if URL is provided
if (REDIS_URL && !REDIS_URL.startsWith("redis://") && !REDIS_URL.startsWith("rediss://")) {
  console.error(`[redis] INVALID REDIS_URL: must start with redis:// or rediss://, got: ${REDIS_URL.replace(/:[^:@]+@/, ':***@').substring(0, 50)}...`);
  REDIS_URL = null; // Invalidate malformed URL
}
// If URL is empty after trim, set to null
if (REDIS_URL === "") {
  REDIS_URL = null;
}
const NODE_ENV = process.env.NODE_ENV || "development";
// Default to false for better resilience - can be set to true for strict production environments
const REQUIRE_REDIS_IN_PRODUCTION = process.env.REQUIRE_REDIS_IN_PRODUCTION === "true";

let redisClient = null;
let usingFallback = false;

/**
 * In-memory fallback implementation that mirrors the minimal async
 * Redis API used by the app (get, set, del, incr, expire, smembers, sadd, srem, hget, hset).
 */
function createInMemoryClient() {
  const store = new Map(); // string -> string
  const sets = new Map(); // key -> Set
  const hashes = new Map(); // key -> Map(field -> value)
  const lists = new Map(); // key -> Array
  const streams = new Map(); // key -> Array of { id, data }
  let streamSeq = 0;

  function toStr(v) {
    if (v === undefined || v === null) return null;
    return typeof v === "string" ? v : JSON.stringify(v);
  }

  return {
    isFallback: true,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async set(key, value, opts) {
      const val = toStr(value);
      store.set(key, val);
      if (opts && opts.EX) {
        setTimeout(() => store.delete(key), Number(opts.EX) * 1000);
      }
      return "OK";
    },
    // List support
    async lPush(key, ...values) {
      const arr = lists.get(key) || [];
      values.forEach(v => arr.unshift(typeof v === 'string' ? v : JSON.stringify(v)));
      lists.set(key, arr);
      return arr.length;
    },
    async rPop(key) {
      const arr = lists.get(key) || [];
      const v = arr.pop();
      if (arr.length === 0) lists.delete(key);
      else lists.set(key, arr);
      return v || null;
    },
    // Stream support (very small subset): XADD + XREVRANGE + XREADGROUP/XAUTOCLAIM/XACK
    async xAdd(key, idPlaceholder, field, value) {
      streamSeq++;
      const id = `${Date.now()}-${streamSeq}`;
      const arr = streams.get(key) || [];
      arr.push({ id, data: { [field]: value } });
      streams.set(key, arr);
      return id;
    },
    async xRevRange(key) {
      const arr = streams.get(key) || [];
      if (!arr.length) return [];
      const last = arr[arr.length - 1];
      return [[last.id, Object.entries(last.data).flat()]];
    },
    // basic sendCommand shim for XADD/XREVRANGE/XREADGROUP/XACK/XAUTOCLAIM
    async sendCommand(cmd) {
      const c = (cmd[0] || '').toUpperCase();
      if (c === 'XADD') {
        const key = cmd[1];
        const field = cmd[3];
        const value = cmd[4];
        return this.xAdd(key, '*', field, value);
      }
      if (c === 'XREVRANGE') {
        const key = cmd[1];
        return this.xRevRange(key);
      }
      if (c === 'XACK') {
        // ignore in fallback
        return 1;
      }
      if (c === 'XGROUP' || c === 'XREADGROUP' || c === 'XAUTOCLAIM' || c === 'XREAD') {
        // Not fully supported in fallback; return null
        return null;
      }
      return null;
    },
    async del(key) {
      const removed = store.delete(key);
      hashes.delete(key);
      sets.delete(key);
      return removed ? 1 : 0;
    },
    async incr(key) {
      const cur = parseInt(store.get(key) || "0", 10) + 1;
      store.set(key, String(cur));
      return cur;
    },
    async expire(key, seconds) {
      if (!store.has(key) && !hashes.has(key) && !sets.has(key)) return 0;
      setTimeout(() => {
        store.delete(key);
        hashes.delete(key);
        sets.delete(key);
      }, Number(seconds) * 1000);
      return 1;
    },
    async smembers(key) {
      const s = sets.get(key);
      return s ? Array.from(s) : [];
    },
    async sadd(key, ...members) {
      const s = sets.get(key) || new Set();
      members.forEach(m => s.add(String(m)));
      sets.set(key, s);
      return s.size;
    },
    async srem(key, ...members) {
      const s = sets.get(key);
      if (!s) return 0;
      let removed = 0;
      members.forEach(m => { if (s.delete(String(m))) removed++; });
      if (s.size === 0) sets.delete(key);
      return removed;
    },
    // Hash support
    async hget(key, field) {
      const h = hashes.get(key);
      if (!h) return null;
      return h.has(field) ? h.get(field) : null;
    },
    async hset(key, field, value) {
      const h = hashes.get(key) || new Map();
      h.set(field, toStr(value));
      hashes.set(key, h);
      return 1;
    },
    on() { /* noop for events */ },
    quit() { return Promise.resolve(); },
    ping() { return Promise.resolve("PONG"); }
  };
}


/**
 * Initialize a real Redis client if REDIS_URL is provided.
 * If initialization fails, fall back to the in-memory client.
 *
 * WARNING: In-memory fallback is NOT suitable for production environments
 * as it will cause data consistency issues in distributed deployments
 * and data loss on server restarts.
 */
async function initClient() {
  if (!REDIS_URL) {
    // Emit strong warnings for production environments
    if (NODE_ENV === "production") {
      console.error("[redis] CRITICAL: REDIS_URL not set in production environment!");
      console.error("[redis] WARNING: In-memory fallback will cause:");
      console.error("[redis]   - Data inconsistency in distributed environments");
      console.error("[redis]   - Session/voucher replay protection failures");
      console.error("[redis]   - Data loss on server restarts");
      if (REQUIRE_REDIS_IN_PRODUCTION) {
        throw new Error("Redis is required in production. Set REDIS_URL or set REQUIRE_REDIS_IN_PRODUCTION=false to override (not recommended).");
      }
    }

    usingFallback = true;
    redisClient = createInMemoryClient();
    console.warn("[redis] REDIS_URL not set — using in-memory fallback (NOT FOR PRODUCTION)");
    return redisClient;
  }

  try {
    // Try to use node-redis (v4+) if available
    const { createClient } = require("redis");

    console.log(`[redis] attempting connection to ${REDIS_URL.replace(/:[^:@]+@/, ':***@')}`); // Mask password in logs

    const client = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: 5000, // 5 second timeout for initial connection
        reconnectStrategy: (retries) => {
          // Stop reconnecting after 3 attempts during initialization
          if (retries >= 3) {
            console.warn(`[redis] giving up after ${retries} reconnect attempts`);
            return false; // Stop reconnecting
          }
          const delay = Math.min(1000 * Math.pow(2, retries), 8000);
          console.warn(`[redis] reconnect attempt ${retries}, retrying in ${delay}ms`);
          return delay;
        }
      }
    });

    client.on("connect", () => console.log("[redis] connecting..."));
    client.on("ready", () => console.log("[redis] ready"));
    client.on("end", () => console.warn("[redis] connection closed"));
    client.on("reconnecting", () => console.warn("[redis] reconnecting..."));
    client.on("error", (err) => console.error("[redis] error:", err && err.message ? err.message : err));

    // Add a hard timeout wrapper to prevent hanging during initialization
    const connectWithTimeout = Promise.race([
      client.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timed out after 10 seconds')), 10000)
      )
    ]);

    await connectWithTimeout;

    usingFallback = false;
    redisClient = client;
    console.log("[redis] successfully connected");
    return redisClient;
  } catch (err) {
    const errorMsg = err && err.message ? err.message : String(err);
    const isAuthError = errorMsg.includes('NOAUTH') || errorMsg.includes('Authentication required') || errorMsg.includes('WRONGPASS');
    
    // Special handling for authentication errors
    if (isAuthError) {
      console.error("[redis] AUTHENTICATION ERROR: Redis requires password authentication!");
      console.error("[redis] Error:", errorMsg);
      console.error("[redis] REDIS_URL format (masked):", REDIS_URL ? REDIS_URL.replace(/:[^:@]+@/, ':***@') : "not set");
      console.error("[redis] ");
      console.error("[redis] To fix this, update your REDIS_URL to include authentication:");
      console.error("[redis]   Format: redis://username:password@host:port");
      console.error("[redis]   Example: redis://default:your_password@localhost:6379");
      console.error("[redis] ");
      console.error("[redis] If Redis has no password set, you can disable it with:");
      console.error("[redis]   redis-cli config set requirepass \"\"");
      console.error("[redis] ");
    }
    
    // Emit strong warnings for production environments
    if (NODE_ENV === "production") {
      console.error("[redis] CRITICAL: Redis connection failed in production environment!");
      if (!isAuthError) {
        console.error("[redis] Error:", errorMsg);
        console.error("[redis] REDIS_URL format (masked):", REDIS_URL ? REDIS_URL.replace(/:[^:@]+@/, ':***@') : "not set");
      }
      console.error("[redis] WARNING: Falling back to in-memory store will cause data consistency issues.");
      if (REQUIRE_REDIS_IN_PRODUCTION) {
        throw new Error("Redis connection failed in production. Fix Redis or set REQUIRE_REDIS_IN_PRODUCTION=false to override (not recommended).");
      }
    } else {
      console.error("[redis] connection failed — falling back to in-memory store");
      if (!isAuthError) {
        console.error("[redis] Error:", errorMsg);
        console.error("[redis] REDIS_URL format (masked):", REDIS_URL ? REDIS_URL.replace(/:[^:@]+@/, ':***@') : "not set");
      }
    }
    usingFallback = true;
    redisClient = createInMemoryClient();
    return redisClient;
  }
}

// Kick off initialization immediately
const initPromise = initClient();

async function ensureClient() {
  if (redisClient) return redisClient;
  try {
    await initPromise;
    return redisClient;
  } catch (err) {
    // Redis initialization failed critically - this should only happen
    // if REQUIRE_REDIS_IN_PRODUCTION=true and Redis connection failed
    console.error("[redis] ensureClient: Redis initialization failed:", err.message);
    throw new Error(`Redis not available: ${err.message}. Set REQUIRE_REDIS_IN_PRODUCTION=false to use fallback.`);
  }
}

// Key helpers and JSON helpers
function key(k) {
  return PREFIX + k;
}

async function getJSON(k) {
  try {
    const client = await ensureClient();
    const raw = await client.get(key(k));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return raw;
    }
  } catch (err) {
    console.error("[redis] getJSON error:", err && err.message ? err.message : err);
    return null;
  }
}

async function setJSON(k, value, opts = {}) {
  try {
    const client = await ensureClient();
    const payload = JSON.stringify(value);
    if (client.isFallback) {
      return await client.set(key(k), payload, opts);
    } else {
      if (opts.EX) {
        return await client.set(key(k), payload, { EX: opts.EX });
      }
      return await client.set(key(k), payload);
    }
  } catch (err) {
    console.error("[redis] setJSON error:", err && err.message ? err.message : err);
    return null;
  }
}

// Helper to detect and enhance authentication errors
function handleRedisError(err, operation) {
  const errorMsg = err && err.message ? err.message : String(err);
  const isAuthError = errorMsg.includes('NOAUTH') || errorMsg.includes('Authentication required') || errorMsg.includes('WRONGPASS');
  
  if (isAuthError) {
    const enhancedError = new Error(
      `Redis authentication required. Update REDIS_URL to include password (format: redis://username:password@host:port). Original error: ${errorMsg}`
    );
    enhancedError.code = 'REDIS_AUTH_ERROR';
    enhancedError.originalError = err;
    throw enhancedError;
  }
  throw err;
}

// Top-level wrappers expected by the rest of the codebase
async function get(k) {
  try {
    const c = await ensureClient();
    return await c.get(key(k));
  } catch (err) {
    handleRedisError(err, 'get');
  }
}
async function set(k, v, opts) {
  try {
    const c = await ensureClient();
    if (c.isFallback) return c.set(key(k), v, opts);
    if (opts && opts.EX) return await c.set(key(k), v, { EX: opts.EX });
    return await c.set(key(k), v);
  } catch (err) {
    handleRedisError(err, 'set');
  }
}
async function del(k) {
  try {
    const c = await ensureClient();
    return await c.del(key(k));
  } catch (err) {
    handleRedisError(err, 'del');
  }
}
async function incr(k) {
  try {
    const c = await ensureClient();
    return await c.incr(key(k));
  } catch (err) {
    handleRedisError(err, 'incr');
  }
}
async function expire(k, s) {
  try {
    const c = await ensureClient();
    return await c.expire(key(k), s);
  } catch (err) {
    handleRedisError(err, 'expire');
  }
}
async function smembers(k) {
  try {
    const c = await ensureClient();
    return await c.smembers(key(k));
  } catch (err) {
    handleRedisError(err, 'smembers');
  }
}
async function sadd(k, ...m) {
  try {
    const c = await ensureClient();
    return await c.sadd(key(k), ...m);
  } catch (err) {
    handleRedisError(err, 'sadd');
  }
}
async function srem(k, ...m) {
  try {
    const c = await ensureClient();
    return await c.srem(key(k), ...m);
  } catch (err) {
    handleRedisError(err, 'srem');
  }
}
async function hget(k, field) {
  try {
    const c = await ensureClient();
    return await c.hget(key(k), field);
  } catch (err) {
    handleRedisError(err, 'hget');
  }
}
async function hset(k, field, value) {
  try {
    const c = await ensureClient();
    return await c.hset(key(k), field, value);
  } catch (err) {
    handleRedisError(err, 'hset');
  }
}
function on(ev, fn) {
  if (redisClient && typeof redisClient.on === "function") {
    redisClient.on(ev, fn);
  }
}
async function quit() {
  const c = await ensureClient();
  if (c && typeof c.quit === "function") return c.quit();
  return Promise.resolve();
}
async function ping() {
  const c = await ensureClient();
  if (c && typeof c.ping === "function") return c.ping();
  return Promise.resolve("PONG");
}

// Export the API expected by the codebase
module.exports = {
  // Promise that resolves when initialization completes
  _init: initPromise,
  // direct access to underlying client (may be null until init completes)
  get client() { return redisClient; },
  usingFallback: () => usingFallback,
  // top-level methods (so require('./redis') returns an object with get/set/hget/hset etc.)
  get,
  set,
  del,
  incr,
  expire,
  smembers,
  sadd,
  srem,
  hget,
  hset,
  on,
  quit,
  ping,
  // helpers
  key,
  getJSON,
  setJSON
};

// Also provide a `redis` named export and camelCase aliases expected by
// various modules in the codebase. Some files do `const { redis, key } = require('./redis')`
// or call `redis.hGet` / `redis.hSet` so we expose those names to remain
// backwards-compatible.
const redisWrapper = {
  _init: initPromise,
  get client() { return redisClient; },
  usingFallback: () => usingFallback,
  // lower-case
  get,
  set,
  del,
  incr,
  expire,
  smembers,
  sadd,
  srem,
  hget,
  hset,
  on,
  quit,
  ping,
  // helpers
  key,
  getJSON,
  setJSON,
};

// camelCase aliases (e.g. hGet/hSet) for modules that use different naming
redisWrapper.hGet = redisWrapper.hget;
redisWrapper.hSet = redisWrapper.hset;
redisWrapper.sMembers = redisWrapper.smembers;
redisWrapper.sAdd = redisWrapper.sadd;
redisWrapper.sRem = redisWrapper.srem;

// Attach to module.exports for backward compatibility
module.exports.redis = redisWrapper;
