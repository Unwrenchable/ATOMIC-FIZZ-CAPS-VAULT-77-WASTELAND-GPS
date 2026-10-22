"use strict";
// Per-route limiters, tighter than the global /api limiter in server.js.
const rateLimit = require("express-rate-limit");

// Static catalog reads (settings, mintables, scavenger, quest list): 60 req/min per IP.
const catalogReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests" },
});

module.exports = { catalogReadLimiter };
