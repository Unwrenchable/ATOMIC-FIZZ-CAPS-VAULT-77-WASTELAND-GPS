// backend/api/frontend-config.js
// Serves frontend-safe configuration values.
// SECURITY: never expose server-side API secrets to browser clients.

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  // Only expose configuration that is safe for the frontend.
  // Overseer AI requests must route through /api/overseer/ask.
  const config = {
    overseer: {
      hfModel: process.env.HF_MODEL || "mistralai/Mixtral-8x7B-Instruct-v0.1",
      proxyEnabled: true,
    },
  };

  res.json(config);
});

module.exports = router;
