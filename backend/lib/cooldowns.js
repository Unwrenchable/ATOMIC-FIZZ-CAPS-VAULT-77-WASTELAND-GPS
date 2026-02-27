// backend/lib/cooldowns.js

const redis = require('./redis');

async function check(player, action) {
  if (!player || !player.wallet) {
    throw new Error("missing player");
  }
  if (!action) {
    throw new Error("missing action");
  }

  const key = `cooldown:${player.wallet}:${action}`;
  const now = Date.now();

  const last = await redis.get(key);
  if (last) {
    const diff = now - Number(last);
    if (diff < 5000) {
      // 5 second cooldown example
      throw new Error("action on cooldown");
    }
  }

  // BUG FIX: was calling redis.set(key, now) without an expiry, leaving cooldown
  // keys in Redis permanently (they only "expire" logically when the 5s diff passes,
  // but the key is never cleaned up). Add EX so keys self-clean after the cooldown
  // window (10 seconds — slightly longer than the 5s threshold for safety).
  await redis.set(key, now.toString(), { EX: 10 });
  return { ok: true };
}

module.exports = {
  check
};
