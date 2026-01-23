// backend/api/adminPlayer.js
// Admin-only player tools (mounted under /api/admin/player)

const express = require("express");
const router = express.Router();
const { redis, key } = require("../lib/redis");
const { requireAdmin, adminRateLimiter } = require("../middleware/adminAuth");

// Apply admin auth and rate limiting to all routes in this router
router.use(adminRateLimiter);
router.use(requireAdmin);

const DEFAULT_SPECIAL = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };

async function loadProfile(wallet) {
  try {
    const raw = await redis.hget(key(`player:${wallet}`), "profile");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[adminPlayer] loadProfile error:", err);
    return null;
  }
}

async function saveProfile(wallet, profile) {
  try {
    await redis.hset(key(`player:${wallet}`), "profile", JSON.stringify(profile));
  } catch (err) {
    console.error("[adminPlayer] saveProfile error:", err);
  }
}

// GET /api/admin/player/search?wallet=...
router.get("/search", async (req, res) => {
  try {
    const wallet = (req.query.wallet || "").trim();
    if (!wallet || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "invalid_wallet" });
    }

    const profile = await loadProfile(wallet);
    if (!profile) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    return res.json({ ok: true, wallet, profile });
  } catch (err) {
    console.error("[adminPlayer] search error:", err);
    return res.status(500).json({ ok: false, error: "search_failed" });
  }
});

// POST /api/admin/player/update
router.post("/update", async (req, res) => {
  try {
    const { wallet, updates } = req.body || {};
    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "invalid_wallet" });
    }

    const profile = await loadProfile(wallet);
    if (!profile) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    if (updates) {
      if (typeof updates.name === "string") profile.name = updates.name.trim().slice(0, 32);
      if (typeof updates.caps === "number") profile.caps = Math.max(0, updates.caps);
      if (typeof updates.xp === "number") profile.xp = Math.max(0, updates.xp);
      if (typeof updates.level === "number") profile.level = Math.max(1, updates.level);
      if (typeof updates.unlockedTerminal === "boolean") profile.unlockedTerminal = updates.unlockedTerminal;
      if (updates.special && typeof updates.special === "object") {
        profile.special = {
          S: Number(updates.special.S ?? profile.special.S ?? DEFAULT_SPECIAL.S),
          P: Number(updates.special.P ?? profile.special.P ?? DEFAULT_SPECIAL.P),
          E: Number(updates.special.E ?? profile.special.E ?? DEFAULT_SPECIAL.E),
          C: Number(updates.special.C ?? profile.special.C ?? DEFAULT_SPECIAL.C),
          I: Number(updates.special.I ?? profile.special.I ?? DEFAULT_SPECIAL.I),
          A: Number(updates.special.A ?? profile.special.A ?? DEFAULT_SPECIAL.A),
          L: Number(updates.special.L ?? profile.special.L ?? DEFAULT_SPECIAL.L),
        };
      }
    }

    await saveProfile(wallet, profile);
    console.log("[adminPlayer] Player %s updated by admin:", wallet, updates);
    return res.json({ ok: true, wallet, profile });
  } catch (err) {
    console.error("[adminPlayer] update error:", err);
    return res.status(500).json({ ok: false, error: "update_failed" });
  }
});

// POST /api/admin/player/reset
router.post("/reset", async (req, res) => {
  try {
    const { wallet } = req.body || {};
    if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
      return res.status(400).json({ ok: false, error: "invalid_wallet" });
    }

    const profile = await loadProfile(wallet);
    if (!profile) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const resetProfile = {
      name: "WANDERER",
      special: { ...DEFAULT_SPECIAL },
      level: 1,
      xp: 0,
      caps: 0,
      claimed: [],
      quests: {},
      unlockedTerminal: false,
    };

    await saveProfile(wallet, resetProfile);
    console.log(`[adminPlayer] Player ${wallet} reset by admin`);
    return res.json({ ok: true, wallet, profile: resetProfile });
  } catch (err) {
    console.error("[adminPlayer] reset error:", err);
    return res.status(500).json({ ok: false, error: "reset_failed" });
  }
});

module.exports = router;
