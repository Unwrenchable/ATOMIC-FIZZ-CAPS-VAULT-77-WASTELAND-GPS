// backend/api/scrap-nft.js
// ------------------------------------------------------------
// NFT Scrap API - Convert NFTs to resources/materials
// Deflationary mechanic: removes NFTs from circulation
// ------------------------------------------------------------

const express = require("express");
const router = express.Router();
const { redis, key } = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");

// Rate limiting for scrap operations
const scrapLimiter = require("express-rate-limit")({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 scrap operations per minute
  message: { error: "Too many scrap operations. Please wait." }
});

// Scrap an NFT for resources
router.post("/", authMiddleware, scrapLimiter, async (req, res) => {
  try {
    const { nftMint, walletAddress } = req.body;

    if (!nftMint || !walletAddress) {
      return res.status(400).json({
        error: "Missing required fields: nftMint, walletAddress"
      });
    }

    // Verify NFT ownership (simplified - in production would check Solana)
    // BUG FIX: was calling key("player", walletAddress) — key() only accepts one
    // argument so walletAddress was ignored, returning "afw:player" (wrong key).
    // Also used redis.get/set (string commands) instead of redis.hget/hset (hash
    // commands), so no player data was ever found. Corrected below.
    const playerKey = key(`player:${walletAddress}`);
    const playerData = await redis.hget(playerKey, "profile");

    if (!playerData) {
      return res.status(404).json({ error: "Player not found" });
    }

    const player = JSON.parse(playerData);

    // Check if NFT is in player's inventory
    const nftIndex = player.inventory?.findIndex(item =>
      item.mint === nftMint || item.id === nftMint
    );

    if (nftIndex === -1) {
      return res.status(404).json({ error: "NFT not found in inventory" });
    }

    const nft = player.inventory[nftIndex];

    // Calculate scrap value based on NFT rarity and type
    const scrapValue = calculateScrapValue(nft);

    // Remove NFT from inventory
    player.inventory.splice(nftIndex, 1);

    // Add scrap resources to player
    player.scrapResources = player.scrapResources || {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
      fusionCores: 0
    };

    const rarity = (nft.rarity || 'common').toLowerCase();
    player.scrapResources[rarity] += scrapValue.resources;
    player.scrapResources.fusionCores += scrapValue.fusionCores;

    // Update player caps reward
    player.caps = (player.caps || 0) + scrapValue.caps;

    // Save updated player data
    await redis.hset(playerKey, "profile", JSON.stringify(player));

    // Log the scrap operation
    const scrapLogKey = key("scrap_log", Date.now());
    await redis.set(scrapLogKey, JSON.stringify({
      walletAddress,
      nftMint,
      nftName: nft.name,
      scrapValue,
      timestamp: new Date().toISOString()
    }));
    await redis.expire(scrapLogKey, 60 * 60 * 24 * 30); // 30 days

    res.json({
      success: true,
      message: `Successfully scrapped ${nft.name || 'NFT'}`,
      scrapValue,
      newResources: player.scrapResources,
      newCaps: player.caps
    });

  } catch (error) {
    console.error("[scrap-nft] Error:", error);
    res.status(500).json({ error: "Internal server error during scrap operation" });
  }
});

// Calculate scrap value based on NFT properties
function calculateScrapValue(nft) {
  const rarity = (nft.rarity || 'common').toLowerCase();
  const type = (nft.type || 'weapon').toLowerCase();

  // Base values by rarity
  const baseValues = {
    common: { resources: 10, fusionCores: 1, caps: 5 },
    uncommon: { resources: 25, fusionCores: 2, caps: 15 },
    rare: { resources: 50, fusionCores: 5, caps: 50 },
    epic: { resources: 100, fusionCores: 10, caps: 150 },
    legendary: { resources: 250, fusionCores: 25, caps: 500 }
  };

  const base = baseValues[rarity] || baseValues.common;

  // Modifiers by type
  const typeModifiers = {
    weapon: 1.0,
    armor: 1.2,
    accessory: 0.8,
    consumable: 0.5
  };

  const modifier = typeModifiers[type] || 1.0;

  return {
    resources: Math.floor(base.resources * modifier),
    fusionCores: Math.floor(base.fusionCores * modifier),
    caps: Math.floor(base.caps * modifier),
    rarity,
    type
  };
}

// Get player's scrap resources
router.get("/resources/:walletAddress", authMiddleware, async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // BUG FIX: same wrong key and wrong Redis command as the scrap endpoint above
    const playerKey = key(`player:${walletAddress}`);
    const playerData = await redis.hget(playerKey, "profile");

    if (!playerData) {
      return res.status(404).json({ error: "Player not found" });
    }

    const player = JSON.parse(playerData);
    const resources = player.scrapResources || {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
      fusionCores: 0
    };

    res.json({ resources });

  } catch (error) {
    console.error("[scrap-nft] Error getting resources:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;