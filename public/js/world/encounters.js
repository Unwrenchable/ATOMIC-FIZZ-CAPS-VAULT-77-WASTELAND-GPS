
// encounters.js
// ------------------------------------------------------------
// Procedural Encounter Orchestrator
// ------------------------------------------------------------

const { reputationStatus } = require("./reputation");
const { pickEnemiesFor } = require("./enemies");
const { rollMerchantEncounter } = require("./merchants");
const { pickEventFor } = require("./events");
const { rollBossEncounter } = require("./bosses");
const { scaleEnemyLevels } = require("./enemyScaling");
const { getWeatherAtLocation } = require("./weather");

function rollAmbientFor(biome, faction) {
  const lines = [
    `You notice fresh tracks left by ${faction} in the ${biome}.`,
    `The ${biome} carries distant echoes of ${faction} activity.`,
    `Discarded gear bearing ${faction} colors lies half-buried.`,
    `A cairn marked with ${faction} sigils watches over the ${biome}.`
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}

function rollEncounter(worldState, location, weather) {
  const repStatus = reputationStatus(worldState, location.faction);
  const lvl = location.lvl;
  const biome = location.biome;
  const type = location.type;
  const weather = getWeatherAtLocation(worldState, location);

  // 1. Boss check
  const bossCheck = rollBossEncounter(worldState, location, weather);
  if (bossCheck) return bossCheck;

  // 2. Merchant check
  const merchantCheck = rollMerchantEncounter(worldState, location, weather);
  if (merchantCheck) return merchantCheck;

  const roll = Math.random();
  // merchantInventory.js
// ------------------------------------------------------------
// Dynamic Merchant Inventory Generator
// ------------------------------------------------------------

const BASE_ITEMS = {
  common: ["scrap_metal", "dirty_water", "cloth_rags", "old_batteries"],
  rare: ["ammo_pack", "medkit", "toolkit", "prewar_food"],
  epic: ["energy_cell", "advanced_toolkit", "stim_injector"],
  legendary: ["prototype_core", "artifact_relic", "relic_weapon"]
};

const FACTION_ITEMS = {
  fizzco_remnants: ["fizzco_prototype", "corporate_datapad", "energy_pack"],
  iron_wastes_militia: ["military_rifle", "combat_armor", "ammo_crate"],
  radborne_tribes: ["radcloak", "tribal_blade", "ritual_components"],
  crater_syndicate: ["contraband_case", "encrypted_chip"],
  hollow_choir: ["ritual_mask", "bone_talisman"],
  the_circuit: ["ai_fragment", "servo_core"],
  dustwalkers: ["raider_armor", "spiked_bat"],
  deepwatch: ["polar_cloak", "flare_pack"],
  free_scavs: ["salvaged_gear", "patchwork_armor"],
  feral_broods: ["mutant_claw", "acid_gland"]
};

const BIOME_ITEMS = {
  desert: ["water_ration", "sunscorched_armor"],
  jungle: ["toxin_sample", "camouflage_cloak"],
  tundra: ["thermal_coat", "insulated_boots"],
  arctic: ["heavy_parka", "heat_cell"],
  crater: ["irradiated_sample", "lead_shielding"],
  industrial_zone: ["mechanical_parts", "coolant_canister"],
  urban_ruins: ["handgun_parts", "lockbox"],
  oceanic: ["diving_mask", "harpoon"]
};

function generateMerchantInventory(faction, biome, seed = Date.now()) {
  const rng = mulberry32(seed);

  const rarityRoll = rng();
  let rarity = "common";
  if (rarityRoll > 0.85) rarity = "rare";
  if (rarityRoll > 0.95) rarity = "epic";
  if (rarityRoll > 0.99) rarity = "legendary";

  const items = new Set();

  function pull(pool) {
    if (!pool || pool.length === 0) return;
    items.add(pool[Math.floor(rng() * pool.length)]);
  }

  // Base items
  for (let i = 0; i < 3; i++) pull(BASE_ITEMS[rarity]);

  // Faction items
  for (let i = 0; i < 2; i++) pull(FACTION_ITEMS[faction]);

  // Biome items
  for (let i = 0; i < 2; i++) pull(BIOME_ITEMS[biome]);

  return Array.from(items);
}

// Deterministic RNG
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = {
  generateMerchantInventory
};

  // 3. Nemesis
  if (repStatus === "nemesis" && roll < 0.85) {
    return {
      type: "combat",
      enemies: pickEnemiesFor(biome, lvl + 5, location.faction),
      modifier: "nemesis"
    };
  }

  // 4. Hostile
  if (repStatus === "hostile" && roll < 0.6) {
    return {
      type: "combat",
      enemies: pickEnemiesFor(biome, lvl, location.faction),
      modifier: "hostile"
    };
  }

  // 5. Friendly
  if ((repStatus === "friendly" || repStatus === "allied") && roll < 0.35) {
    return {
      type: "merchant",
      merchant: {
        faction: location.faction,
        biome,
        greeting: "A friendly trader approaches."
      }
    };
  }

  // 6. Special locations
  if ((type === "vault" || type === "megastructure") && roll < 0.5) {
    return {
      type: "event",
      event: pickEventFor(location, worldState)
    };
  }

  // 7. Ambient
  if (roll < 0.2) {
    return {
      type: "ambient",
      description: rollAmbientFor(biome, location.faction)
    };
  }

  return { type: "none" };
}

module.exports = { rollEncounter };
