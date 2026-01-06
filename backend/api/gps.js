// backend/api/gps.js
const router = require("express").Router();
const { authMiddleware } = require("../lib/auth");
const { isWithinDistanceToPoi, getPoi } = require("../lib/gps"); // note: exports used above
// If your module exports named functions differently, adjust imports accordingly.

router.post("/api/gps/validate", authMiddleware, (req, res) => {
  try {
    // Expect client to send only player coordinates and poiId
    const { playerLat, playerLng, poiId } = req.body;

    // Basic validation
    if (typeof playerLat !== "number" || typeof playerLng !== "number" || !poiId) {
      return res.status(400).json({ ok: false, error: "Invalid parameters" });
    }

    // Use server-side POI coordinates via gps.isWithinDistanceToPoi
    const result = require("../lib/gps").isWithinDistanceToPoi(playerLat, playerLng, poiId);
    // result: { ok: boolean, distance: number }
    res.json({ ok: result.ok, distanceMeters: result.distance });
  } catch (err) {
    console.error("[gps] validate error:", err && err.message ? err.message : err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
