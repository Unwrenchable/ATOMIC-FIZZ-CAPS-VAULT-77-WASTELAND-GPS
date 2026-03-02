const express = require("express");
const path = require("path");
const router = express.Router();
const { redis, key } = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");

// Maximum rewards allowed per quest completion (server-side caps)
// Prevents a client from self-awarding unlimited XP/caps by injecting values.
const MAX_QUEST_XP   = 1000;
const MAX_QUEST_CAPS = 500;
// Maximum number of item IDs a client may claim per quest reward
const MAX_QUEST_ITEMS = 5;

// GET /api/quests - Return quests.json data
router.get("/", (req, res) => {
  const file = path.join(__dirname, "..", "..", "public", "data", "quests.json");
  res.sendFile(file, (err) => {
    if (err) {
      console.error("[api/quests] sendFile error:", err);
      res.status(500).json({ error: "Quests not available" });
    }
  });
});

// POST /api/quests/accept - Accept a quest
// BUG FIX: added authMiddleware so only authenticated players can accept quests
// on their own account.  Previously any caller could accept quests for any wallet.
router.post("/accept", authMiddleware, async (req, res) => {
  try {
    // BUG FIX: use wallet from the verified session, not the untrusted request body.
    // The body may contain an arbitrary wallet address supplied by a malicious client.
    const wallet = req.player.wallet;
    const { questId } = req.body;

    if (!questId || typeof questId !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid quest ID" });
    }

    // Get player profile
    const playerKey = key(`player:${wallet}`);
    let playerData = await redis.hget(playerKey, "profile");
    
    if (!playerData) {
      return res.status(404).json({ ok: false, error: "Player not found" });
    }

    const player = JSON.parse(playerData);
    // BUG FIX: player.quests is initialised as {} by player.js/create, so
    // `!player.quests` is false (truthy object) but player.quests.active is
    // undefined, causing TypeError on .includes(). Normalise both arrays.
    if (!player.quests || typeof player.quests !== 'object') {
      player.quests = {};
    }
    if (!Array.isArray(player.quests.active)) player.quests.active = [];
    if (!Array.isArray(player.quests.completed)) player.quests.completed = [];

    // Check if quest already completed or active
    if (player.quests.completed.includes(questId)) {
      return res.status(400).json({ ok: false, error: "Quest already completed" });
    }

    if (player.quests.active.includes(questId)) {
      return res.status(400).json({ ok: false, error: "Quest already active" });
    }

    // Add to active quests
    player.quests.active.push(questId);
    player.quests.acceptedAt = player.quests.acceptedAt || {};
    player.quests.acceptedAt[questId] = Date.now();

    // Save player profile
    await redis.hset(playerKey, "profile", JSON.stringify(player));

    console.log(`[quests] ${wallet.slice(0, 8)} accepted quest: ${questId}`);

    return res.json({
      ok: true,
      questId,
      active: player.quests.active,
      completed: player.quests.completed
    });

  } catch (err) {
    console.error("[api/quests/accept] error:", err);
    return res.status(500).json({ ok: false, error: "Failed to accept quest" });
  }
});

