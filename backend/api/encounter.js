"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { handleEncounterCheck } = require("../encounters/controller");

const router = express.Router();

const encounterLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 30,
  message: { ok: false, error: "Pip-Boy chatter overload. Hold position a moment." },
  standardHeaders: true,
  legacyHeaders: false
});

router.post("/check", encounterLimiter, handleEncounterCheck);

module.exports = router;
