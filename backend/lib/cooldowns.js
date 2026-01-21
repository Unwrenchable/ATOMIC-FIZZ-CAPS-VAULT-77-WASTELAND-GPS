// backend/lib/cooldowns.js

const redis = require('./lib/redis');

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

  await redis.set(key, now);
  return { ok: true };
}

module.exports = {
  check
};
