const fs = require("fs");
const path = require("path");
const express = require("express");
const router = express.Router();

function readDirRecursive(dir, base = dir) {
  let result = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      result = result.concat(readDirRecursive(full, base));
    } else {
      const rel = path.relative(base, full);
      const content = fs.readFileSync(full, "utf8");
      result.push({ file: rel, content });
    }
  }
  return result;
}

router.get("/", (req, res) => {
  try {
    const repoRoot = path.join(__dirname, "..", "..");
    const snapshot = readDirRecursive(repoRoot);
    res.json({ ok: true, snapshot });
  } catch (err) {
    console.error("[repo-snapshot]", err);
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
