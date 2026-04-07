// backend/api/player.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Player Profile API
// Mounted at /api/player
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const redis = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");
const { checkNFTOwnership } = require("../lib/nfts");

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
// BUG FIX: removed key() wrapper — redis wrappers add afw: prefix internally.
// Passing key()-prefixed strings resulted in double-prefixed keys (afw:afw:...).
// ------------------------------------------------------------
async function loadProfile(wallet) {
  try {
    const raw = await redis.hget(`player:${wallet}`, "profile");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("[player] loadProfile error:", err);
    return null;
  }
}

async function saveProfile(wallet, profile) {
  try {
    await redis.hset(`player:${wallet}`, "profile", JSON.stringify(profile));
  } catch (err) {
    console.error("[player] saveProfile error:", err);
  }
}

// ------------------------------------------------------------
// POST /api/player/create
// ------------------------------------------------------------
router.post("/create", authMiddleware, playerLimiter, async (req, res) => {
  try {
    // BUG FIX: wallet sourced from verified session, not req.body, to prevent
    // an attacker from pre-creating a profile for a wallet they don't own.
    const wallet = req.player.wallet;
    const { name, special: incomingSpecial, background, traits } = req.body;
    const existing = await loadProfile(wallet);
    if (existing) {
      return res.json({ ok: true, profile: existing });
    }

    // ----------------------------------------------------------
    // Validate and sanitise SPECIAL allocation
    // Rules: each stat must be 1–10, total points ≤ 28 (7 base + 21 spend)
    // ----------------------------------------------------------
    const SPECIAL_KEYS = ["S", "P", "E", "C", "I", "A", "L"];
    // Max total = 7 minimum (1 each) + 21 allocation points.
    // Individual stat cap of 10 is enforced per-stat in the loop below (line 83-84)
    // before the sum check, so {S:1,...,L:22} is rejected by the per-stat guard first.
    const MAX_SPECIAL_TOTAL = 28;

    let chosenSpecial = { ...DEFAULT_SPECIAL };

    if (incomingSpecial && typeof incomingSpecial === "object") {
      let valid = true;
      let total = 0;
      const candidate = {};

      for (const stat of SPECIAL_KEYS) {
        const raw = incomingSpecial[stat];
        if (raw === undefined || raw === null) {
          candidate[stat] = 1; // default min if stat absent
        } else if (typeof raw !== "number" || !Number.isFinite(raw) ||
                   raw < 1 || raw > 10 || Math.floor(raw) !== raw) {
          valid = false;
          break;
        } else {
          candidate[stat] = Math.floor(raw);
        }
        total += candidate[stat];
      }

      if (valid && total <= MAX_SPECIAL_TOTAL) {
        chosenSpecial = candidate;
      } else {
        console.log("[player] create: incoming SPECIAL invalid (total=%d, valid=%s), using default", total, valid);
        // Silently fall back — don't error the player out of creation
      }
    }

    // ----------------------------------------------------------
    // Validate background (string from known list, or null)
    // We accept any short alphanumeric+underscore string — full
    // validation of IDs against the data file is not done server-
    // side here (it lives in public/data) but we sanitise strictly.
    // ----------------------------------------------------------
    let chosenBackground = null;
    if (typeof background === "string" && /^[a-z0-9_]{1,64}$/.test(background)) {
      chosenBackground = background;
    }

    // ----------------------------------------------------------
    // Validate traits (array of max 2 short alphanumeric strings)
    // ----------------------------------------------------------
    let chosenTraits = [];
    if (Array.isArray(traits)) {
      chosenTraits = traits
        .filter(t => typeof t === "string" && /^[a-z0-9_]{1,64}$/.test(t))
        .slice(0, 2);
    }

    // ----------------------------------------------------------
    // Validate and sanitise player name
    // Allow alphanumeric, spaces, hyphens, underscores, and periods only.
    // This prevents stored XSS via leaderboard/Overseer terminal display
    // and blocks homograph/injection attacks (SEC-005 FIX).
    // Max 32 characters.
    // ----------------------------------------------------------
    let chosenName = "WANDERER";
    if (typeof name === "string") {
      const trimmed = name.trim();
      if (trimmed.length > 0) {
        chosenName = trimmed
          .replace(/[^a-zA-Z0-9\s\-_.]/g, "")
          .slice(0, 32)
          .trim() || "WANDERER";
      }
    }

    const profile = {
      name: chosenName,
      special: chosenSpecial,
      background: chosenBackground,
      traits: chosenTraits,
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
// BUG FIX: Added authMiddleware so only the authenticated player can update
// their own SPECIAL stats.  Previously any caller could overwrite any wallet's
// SPECIAL by supplying an arbitrary wallet address in the request body.
// ------------------------------------------------------------
router.post("/special/update", authMiddleware, playerLimiter, async (req, res) => {
  try {
    // BUG FIX: wallet comes from the verified session, not req.body
    const wallet = req.player.wallet;
    const { special } = req.body;

    if (!special || typeof special !== "object") {
      return res.status(400).json({ ok: false, error: "Invalid special object" });
    }

    // Validate each SPECIAL stat is in [1, 10] range
    const SPECIAL_KEYS = ["S", "P", "E", "C", "I", "A", "L"];
    for (const stat of SPECIAL_KEYS) {
      const val = special[stat];
      if (val !== undefined) {
        if (typeof val !== "number" || !Number.isFinite(val) || val < 1 || val > 10) {
          return res.status(400).json({ ok: false, error: `Invalid SPECIAL value for ${stat}` });
        }
      }
    }

    const profile = await loadProfile(wallet);
    if (!profile) return res.status(404).json({ ok: false, error: "not found" });

    // Only update recognised SPECIAL keys to avoid arbitrary property injection
    const sanitizedSpecial = {};
    SPECIAL_KEYS.forEach(k => {
      const raw = special[k];
      const val = typeof raw === "number"
        ? Math.min(10, Math.max(1, Math.floor(raw)))
        : (profile.special?.[k] ?? 5);
      sanitizedSpecial[k] = val;
    });
    profile.special = sanitizedSpecial;
    await saveProfile(wallet, profile);

    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("[player] special update error:", err);
    return res.status(500).json({ ok: false, error: "Failed to update SPECIAL" });
  }
});

// ------------------------------------------------------------
// POST /api/player/terminal/unlock
// BUG FIX: Added authMiddleware so only the authenticated player can unlock
// their own terminal.  Previously any caller could unlock any wallet's terminal.
// ------------------------------------------------------------
router.post("/terminal/unlock", authMiddleware, playerLimiter, async (req, res) => {
  try {
    // BUG FIX: wallet comes from the verified session, not req.body
    const wallet = req.player.wallet;

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
// BUG FIX: Added authMiddleware – wallet from session, not body.
// ------------------------------------------------------------
router.post("/respec", authMiddleware, playerLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;

    const profile = await loadProfile(wallet);
    if (!profile) return res.status(404).json({ ok: false, error: "not found" });

    // Check actual NFT ownership via Helius API.
    // RESPEC_TOKEN_MINT env var must be set to the mint address of the recalibration token.
    // When HELIUS_API_KEY or RESPEC_TOKEN_MINT is absent the feature is disabled gracefully.
    const RESPEC_TOKEN_MINT = process.env.RESPEC_TOKEN_MINT || "";
    const ownsToken = RESPEC_TOKEN_MINT
      ? await checkNFTOwnership(wallet, RESPEC_TOKEN_MINT)
      : false;
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
