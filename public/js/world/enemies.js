// enemies.js
// ------------------------------------------------------------
// Biome-Specific Enemy Tables
// ------------------------------------------------------------

const ENEMIES = {
  desert: ["sand_raider", "rad_scorpion", "dust_walker", "feral_hound"],
  jungle: ["mutant_vinebeast", "toxic_sporeling", "jungle_raider"],
  temperate_forest: ["feral_ghoul", "hungry_wolf", "bandit"],
  tundra: ["frost_stalker", "deepwatch_patrol_gone_rogue"],
  arctic: ["ice_wraith", "polar_aberration"],
  mountain: ["rock_titan", "ambush_raider"],
  crater: ["glowling", "irradiated_brute"],
  industrial_zone: ["security_drone", "scrap_mech", "syndicate_enforcer"],
  urban_ruins: ["street_raider", "looter", "feral_swarm"],
  oceanic: ["mutant_crab", "dock_raider", "drowned_thing"]
};

function pickEnemiesFor(biome, lvl, faction) {
  const base = ENEMIES[biome] || ENEMIES.temperate_forest;
  return {
    minLevel: Math.max(1, lvl - 5),
    maxLevel: lvl + 5,
    list: base
  };
}

module.exports = { pickEnemiesFor };
