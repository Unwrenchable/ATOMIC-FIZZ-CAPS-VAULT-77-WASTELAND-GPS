// encounters.js
// Random encounter definitions & selection based on region + level

(function () {
  const gs = window.gameState;

  const ENCOUNTERS = [
    {
      id: "rad_scorpion_attack",
      biomes: ["desert", "rad_zone", "mojave", "urban", "ruins"],
      minLevel: 1,
      maxLevel: 10,
      chance: 0.60,
      enemies: [{ type: "rad_scorpion", hp: 40, damage: 10 }],
      rewards: {
        xp: 25,
        caps: 10,
        items: [],
      },
    },
    {
      id: "raider_ambush",
      biomes: ["mojave", "desert", "ruins", "urban", "rad_zone"],
      minLevel: 1,
      maxLevel: 20,
      chance: 0.55,
      enemies: [{ type: "raider", hp: 30, damage: 8 }],
      rewards: {
        xp: 20,
        caps: 15,
        items: ["5mm_round"],
      },
    },
    {
      id: "feral_ghoul_rush",
      biomes: ["ruins", "rad_zone", "urban", "desert", "mojave"],
      minLevel: 1,
      maxLevel: 50,
      chance: 0.50,
      enemies: [
        { type: "feral_ghoul", hp: 25, damage: 6 },
        { type: "feral_ghoul", hp: 25, damage: 6 },
      ],
      rewards: {
        xp: 30,
        caps: 8,
        items: [],
      },
    },
  ];

  // Secure RNG: never use Math.random() for game-economic outcomes.
  function secureRandom() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    // Use 2^32 (not 2^32-1) so result is in [0, 1) — strictly less than 1.
    return buf[0] / 0x100000000;
  }

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
    // Allow null region for test/offline mode — default to mojave biome
    const region = (window.world && typeof window.world.getCurrentRegion === "function")
      ? window.world.getCurrentRegion()
      : null;
    const regionId = region ? region.id : "default";
    const biome = biomeFromRegion(regionId);
    const lvl = (gs && gs.player && typeof gs.player.level === "number") ? gs.player.level : 1;
    const roll = secureRandom();

    const candidates = ENCOUNTERS.filter(
      (e) =>
        e.biomes.includes(biome) &&
        lvl >= e.minLevel &&
        lvl <= e.maxLevel &&
        roll < e.chance
    );

    if (!candidates.length) return null;

    const encounter = candidates[0];
    if (gs && gs.encounters) {
      gs.encounters.active = {
        encounter,
        enemyHp: encounter.enemies.map((e) => e.hp),
      };
    }

    // Route to the unified battle module (Game.modules.battle.start) first;
    // fall back to legacy window.battle.startBattle if present.
    const battleMod = window.Game && window.Game.modules && window.Game.modules.battle;
    if (battleMod && typeof battleMod.start === "function") {
      battleMod.start({
        id:      encounter.id,
        name:    encounter.id.replace(/_/g, " "),
        enemies: encounter.enemies.map(function (e) {
          return {
            id:     e.type || "enemy",
            name:   (e.type || "enemy").replace(/_/g, " "),
            hp:     typeof e.hp === "number"     ? e.hp     : 30,
            damage: typeof e.damage === "number" ? e.damage : 8
          };
        }),
        rewards: encounter.rewards || {}
      });
    } else if (window.battle && typeof window.battle.startBattle === "function") {
      window.battle.startBattle({ encounter, enemyHp: encounter.enemies.map(function (e) { return typeof e.hp === "number" ? e.hp : 30; }) });
    }

    return encounter;
  }

  window.encounters = {
    ENCOUNTERS,
    maybeTriggerEncounter,
  };
})();
