// backend/api/location-claim.js
const express = require("express");
const router = express.Router();
const redis = require("../redis");

// Very simple placeholder; you can expand this
router.post("/claim", async (req, res) => {
  const { wallet, poiId, lat, lng } = req.body;
  if (!wallet || !poiId || lat == null || lng == null) {
    return res.status(400).json({ ok: false, error: "wallet, poiId, lat, lng required" });
  }

  // TODO: distance check vs POI coords
  // TODO: cooldowns, rewards, XP, caps

  const key = `player:${wallet}:claimed`;
  await redis.sadd(key, poiId);

  res.json({ ok: true, poiId });
});

module.exports = router;
