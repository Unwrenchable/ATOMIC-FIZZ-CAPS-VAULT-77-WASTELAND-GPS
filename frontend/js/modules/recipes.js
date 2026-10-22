// recipes.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Recipes Module
// Loads crafting/upgrade/repair recipes and indexes them
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  function normalizeRecipe(raw) {
    if (!raw || typeof raw !== "object" || !raw.id) return null;
    const inputs = Array.isArray(raw.inputs)
      ? raw.inputs.map((inp) => ({
          id: inp.id || inp.itemId,
          amount: inp.amount || inp.qty || 1
        })).filter((inp) => inp.id)
      : Array.isArray(raw.materials)
        ? raw.materials.map((mat) => ({
            id: mat.itemId || mat.id,
            amount: mat.qty || mat.amount || 1
          })).filter((inp) => inp.id)
        : [];
    return {
      ...raw,
      id: raw.id,
      name: raw.name || raw.id,
      description: raw.description || "",
      inputs,
      outputId: raw.outputId || (raw.output && raw.output.itemId) || raw.id,
      outputAmount: raw.outputAmount || (raw.output && raw.output.qty) || 1
    };
  }

  const recipesModule = {
    recipes: [],
    indexedById: {},
    indexedByOutput: {},
    loaded: false,

    async init() {
      if (this.loaded) return;
      if (this._pending) return this._pending;
      this._pending = this._load();
      try {
        await this._pending;
      } finally {
        this._pending = null;
      }
    },

    async _load() {
      // Absolute paths: a relative "recipes.json" 404s off any non-root route.
      // craftables/recipes.json uses materials/output instead of inputs/outputId.
      const urls = ["/recipes.json", "/data/craftables/recipes.json"];
      let lastError = null;
      for (const url of urls) {
        try {
          const res = await fetch(url, { headers: { "Accept": "application/json" } });
          if (!res.ok) {
            lastError = new Error(url + " HTTP " + res.status);
            continue;
          }
          const json = await res.json();
          const list = Array.isArray(json) ? json : (json && Array.isArray(json.recipes) ? json.recipes : null);
          if (!list || !list.length) {
            lastError = new Error(url + " did not contain a recipe list");
            continue;
          }
          this.recipes = list.map(normalizeRecipe).filter(Boolean);
          if (!this.recipes.length) {
            lastError = new Error(url + " had no usable recipes");
            continue;
          }
          this.buildIndexes();
          this.loaded = true;
          console.log("recipes: loaded " + this.recipes.length + " from " + url);
          return;
        } catch (e) {
          lastError = e;
        }
      }
      console.error("recipes: failed to load recipes", lastError);
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
