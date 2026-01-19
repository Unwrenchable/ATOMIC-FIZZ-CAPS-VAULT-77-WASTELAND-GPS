// lib/redis.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Redis Client Wrapper
// Safe, shared Redis connection for all API routes
// ------------------------------------------------------------

const { createClient } = require("redis");

// Optional namespacing for all keys (helps avoid collisions)
const PREFIX = process.env.REDIS_PREFIX || "afw:";

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with a cap
      const delay = Math.min(1000 * Math.pow(2, retries), 8000);
      console.warn(`[redis] reconnect attempt ${retries}, retrying in ${delay}ms`);
      return delay;
    },
  },
});

// ------------------------------------------------------------
// Connection lifecycle logging
// ------------------------------------------------------------
redis.on("connect", () => console.log("[redis] connecting..."));
redis.on("ready", () => console.log("[redis] ready"));
redis.on("end", () => console.warn("[redis] connection closed"));
redis.on("reconnecting", () => console.log("[redis] reconnecting..."));
redis.on("error", (err) => console.error("[redis] error:", err));

// ------------------------------------------------------------
// Connect immediately
// ------------------------------------------------------------
(async () => {
  try {
    await redis.connect();
  } catch (err) {
    console.error("[redis] failed to connect:", err);
  }
})();

// ------------------------------------------------------------
// Safe helper wrappers (optional but extremely useful)
// ------------------------------------------------------------

// Prefix all keys automatically
function key(k) {
  return PREFIX + k;
}

async function getJSON(k) {
  try {
    const raw = await redis.get(key(k));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[redis] getJSON error:", err);
    return null;
  }
}

async function setJSON(k, value, opts = {}) {
  try {
    const payload = JSON.stringify(value);
    if (opts.EX) {
      return await redis.set(key(k), payload, { EX: opts.EX });
    }
    return await redis.set(key(k), payload);
  } catch (err) {
    console.error("[redis] setJSON error:", err);
  }
}

module.exports = {
  redis,
  key,
  getJSON,
  setJSON,
};
