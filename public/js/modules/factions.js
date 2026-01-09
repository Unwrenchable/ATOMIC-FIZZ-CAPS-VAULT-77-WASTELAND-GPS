// factions.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Factions Module
// Static faction data + integration with world reputation
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const factionsModule = {
    factions: [],
    indexedById: {},
    loaded: false,

    async init() {
      if (this.loaded) return;

      try {
        // Adjust path if needed
        const res = await fetch("factions.json");
        this.factions = await res.json();
        this.buildIndex();
        this.loaded = true;
      } catch (e) {
        console.error("factions: failed to load factions.json", e);
      }
    },

    buildIndex() {
      this.indexedById = {};
      this.factions.forEach(f => {
        this.indexedById[f.id] = f;
      });
    },

    getFaction(id) {
      return this.indexedById[id] || null;
    },

    getAll() {
      return this.factions;
    },

    // ----------------------------------------------------------------
    // Reputation bridge: uses Game.modules.world.reputation if present
    // ----------------------------------------------------------------
    getReputation(worldState, factionId) {
      if (Game.modules.world && Game.modules.world.reputation) {
        return Game.modules.world.reputation.status(worldState, factionId);
      }
      return { standing: "neutral", score: 0 };
    },

    adjustReputation(worldState, factionId, delta) {
      if (Game.modules.world && Game.modules.world.reputation) {
        return Game.modules.world.reputation.adjust(worldState, factionId, delta);
      }
      return null;
    },

    // ----------------------------------------------------------------
    // Derived helpers
    // ----------------------------------------------------------------
    isHostile(worldState, factionId) {
      const rep = this.getReputation(worldState, factionId);
      return rep.standing === "hostile" || rep.score <= -50;
    },

    isFriendly(worldState, factionId) {
      const rep = this.getReputation(worldState, factionId);
      return rep.standing === "ally" || rep.standing === "friendly" || rep.score >= 50;
    },

    getMerchantDiscount(worldState, factionId) {
      const faction = this.getFaction(factionId);
      if (!faction) return 0;
      const rep = this.getReputation(worldState, factionId);

      // Simple banded logic; can be overridden by faction JSON
      const baseDiscount = faction.baseDiscount || 0;
      if (rep.score >= 75) return baseDiscount + 0.25;
      if (rep.score >= 50) return baseDiscount + 0.15;
      if (rep.score >= 25) return baseDiscount + 0.05;
      if (rep.score <= -75) return -0.25;
      if (rep.score <= -50) return -0.15;
      if (rep.score <= -25) return -0.05;
      return baseDiscount;
    },

    getEncounterBias(worldState, factionId) {
      const faction = this.getFaction(factionId);
      if (!faction) return { ambushChance: 0, backupChance: 0 };

      const rep = this.getReputation(worldState, factionId);

      // Positive rep → backup more likely, ambush less likely
      // Negative rep → ambush more likely, backup less likely
      const baseAmbush = faction.baseAmbushChance || 0.1;
      const baseBackup = faction.baseBackupChance || 0.1;

      if (rep.score >= 75) {
        return {
          ambushChance: baseAmbush * 0.25,
          backupChance: baseBackup * 2.0
        };
      }
      if (rep.score >= 50) {
        return {
          ambushChance: baseAmbush * 0.5,
          backupChance: baseBackup * 1.5
        };
      }
      if (rep.score <= -75) {
        return {
          ambushChance: baseAmbush * 2.0,
          backupChance: baseBackup * 0.25
        };
      }
      if (rep.score <= -50) {
        return {
          ambushChance: baseAmbush * 1.5,
          backupChance: baseBackup * 0.5
        };
      }
      return {
        ambushChance: baseAmbush,
        backupChance: baseBackup
      };
    }
  };

  Game.modules.factions = factionsModule;
})();
