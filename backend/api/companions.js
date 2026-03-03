// backend/api/companions.js
// ------------------------------------------------------------
// Atomic Fizz Caps — Companion NPC System API
// Mounted at /api/companions
//
// Players recruit companions by earning trust through quests,
// trades, and dialogue choices. One active companion + one
// active pet at a time. Companions unlock economy roles and
// passive perks. At max trust + companion quest complete,
// players can mint the companion as a tradeable NFT.
//
// Routes:
//   GET    /api/companions/all              — Full companion catalogue (public)
//   GET    /api/companions/mine             — Player's companion roster
//   POST   /api/companions/trust            — Add/subtract trust for a companion
//   POST   /api/companions/recruit          — Recruit a companion (trust threshold met)
//   POST   /api/companions/dismiss          — Dismiss a companion
//   POST   /api/companions/set-active       — Set active companion or active pet
//   GET    /api/companions/active/:wallet   — Get active companion+pet (public, for map)
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const { redis, key } = require("../lib/redis");

// ------------------------------------------------------------
// Load companion definitions
// ------------------------------------------------------------
let COMPANIONS_DATA = { companions: [] };
try {
  const dataFile = path.join(__dirname, "..", "..", "public", "data", "companions.json");
  COMPANIONS_DATA = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  console.log(`[companions] Loaded ${COMPANIONS_DATA.companions.length} companion definitions`);
} catch (e) {
  console.error("[companions] Failed to load companions.json:", e.message);
}

const COMPANIONS_BY_ID = Object.fromEntries(COMPANIONS_DATA.companions.map(c => [c.id, c]));

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------
const MAX_TRUST            = 6;
const TRUST_ACTION_COOLDOWN = 60; // seconds between same trust action
const WALLET_MAX            = 128;

