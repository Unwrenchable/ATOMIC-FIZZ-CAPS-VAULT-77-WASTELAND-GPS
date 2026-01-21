const express = require("express");
const path = require("path");
const router = express.Router();

router.get("/", (req, res) => {
  const file = path.join(__dirname, "..", "..", "public", "data", "locations.json");
  res.sendFile(file, (err) => {
    if (err) {
      console.error("[api/locations] sendFile error:", err);
      res.status(500).json({ error: "Locations not available" });
    }
  });
});

module.exports = router;
