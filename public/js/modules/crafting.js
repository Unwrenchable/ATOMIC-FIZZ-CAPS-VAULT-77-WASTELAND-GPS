// crafting.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Crafting Module
// Uses mintables + recipes + inventory to craft items
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const craftingModule = {
    gs: null,

    init(gameState) {
      this.gs = gameState;
    },

    // Check if player can craft recipeId with current inventory
    canCraft(recipeId) {
      const recipes = Game.modules.recipes;
      if (!recipes || !recipes.loaded) return false;
      const recipe = recipes.getById(recipeId);
      if (!recipe) return false;

      // Assume recipe.inputs = [{ id, type, amount }]
      return recipe.inputs.every(req => this.hasIngredient(req));
    },

    hasIngredient(req) {
      const inv = this.gs.inventory;
      if (!inv) return false;

      // Simple approach: check all categories depending on type
      const pools = [
        inv.weapons,
        inv.armor,
        inv.consumables,
        inv.misc,
        inv.questItems,
        inv.ammo
      ].filter(Boolean);

      let count = 0;
      pools.forEach(arr => {
        arr.forEach(item => {
          if (item.id === req.id) {
            count += item.amount || 1;
          }
        });
      });

      return count >= (req.amount || 1);
    },

    consumeIngredient(req) {
      const inv = this.gs.inventory;
      const pools = [
        inv.weapons,
        inv.armor,
        inv.consumables,
        inv.misc,
        inv.questItems,
        inv.ammo
      ].filter(Boolean);

      let toRemove = req.amount || 1;

      for (const arr of pools) {
        for (let i = arr.length - 1; i >= 0 && toRemove > 0; i--) {
          const item = arr[i];
          if (item.id !== req.id) continue;

          const stack = item.amount || 1;
          if (stack <= toRemove) {
            toRemove -= stack;
            arr.splice(i, 1);
          } else {
            item.amount = stack - toRemove;
            toRemove = 0;
          }
        }
      }
    },

    craft(recipeId) {
      const recipes = Game.modules.recipes;
      const mintables = Game.modules.mintables;
      const inventory = Game.modules.inventory;

      if (!recipes || !recipes.loaded || !mintables || !mintables.loaded || !inventory) {
        console.warn("crafting: dependencies not ready");
        return null;
      }

      const recipe = recipes.getById(recipeId);
      if (!recipe) return null;
      if (!this.canCraft(recipeId)) return null;

      // Consume inputs
      recipe.inputs.forEach(req => this.consumeIngredient(req));

      // Get base item from mintables
      const baseItem = mintables.getById(recipe.outputId);
      if (!baseItem) {
        console.warn("crafting: base item not found in mintables", recipe.outputId);
        return null;
      }

      // Roll stats and optional variant
      const rolledStats = mintables.rollStats(baseItem.baseStats || {}, baseItem.rollRanges || {});
      const variant = mintables.rollVariant(baseItem);

      const craftedItem = {
        ...baseItem,
        rolledStats,
        variant,
        crafted: true
      };

      // Add to inventory
      inventory.add(craftedItem, recipe.outputAmount || 1);

      return craftedItem;
    }
  };

  Game.modules.crafting = craftingModule;
})();
