// backend/api/locations.js
const express = require("express");
const path = require("path");
const router = express.Router();

let locationsLib = null;
try {
  // prefer a server-side lib if you have one
  locationsLib = require("../lib/locations");
} catch (e) {
  locationsLib = null;
}

// GET /api/locations
router.get("/", async (req, res) => {
  try {
    if (locationsLib && typeof locationsLib.list === "function") {
      const list = await locationsLib.list();
      return res.json(list);
    }

    // fallback: serve static JSON file from public/data/locations.json
    const filePath = path.join(__dirname, "..", "..", "public", "data", "locations.json");
    return res.sendFile(filePath, (err) => {
      if (err) {
        console.error("[api/locations] failed to send static file:", err);
        return res.status(500).json({ error: "Locations not available" });
      }
    });
  } catch (err) {
    console.error("[api/locations] error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
