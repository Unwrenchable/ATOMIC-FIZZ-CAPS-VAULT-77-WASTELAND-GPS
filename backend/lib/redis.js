// backend/lib/redis.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Redis Client Wrapper
// Resilient connector: uses real Redis when available, falls back
// to a small in-memory store when Redis is not configured or fails.
// Exports a consistent API so the rest of the codebase can use it
// without change: get, set, hget, hset, del, incr, expire, smembers, sadd, srem, on, quit, ping, key, getJSON, setJSON.
// ------------------------------------------------------------

const PREFIX = process.env.REDIS_PREFIX || "afw:";
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS || null;

let redisClient = null;
let usingFallback = false;

/**
 * In-memory fallback implementation that mirrors the minimal async
 * Redis API used by the app (get, set, del, incr, expire, smembers, sadd, srem, hget, hset).
 */
function createInMemoryClient() {
  const store = new Map(); // string -> string
  const sets = new Map();  // key -> Set
  const hashes = new Map(); // key -> Map(field -> value)

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

    await client.connect();

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

// Kick off initialization immediately
const initPromise = initClient();

async function ensureClient() {
  if (redisClient) return redisClient;
  await initPromise;
  return redisClient;
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

// Top-level wrappers expected by the rest of the codebase
async function get(k) {
  const c = await ensureClient();
  return c.get(key(k));
}
async function set(k, v, opts) {
  const c = await ensureClient();
  if (c.isFallback) return c.set(key(k), v, opts);
  if (opts && opts.EX) return c.set(key(k), v, { EX: opts.EX });
  return c.set(key(k), v);
}
async function del(k) {
  const c = await ensureClient();
  return c.del(key(k));
}
async function incr(k) {
  const c = await ensureClient();
  return c.incr(key(k));
}
async function expire(k, s) {
  const c = await ensureClient();
  return c.expire(key(k), s);
}
async function smembers(k) {
  const c = await ensureClient();
  return c.smembers(key(k));
}
async function sadd(k, ...m) {
  const c = await ensureClient();
  return c.sadd(key(k), ...m);
}
async function srem(k, ...m) {
  const c = await ensureClient();
  return c.srem(key(k), ...m);
}
async function hget(k, field) {
  const c = await ensureClient();
  return c.hget(key(k), field);
}
async function hset(k, field, value) {
  const c = await ensureClient();
  return c.hset(key(k), field, value);
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
