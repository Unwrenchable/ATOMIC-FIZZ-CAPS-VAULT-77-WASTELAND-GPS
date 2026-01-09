// mintables.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Mintables Module
// Master item database: weapons, armor, consumables, junk, lore, trophies
// ------------------------------------------------------------

(function () {
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
        // Adjust path if your mintables live elsewhere
        const res = await fetch("mintables.json");
        this.items = await res.json();
        this.buildIndexes();
        this.loaded = true;
      } catch (e) {
        console.error("mintables: failed to load mintables.json", e);
      }
    },

    buildIndexes() {
      this.indexedById = {};
      this.indexedByType = {};
      this.indexedByRarity = {};

      this.items.forEach(item => {
        this.indexedById[item.id] = item;

        if (!this.indexedByType[item.type]) this.indexedByType[item.type] = [];
        this.indexedByType[item.type].push(item);

        if (!this.indexedByRarity[item.rarity]) this.indexedByRarity[item.rarity] = [];
        this.indexedByRarity[item.rarity].push(item);
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
        // If base is integer, keep stat integer-ish
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
      if (!item.variants || !item.variants.length) return null;
      // Simple: pick one at random for now
      const variant = item.variants[Math.floor(Math.random() * item.variants.length)];
      return variant;
    }
  };

  Game.modules.mintables = mintablesModule;
})();
