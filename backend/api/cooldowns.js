const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const cooldowns = require("../lib/cooldowns");
const { redis, key } = require("../lib/redis");

// Mounted at /api/cooldowns

// Solana base58 wallet address: 32-44 alphanumeric chars (no 0, O, I, l)
const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// POI IDs are short alphanumeric/hyphen/underscore strings
const POI_RE = /^[a-zA-Z0-9_\-]{1,128}$/;

// GET /api/cooldowns/status — public endpoint to check POI claim cooldown for a wallet.
// No auth required: cooldown state is not sensitive (it just tells you if a POI is claimable).
// Query params: wallet (required), poi (required)
router.get("/status", async (req, res) => {
  try {
    const { wallet, poi } = req.query;

    if (!wallet || !WALLET_RE.test(wallet)) {
      return res.status(400).json({ ok: false, error: "Missing or invalid wallet" });
    }
    if (!poi || !POI_RE.test(poi)) {
      return res.status(400).json({ ok: false, error: "Missing or invalid poi" });
    }

    // POI claim cooldown key: afw:player:{wallet}:cooldown:{poi}
    // NOTE: redis.get() applies the afw: prefix internally via key() — pass bare string
    const raw = await redis.get(`player:${wallet}:cooldown:${poi}`);
    const onCooldown = raw !== null && raw !== undefined;

    // secondsRemaining: null when on cooldown but TTL is unknown (key will auto-expire via Redis EX)
    const secondsRemaining = onCooldown ? null : 0;

    return res.json({ ok: true, onCooldown, secondsRemaining });
  } catch (err) {
    console.error("[api/cooldowns] status error:", err && err.stack ? err.stack : err);
    return res.status(500).json({ ok: false, error: "Failed to check cooldown" });
  }
});

router.post("/check", authMiddleware, async (req, res) => {
  try {
    const player = req.player;
    const { action } = req.body;

    if (!player || !player.wallet) {
      return res.status(401).json({ error: "Unauthorized: missing player" });
    }

    if (!action || typeof action !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'action' in request body" });
    }

    const result = await cooldowns.check(player, action);
    return res.json(result);
  } catch (err) {
    console.error("[api/cooldowns] check error:", err && err.stack ? err.stack : err);
    return res.status(400).json({ error: err?.message || "Cooldown check failed" });
  }
});

module.exports = router;

