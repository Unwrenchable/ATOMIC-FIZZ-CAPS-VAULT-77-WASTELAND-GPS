// backend/lib/xp.js

const redis = require('./redis');

async function awardXp(player, amount) {
  if (!player || !player.wallet) {
    throw new Error("missing player");
  }
  if (typeof amount !== "number" || amount <= 0) {
    throw new Error("invalid XP amount");
  }

  const key = `player:${player.wallet}`;
  const raw = await redis.hget(key, "profile");
  if (!raw) throw new Error("player not found");

  const profile = JSON.parse(raw);
  profile.xp = (profile.xp || 0) + amount;

  await redis.hset(key, "profile", JSON.stringify(profile));

  return { ok: true, xp: profile.xp };
}

module.exports = {
  awardXp
};
