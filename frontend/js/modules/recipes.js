// recipes.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Recipes Module
// Loads crafting/upgrade/repair recipes and indexes them
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const recipesModule = {
    recipes: [],
    indexedById: {},
    indexedByOutput: {},
    loaded: false,

    async init() {
      if (this.loaded) return;
      try {
        // Adjust path if needed
        const res = await fetch("recipes.json");
        this.recipes = await res.json();
        this.buildIndexes();
        this.loaded = true;
      } catch (e) {
        console.error("recipes: failed to load recipes.json", e);
      }
    },

    buildIndexes() {
      this.indexedById = {};
      this.indexedByOutput = {};

      this.recipes.forEach(r => {
        this.indexedById[r.id] = r;
        if (!this.indexedByOutput[r.outputId]) this.indexedByOutput[r.outputId] = [];
        this.indexedByOutput[r.outputId].push(r);
      });
    },

    getById(id) {
      return this.indexedById[id] || null;
    },

    getByOutputId(outputId) {
      return this.indexedByOutput[outputId] || [];
    },

    listAll() {
      return this.recipes;
    }
  };

  Game.modules.recipes = recipesModule;
})();
