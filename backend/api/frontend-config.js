// backend/api/frontend-config.js
// Serves frontend configuration values from environment variables.
// Note: HF_API_KEY is exposed to the frontend because it's needed for
// client-side AI requests to Hugging Face. This is the same pattern as
// the original hardcoded approach, but now configurable via env vars.
// For higher security, consider proxying AI requests through the backend.

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  // Only expose configuration that is safe for the frontend
  // HF_API_KEY is needed by the Overseer personality AI for client-side requests
  const config = {
    overseer: {
      hfApiKey: process.env.HF_API_KEY || "",
      hfModel: process.env.HF_MODEL || "mistralai/Mixtral-8x7B-Instruct-v0.1",
    },
  };

  res.json(config);
});

module.exports = router;
