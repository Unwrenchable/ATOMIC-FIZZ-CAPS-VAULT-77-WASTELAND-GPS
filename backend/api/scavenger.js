const express = require("express");
const fs = require("fs");
const router = express.Router();
const { resolveDataFile } = require("../lib/data-paths");

// Canonical catalog is frontend/data/scavenger.json.
// public/data/ is a legacy path that is not in this repo, so sendFile 500'd.
router.get("/", (req, res) => {
  const file = resolveDataFile("scavenger.json");
  if (!fs.existsSync(file)) {
    console.error("[api/scavenger] missing scavenger.json, last candidate:", file);
    return res.status(500).json({ ok: false, error: "Scavenger not available" });
  }
  res.type("application/json");
  return res.sendFile(file, (err) => {
    if (err) {
      console.error("[api/scavenger] sendFile error:", err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: "Scavenger not available" });
    }
  });
});

module.exports = router;
