// backend/api/frontend-config.js
// Serves frontend-safe configuration values.
// SECURITY: never expose server-side API secrets to browser clients.

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  const overseerMode = String(process.env.OVERSEER_MODE || "linked-ai").trim().toLowerCase();
  const realAiMode = String(
    process.env.OVERSEER_REALAI_MODE || process.env.REALAI_MODE || "local"
  )
    .trim()
    .toLowerCase();
  const safeMode = overseerMode === "linked-ai" ? "linked-ai" : "local-webllm";
  const defaultStatusLabel =
    safeMode === "local-webllm"
      ? "OVERSEER STANDBY // BROWSER-LOCAL WEBLLM CORE READY"
      : realAiMode === "cloud"
        ? "LINKED TO OVERSEER RELAY // CLOUD UPLINK STABLE"
        : "LINKED TO SELF-HOSTED OVERSEER RELAY // LOCAL REALAI CORE ACTIVE";
  const statusLabel = process.env.OVERSEER_STATUS_LABEL || defaultStatusLabel;

  // Only expose configuration that is safe for the frontend.
  // Overseer AI requests must route through /api/overseer/ask.
  const config = {
    overseer: {
      hfModel: process.env.HF_MODEL || "mistralai/Mixtral-8x7B-Instruct-v0.1",
      proxyEnabled: true,
      mode: safeMode,
      statusLabel,
    },
    capsMint: process.env.CAPS_MINT || process.env.TOKEN_MINT || "",
    treasuryWallet: process.env.TREASURY_WALLET || "",
    fizzFunProgramId: process.env.FIZZ_FUN_PROGRAM_ID || "GvTeKyGiFqtpJn2cJQxFb2iPVCYotvnMjMZKGAnPgZkc",
    solanaRpc: process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC || "https://api.devnet.solana.com",
  };

  res.json(config);
});

module.exports = router;
