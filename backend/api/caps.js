// backend/api/caps.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Caps Minting API
// Mints caps to a player in a controlled, rate-limited way
// Mounted at /api/caps
// ------------------------------------------------------------

const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { mintCapsToPlayer } = require("../lib/caps");

// Per-route limiter: caps minting is value-bearing
const capsMintLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5,
  message: { ok: false, error: "Too many caps mint requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/caps/mint
router.post("/mint", capsMintLimiter, async (req, res) => {
  try {
    const { player, amount } = req.body;

    // Basic validation
    if (!player || typeof player !== "string" || player.length > 128) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid or missing player" });
    }

    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1_000_000
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid amount" });
    }

    const sig = await mintCapsToPlayer(player.trim(), amount);

    return res.json({ ok: true, signature: sig });
  } catch (err) {
    console.error("[caps] mint error:", err);
    return res.status(500).json({ ok: false, error: "Failed to mint caps" });
  }
});

module.exports = router;
