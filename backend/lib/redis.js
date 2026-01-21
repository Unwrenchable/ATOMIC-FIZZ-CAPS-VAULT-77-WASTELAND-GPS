// backend/lib/redis.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Redis Client Wrapper
// Resilient connector: uses real Redis when available, falls back
// to a small in-memory store when Redis is not configured or fails.
// Exports a consistent API so the rest of the codebase can use it
// without change: redis, key, getJSON, setJSON.
// ------------------------------------------------------------

const PREFIX = process.env.REDIS_PREFIX || "afw:";
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS || null;

let redisClient = null;
let usingFallback = false;

/**
 * In-memory fallback implementation that mirrors the minimal async
 * Redis API used by the app (get, set, del, incr, expire, smembers, sadd, srem).
 * This is intentionally simple and not a full Redis replacement.
 */
function createInMemoryClient() {
  const store = new Map();
  const sets = new Map();

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
      // support both redis.set(key, value) and redis.set(key, value, { EX: seconds })
      const val = toStr(value);
      store.set(key, val);
      if (opts && opts.EX) {
        setTimeout(() => store.delete(key), Number(opts.EX) * 1000);
      }
      return "OK";
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
    async incr(key) {
      const cur = parseInt(store.get(key) || "0", 10) + 1;
      store.set(key, String(cur));
      return cur;
    },
    async expire(key, seconds) {
      if (!store.has(key)) return 0;
      setTimeout(() => store.delete(key), Number(seconds) * 1000);
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
    on() { /* noop for events */ },
    quit() { return Promise.resolve(); },
    ping() { return Promise.resolve("PONG"); }
  };
}

/**
 * Initialize a real Redis client if REDIS_URL is provided.
 * If initialization fails, fall back to the in-memory client.
 */
async function initClient() {
  if (!REDIS_URL) {
    usingFallback = true;
    redisClient = createInMemoryClient();
    console.warn("[redis] REDIS_URL not set — using in-memory fallback (not for production)");
    return redisClient;
  }

  try {
    // Try to use node-redis (v4+) if available
    const { createClient } = require("redis");

    const client = createClient({
      url: REDIS_URL,
      socket: {
        // reconnectStrategy receives the number of retries and should return delay in ms
        reconnectStrategy: (retries) => {
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

    // Attempt to connect; if it fails we'll catch and fallback
    await client.connect();

    // If connect succeeded, use this client
    usingFallback = false;
    redisClient = client;
    return redisClient;
  } catch (err) {
    console.error("[redis] connection failed — falling back to in-memory store", err && err.message ? err.message : err);
    usingFallback = true;
    redisClient = createInMemoryClient();
    return redisClient;
  }
}

// Kick off initialization immediately but export functions that will
// wait for the client to be ready if necessary.
const initPromise = initClient();

/* Helper to ensure the client is ready before calling methods */
async function ensureClient() {
  if (redisClient) return redisClient;
  await initPromise;
  return redisClient;
}

// ------------------------------------------------------------
// Key helpers and JSON helpers (safe wrappers)
// ------------------------------------------------------------
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
      // If stored value is plain string, return it as-is
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
    // Support both node-redis v4 signature and fallback options object
    if (client.isFallback) {
      // our fallback expects set(key, value, opts)
      return await client.set(key(k), payload, opts);
    } else {
      // node-redis v4 supports set(key, value, { EX: seconds })
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

// Export the raw client (may be the fallback), helpers, and a small API
module.exports = {
  // Promise that resolves when initialization completes
  _init: initPromise,
  // The live client (may be null until init completes); callers should await _init or use ensureClient
  get client() { return redisClient; },
  usingFallback: () => usingFallback,
  redis: {
    // Provide thin wrappers so existing code that expects `redis.get(...)` still works.
    get: async (k) => {
      const c = await ensureClient();
      return c.get(k);
    },
    set: async (k, v, opts) => {
      const c = await ensureClient();
      // If opts is an object (fallback), pass it through; otherwise try to map
      if (opts && typeof opts === "object") {
        return c.set(k, v, opts);
      }
      return c.set(k, v);
    },
    del: async (k) => {
      const c = await ensureClient();
      return c.del(k);
    },
    incr: async (k) => {
      const c = await ensureClient();
      return c.incr(k);
    },
    expire: async (k, s) => {
      const c = await ensureClient();
      return c.expire(k, s);
    },
    smembers: async (k) => {
      const c = await ensureClient();
      return c.smembers(k);
    },
    sadd: async (k, ...m) => {
      const c = await ensureClient();
      return c.sadd(k, ...m);
    },
    srem: async (k, ...m) => {
      const c = await ensureClient();
      return c.srem(k, ...m);
    },
    on: (ev, fn) => {
      // attach to underlying client if available
      if (redisClient && typeof redisClient.on === "function") {
        redisClient.on(ev, fn);
      }
    },
    quit: async () => {
      const c = await ensureClient();
      if (c && typeof c.quit === "function") return c.quit();
      return Promise.resolve();
    }
  },
  key,
  getJSON,
  setJSON
};
