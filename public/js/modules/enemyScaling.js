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
        // BUG FIX: was using Math.random() for combat outcome RNG — must use
        // crypto.getRandomValues() per project security policy.
        const eliteRoll = this.secureRandom();
        let elite = false;
        let eliteTier = 0;

        // BUG-006 FIX: changed to if/else-if so Tier-2 condition (eliteRoll < 0.03)
        // doesn't also execute the Tier-1 block (eliteRoll < 0.10).  The old code
        // double-stacked +4+7 = +11 levels for Tier-2 elites instead of the intended +7.
        if (eliteRoll < 0.03) {
          elite = true;
          eliteTier = 2;
          lvl += 7;
        } else if (eliteRoll < 0.10) {
          elite = true;
          eliteTier = 1;
          lvl += 4;
        }

        // Mutation logic
        let mutated = false;
        let mutationType = null;

        if (weather?.type === "rad_storm") {
          if (this.secureRandom() < 0.25) {
            mutated = true;

            const mRoll = this.secureRandom();
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
          mutationType,
          awareness: 'unaware' // 'unaware', 'alerted', 'detected' - for stealth mechanics
        });
      }

      return scaled;
    },

    // --------------------------------------------------------
    // Cryptographically-secure random float in [0, 1)
    // BUG FIX: replaces Math.random() with crypto.getRandomValues()
    // --------------------------------------------------------
    secureRandom() {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      // Divide by 2^32 to get a float in [0, 1)
      return arr[0] / 0x100000000;
    },

    // --------------------------------------------------------
    // Cryptographically-secure integer in [min, max] inclusive
    // BUG FIX: replaces Math.random() with crypto.getRandomValues()
    // --------------------------------------------------------
    randomInRange(min, max) {
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return Math.floor((arr[0] / 0x100000000) * (hi - lo + 1)) + lo;
    }
  };

  Game.modules.enemyScaling = scalingModule;
})();
