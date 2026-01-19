// backend/api/player.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Player Profile API
// Mounted at /api/player
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { redis, key } = require("../lib/redis");

const DEFAULT_SPECIAL = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };

// ------------------------------------------------------------
// Per-route limiter (player profile is sensitive state)
// ------------------------------------------------------------
const playerLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 20,
  message: { ok: false, error: "Too many player requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// Redis helpers
// ------------------------------------------------------------
async function loadProfile(wallet) {
  try {
    const raw = await redis.hGet(key(`player:${wallet}`), "profile");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[player] loadProfile error:", err);
    return null;
  }
}

async function saveProfile(wallet, profile) {
  try {
    await redis.hSet(key(`player:${wallet}`), "profile", JSON.stringify(profile));
  } catch (err) {
    console.error("[player] saveProfile error:", err);
  }
}

// ------------------------------------------------------------
// POST /api/player/create
// ------------------------------------------------------------
router.post("/create", playerLimiter, async (req, res) => {
  try {
    const { wallet, name } = req.body;

    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    const existing = await loadProfile(wallet);
    if (existing) {
      return res.json({ ok: true, profile: existing });
    }

    const profile = {
      name: typeof name === "string" && name.trim().length > 0 ? name.trim() : "WANDERER",
      special: { ...DEFAULT_SPECIAL },
      level: 1,
      xp: 0,
      caps: 0,
      claimed: [],
      quests: {},
      unlockedTerminal: false,
    };

    await saveProfile(wallet, profile);
    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("[player] create error:", err);
    return res.status(500).json({ ok: false, error: "Failed to create profile" });
  }
});

// ------------------------------------------------------------
// GET /api/player/:wallet
// ------------------------------------------------------------
router.get("/:wallet", playerLimiter, async (req, res) => {
  try {
    const wallet = req.params.wallet;

    if (!wallet || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    const profile = await loadProfile(wallet);
    if (!profile) {
      return res.status(404).json({ ok: false, error: "not found" });
    }

    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("[player] load error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load profile" });
  }
});

// ------------------------------------------------------------
// POST /api/player/special/update
// ------------------------------------------------------------
router.post("/special/update", playerLimiter, async (req, res) => {
  try {
    const { wallet, special } = req.body;

    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    if (!special || typeof special !== "object") {
      return res.status(400).json({ ok: false, error: "Invalid special object" });
    }

    const profile = await loadProfile(wallet);
    if (!profile) return res.status(404).json({ ok: false, error: "not found" });

    profile.special = special;
    await saveProfile(wallet, profile);

    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("[player] special update error:", err);
    return res.status(500).json({ ok: false, error: "Failed to update SPECIAL" });
  }
});

// ------------------------------------------------------------
// POST /api/player/terminal/unlock
// ------------------------------------------------------------
router.post("/terminal/unlock", playerLimiter, async (req, res) => {
  try {
    const { wallet } = req.body;

    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    const profile = await loadProfile(wallet);
    if (!profile) return res.status(404).json({ ok: false, error: "not found" });

    profile.unlockedTerminal = true;
    await saveProfile(wallet, profile);

    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("[player] terminal unlock error:", err);
    return res.status(500).json({ ok: false, error: "Failed to unlock terminal" });
  }
});

// ------------------------------------------------------------
// POST /api/player/respec
// ------------------------------------------------------------
router.post("/respec", playerLimiter, async (req, res) => {
  try {
    const { wallet } = req.body;

    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    const profile = await loadProfile(wallet);
    if (!profile) return res.status(404).json({ ok: false, error: "not found" });

    // TODO: real NFT check
    const ownsToken = false;
    if (!ownsToken) {
      return res.status(403).json({ ok: false, error: "no recalibration token" });
    }

    profile.special = { ...DEFAULT_SPECIAL };
    await saveProfile(wallet, profile);

    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("[player] respec error:", err);
    return res.status(500).json({ ok: false, error: "Failed to respec SPECIAL" });
  }
});

module.exports = router;
