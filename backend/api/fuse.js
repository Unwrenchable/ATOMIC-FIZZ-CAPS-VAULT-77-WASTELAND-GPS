// backend/api/fuse.js
// ------------------------------------------------------------
// NFT Fusion API - Combine multiple NFTs to create enhanced versions
// Allows players to upgrade/mod their gear
// ------------------------------------------------------------

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { redis, key } = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");

// Cryptographically-secure helpers
// Returns a random integer in [min, max) using crypto.randomInt
function secureRandInt(min, max) {
  return crypto.randomInt(min, max);
}


// Rate limiting for fusion operations
const fuseLimiter = require("express-rate-limit")({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // 3 fusion operations per minute
  message: { error: "Too many fusion operations. Please wait." }
});

// Fuse multiple NFTs together
router.post("/", authMiddleware, fuseLimiter, async (req, res) => {
  try {
    const { nftMints, walletAddress, fusionType = 'upgrade' } = req.body;

    if (!nftMints || !Array.isArray(nftMints) || nftMints.length < 2 || !walletAddress) {
      return res.status(400).json({
        error: "Missing required fields: nftMints (array, min 2 items), walletAddress"
      });
    }

    if (nftMints.length > 5) {
      return res.status(400).json({
        error: "Cannot fuse more than 5 items at once"
      });
    }

    // Get player data
    const playerKey = key("player", walletAddress);
    const playerData = await redis.get(playerKey);

    if (!playerData) {
      return res.status(404).json({ error: "Player not found" });
    }

    const player = JSON.parse(playerData);

    // Verify all NFTs are in player's inventory
    const nftsToFuse = [];
    const indicesToRemove = [];

    for (const mint of nftMints) {
      const nftIndex = player.inventory?.findIndex(item =>
        item.mint === mint || item.id === mint
      );

      if (nftIndex === -1) {
        return res.status(404).json({
          error: `NFT ${mint} not found in inventory`
        });
      }

      nftsToFuse.push(player.inventory[nftIndex]);
      indicesToRemove.push(nftIndex);
    }

    // Sort indices in descending order to remove from end first
    indicesToRemove.sort((a, b) => b - a);

    // Calculate fusion result
    const fusionResult = calculateFusion(nftsToFuse, fusionType);

    // Remove fused NFTs from inventory
    for (const index of indicesToRemove) {
      player.inventory.splice(index, 1);
    }

    // Add fused result to inventory
    player.inventory.push(fusionResult.newItem);

    // Deduct fusion cores if required
    if (fusionResult.fusionCoresRequired > 0) {
      player.scrapResources = player.scrapResources || { fusionCores: 0 };
      if (player.scrapResources.fusionCores < fusionResult.fusionCoresRequired) {
        return res.status(400).json({
          error: `Insufficient fusion cores. Required: ${fusionResult.fusionCoresRequired}, Available: ${player.scrapResources.fusionCores}`
        });
      }
      player.scrapResources.fusionCores -= fusionResult.fusionCoresRequired;
    }

    // Save updated player data
    await redis.set(playerKey, JSON.stringify(player));

    // Log the fusion operation
    const fusionLogKey = key("fusion_log", Date.now());
    await redis.set(fusionLogKey, JSON.stringify({
      walletAddress,
      nftMints,
      fusionType,
      fusionResult,
      timestamp: new Date().toISOString()
    }));
    await redis.expire(fusionLogKey, 60 * 60 * 24 * 30); // 30 days

    res.json({
      success: true,
      message: `Successfully fused ${nftMints.length} items`,
      fusionResult,
      newInventory: player.inventory,
      remainingResources: player.scrapResources
    });

  } catch (error) {
    console.error("[fuse] Error:", error);
    res.status(500).json({ error: "Internal server error during fusion operation" });
  }
});

