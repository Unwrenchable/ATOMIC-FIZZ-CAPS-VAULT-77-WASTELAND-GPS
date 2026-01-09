// worldLogic.js
// ------------------------------------------------------------
// Atomic Fizz Caps – World Logic Core
// ------------------------------------------------------------
// Responsibilities:
//   - Faction reputation
//   - Procedural encounters
//   - Biome-specific enemies
//   - Traveling merchants
//   - Ambient flavor
//   - Simple event hook (expandable)
//   - Boss respawn logic
// ------------------------------------------------------------



// ============================================================
// SYSTEM 2: Faction Reputation
// ============================================================

const ALL_FACTIONS = [
  "fizzco_remnants",
  "iron_wastes_militia",
  "radborne_tribes",
  "crater_syndicate",
  "hollow_choir",
  "the_circuit",
  "dustwalkers",
  "deepwatch",
  "free_scavs",
  "feral_broods"
];

function ensureReputation(worldState) {
  if (!worldState.reputation) worldState.reputation = {};
  for (const f of ALL_FACTIONS) {
    if (typeof worldState.reputation[f] !== "number") {
      worldState.reputation[f] = 0;
    }
  }
  return worldState.reputation;
}

function adjustReputation(worldState, faction, delta) {
  ensureReputation(worldState);
  if (typeof worldState.reputation[faction] !== "number") {
    worldState.reputation[faction] = 0;
  }
  worldState.reputation[faction] += delta;

  // clamp
  worldState.reputation[faction] = Math.max(-200, Math.min(200, worldState.reputation[faction]));
  return worldState.reputation[faction];
}

function getReputation(worldState, faction) {
  ensureReputation(worldState);
  return worldState.reputation[faction] ?? 0;
}

function reputationStatus(worldState, faction) {
  const value = getReputation(worldState, faction);
  if (value <= -100) return "nemesis";
  if (value <= -50) return "hostile";
  if (value < 0) return "unfriendly";
  if (value < 50) return "neutral";
  if (value < 100) return "friendly";
  return "allied";
}



// ============================================================
// SYSTEM 3: Biome-Specific Enemies
// ============================================================

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



// ============================================================
// SYSTEM 4: Merchants (Base Merchant Generator)
// ============================================================

function pickMerchantFor(faction, biome) {
  return {
    id: `merchant_${faction || "neutral"}_${biome || "unknown"}_${Date.now()}`,
    faction: faction || "free_scavs",
    biome: biome || "unknown"
  };
}



// ============================================================
// SYSTEM 5: Traveling Merchants (Dynamic)
// ============================================================

function rollMerchantEncounter(worldState, location, weather) {
  const rep = getReputation(worldState, location.faction);
  const biome = location.biome;
  const faction = location.faction;

  let chance = 0.05;

  // Reputation modifiers
  if (rep >= 50) chance += 0.15;
  if (rep >= 100) chance += 0.25;
  if (rep <= -50) chance -= 0.04;

  // Biome modifiers
  if (biome === "urban_ruins" || biome === "industrial_zone") chance += 0.1;
  if (biome === "desert") chance -= 0.02;
  if (biome === "arctic" || biome === "tundra") chance -= 0.03;

  // Weather modifiers
  if (weather?.type === "storm") chance -= 0.1;
  if (weather?.type === "rad_storm") chance = 0;

  if (Math.random() < chance) {
    return {
      type: "merchant",
      merchant: {
        id: `merchant_${faction}_${biome}_${Date.now()}`,
        faction,
        biome,
        inventorySeed: `${faction}_${biome}_${Date.now()}`,
        greeting: merchantGreeting(faction)
      }
    };
  }

  return null;
}

function merchantGreeting(faction) {
  const lines = {
    fizzco_remnants: "FizzCo welcomes your continued patronage, survivor.",
    iron_wastes_militia: "Keep your weapon clean and your credits ready.",
    radborne_tribes: "The glow guides us both today.",
    crater_syndicate: "Looking to trade? No questions asked.",
    hollow_choir: "The Choir whispers of bargains.",
    the_circuit: "Unit ready for transactional exchange.",
    dustwalkers: "Got scrap? Got caps? Let’s deal.",
    deepwatch: "Cold winds bite. My prices don’t.",
    free_scavs: "Scavver to scavver, let’s trade fair.",
    feral_broods: "Hiss… trade… hiss…"
  };
  return lines[faction] || "Let's trade while the world still spins.";
}



// ============================================================
// SYSTEM 5B: Ambient Flavor
// ============================================================

