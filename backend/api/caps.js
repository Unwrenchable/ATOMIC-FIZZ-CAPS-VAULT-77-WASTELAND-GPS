// backend/api/caps.js
// ------------------------------------------------------------
// Atomic Fizz Caps – IN-GAME Caps API
// Awards in-game caps (virtual currency) to players
// Mounted at /api/caps
// ------------------------------------------------------------
// 
// ⚠️ IMPORTANT: This API manages IN-GAME caps (virtual game currency)
// NOT the actual AFC token. The real token has FIXED SUPPLY on mainnet.
// See the distinction in backend/lib/caps.js
// ------------------------------------------------------------

const crypto = require("crypto");
const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { awardCapsToPlayer, getCapsBalance } = require("../lib/caps");

// Per-route limiter for admin caps endpoints
const capsAwardLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5,
  message: { ok: false, error: "Too many caps requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Verify the request carries a valid ADMIN_MINT_SECRET header.
// Uses constant-time comparison to prevent timing attacks.
function requireAdminSecret(req, res, next) {
  const adminSecret = process.env.ADMIN_MINT_SECRET || "";
  const supplied = req.headers["x-admin-mint"] || req.body?.adminSecret || "";
  if (!adminSecret || !supplied) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  const h1 = crypto.createHash("sha256").update(String(adminSecret)).digest();
  const h2 = crypto.createHash("sha256").update(String(supplied)).digest();
  if (!crypto.timingSafeEqual(h1, h2)) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  next();
}

// POST /api/caps/award - Admin-only: award in-game caps to a specific wallet.
// SECURITY: requires ADMIN_MINT_SECRET header. Players must never be able to
// call this endpoint directly — caps are awarded server-side as a side-effect
// of verified game events (quest completion, location claim, battle victory).
router.post("/award", requireAdminSecret, capsAwardLimiter, async (req, res) => {
  try {
    const { wallet, amount } = req.body;

    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
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

    const result = await awardCapsToPlayer(wallet, amount);

    return res.json({ 
      ok: true, 
      newBalance: result.newBalance,
      txId: result.txId
    });
  } catch (err) {
    console.error("[caps] award error:", err);
    return res.status(500).json({ ok: false, error: "Failed to award caps" });
  }
});

// POST /api/caps/mint - Admin-only alias for /award (kept for backward compat)
router.post("/mint", requireAdminSecret, capsAwardLimiter, async (req, res) => {
  try {
    const { wallet, amount } = req.body;

    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
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

    const result = await awardCapsToPlayer(wallet, amount);

    return res.json({ 
      ok: true, 
      newBalance: result.newBalance,
      txId: result.txId
    });
  } catch (err) {
    console.error("[caps] mint error:", err);
    return res.status(500).json({ ok: false, error: "Failed to award caps" });
  }
});

// GET /api/caps/:wallet - Get player's in-game caps balance
router.get("/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;

    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid wallet" });
    }

    const balance = await getCapsBalance(wallet);
    return res.json({ ok: true, balance });
  } catch (err) {
    console.error("[caps] balance error:", err);
    return res.status(500).json({ ok: false, error: "Failed to get balance" });
  }
});

module.exports = router;
