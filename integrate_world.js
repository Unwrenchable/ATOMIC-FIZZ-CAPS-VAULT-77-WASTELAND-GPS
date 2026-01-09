/**
 * Atomic Fizz Caps – World Integration Script (Enhanced)
 * ------------------------------------------------------
 * Reads:
 *   - public/data/world_locations.json  (from generate_world.js)
 *   - public/data/quests.json           (optional, for questTrigger)
 *
 * Produces:
 *   - public/data/locations.json        (engine-ready global locations)
 */

const fs = require('fs');
const path = require('path');

// -----------------------------
// Helpers
// -----------------------------
function dynamicTriggerRadius(lvl, rarity, type) {
  if (type === 'megastructure') return 260;
  if (type === 'boss') return 240;
  if (rarity === 'legendary' || lvl >= 70) return 220;
  if (lvl >= 50) return 190;
  if (lvl >= 30) return 150;
  if (lvl >= 15) return 120;
  if (lvl >= 5) return 90;
  return 60;
}

function xpForLevel(lvl, type) {
  let base = Math.round(lvl * 10);
  if (type === 'vault') base = Math.round(base * 1.2);
  if (type === 'megastructure') base = Math.round(base * 1.5);
  if (type === 'boss') base = Math.round(base * 2.0);
  return base;
}

function capsForLevel(lvl, rarity, type) {
  let base = Math.round(lvl * 8);
  if (rarity === 'rare') base = Math.round(base * 1.2);
  if (rarity === 'epic') base = Math.round(base * 1.6);
  if (rarity === 'legendary') base = Math.round(base * 2.1);
  if (type === 'boss' || type === 'megastructure') base = Math.round(base * 1.4);
  return base;
}

// -----------------------------
// Loot pools
// -----------------------------
const BASE_LOOT = {
  common: ["scrap_metal", "dirty_water", "cloth_rags", "rusted_parts", "old_batteries"],
  rare: ["ammo_pack", "medkit", "toolkit", "prewar_food", "filter_mask"],
  epic: ["energy_cell", "advanced_toolkit", "stim_injector", "enhanced_armor_plate", "targeting_module"],
  legendary: ["prototype_core", "artifact_relic", "relic_weapon", "fizzco_prototype_rig", "ancient_datacube"]
};

const BIOME_LOOT = {
  desert: ["sand_caked_weapon", "sunscorched_armor", "water_ration", "scav_goggles"],
  jungle: ["mutant_fungus", "toxin_sample", "jungle_rations", "camouflage_cloak"],
  temperate_forest: ["foraged_herbs", "hunting_bow", "wooden_stock_rifle", "snare_kit"],
  tundra: ["thermal_coat", "handwarmers", "frozen_rations", "insulated_boots"],
  arctic: ["heavy_parka", "heat_cell", "icepick", "emergency_beacon"],
  mountain: ["climbing_gear", "rope_kit", "mountain_rifle", "altimeter"],
  crater: ["irradiated_sample", "glow_dust", "lead_shielding", "rad_resist_serum"],
  industrial_zone: ["mechanical_parts", "welding_goggles", "power_tools", "coolant_canister"],
  urban_ruins: ["prewar_cash", "office_supplies", "handgun_parts", "lockbox"],
  oceanic: ["salted_rations", "diving_mask", "harpoon", "floatation_device"]
};

const FACTION_LOOT = {
  fizzco_remnants: ["fizzco_badge", "fizzco_prototype", "corporate_datapad", "lab_coat", "fizzco_energy_pack"],
  iron_wastes_militia: ["military_rifle", "combat_armor", "field_manual", "ration_pack", "ammo_crate"],
  radborne_tribes: ["totem_charm", "patched_armor", "radcloak", "tribal_blade", "ritual_components"],
  crater_syndicate: ["contraband_case", "syndicate_mark", "encrypted_chip", "bloodstained_credits", "black_market_contract"],
  hollow_choir: ["ritual_mask", "hymn_fragment", "cult_robe", "bone_talisman", "etched_relic"],
  the_circuit: ["ai_fragment", "servo_core", "optical_unit", "logic_board", "cybernetic_implant"],
  dustwalkers: ["raider_armor", "spiked_bat", "shotgun_parts", "improvised_explosive", "raider_flag"],
  deepwatch: ["scout_scope", "polar_cloak", "encrypted_transmission", "deepwatch_patch", "flare_pack"],
  free_scavs: ["salvaged_gear", "mixed_scrap", "makeshift_weapon", "patchwork_armor", "trade_tokens"],
  feral_broods: ["mutant_claw", "acid_gland", "feral_hide", "bone_fragment", "ooze_sample"]
};