function rollAmbientFor(biome, faction) {
  const f = faction || "unknown faction";
  const b = biome || "wastes";

  const lines = [
    `You notice fresh tracks and markings left by ${f} in the ${b}.`,
    `The ${b} carries distant echoes of ${f} activity.`,
    `Discarded gear bearing ${f} colors lies half-buried in the ${b}.`,
    `A makeshift cairn marked with ${f} sigils watches over this part of the ${b}.`
  ];

  return lines[Math.floor(Math.random() * lines.length)];
}



// ============================================================
// SYSTEM 6: Simple Event Hook (Expandable)
// ============================================================

const EVENTS = [
  {
    id: "strange_broadcast",
    conditions: (worldState, location) =>
      location.faction === "fizzco_remnants" && Math.random() < 0.1,
    effect: (worldState, location) => ({
      id: "strange_broadcast",
      description:
        "A garbled pre-war FizzCo broadcast cuts through the static, offering 'limited-time' salvation.",
      faction: location.faction
    })
  },
  {
    id: "silent_sky",
    conditions: () => Math.random() < 0.05,
    effect: (worldState, location) => ({
      id: "silent_sky",
      description:
        "The sky feels heavier here, the silence stretching just a few seconds too long.",
      faction: location.faction
    })
  }
];

function pickEventFor(location, worldState) {
  const candidates = EVENTS.filter(e => e.conditions(worldState, location));
  if (!candidates.length) {
    return {
      id: "ambient_mystery",
      description:
        "Nothing obvious happens, but something about this place lingers in your mind.",
      faction: location.faction
    };
  }
  return candidates[Math.floor(Math.random() * candidates.length)].effect(worldState, location);
}



// ============================================================
// SYSTEM 6B: Boss Respawn Logic
// ============================================================

function ensureBossState(worldState) {
  if (!worldState.bosses) worldState.bosses = {};
  return worldState.bosses;
}

function bossStatus(worldState, location) {
  const bosses = ensureBossState(worldState);
  const entry = bosses[location.id];

  if (!entry) return { alive: true, respawnAt: null };

  const now = Date.now();
  return {
    alive: now >= entry.respawnAt,
    respawnAt: entry.respawnAt
  };
}

function defeatBoss(worldState, location) {
  const bosses = ensureBossState(worldState);

  const baseRespawn = 1000 * 60 * 30; // 30 minutes
  const variance = Math.random() * 1000 * 60 * 15; // ±15 minutes

  bosses[location.id] = {
    defeatedAt: Date.now(),
    respawnAt: Date.now() + baseRespawn + variance,
    kills: (bosses[location.id]?.kills || 0) + 1
  };

  return bosses[location.id];
}

function rollBossEncounter(worldState, location, weather) {
  if (location.type !== "boss") return null;

  const status = bossStatus(worldState, location);
  if (!status.alive) {
    return {
      type: "boss_absent",
      description: "The boss has been slain recently. Only echoes remain."
    };
  }

  let levelBoost = 0;
  if (weather?.type === "storm") levelBoost += 2;
  if (weather?.type === "rad_storm") levelBoost += 5;

  return {
    type: "boss",
    boss: {
      id: location.id,
      name: location.name,
      lvl: location.lvl + levelBoost,
      faction: location.faction
    }
  };
}



// ============================================================
// SYSTEM 1: Procedural Encounters (Final Layer)
// ============================================================

function rollEncounter(worldState, location) {
  const repStatus = reputationStatus(worldState, location.faction);
  const lvl = location.lvl;
  const biome = location.biome;
  const type = location.type;
  const roll = Math.random();

  // Nemesis
  if (repStatus === "nemesis" && roll < 0.85) {
    return {
      type: "combat",
      enemies: pickEnemiesFor(biome, lvl + 5, location.faction),
      modifier: "nemesis"
    };
  }

  // Hostile
  if (repStatus === "hostile" && roll < 0.6) {
    return {
      type: "combat",
      enemies: pickEnemiesFor(biome, lvl, location.faction),
      modifier: "hostile"
    };
  }

  // Friendly / Allied
  if ((repStatus === "friendly" || repStatus === "allied") && roll < 0.35) {
    return {
      type: "merchant",
      merchant: pickMerchantFor(location.faction, biome),
      modifier: "friendly"
    };
  }

  // Special locations
  if ((type === "vault" || type === "megastructure") && roll < 0.5) {
    return {
      type: "event",
      event: pickEventFor(location, worldState),
      modifier: "special_location"
    };
  }

  // Ambient
  if (roll < 0.2) {
    return {
      type: "ambient",
      description: rollAmbientFor(biome, location.faction),
      modifier: "ambient"
    };
  }

  return { type: "none" };
}



// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  rollEncounter,

  ensureReputation,
  adjustReputation,
  getReputation,
  reputationStatus,

  pickEnemiesFor,
  pickMerchantFor,
  rollAmbientFor,
  pickEventFor,

  ensureBossState,
  bossStatus,
  defeatBoss,
  rollBossEncounter
};
