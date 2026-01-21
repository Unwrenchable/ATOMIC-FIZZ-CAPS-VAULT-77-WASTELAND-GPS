const express = require("express");
const path = require("path");
const router = express.Router();

router.get("/", (req, res) => {
  const file = path.join(__dirname, "..", "..", "public", "data", "settings.json");
  res.sendFile(file, (err) => {
    if (err) {
      console.error("[api/settings] sendFile error:", err);
      res.status(500).json({ error: "Settings not available" });
    }
  });
});

module.exports = router;
