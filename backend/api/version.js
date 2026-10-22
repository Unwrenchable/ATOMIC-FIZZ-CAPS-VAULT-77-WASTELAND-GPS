// backend/api/version.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Version / Build Info Endpoint
// Mounted at /api/version
// ------------------------------------------------------------

"use strict";

const path = require("path");
const router = require("express").Router();

// Read version from root package.json once at startup.
let pkg = { name: "atomicfizzcaps", version: "unknown" };
try {
  pkg = require(path.join(__dirname, "..", "..", "package.json"));
} catch (_) {
  // fallback — non-fatal
}

// GET /api/version — returns version metadata for the deployed build.
// No auth required; used by smoke tests and monitoring dashboards.
router.get("/", (req, res) => {
  res.json({
    ok: true,
    name: pkg.name,
    version: pkg.version,
    env: process.env.NODE_ENV || "unknown",
    time: new Date().toISOString(),
  });
});

module.exports = router;
