const express = require("express");
const fs = require("fs");
const router = express.Router();
const { resolveDataFile } = require("../lib/data-paths");

// Canonical catalog is frontend/data/settings.json.
// public/data/ is a legacy path that is not in this repo, so sendFile 500'd.
router.get("/", (req, res) => {
  const file = resolveDataFile("settings.json");
  if (!fs.existsSync(file)) {
    console.error("[api/settings] missing settings.json, last candidate:", file);
    return res.status(500).json({ ok: false, error: "Settings not available" });
  }
  res.type("application/json");
  return res.sendFile(file, (err) => {
    if (err) {
      console.error("[api/settings] sendFile error:", err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: "Settings not available" });
    }
  });
});

module.exports = router;
