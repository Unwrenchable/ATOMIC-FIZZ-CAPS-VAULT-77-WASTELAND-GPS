const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const { redis, key } = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");
const { applyXpToProfile, MAX_LEVEL: _MAX_LEVEL } = require("../lib/xp");

// -----------------------------------------------------------------------
// BUG-003 FIX: Load quest definitions from server-side data at startup.
// Quest rewards must come from server-defined data, not from the client.
// BUG-015 FIX: Validate questId against known quest IDs.
// -----------------------------------------------------------------------
const QUEST_DATA_DIR = path.join(__dirname, "..", "..", "public", "data", "quest");
const QUEST_MAP = new Map(); // questId -> quest definition

(function loadQuestData() {
  try {
    if (!fs.existsSync(QUEST_DATA_DIR)) {
      console.warn("[api/quests] Quest data directory not found:", QUEST_DATA_DIR);
      return;
    }
    const files = fs.readdirSync(QUEST_DATA_DIR).filter(f => f.endsWith(".json"));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(QUEST_DATA_DIR, file), "utf8");
        const quest = JSON.parse(raw);
        if (quest && quest.id) {
          QUEST_MAP.set(quest.id, quest);
        }
      } catch (e) {
        console.warn("[api/quests] Failed to load quest file:", file, e.message);
      }
    }
    // Also load top-level quests.json (array format)
    const topLevel = path.join(__dirname, "..", "..", "public", "data", "quests.json");
    if (fs.existsSync(topLevel)) {
      const arr = JSON.parse(fs.readFileSync(topLevel, "utf8"));
      if (Array.isArray(arr)) {
        arr.forEach(q => { if (q && q.id) QUEST_MAP.set(q.id, q); });
      }
    }
    console.log(`[api/quests] Loaded ${QUEST_MAP.size} quest definitions`);
  } catch (e) {
    console.error("[api/quests] Failed to load quest data:", e.message);
  }
})();

// Maximum rewards allowed per quest completion (server-side hard caps as a last resort)
// BUG-003 FIX: actual rewards now come from QUEST_MAP, not from the client.
const MAX_QUEST_XP   = 500;
const MAX_QUEST_CAPS = 250;
// Maximum number of item IDs a quest may grant
const MAX_QUEST_ITEMS = 5;

// Maximum inventory size — no unbounded growth (BUG-008 FIX)
const MAX_INVENTORY_SIZE = 200;

// MAX_LEVEL is imported from lib/xp (shared constant — BUG-014 FIX)

// GET /api/quests - Return quests.json data
router.get("/", (req, res) => {
  const file = path.join(__dirname, "..", "..", "public", "data", "quests.json");
  res.sendFile(file, (err) => {
    if (err) {
      console.error("[api/quests] sendFile error:", err);
      res.status(500).json({ ok: false, error: "Quests not available" });
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

    // BUG-015 FIX: validate quest ID against server-known quests.
    // Unknown quest IDs can't be accepted — prevents phantom quest injection.
    if (QUEST_MAP.size > 0 && !QUEST_MAP.has(questId)) {
      return res.status(400).json({ ok: false, error: "Unknown quest" });
    }

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

    // BUG-013 FIX: enforce a maximum number of simultaneously active quests to
    // prevent unbounded profile JSON growth and Redis storage inflation.
    const MAX_ACTIVE_QUESTS = 10;
    if (player.quests.active.length >= MAX_ACTIVE_QUESTS) {
      return res.status(400).json({
        ok: false,
        error: `Maximum ${MAX_ACTIVE_QUESTS} active quests — complete or abandon one first`,
      });
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
// BUG-003 FIX: Rewards now come from server-defined quest data, not client body.
// BUG-015 FIX: questId validated against known quest definitions.
router.post("/complete", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;
    const { questId } = req.body;

    if (!questId || typeof questId !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid quest ID" });
    }

    // BUG-015 FIX: validate quest ID against server-known quests.
    if (QUEST_MAP.size > 0 && !QUEST_MAP.has(questId)) {
      return res.status(400).json({ ok: false, error: "Unknown quest" });
    }

    // BUG-003 FIX: load rewards from server-side quest definition.
    // Ignores any rewards provided by the client.
    const questDef = QUEST_MAP.get(questId);
    const serverRewards = questDef?.reward || questDef?.rewards || {};

    // Distributed lock: prevent concurrent completion of the same quest
    // by the same wallet (race-condition / double-reward attack).
    const lockKey = `quest:complete:lock:${wallet}:${questId}`;
    const lockResult = await redis.set(lockKey, "1", { NX: true, EX: 15 });
    if (!lockResult) {
      return res.status(409).json({ ok: false, error: "Quest completion already in progress" });
    }

    try {
      // Get player profile
      const playerKey = key(`player:${wallet}`);
      let playerData = await redis.hget(playerKey, "profile");
      
      if (!playerData) {
        return res.status(404).json({ ok: false, error: "Player not found" });
      }

      const player = JSON.parse(playerData);
      if (!player.quests || typeof player.quests !== 'object') {
        player.quests = {};
      }
      if (!Array.isArray(player.quests.active)) player.quests.active = [];
      if (!Array.isArray(player.quests.completed)) player.quests.completed = [];

      // Check if quest is active
      if (!player.quests.active.includes(questId)) {
        return res.status(400).json({ ok: false, error: "Quest not active" });
      }

      // CRITICAL-001 FIX: Store quest completion in Redis BEFORE awarding reward to prevent multiple claims
      const completionKey = key(`quest:completed:${wallet}:${questId}`);
      const completionResult = await redis.set(completionKey, "1", { NX: true, EX: 86400 }); // Expire in 24 hours
      if (!completionResult) {
        return res.status(409).json({ ok: false, error: "Quest already completed" });
      }

      // Move from active to completed
      player.quests.active = player.quests.active.filter(q => q !== questId);
      player.quests.completed.push(questId);
      
      player.quests.completedAt = player.quests.completedAt || {};
      player.quests.completedAt[questId] = Date.now();

      // Award server-defined rewards (BUG-003 FIX: no client-provided reward values)
      if (typeof serverRewards.xp === "number" && serverRewards.xp > 0) {
        const xpToAward = Math.min(Math.max(0, Math.floor(serverRewards.xp)), MAX_QUEST_XP);
        // Use shared applyXpToProfile() to avoid duplicating level-up logic (review fix)
        applyXpToProfile(player, xpToAward);
      }
      if (typeof serverRewards.caps === "number" && serverRewards.caps > 0) {
        const capsToAward = Math.min(Math.max(0, Math.floor(serverRewards.caps)), MAX_QUEST_CAPS);
        player.caps = (player.caps || 0) + capsToAward;
      }
      if (Array.isArray(serverRewards.items)) {
        if (!player.inventory) player.inventory = [];
        // BUG-008 FIX: enforce inventory size limit
        const slotsAvailable = Math.max(0, MAX_INVENTORY_SIZE - player.inventory.length);
        const validItems = serverRewards.items
          .filter(id => typeof id === "string" && id.length > 0 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id))
          .slice(0, Math.min(MAX_QUEST_ITEMS, slotsAvailable));
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

    } finally {
      // Release the lock regardless of success or failure
      await redis.del(lockKey).catch(() => {});
    }

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
