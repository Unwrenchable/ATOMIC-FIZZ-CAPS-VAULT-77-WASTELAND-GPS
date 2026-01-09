// public/js/modules/enemyScaling.js
// ------------------------------------------------------------
// Enemy Level Scaling + Elite Variants + Mutations (Modular)
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const scalingModule = {
    loaded: true,

    // --------------------------------------------------------
    // Main scaling function
    // --------------------------------------------------------
    scale(baseEnemies, locationLevel, weather, repStatus, biome) {
      const scaled = [];

      for (const enemyId of baseEnemies.list) {
        let lvl = this.randomInRange(baseEnemies.minLevel, baseEnemies.maxLevel);

        // Location difficulty curve
        lvl += Math.floor(locationLevel * 0.5);

        // Weather buffs
        if (weather?.type === "storm") lvl += 1;
        if (weather?.type === "rad_storm") lvl += 3;

        // Biome difficulty
        if (biome === "arctic" || biome === "tundra") lvl += 1;
        if (biome === "crater" || biome === "toxic_zone") lvl += 2;

        // Reputation influence
        if (repStatus === "nemesis") lvl += 3;
        if (repStatus === "hostile") lvl += 1;

        // Elite tiers
        const eliteRoll = Math.random();
        let elite = false;
        let eliteTier = 0;

        if (eliteRoll < 0.10) {
          elite = true;
          eliteTier = 1;
          lvl += 4;
        }
        if (eliteRoll < 0.03) {
          elite = true;
          eliteTier = 2;
          lvl += 7;
        }

        // Mutation logic
        let mutated = false;
        let mutationType = null;

        if (weather?.type === "rad_storm") {
          if (Math.random() < 0.25) {
            mutated = true;

            const mRoll = Math.random();
            if (mRoll < 0.33) mutationType = "glowing";
            else if (mRoll < 0.66) mutationType = "feral";
            else mutationType = "unstable";

            lvl += 2;
          }
        }

        // Clamp level
        lvl = Math.max(1, Math.min(lvl, 100));

        scaled.push({
          id: enemyId,
          level: lvl,
          elite,
          eliteTier,
          mutated,
          mutationType
        });
      }

      return scaled;
    },

    // --------------------------------------------------------
    // Utility
    // --------------------------------------------------------
    randomInRange(min, max) {
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    }
  };

  Game.modules.enemyScaling = scalingModule;
})();
