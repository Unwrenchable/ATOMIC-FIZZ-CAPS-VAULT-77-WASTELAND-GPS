// public/js/modules/mintables.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Mintables Module
// Master item database: weapons, armor, consumables, junk, lore, trophies
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const mintablesModule = {
    items: [],
    indexedById: {},
    indexedByType: {},
    indexedByRarity: {},
    loaded: false,

    async init() {
      if (this.loaded) return;
      try {
        // Mintables live in /public/data/mintables.json
        const res = await fetch("/data/mintables.json");
        if (!res.ok) {
          console.error("mintables: HTTP error loading /data/mintables.json:", res.status);
          return;
        }
        const json = await res.json();
        if (!Array.isArray(json)) {
          console.error("mintables: expected array in mintables.json");
          return;
        }
        this.items = json;
        this.buildIndexes();
        this.loaded = true;
        console.log(`mintables: loaded ${this.items.length} items`);
      } catch (e) {
        console.error("mintables: failed to load mintables.json", e);
      }
    },

    buildIndexes() {
      this.indexedById = {};
      this.indexedByType = {};
      this.indexedByRarity = {};

      this.items.forEach(item => {
        if (!item || !item.id) return;

        this.indexedById[item.id] = item;

        if (item.type) {
          if (!this.indexedByType[item.type]) this.indexedByType[item.type] = [];
          this.indexedByType[item.type].push(item);
        }

        if (item.rarity) {
          if (!this.indexedByRarity[item.rarity]) this.indexedByRarity[item.rarity] = [];
          this.indexedByRarity[item.rarity].push(item);
        }
      });
    },

    getById(id) {
      return this.indexedById[id] || null;
    },

    getByType(type) {
      return this.indexedByType[type] || [];
    },

    getByRarity(rarity) {
      return this.indexedByRarity[rarity] || [];
    },

    filter(predicateFn) {
      return this.items.filter(predicateFn);
    },

    // Basic roll using baseStats + rollRanges
    rollStats(baseStats = {}, rollRanges = {}) {
      const rolled = { ...baseStats };

      Object.keys(rollRanges).forEach(stat => {
        const [min, max] = rollRanges[stat];
        const delta = Math.random() * (max - min) + min;
        const baseVal = baseStats[stat] ?? 0;
        if (Number.isInteger(baseVal) && Number.isInteger(min) && Number.isInteger(max)) {
          rolled[stat] = baseVal + Math.round(delta);
        } else {
          rolled[stat] = baseVal + delta;
        }
      });

      return rolled;
    },

    // Optionally roll a variant (for weapons mostly)
    rollVariant(item) {
      if (!item || !Array.isArray(item.variants) || !item.variants.length) return null;
      const idx = Math.floor(Math.random() * item.variants.length);
      return item.variants[idx];
    }
  };

  Game.modules.mintables = mintablesModule;
})();
