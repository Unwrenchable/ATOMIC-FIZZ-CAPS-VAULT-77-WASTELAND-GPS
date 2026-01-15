// backend/lib/gps.js

const redis = require('../redis');

async function updateLocation(player, lat, lng) {
  if (!player || !player.wallet) {
    throw new Error("missing player");
  }
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("invalid coordinates");
  }

  const key = `player:${player.wallet}`;
  const raw = await redis.hget(key, "profile");
  if (!raw) throw new Error("player not found");

  const profile = JSON.parse(raw);
  profile.location = { lat, lng };

  await redis.hset(key, "profile", JSON.stringify(profile));

  return { ok: true, location: profile.location };
}

module.exports = {
  updateLocation
};
