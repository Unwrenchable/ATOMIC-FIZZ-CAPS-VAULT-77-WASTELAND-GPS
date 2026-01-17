// backend/lib/gps.js

const redis = require("../redis");

async function updateLocation(player, lat, lng) {
  if (!player || !player.wallet) {
    throw new Error("missing player");
  }

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    throw new Error("invalid coordinates");
  }

  const key = `player:${player.wallet}`;
  const raw = await redis.hget(key, "profile");
  if (!raw) throw new Error("player not found");

  const profile = JSON.parse(raw);
  profile.lastLocation = {
    lat,
    lng,
    updatedAt: Date.now(),
  };

  await redis.hset(key, "profile", JSON.stringify(profile));

  return {
    ok: true,
    lastLocation: profile.lastLocation,
  };
}

module.exports = {
  updateLocation,
};
