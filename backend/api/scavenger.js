const express = require("express");
const path = require("path");
const router = express.Router();

router.get("/", (req, res) => {
  const file = path.join(__dirname, "..", "..", "public", "data", "scavenger.json");
  res.sendFile(file, (err) => {
    if (err) {
      console.error("[api/scavenger] sendFile error:", err);
      res.status(500).json({ error: "Scavenger not available" });
    }
  });
});

module.exports = router;
