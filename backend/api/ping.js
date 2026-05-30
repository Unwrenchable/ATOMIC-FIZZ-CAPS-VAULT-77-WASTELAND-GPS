// backend/api/ping.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Ping / Liveness Endpoint
// Mounted at /api/ping
// ------------------------------------------------------------

"use strict";

const router = require("express").Router();

// GET /api/ping — fast liveness check, no auth required.
// Returns JSON so monitoring tools and smoke tests can confirm the
// backend is alive and not accidentally serving the frontend.
router.get("/", (req, res) => {
  res.json({
    ok: true,
    pong: true,
    time: new Date().toISOString(),
    vault: "77",
  });
});

module.exports = router;
