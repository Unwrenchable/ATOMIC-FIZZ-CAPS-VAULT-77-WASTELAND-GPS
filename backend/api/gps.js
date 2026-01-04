const router = require("express").Router();
const { isWithinDistance } = require("../lib/gps");

router.post("/api/gps/validate", (req, res) => {
  const { playerLat, playerLng, targetLat, targetLng } = req.body;
  const ok = isWithinDistance(playerLat, playerLng, targetLat, targetLng);
  res.json({ ok });
});

module.exports = router;