function generateLoot(biome, faction, rarity, lvl, type) {
  const items = new Set();

  const basePool = BASE_LOOT[rarity] || BASE_LOOT.common;
  const biomePool = BIOME_LOOT[biome] || [];
  const factionPool = FACTION_LOOT[faction] || [];

  const baseCount = rarity === "common" ? 2 : rarity === "rare" ? 3 : rarity === "epic" ? 4 : 5;
  let bonus = 0;
  if (type === "vault") bonus += 1;
  if (type === "megastructure") bonus += 2;
  if (type === "boss") bonus += 3;

  const totalItems = Math.min(baseCount + bonus, 10);

  function pull(pool) {
    if (!pool || pool.length === 0) return;
    items.add(pool[Math.floor(Math.random() * pool.length)]);
  }

  // mix pulls
  while (items.size < totalItems) {
    const roll = Math.random();
    if (roll < 0.4) pull(basePool);
    else if (roll < 0.7) pull(biomePool);
    else pull(factionPool);
  }

  return Array.from(items);
}

// -----------------------------
// Paths
// -----------------------------
const WORLD_PATH = path.join(__dirname, 'public/data/world_locations.json');
const QUEST_PATH = path.join(__dirname, 'public/data/quests.json');
const OUT_PATH   = path.join(__dirname, 'public/data/locations.json');

// -----------------------------
// Load world locations
// -----------------------------
if (!fs.existsSync(WORLD_PATH)) {
  console.error('ERROR: world_locations.json not found. Run `node generate_world.js` first.');
  process.exit(1);
}

const world = JSON.parse(fs.readFileSync(WORLD_PATH, 'utf8'));
const worldAll = Array.isArray(world.all) ? world.all : [];

if (worldAll.length === 0) {
  console.error('ERROR: world_locations.json has no entries in `all`.');
  process.exit(1);
}

// -----------------------------
// Optional quest integration
// -----------------------------
let questMap = {};
if (fs.existsSync(QUEST_PATH)) {
  try {
    const quests = JSON.parse(fs.readFileSync(QUEST_PATH, 'utf8'));
    for (const q of quests) {
      if (!Array.isArray(q.poIs)) continue;
      for (const poiName of q.poIs) {
        const key = poiName.trim().toLowerCase();
        if (!questMap[key]) questMap[key] = [];
        questMap[key].push(q.id);
      }
    }
    console.log(`Loaded quests: ${Object.keys(questMap).length} POI name mappings.`);
  } catch (e) {
    console.warn('WARNING: Failed to parse quests.json. Continuing without questTrigger mapping.');
  }
} else {
  console.log('quests.json not found. Skipping questTrigger integration.');
}

// -----------------------------
// Build engine-ready locations
// -----------------------------
const locations = worldAll.map((loc, index) => {
  const name = loc.name || `Unknown Location ${index}`;
  const id   = loc.id || `loc_${index}`;

  const lvl     = loc.lvl || 1;
  const rarity  = loc.rarity || 'common';
  const lat     = loc.lat;
  const lng     = loc.lng;

  const biome   = loc.biome || 'temperate_forest';
  const faction = loc.faction || 'free_scavs';
  const type    = loc.type || 'normal';
  const lore    = loc.lore || '';

  const triggerRadius = dynamicTriggerRadius(lvl, rarity, type);
  const xp   = xpForLevel(lvl, type);
  const caps = capsForLevel(lvl, rarity, type);

  const items = generateLoot(biome, faction, rarity, lvl, type);

  const questKey = name.trim().toLowerCase();
  const questTriggers = questMap[questKey] || [];

  return {
    id,
    name,
    lat,
    lng,
    lvl,
    rarity,
    biome,
    faction,
    type,
    lore,
    triggerRadius,
    loot: {
      items,
      xp,
      caps
    },
    ...(questTriggers.length > 0 ? { questTrigger: questTriggers } : {})
  };
});

// -----------------------------
// Write output
// -----------------------------
fs.writeFileSync(OUT_PATH, JSON.stringify(locations, null, 2));
console.log(`✔ Integrated ${locations.length} enriched world locations into locations.json`);
