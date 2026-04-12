// backend/api/transfer-fizz.js
// ------------------------------------------------------------
// Atomic Fizz Caps – In-game CAPS Transfer API
// Transfers in-game caps from the authenticated player to
// another player wallet.
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const { authMiddleware } = require("../lib/auth");
const { transferCaps } = require("../lib/caps");

const router = express.Router();

const transferLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { ok: false, error: "Too many transfer requests — take a breather, Wanderer." },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/transfer-fizz
// body: { to: string, amount: number }
// Authorization: Bearer <sessionId>
router.post("/", transferLimiter, authMiddleware, async (req, res) => {
  try {
    const fromWallet = req.player.wallet; // always from the authenticated session
    const { to, amount } = req.body || {};

    if (!to || typeof to !== "string" || to.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid recipient wallet address." });
    }

    // Basic base58 wallet address sanity-check (Solana public keys are 32–44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(to)) {
      return res.status(400).json({ ok: false, error: "Recipient address is not a valid Solana wallet." });
    }

    if (fromWallet.toLowerCase() === to.toLowerCase()) {
      return res.status(400).json({ ok: false, error: "Vault Tec regulations prohibit transferring caps to yourself." });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !Number.isInteger(parsedAmount)) {
      return res.status(400).json({ ok: false, error: "Amount must be a positive whole number of CAPS." });
    }

    const result = await transferCaps(fromWallet, to, parsedAmount);

    console.log(`[transfer-fizz] ${fromWallet} → ${to}: ${parsedAmount} CAPS`);

    return res.json({
      ok: true,
      from: fromWallet,
      to,
      amount: parsedAmount,
      fromBalance: result.fromBalance,
      toBalance: result.toBalance,
    });
  } catch (err) {
    console.error("[transfer-fizz] error:", err);

    if (err.message === "Insufficient caps") {
      return res.status(400).json({ ok: false, error: "Not enough CAPS in your account, Wanderer." });
    }
    if (err.message === "Transfer already in progress — please retry") {
      return res.status(429).json({ ok: false, error: "Transfer already in progress — please retry." });
    }

    return res.status(500).json({ ok: false, error: "CAPS transfer failed. The wasteland is unstable." });
  }
});

module.exports = router;
