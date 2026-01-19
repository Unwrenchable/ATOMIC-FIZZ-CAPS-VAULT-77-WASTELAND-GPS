// backend/redis.js
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
});

redis.on("connect", () => console.log("[redis] connected"));
redis.on("ready", () => console.log("[redis] ready"));
redis.on("error", (err) => console.error("[redis] error", err));
redis.on("end", () => console.warn("[redis] connection closed"));

module.exports = redis;