// POST /api/quests/complete - Complete a quest
// BUG FIX (CRITICAL): Added authMiddleware and reward validation.
// Previously any caller could (1) complete quests for any wallet and
// (2) self-award unlimited XP/caps/items by supplying arbitrary reward values
// in the request body.  Fixes applied:
//   a) authMiddleware – wallet comes from the verified session, not the body.
//   b) reward caps   – XP ≤ MAX_QUEST_XP, caps ≤ MAX_QUEST_CAPS.
//   c) item limit    – at most MAX_QUEST_ITEMS item IDs accepted from the client;
//      each item ID must be a non-empty string ≤ 64 chars (no raw HTML/scripts).
router.post("/complete", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { questId, rewards } = req.body;

    if (!questId || typeof questId !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid quest ID" });
    }

    // Get player profile
    const playerKey = key(`player:${wallet}`);
    let playerData = await redis.hget(playerKey, "profile");
    
    if (!playerData) {
      return res.status(404).json({ ok: false, error: "Player not found" });
    }

    const player = JSON.parse(playerData);
    // BUG FIX: same quests normalisation as /accept — player.quests may be {} (not null)
    // so the old `if (!player.quests)` guard was insufficient.
    if (!player.quests || typeof player.quests !== 'object') {
      player.quests = {};
    }
    if (!Array.isArray(player.quests.active)) player.quests.active = [];
    if (!Array.isArray(player.quests.completed)) player.quests.completed = [];

    // Check if quest is active
    if (!player.quests.active.includes(questId)) {
      return res.status(400).json({ ok: false, error: "Quest not active" });
    }

    // Move from active to completed
    player.quests.active = player.quests.active.filter(q => q !== questId);
    player.quests.completed.push(questId);
    
    player.quests.completedAt = player.quests.completedAt || {};
    player.quests.completedAt[questId] = Date.now();

    // Award rewards if provided — with server-side caps to prevent exploit
    if (rewards && typeof rewards === "object") {
      if (typeof rewards.xp === "number" && rewards.xp > 0) {
        // BUG FIX: cap XP to server-enforced maximum per quest completion
        const xpToAward = Math.min(Math.max(0, Math.floor(rewards.xp)), MAX_QUEST_XP);
        player.xp = (player.xp || 0) + xpToAward;
        // Check for level up
        const xpPerLevel = 100;
        while (player.xp >= player.level * xpPerLevel) {
          player.xp -= player.level * xpPerLevel;
          player.level += 1;
        }
      }
      if (typeof rewards.caps === "number" && rewards.caps > 0) {
        // BUG FIX: cap caps to server-enforced maximum per quest completion
        const capsToAward = Math.min(Math.max(0, Math.floor(rewards.caps)), MAX_QUEST_CAPS);
        player.caps = (player.caps || 0) + capsToAward;
      }
      if (Array.isArray(rewards.items)) {
        if (!player.inventory) player.inventory = [];
        // BUG FIX: limit number of items and validate each item ID
        const validItems = rewards.items
          .filter(id => typeof id === "string" && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id))
          .slice(0, MAX_QUEST_ITEMS);
        validItems.forEach(itemId => {
          const existing = player.inventory.find(i => i.id === itemId);
          if (existing) {
            existing.quantity = (existing.quantity || 1) + 1;
          } else {
            player.inventory.push({
              id: itemId,
              name: itemId,
              quantity: 1,
              obtainedAt: Date.now(),
              source: "quest_reward"
            });
          }
        });
      }
    }

    // Save player profile
    await redis.hset(playerKey, "profile", JSON.stringify(player));

    console.log(`[quests] ${wallet.slice(0, 8)} completed quest: ${questId}`);

    return res.json({
      ok: true,
      questId,
      active: player.quests.active,
      completed: player.quests.completed,
      player: {
        xp: player.xp,
        caps: player.caps,
        level: player.level
      }
    });

  } catch (err) {
    console.error("[api/quests/complete] error:", err);
    return res.status(500).json({ ok: false, error: "Failed to complete quest" });
  }
});

// GET /api/quests/player/:wallet - Get player's quest progress
router.get("/player/:wallet", authMiddleware, async (req, res) => {
  try {
    const { wallet } = req.params;
    // BUG-010: Only allow players to see their own quest data (IDOR fix)
    if (wallet !== req.player.wallet && req.player.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    if (!wallet || typeof wallet !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

    // Get player profile
    const playerKey = key(`player:${wallet}`);
    let playerData = await redis.hget(playerKey, "profile");
    
    if (!playerData) {
      return res.status(404).json({ ok: false, error: "Player not found" });
    }

    const player = JSON.parse(playerData);
    const quests = player.quests || { active: [], completed: [] };

    return res.json({
      ok: true,
      active: quests.active || [],
      completed: quests.completed || [],
      acceptedAt: quests.acceptedAt || {},
      completedAt: quests.completedAt || {}
    });

  } catch (err) {
    console.error("[api/quests/player] error:", err);
    return res.status(500).json({ ok: false, error: "Failed to get player quests" });
  }
});

module.exports = router;
