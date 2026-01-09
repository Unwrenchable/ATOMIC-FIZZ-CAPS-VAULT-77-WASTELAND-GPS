// encounters.js
// Random encounter definitions & selection based on region + level

(function () {
  const gs = window.gameState;

  const ENCOUNTERS = [
    {
      id: "rad_scorpion_attack",
      biomes: ["desert", "rad_zone"],
      minLevel: 1,
      maxLevel: 10,
      chance: 0.15,
      enemies: [{ type: "rad_scorpion", hp: 40, damage: 10 }],
      rewards: {
        xp: 25,
        caps: 10,
        items: [],
      },
    },
    {
      id: "raider_ambush",
      biomes: ["mojave"],
      minLevel: 2,
      maxLevel: 20,
      chance: 0.12,
      enemies: [{ type: "raider", hp: 30, damage: 8 }],
      rewards: {
        xp: 20,
        caps: 15,
        items: ["5mm_round"],
      },
    },
  ];

  function biomeFromRegion(regionId) {
    switch (regionId) {
      case "rad_zone":
        return "rad_zone";
      case "vault_region":
        return "urban";
      default:
        return "mojave";
    }
  }

  function maybeTriggerEncounter() {
    const region = window.world.getCurrentRegion();
    if (!region) return null;

    const biome = biomeFromRegion(region.id);
    const lvl = gs.player.level;
    const roll = Math.random();

    const candidates = ENCOUNTERS.filter(
      (e) =>
        e.biomes.includes(biome) &&
        lvl >= e.minLevel &&
        lvl <= e.maxLevel &&
        roll < e.chance
    );

    if (!candidates.length) return null;

    const encounter = candidates[0];
    gs.encounters.active = {
      encounter,
      enemyHp: encounter.enemies.map((e) => e.hp),
    };

    if (window.battle && typeof window.battle.startBattle === "function") {
      window.battle.startBattle(gs.encounters.active);
    }

    return encounter;
  }

  window.encounters = {
    ENCOUNTERS,
    maybeTriggerEncounter,
  };
})();