// Calculate fusion result based on input NFTs
function calculateFusion(nfts, fusionType) {
  // Determine the highest rarity among fused items
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const maxRarityIndex = Math.max(...nfts.map(nft =>
    rarities.indexOf((nft.rarity || 'common').toLowerCase())
  ));

  let newRarity = rarities[Math.min(maxRarityIndex + 1, rarities.length - 1)]; // Upgrade by 1 level
  let fusionCoresRequired = 0;

  // Special fusion types
  if (fusionType === 'legendary') {
    newRarity = 'legendary';
    fusionCoresRequired = 50;
  } else if (fusionType === 'modded') {
    // Modded items get special properties
    fusionCoresRequired = 25;
  }

  // Generate new item properties
  const baseItem = nfts[0]; // Use first item as base
  const newItem = {
    id: `fused_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`,
    name: generateFusedName(nfts, fusionType),
    type: baseItem.type || 'weapon',
    rarity: newRarity,
    level: Math.max(...nfts.map(n => n.level || 1)) + 1,
    stats: combineStats(nfts),
    fused: true,
    fusionCount: nfts.length,
    originalItems: nfts.map(n => ({ name: n.name, rarity: n.rarity })),
    created: new Date().toISOString()
  };

  // Add special properties for modded items
  if (fusionType === 'modded') {
    newItem.modded = true;
    newItem.modifiers = generateModifiers(nfts.length);
  }

  return {
    newItem,
    fusionCoresRequired,
    originalItemsDestroyed: nfts.length,
    rarityUpgrade: newRarity !== rarities[maxRarityIndex]
  };
}

// Generate a name for the fused item
function generateFusedName(nfts, fusionType) {
  const baseName = nfts[0].name || 'Unknown Item';
  const prefixes = {
    upgrade: ['Enhanced', 'Improved', 'Upgraded', 'Refined'],
    legendary: ['Legendary', 'Mythical', 'Divine', 'Ultimate'],
    modded: ['Modded', 'Custom', 'Tuned', 'Engineered']
  };

  const prefix = prefixes[fusionType] || prefixes.upgrade;
  const randomPrefix = prefix[secureRandInt(0, prefix.length)];

  return `${randomPrefix} ${baseName}`;
}

// Combine stats from multiple items
function combineStats(nfts) {
  const combinedStats = {};

  nfts.forEach(nft => {
    const stats = nft.stats || {};
    Object.keys(stats).forEach(stat => {
      combinedStats[stat] = (combinedStats[stat] || 0) + stats[stat];
    });
  });

  // Apply fusion bonuses (20-50% increase) — randomInt(200,501) gives an integer in [200,500]
  // representing the bonus percentage * 1000, avoiding floating-point bias.
  Object.keys(combinedStats).forEach(stat => {
    const bonusPermille = crypto.randomInt(200, 501); // 200–500 (= 20%–50%)
    combinedStats[stat] = Math.floor(combinedStats[stat] * (1000 + bonusPermille) / 1000);
  });

  return combinedStats;
}

// Generate random modifiers for modded items
function generateModifiers(itemCount) {
  const possibleModifiers = [
    { name: 'High Capacity', effect: '+50% ammo capacity' },
    { name: 'Rapid Fire', effect: '+30% fire rate' },
    { name: 'Armor Piercing', effect: '+25% damage vs armor' },
    { name: 'Silent', effect: 'No noise when firing' },
    { name: 'Scoped', effect: '+100% accuracy at long range' },
    { name: 'Stabilized', effect: '-50% recoil' },
    { name: 'Overcharged', effect: '+40% damage, -20% durability' },
    { name: 'Lightweight', effect: '+20% movement speed' }
  ];

  const modifierCount = Math.min(itemCount, 3); // Max 3 modifiers
  const selectedModifiers = [];

  for (let i = 0; i < modifierCount; i++) {
    const randomIndex = secureRandInt(0, possibleModifiers.length);
    selectedModifiers.push(possibleModifiers[randomIndex]);
    possibleModifiers.splice(randomIndex, 1); // Remove to avoid duplicates
  }

  return selectedModifiers;
}

// Get fusion recipes and requirements
router.get("/recipes", (req, res) => {
  res.json({
    recipes: [
      {
        type: 'upgrade',
        name: 'Basic Upgrade',
        description: 'Combine 2-3 items to create an upgraded version',
        requirements: { minItems: 2, maxItems: 3, fusionCores: 0 },
        result: 'One upgraded item (rarity +1)'
      },
      {
        type: 'modded',
        name: 'Modded Weapon',
        description: 'Create a custom weapon with special modifiers',
        requirements: { minItems: 3, maxItems: 5, fusionCores: 25 },
        result: 'One modded item with random modifiers'
      },
      {
        type: 'legendary',
        name: 'Legendary Fusion',
        description: 'Attempt to create a legendary item',
        requirements: { minItems: 4, maxItems: 5, fusionCores: 50 },
        result: 'Legendary item (guaranteed) or epic item (fallback)'
      }
    ]
  });
});

module.exports = router;