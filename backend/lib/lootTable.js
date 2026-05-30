// backend/lib/lootTable.js
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const DEFAULT_PLAYER_LEVEL = 1;

// Load loot table data once at startup
let LOOT_DATA = null;
function getLootData() {
  if (LOOT_DATA) return LOOT_DATA;
  const filePath = path.resolve(__dirname, "../../public/data/items/loot_tables.json");
  try {
    LOOT_DATA = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error("[lootTable] failed to load loot_tables.json at", filePath, ":", err.message);
    LOOT_DATA = { meta: {}, tiers: {} };
  }
  return LOOT_DATA;
}

// Cryptographically secure float in [0, 1) — no Math.random()
function cryptoRandFloat() {
  const bytes = crypto.randomBytes(4);
  const uint = bytes.readUInt32BE(0);
  return uint / 0x100000000;
}

// Cryptographically secure integer index in [0, length) via rejection sampling (no bias)
function cryptoRandIndex(length) {
  if (length <= 1) return 0;
  const RANGE = 0x100000000; // 2^32
  const limit = RANGE - (RANGE % length);
  let rand;
  do {
    rand = crypto.randomBytes(4).readUInt32BE(0);
  } while (rand >= limit);
  return rand % length;
}

// Weighted random pick from an array of { weight, ...item } objects
// Returns the selected item (or null if pool is empty / all weights are 0)
function weightedPick(pool) {
  if (!pool || pool.length === 0) return null;
  const totalWeight = pool.reduce((sum, item) => sum + (item.weight || 1), 0);
  if (totalWeight <= 0) {
    // Fall back to uniform crypto-random if no weights
    return pool[cryptoRandIndex(pool.length)];
  }
  let roll = cryptoRandFloat() * totalWeight;
  for (const item of pool) {
    roll -= item.weight || 1;
    if (roll <= 0) return item;
  }
  return pool[pool.length - 1];
}

// Select a loot tier based on base drop-chance probabilities from meta,
// optionally scaled by player level.
// Returns one of: 'nft_items', 'legendary', 'epic', 'rare', 'uncommon', 'common'
function selectTier(meta, playerLevel) {
  const level = typeof playerLevel === "number" && playerLevel > 0 ? playerLevel : DEFAULT_PLAYER_LEVEL;
  const scale = meta.level_scaling_factor || 0;

  const nft     = Math.min(0.15, (meta.nft_drop_base_chance    || 0.02) + scale * level);
  const leg     = Math.min(0.25, (meta.legendary_base_chance    || 0.05) + scale * level);
  const epic    = Math.min(0.35, (meta.epic_base_chance         || 0.12) + scale * level);
  const rare    = (meta.rare_base_chance         || 0.28);
  const uncommon= (meta.uncommon_base_chance     || 0.35);
  const common  = (meta.common_base_chance       || 0.18);

  const tiers = [
    { tier: "nft_items", chance: nft },
    { tier: "legendary", chance: leg },
    { tier: "epic",      chance: epic },
    { tier: "rare",      chance: rare },
    { tier: "uncommon",  chance: uncommon },
    { tier: "common",    chance: common },
  ];

  const total = tiers.reduce((s, t) => s + t.chance, 0);
  let roll = cryptoRandFloat() * total;
  for (const { tier, chance } of tiers) {
    roll -= chance;
    if (roll <= 0) return tier;
  }
  return "common";
}

/**
 * getCurrentLoot — pick a random loot item from the weighted loot table.
 * @param {object} [options]
 * @param {number} [options.playerLevel=1]  — used for level-scaling drop-rate boosts
 * @param {string} [options.forceTier]      — override tier selection (testing / admin)
 * @returns {object} loot item with at minimum: id, name, rarity, tier
 */
exports.getCurrentLoot = function (options) {
  const opts = options || {};
  const data = getLootData();
  const meta = data.meta || {};
  const tiers = data.tiers || {};

  const tierKey = opts.forceTier || selectTier(meta, opts.playerLevel);
  const pool = tiers[tierKey];

  if (!pool || pool.length === 0) {
    // graceful fallback — should never happen if loot_tables.json is complete
    return {
      lootId: crypto.randomBytes(4).toString("hex"),
      id: "scrap_metal",
      name: "Scrap Metal",
      rarity: "common",
      tier: "common",
    };
  }

  const item = weightedPick(pool);
  return {
    ...item,
    lootId: crypto.randomBytes(4).toString("hex"),
    tier: tierKey,
  };
};

