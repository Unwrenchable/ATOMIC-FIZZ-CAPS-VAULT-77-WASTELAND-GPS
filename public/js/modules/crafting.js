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

      // Handle both flat array (player-state.js) and legacy category-object structure
      const items = Array.isArray(inv)
        ? inv
        : [].concat(
            inv.weapons || [],
            inv.armor || [],
            inv.consumables || [],
            inv.misc || [],
            inv.questItems || [],
            inv.ammo || []
          );

      const count = items
        .filter(i => i && i.id === req.id)
        .reduce((sum, i) => sum + (i.quantity ?? i.amount ?? 1), 0);

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

          const stack = item.quantity ?? item.amount ?? 1;
          if (stack <= toRemove) {
            toRemove -= stack;
            arr.splice(i, 1);
          } else {
            // BUG-008: use 'in' check so write matches read precedence even when quantity===0
            if ('quantity' in item) {
              item.quantity = stack - toRemove;
            } else {
              item.amount = stack - toRemove;
            }
            toRemove = 0;
          }
        }
      }
    },

    /**
     * craftAsync(recipeId) → Promise<craftedItem|null>
     *
     * Server-validated crafting flow:
     * 1. Verify client-side prerequisites (ingredients, dependencies loaded)
     * 2. Call POST /api/crafting/craft — server enforces level req, cooldown, daily limit
     * 3. Only if server approves: consume ingredients locally and add crafted item
     *
     * Returns the crafted item object on success, null on failure.
     * Rejects with an Error (message safe to show in UI) on server rejection.
     */
    async craftAsync(recipeId) {
      const recipes = Game.modules.recipes;
      const mintables = Game.modules.mintables;

      if (!recipes || !recipes.loaded || !mintables || !mintables.loaded) {
        throw new Error("Crafting dependencies not ready — try again in a moment");
      }

      const recipe = recipes.getById(recipeId);
      if (!recipe) throw new Error("Unknown recipe: " + recipeId);
      if (!this.canCraft(recipeId)) throw new Error("Missing ingredients");

      // ---- Server validation ----
      try {
        const apiBase = window.API_BASE || "";
        const sessionId = window.Game?.sessionId || window.sessionId || localStorage.getItem("sessionId") || "";
        const response = await fetch(`${apiBase}/api/crafting/craft`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionId ? { Authorization: `Bearer ${sessionId}` } : {}),
          },
          body: JSON.stringify({ recipeId }),
        });

        const data = await response.json();
        if (!data.ok) {
          throw new Error(data.error || "Server rejected craft");
        }
      } catch (err) {
        // Re-throw with user-friendly prefix so UI can display it
        throw new Error("Crafting failed: " + (err.message || "server error"), { cause: err });
      }

      // ---- Server approved — complete craft locally ----
      return this.craft(recipeId);
    },

    craft(recipeId) {
      const recipes = Game.modules.recipes;
      const mintables = Game.modules.mintables;

      if (!recipes || !recipes.loaded || !mintables || !mintables.loaded) {
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

      // Add to inventory — use available inventory system
      const qty = recipe.outputAmount || 1;
      if (Game.modules?.PlayerState?.addItem) {
        Game.modules.PlayerState.addItem(craftedItem, qty);
      } else if (Game.giveItem) {
        Game.giveItem(craftedItem, qty);
      } else {
        // Fallback: push directly into gameState.inventory
        const inv = this.gs.inventory;
        if (!inv) {
          console.warn("crafting: no inventory target available");
          return null;
        }
        const category =
          craftedItem.type === "weapon" ? "weapons" :
          craftedItem.type === "armor" ? "armor" :
          craftedItem.type === "ammo" ? "ammo" :
          craftedItem.type === "consumable" ? "consumables" : "misc";
        if (!inv[category]) inv[category] = [];
        const existing = inv[category].find(i => i.id === craftedItem.id);
        if (existing) {
          existing.amount = (existing.amount || 1) + qty;
        } else {
          inv[category].push({ ...craftedItem, amount: qty });
        }
      }

      return craftedItem;
    }
  };

  Game.modules.crafting = craftingModule;
})();