// ------------------------------------------------------------
// Rate limiters
// ------------------------------------------------------------
const trustLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 20,
  message: { ok: false, error: "Too many trust updates" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// GET /api/companions/all
// Public — returns companion catalogue without internal trust data
// ------------------------------------------------------------
router.get("/all", (req, res) => {
  const safe = COMPANIONS_DATA.companions.map(c => ({
    id: c.id, name: c.name, title: c.title, role: c.role,
    archetype: c.archetype, rarity: c.rarity, isPet: c.isPet || false,
    description: c.description, voice: c.voice,
    trust_requirement: c.trust_requirement, active_perk: c.active_perk,
    trade_role: c.trade_role, passive_hindrance: c.passive_hindrance,
    nft_metadata: c.nft_metadata, lore: c.lore
  }));
  return res.json({ ok: true, companions: safe, economy_roles: COMPANIONS_DATA.economy_roles });
});

// ------------------------------------------------------------
// GET /api/companions/mine
// Authenticated — returns player's trust levels, roster, active companion
// ------------------------------------------------------------
router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const rosterKey = key(`companions:roster:${wallet}`);
    const raw = await redis.get(rosterKey);
    const roster = raw ? JSON.parse(raw) : {};
    return res.json({ ok: true, roster, companions: COMPANIONS_DATA.companions.length });
  } catch (err) {
    console.error("[companions] mine error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// POST /api/companions/trust
// Authenticated. Body: { companionId, action }
// Adds/subtracts trust based on named action from companion def.
// ------------------------------------------------------------
router.post("/trust", authMiddleware, trustLimiter, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { companionId, action } = req.body;

    if (!companionId || typeof companionId !== "string" || companionId.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid companionId" });
    }
    if (!action || typeof action !== "string" || action.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid action" });
    }

    const companion = COMPANIONS_BY_ID[companionId];
    if (!companion) return res.status(404).json({ ok: false, error: "Unknown companion" });

    const trustDelta = companion.trust_actions?.[action];
    if (trustDelta === undefined) {
      return res.status(400).json({ ok: false, error: "Unknown trust action for this companion" });
    }

    // Per-action cooldown (prevents spamming same action repeatedly)
    const cooldownKey = key(`companions:trust_cd:${wallet}:${companionId}:${action}`);
    if (trustDelta > 0 && await redis.get(cooldownKey)) {
      return res.status(429).json({ ok: false, error: "Action on cooldown" });
    }

    // Load roster
    const rosterKey = key(`companions:roster:${wallet}`);
    const raw = await redis.get(rosterKey);
    const roster = raw ? JSON.parse(raw) : {};

    if (!roster[companionId]) {
      roster[companionId] = { trust: 0, recruited: false, active: false, isPet: companion.isPet || false };
    }

    const oldTrust = roster[companionId].trust;
    const newTrust = Math.max(0, Math.min(MAX_TRUST, oldTrust + trustDelta));
    roster[companionId].trust = newTrust;

    await redis.set(rosterKey, JSON.stringify(roster));

    // Set cooldown for positive trust gains (prevent farming)
    if (trustDelta > 0) {
      await redis.set(cooldownKey, "1", { EX: TRUST_ACTION_COOLDOWN });
    }

    return res.json({
      ok: true,
      companionId,
      trust: newTrust,
      delta: trustDelta,
      canRecruit: newTrust >= companion.trust_requirement && !roster[companionId].recruited,
      atMaxTrust: newTrust >= MAX_TRUST
    });
  } catch (err) {
    console.error("[companions] trust error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// POST /api/companions/recruit
// Authenticated. Body: { companionId }
// Recruits a companion if trust threshold is met.
// ------------------------------------------------------------
router.post("/recruit", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { companionId } = req.body;

    if (!companionId || typeof companionId !== "string" || companionId.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid companionId" });
    }

    const companion = COMPANIONS_BY_ID[companionId];
    if (!companion) return res.status(404).json({ ok: false, error: "Unknown companion" });

    const rosterKey = key(`companions:roster:${wallet}`);
    const raw = await redis.get(rosterKey);
    const roster = raw ? JSON.parse(raw) : {};

    const entry = roster[companionId] || { trust: 0, recruited: false, active: false };

    if (entry.recruited) {
      return res.status(409).json({ ok: false, error: "Already recruited" });
    }
    if (entry.trust < companion.trust_requirement) {
      return res.status(400).json({
        ok: false,
        error: "Insufficient trust",
        current: entry.trust,
        required: companion.trust_requirement
      });
    }

    entry.recruited = true;
    entry.recruitedAt = Date.now();
    entry.isPet = companion.isPet || false;
    roster[companionId] = entry;

    await redis.set(rosterKey, JSON.stringify(roster));

    return res.json({
      ok: true,
      companionId,
      companion: { id: companionId, name: companion.name, title: companion.title, perk: companion.active_perk },
      message: companion.recruit_dialogue
    });
  } catch (err) {
    console.error("[companions] recruit error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// POST /api/companions/dismiss
// Authenticated. Body: { companionId }
// Dismisses a companion (removes from active, keeps in roster).
// ------------------------------------------------------------
router.post("/dismiss", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { companionId } = req.body;

    if (!companionId || typeof companionId !== "string" || companionId.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid companionId" });
    }

    const rosterKey = key(`companions:roster:${wallet}`);
    const raw = await redis.get(rosterKey);
    const roster = raw ? JSON.parse(raw) : {};

    if (!roster[companionId]?.recruited) {
      return res.status(400).json({ ok: false, error: "Companion not in roster" });
    }

    roster[companionId].active = false;
    await redis.set(rosterKey, JSON.stringify(roster));

    return res.json({ ok: true, companionId, dismissed: true });
  } catch (err) {
    console.error("[companions] dismiss error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// POST /api/companions/set-active
// Authenticated. Body: { companionId }
// Sets the active companion. Enforces: 1 companion + 1 pet max.
// ------------------------------------------------------------
router.post("/set-active", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { companionId } = req.body;

    if (!companionId || typeof companionId !== "string" || companionId.length > 64) {
      return res.status(400).json({ ok: false, error: "Invalid companionId" });
    }

    const companion = COMPANIONS_BY_ID[companionId];
    if (!companion) return res.status(404).json({ ok: false, error: "Unknown companion" });

    const rosterKey = key(`companions:roster:${wallet}`);
    const raw = await redis.get(rosterKey);
    const roster = raw ? JSON.parse(raw) : {};

    if (!roster[companionId]?.recruited) {
      return res.status(400).json({ ok: false, error: "Companion not recruited" });
    }

    const isPet = companion.isPet || false;

    // Deactivate any current active of same type (companion or pet)
    for (const [cid, entry] of Object.entries(roster)) {
      const cDef = COMPANIONS_BY_ID[cid];
      if (entry.active && (cDef?.isPet || false) === isPet && cid !== companionId) {
        entry.active = false;
      }
    }

    roster[companionId].active = true;
    await redis.set(rosterKey, JSON.stringify(roster));

    // Return active perks for client to apply
    return res.json({
      ok: true,
      active: { companionId, name: companion.name, perk: companion.active_perk, hindrance: companion.passive_hindrance },
      isPet
    });
  } catch (err) {
    console.error("[companions] set-active error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ------------------------------------------------------------
// GET /api/companions/active/:wallet
// Public — returns active companion + pet for a wallet
// ------------------------------------------------------------
router.get("/active/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    if (!wallet || typeof wallet !== "string" || wallet.length > WALLET_MAX) {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    const rosterKey = key(`companions:roster:${wallet}`);
    const raw = await redis.get(rosterKey);
    const roster = raw ? JSON.parse(raw) : {};

    const activeCompanion = Object.entries(roster)
      .filter(([cid, e]) => e.active && !(COMPANIONS_BY_ID[cid]?.isPet))
      .map(([cid]) => {
        const def = COMPANIONS_BY_ID[cid];
        return def ? { id: cid, name: def.name, title: def.title, perk: def.active_perk } : null;
      })
      .filter(Boolean)[0] || null;

    const activePet = Object.entries(roster)
      .filter(([cid, e]) => e.active && (COMPANIONS_BY_ID[cid]?.isPet))
      .map(([cid]) => {
        const def = COMPANIONS_BY_ID[cid];
        return def ? { id: cid, name: def.name, title: def.title, perk: def.active_perk } : null;
      })
      .filter(Boolean)[0] || null;

    return res.json({ ok: true, companion: activeCompanion, pet: activePet });
  } catch (err) {
    console.error("[companions] active error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
