const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../../backend/lib/auth");
const gps = require("../../backend/lib/gps");

// Mounted at /api/gps
router.post("/update", authMiddleware, async (req, res) => {
  try {
    const player = req.player;
    const { lat, lng } = req.body;

    const result = await gps.updateLocation(player, lat, lng);
    res.json(result);
  } catch (err) {
    console.error("[api/gps] update error:", err?.message || err);
    res.status(400).json({ error: err.message || "Failed to update GPS" });
  }
});

module.exports = router;
