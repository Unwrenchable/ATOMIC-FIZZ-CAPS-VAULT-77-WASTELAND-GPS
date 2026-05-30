// backend/api/repair.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Repair API
// Mounted at /api/repair
//
// Server-side enforcement for repairing equipped items:
//  - Validates player has repair kit in inventory
//  - Repairs durability of equipped items
//  - Consumes repair kit
// ------------------------------------------------------------

"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { redis, key } = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");

// ------------------------------------------------------------
// Rate limiter for repair actions
// ------------------------------------------------------------
const repairLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,              // max 5 repair attempts per minute
  message: { ok: false, error: "Too many repair requests — take it easy, wastelander" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// POST /api/repair/item
// Repair a specific equipped item slot using a repair kit
// ------------------------------------------------------------
router.post("/item", authMiddleware, repairLimiter, async (req, res) => {
  try {
    const { slot } = req.body;
    const wallet = req.player.wallet;

    if (!slot || !["weapon", "chest", "head", "arms", "legs"].includes(slot)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid slot. Must be: weapon, chest, head, arms, or legs"
      });
    }

    // Get player state from Redis
    const playerKey = key(`player:${wallet}`);
    const playerData = await redis.hget(playerKey, "profile");
    if (!playerData) {
      return res.status(404).json({ ok: false, error: "Player profile not found" });
    }

    let profile;
    try {
      profile = JSON.parse(playerData);
    } catch (e) {
      return res.status(500).json({ ok: false, error: "Failed to parse player profile" });
    }

    // Check if player has repair kit
    const inventory = profile.inventory || [];
    const repairKit = inventory.find(item => item.id === "repair_kit" && (item.quantity || 1) > 0);
    if (!repairKit) {
      return res.status(400).json({
        ok: false,
        error: "No repair kits available. Craft one at the workbench."
      });
    }

    // Check if item is equipped in the slot
    const equipped = profile.equipped || {};
    const equippedItem = equipped[slot];
    if (!equippedItem) {
      return res.status(400).json({
        ok: false,
        error: `No item equipped in ${slot} slot`
      });
    }

    // Check if item has durability system
    const durability = profile.durability || {};
    if (durability[slot] === undefined) {
      return res.status(400).json({
        ok: false,
        error: `Item in ${slot} slot doesn't have durability`
      });
    }

    // Check if item needs repair
    if (durability[slot] >= 100) {
      return res.status(400).json({
        ok: false,
        error: `Item in ${slot} slot is already at full durability`
      });
    }

    // Repair the item (restore 50 durability points)
    const repairAmount = 50;
    durability[slot] = Math.min(100, durability[slot] + repairAmount);

    // Consume repair kit
    if (repairKit.quantity > 1) {
      repairKit.quantity--;
    } else {
      const index = inventory.indexOf(repairKit);
      inventory.splice(index, 1);
    }

    // Update profile
    profile.durability = durability;
    profile.inventory = inventory;

    // Save back to Redis
    await redis.hset(playerKey, "profile", JSON.stringify(profile));

    console.log(`[repair] ${wallet} repaired ${slot} by ${repairAmount} to ${durability[slot]}%, consumed repair kit`);

    res.json({
      ok: true,
      message: `Repaired ${equippedItem.name} in ${slot} slot`,
      slot,
      newDurability: durability[slot],
      repairAmount
    });

  } catch (error) {
    console.error("[repair/item] Error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

module.exports = router;