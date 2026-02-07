const express = require("express");
const path = require("path");
const router = express.Router();
const { redis, key } = require("../lib/redis");

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
router.post("/accept", async (req, res) => {
  try {
    const { wallet, questId } = req.body;

    if (!wallet || typeof wallet !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

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
    if (!player.quests) {
      player.quests = { active: [], completed: [] };
    }

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
router.post("/complete", async (req, res) => {
  try {
    const { wallet, questId, rewards } = req.body;

    if (!wallet || typeof wallet !== "string") {
      return res.status(400).json({ ok: false, error: "Invalid wallet" });
    }

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
    if (!player.quests) {
      player.quests = { active: [], completed: [] };
    }

    // Check if quest is active
    if (!player.quests.active.includes(questId)) {
      return res.status(400).json({ ok: false, error: "Quest not active" });
    }

    // Move from active to completed
    player.quests.active = player.quests.active.filter(q => q !== questId);
    player.quests.completed.push(questId);
    
    player.quests.completedAt = player.quests.completedAt || {};
    player.quests.completedAt[questId] = Date.now();

    // Award rewards if provided
    if (rewards) {
      if (rewards.xp) {
        player.xp = (player.xp || 0) + rewards.xp;
        // Check for level up
        const xpPerLevel = 100;
        while (player.xp >= player.level * xpPerLevel) {
          player.xp -= player.level * xpPerLevel;
          player.level += 1;
        }
      }
      if (rewards.caps) {
        player.caps = (player.caps || 0) + rewards.caps;
      }
      if (rewards.items && Array.isArray(rewards.items)) {
        if (!player.inventory) player.inventory = [];
        rewards.items.forEach(itemId => {
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
router.get("/player/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;

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
