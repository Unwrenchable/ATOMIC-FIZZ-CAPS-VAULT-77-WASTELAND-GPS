// encounters.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Encounter Engine (Hybrid-D)
// Grounded wasteland + faction dynamics + rare weirdness
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const encountersModule = {
    init(gameState) {
      this.gs = gameState;
    },

    // --------------------------------------------------------
    // Core roll entrypoint
    // --------------------------------------------------------
    roll(location) {
      const world = Game.modules.world;
      const factions = Game.modules.factions;
      const events = Game.modules.events;

      if (!world || !this.gs) {
        console.warn("encounters: world or gameState missing");
        return null;
      }

      const ctx = this.buildContext(location);

      // Let events override or bias encounters if they want
      if (events && events.loaded) {
        const eventOverride = events.trigger("preEncounter", ctx);
        if (eventOverride && eventOverride.encounter) {
          return this.prepareEncounter(eventOverride.encounter, ctx);
        }
      }

      // 1) Check for very rare chaos/anomaly
      if (Math.random() < ctx.chaosChance) {
        const anomaly = this.rollAnomalyEncounter(ctx);
        if (anomaly) return this.prepareEncounter(anomaly, ctx);
      }

      // 2) Faction-driven encounters (patrols, caravans, hit squads)
      const factionEncounter = this.rollFactionEncounter(ctx);
      if (factionEncounter) return this.prepareEncounter(factionEncounter, ctx);

      // 3) Biome / baseline encounters
      const baselineEncounter = this.rollBaselineEncounter(ctx);
      if (baselineEncounter) return this.prepareEncounter(baselineEncounter, ctx);

      // 4) Very rare: nothing happens (quiet moment)
      return null;
    },

    // --------------------------------------------------------
    // Context builder – who / where / what
    // --------------------------------------------------------
    buildContext(location) {
      const world = Game.modules.world;
      const weather = world && world.weather ? world.weather.current : null;
      const factions = Game.modules.factions;

      const loc = location || world.currentLocation || {};
      const biome = loc.biome || "wasteland";
      const timeOfDay = world.timeOfDay || "day"; // "day", "night"
      const playerLevel = this.gs.player && this.gs.player.level ? this.gs.player.level : 1;

      const territoryFactionId = loc.factionId || null;
      const rep = (territoryFactionId && factions)
        ? factions.getReputation(world.state, territoryFactionId)
        : { standing: "neutral", score: 0 };

      // Chaos chance: mostly low, higher in storms / special areas
      let chaosChance = 0.03; // 3% baseline
      if (weather && weather.type === "rad_storm") chaosChance += 0.07;
      if (loc.tags && loc.tags.includes("anomaly_zone")) chaosChance += 0.1;

      return {
        location: loc,
        biome,
        timeOfDay,
        weather,
        playerLevel,
        territoryFactionId,
        reputation: rep,
        chaosChance
      };
    },

    // --------------------------------------------------------
    // Encounter tables
    // --------------------------------------------------------
    rollBaselineEncounter(ctx) {
      const table = this.getBaselineTable(ctx);

      if (!table.length) return null;

      const totalWeight = table.reduce((sum, e) => sum + (e.weight || 1), 0);
      let roll = Math.random() * totalWeight;

      for (const entry of table) {
        roll -= (entry.weight || 1);
        if (roll <= 0) return entry;
      }

      return table[table.length - 1];
    },

    getBaselineTable(ctx) {
      const { biome, timeOfDay, playerLevel } = ctx;
      const t = [];

      // Simple, readable tables. You can expand these later.
      if (biome === "desert") {
        t.push(
          { id: "raider_pack", type: "hostile", weight: 4 },
          { id: "gecko_pack", type: "creatures", weight: 3 },
          { id: "scavenger", type: "neutral", weight: 2 },
          { id: "feral_ghouls", type: "hostile", weight: timeOfDay === "night" ? 3 : 1 }
        );
      } else if (biome === "urban") {
        t.push(
          { id: "raider_gang", type: "hostile", weight: 4 },
          { id: "scavenger_duo", type: "neutral", weight: 3 },
          { id: "security_bot", type: "hostile", weight: 2 },
          { id: "feral_ghouls", type: "hostile", weight: timeOfDay === "night" ? 4 : 1 }
        );
      } else if (biome === "mountain") {
        t.push(
          { id: "night_stalkers", type: "creatures", weight: 3 },
          { id: "mutant_hunters", type: "hostile", weight: 2 },
          { id: "wandering_hermit", type: "neutral", weight: 1 }
        );
      } else {
        // generic wasteland
        t.push(
          { id: "raider_pair", type: "hostile", weight: 4 },
          { id: "wild_dogs", type: "creatures", weight: 3 },
          { id: "lone_traveler", type: "neutral", weight: 2 }
        );
      }

      // Very light level-based tuning (bosses come later)
      if (playerLevel >= 10) {
        t.push({ id: "elite_raiders", type: "hostile", weight: 1 });
      }

      return t;
    },

    // --------------------------------------------------------
    // Faction encounters
    // --------------------------------------------------------
    rollFactionEncounter(ctx) {
      const factions = Game.modules.factions;
      const world = Game.modules.world;
      if (!factions || !world || !ctx.territoryFactionId) return null;

      const rep = ctx.reputation;
      const factionId = ctx.territoryFactionId;

      // Hostile? Chance of patrol or hit squad.
      if (rep.score <= -50) {
        if (Math.random() < 0.5) {
          return { id: factionId + "_hit_squad", type: "faction_hostile" };
        }
        return { id: factionId + "_patrol", type: "faction_hostile" };
      }

      // Friendly? Chance of patrol or help.
      if (rep.score >= 50) {
        if (Math.random() < 0.3) {
          return { id: factionId + "_backup_patrol", type: "faction_friendly" };
        }
      }

      // Neutral territory patrols (low chance)
      if (Math.random() < 0.15) {
        return { id: factionId + "_patrol", type: "faction_neutral" };
      }

      // Merchant caravans (territory or neutral)
      if (Math.random() < 0.1) {
        return { id: factionId + "_caravan", type: "merchant" };
      }

      return null;
    },

    // --------------------------------------------------------
    // Anomaly / rare weirdness
    // --------------------------------------------------------
    rollAnomalyEncounter(ctx) {
      const { weather, biome } = ctx;
      const anomalies = [];

      // Subtle + Fallout-weird hybrid
      if (weather && weather.type === "rad_storm") {
        anomalies.push(
          { id: "rad_storm_ghouls", type: "anomaly_hostile", weight: 3 },
          { id: "glowing_gecko_migration", type: "anomaly_creatures", weight: 2 },
          { id: "rogue_mr_gutsy_broadcast", type: "anomaly_event", weight: 1 }
        );
      }

      if (biome === "desert") {
        anomalies.push(
          { id: "phantom_caravan", type: "anomaly_merchant", weight: 1 }
        );
      }

      if (biome === "urban") {
        anomalies.push(
          { id: "malfunctioning_eyebot_follow", type: "anomaly_event", weight: 1 }
        );
      }

      if (!anomalies.length) return null;

      const total = anomalies.reduce((s, e) => s + (e.weight || 1), 0);
      let roll = Math.random() * total;

      for (const a of anomalies) {
        roll -= (a.weight || 1);
        if (roll <= 0) return a;
      }

      return anomalies[anomalies.length - 1];
    },

    // --------------------------------------------------------
    // Prepare encounter: attach enemies, loot, behavior
    // --------------------------------------------------------
    prepareEncounter(entry, ctx) {
      const mintables = Game.modules.mintables;
      const factions = Game.modules.factions;

      const encounter = {
        id: entry.id,
        type: entry.type,
        biome: ctx.biome,
        weather: ctx.weather ? ctx.weather.type : null,
        territoryFactionId: ctx.territoryFactionId,
        enemies: [],
        allies: [],
        merchants: [],
        lootTable: [],
        levelHint: ctx.playerLevel
      };

      // Basic patterns – you can tune these per-id later
      switch (entry.type) {
        case "hostile":
        case "faction_hostile":
        case "anomaly_hostile":
          encounter.enemies = this.buildEnemyGroup(entry, ctx);
          encounter.lootTable = this.buildLootTable(entry, ctx);
          break;

        case "creatures":
        case "anomaly_creatures":
          encounter.enemies = this.buildCreatureGroup(entry, ctx);
          encounter.lootTable = this.buildCreatureLoot(entry, ctx);
          break;

        case "faction_friendly":
        case "faction_neutral":
          encounter.allies = this.buildFactionGroup(entry, ctx);
          break;

        case "merchant":
        case "anomaly_merchant":
          encounter.merchants = this.buildMerchantGroup(entry, ctx);
          break;

        case "neutral":
        case "anomaly_event":
        default:
          // Could trigger dialog/event instead of combat
          break;
      }

      return encounter;
    },

    // --------------------------------------------------------
    // Enemy / creature / faction groups
    // --------------------------------------------------------
    buildEnemyGroup(entry, ctx) {
      const mintables = Game.modules.mintables;
      if (!mintables || !mintables.loaded) return [];

      // Placeholder logic – you probably have enemy templates.
      // Here we just tag them conceptually.
      const base = [];

      if (entry.id.includes("raider")) {
        const count = this.rollInt(2, 5);
        for (let i = 0; i < count; i++) {
          base.push({
            templateId: "raider_grunt",
            level: this.scaleLevel(ctx.playerLevel),
            faction: "raiders"
          });
        }
      } else if (entry.id.includes("elite_raiders")) {
        const count = this.rollInt(2, 3);
        for (let i = 0; i < count; i++) {
          base.push({
            templateId: "raider_elite",
            level: this.scaleLevel(ctx.playerLevel + 2),
            faction: "raiders"
          });
        }
      } else if (entry.id.includes("ghouls")) {
        const count = this.rollInt(3, 6);
        for (let i = 0; i < count; i++) {
          base.push({
            templateId: "feral_ghoul",
            level: this.scaleLevel(ctx.playerLevel),
            faction: "feral"
          });
        }
      } else {
        // generic hostiles
        const count = this.rollInt(1, 3);
        for (let i = 0; i < count; i++) {
          base.push({
            templateId: "wasteland_hostile",
            level: this.scaleLevel(ctx.playerLevel),
            faction: "hostile"
          });
        }
      }

      return base;
    },

    buildCreatureGroup(entry, ctx) {
      const group = [];
      const count = this.rollInt(2, 5);

      for (let i = 0; i < count; i++) {
        group.push({
          templateId: "wasteland_creature",
          level: this.scaleLevel(ctx.playerLevel),
          faction: "creature"
        });
      }

      if (entry.id.includes("glowing_gecko")) {
        group.forEach(e => e.templateId = "glowing_gecko");
      }

      return group;
    },

    buildFactionGroup(entry, ctx) {
      const factionId = ctx.territoryFactionId || "unknown_faction";
      const count = this.rollInt(2, 4);
      const group = [];

      for (let i = 0; i < count; i++) {
        group.push({
          templateId: factionId + "_trooper",
          level: this.scaleLevel(ctx.playerLevel),
          faction: factionId
        });
      }

      return group;
    },

    buildMerchantGroup(entry, ctx) {
      const factionId = ctx.territoryFactionId || "neutral";
      const merchants = [{
        templateId: factionId + "_caravan_merchant",
        level: this.scaleLevel(ctx.playerLevel),
        faction: factionId,
        inventoryType: "caravan"
      }];

      return merchants;
    },

    // --------------------------------------------------------
    // Loot tables
    // --------------------------------------------------------
    buildLootTable(entry, ctx) {
      const mintables = Game.modules.mintables;
      if (!mintables || !mintables.loaded) return [];

      const table = [];

      // Very simple rarity logic stub; you can wire real tiers.
      table.push(
        { rarity: "common", weight: 5 },
        { rarity: "uncommon", weight: 3 },
        { rarity: "rare", weight: 1 }
      );

      if (ctx.playerLevel >= 10) {
        table.push({ rarity: "epic", weight: 0.5 });
      }

      return table;
    },

    buildCreatureLoot(entry, ctx) {
      const table = [];

      table.push({ rarity: "common", weight: 6 }); // meat, hides, glands
      if (entry.id.includes("glowing_gecko")) {
        table.push({ rarity: "rare", weight: 1 }); // rare glowing reagent
      }

      return table;
    },

    // --------------------------------------------------------
    // Utility
    // --------------------------------------------------------
    rollInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    scaleLevel(playerLevel) {
      // Simple scaling stub
      if (playerLevel <= 3) return playerLevel;
      if (playerLevel <= 10) return playerLevel + this.rollInt(-1, 1);
      return playerLevel + this.rollInt(-2, 2);
    }
  };

  Game.modules.encounters = encountersModule;
})();
