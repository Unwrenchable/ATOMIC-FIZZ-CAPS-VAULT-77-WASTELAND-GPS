// loot.js (v2)
// ------------------------------------------------------------
// Dynamic Loot Engine
// Region-aware, faction-biased, anomaly-tiered, timeline-distorted,
// NPC-trait-influenced.
// ------------------------------------------------------------

(function () {
  "use strict";

  const WorldState = window.overseerWorldState;
  const Regions = window.overseerRegions;
  const Factions = window.overseerFaction;
  const Timeline = window.overseerTimeline;
  const Anomalies = window.overseerAnomalies;
  const Traits = window.overseerNpcTraits;

  // ------------------------------------------------------------
  // Base loot pools
  // ------------------------------------------------------------
  const BASE_LOOT = {
    common: ["scrap_metal", "cloth_rags", "dirty_water", "old_batteries"],
    uncommon: ["ammo_pack", "medkit", "toolkit", "prewar_food"],
    rare: ["energy_cell", "advanced_toolkit", "stim_injector"],
    legendary: ["prototype_core", "artifact_relic", "relic_weapon"],
    anomaly: ["glitch_fragment", "unstable_core", "echo_shard"]
  };

  // Faction loot biases
  const FACTION_POOLS = {
    tech: ["fizzco_prototype", "energy_pack", "corporate_datapad"],
    electronics: ["ai_fragment", "servo_core", "circuit_relic"],
    ritual: ["ritual_mask", "bone_talisman", "occult_components"],
    scrap: ["raider_armor", "spiked_bat", "junk_parts"],
    military: ["combat_armor", "ammo_crate", "military_rifle"],
    bio: ["mutant_claw", "acid_gland", "bio_sample"],
    mixed: ["salvaged_gear", "patchwork_armor", "random_parts"]
  };

  // Region personality loot modifiers
  const PERSONALITY_LOOT = {
    unstable: ["unstable_core", "glitch_fragment"],
    dusty: ["water_ration", "sunscorched_armor"],
    mysterious: ["encrypted_chip", "strange_relic"]
  };

  // ------------------------------------------------------------
  // Weighted rarity roll
  // ------------------------------------------------------------
  function rollRarity(region, traits, anomalyLevel) {
    let weights = {
      common: 1,
      uncommon: 0.6,
      rare: 0.25,
      legendary: 0.05,
      anomaly: anomalyLevel * 0.4
    };

    // Trait influence
    if (traits.includes("greedy")) weights.uncommon += 0.2;
    if (traits.includes("elite")) weights.rare += 0.2;
    if (traits.includes("anomaly_touched")) weights.anomaly += 0.3;

    // Region influence
    if (region.rarityMultiplier) {
      weights.rare *= region.rarityMultiplier;
      weights.legendary *= region.rarityMultiplier;
    }

    // Normalize
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;

    for (const [rarity, weight] of Object.entries(weights)) {
      if (roll < weight) return rarity;
      roll -= weight;
    }

    return "common";
  }

  // ------------------------------------------------------------
  // Main loot generator
  // ------------------------------------------------------------
  function generateLoot({ regionId, factionId, npcTraits = [] }) {
    const region = Regions.get(regionId);
    const faction = Factions.getFaction(factionId);
    const anomalyLevel = WorldState.getAnomalyLevel(regionId);
    const weather = WorldState.getWeather();
    const timelineUnstable = Timeline.isUnstable(regionId);

    const rarity = rollRarity(region, npcTraits, anomalyLevel);
    let loot = [];

    // Base loot
    const basePool = BASE_LOOT[rarity] || [];
    loot.push(pick(basePool));

    // Region personality loot
    if (PERSONALITY_LOOT[region.personality]) {
      loot.push(pick(PERSONALITY_LOOT[region.personality]));
    }

    // Faction loot bias
    if (faction && faction.lootBias && FACTION_POOLS[faction.lootBias]) {
      loot.push(pick(FACTION_POOLS[faction.lootBias]));
    }

    // Weather influence
    if (weather.type === "rad_storm" && anomalyLevel > 0.3) {
      loot.push(pick(BASE_LOOT.anomaly));
    }

    if (weather.type === "whiteout") {
      loot.push("thermal_coat");
    }

    // Timeline distortions
    if (timelineUnstable && Math.random() < 0.25) {
      loot.push("echo_item");
    }

    // Quantity multiplier
    const qty = region.quantityMultiplier || 1;
    if (qty > 1) {
      loot = loot.concat(loot.slice(0, Math.floor(qty - 1)));
    }

    return Array.from(new Set(loot)); // dedupe
  }

  // ------------------------------------------------------------
  // Helper: pick random item
  // ------------------------------------------------------------
  function pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  window.overseerLoot = {
    generateLoot
  };
})();
