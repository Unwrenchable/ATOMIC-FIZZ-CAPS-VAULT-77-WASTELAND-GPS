// backend/api/mintables.js
const express = require("express");
const path = require("path");
const router = express.Router();

let mintablesLib = null;
try {
  mintablesLib = require("../lib/mintables");
} catch (e) {
  mintablesLib = null;
}

router.get("/", async (req, res) => {
  try {
    if (mintablesLib && typeof mintablesLib.list === "function") {
      const list = await mintablesLib.list();
      return res.json(list);
    }
    const filePath = path.join(__dirname, "..", "..", "public", "data", "mintables.json");
    return res.sendFile(filePath, (err) => {
      if (err) {
        console.error("[api/mintables] sendFile error:", err);
        return res.status(500).json({ error: "Mintables not available" });
      }
    });
  } catch (err) {
    console.error("[api/mintables] error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
