// lib/redis.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Redis Client Wrapper
// Safe, shared Redis connection for all API routes
// ------------------------------------------------------------

const { createClient } = require("redis");

const redis = createClient({
  url: process.env.REDIS_URL,
});

// Log connection events
redis.on("error", (err) => {
  console.error("[redis] error:", err);
});

redis.on("connect", () => {
  console.log("[redis] connected");
});

redis.on("reconnecting", () => {
  console.log("[redis] reconnecting...");
});

// Connect immediately
(async () => {
  try {
    await redis.connect();
  } catch (err) {
    console.error("[redis] failed to connect:", err);
  }
})();

module.exports = redis;
