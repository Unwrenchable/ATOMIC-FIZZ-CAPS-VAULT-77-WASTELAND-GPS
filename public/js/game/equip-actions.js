// public/js/game/equip-actions.js
// Unified equipment actions - uses PlayerState for persistence

window.Game = window.Game || {};
Game.player = Game.player || {};
// Don't initialize equipped object - let PlayerState manage it
// Game.player.equipped will be set by PlayerState.syncGamePlayerReferences()

/**
 * Equip an item to the player
 * Uses PlayerState for persistence so equipped items survive reload
 * @param {Object|string} itemOrId - Item object or item ID
 */
Game.equipItem = function (itemOrId) {
  if (!itemOrId) {
    console.warn("[equipItem] No item provided");
    return false;
  }

  // Resolve item if ID was passed
  let item = itemOrId;
  if (typeof itemOrId === "string") {
    // Try to find in PlayerState
    if (Game.modules?.PlayerState?.getItem) {
      item = Game.modules.PlayerState.getItem(itemOrId);
    }
    // Fallback to Game.player.inventory
    if (!item) {
      item = Game.player.inventory.find(i => i.id === itemOrId);
    }
    if (!item) {
      console.warn("[equipItem] Item not found:", itemOrId);
      return false;
    }
  }

  // Use PlayerState if available (persists to localStorage)
  if (Game.modules?.PlayerState?.equipItem) {
    return Game.modules.PlayerState.equipItem(item);
  }

  // Fallback: direct equip
  // Ensure equipped object exists
  if (!Game.player.equipped) {
    Game.player.equipped = {};
  }
  
  // Determine slot based on item type
  let slot = "accessory";
  if (item.type === "weapon") slot = "weapon";
  else if (item.type === "armor") slot = "armor";
  else if (item.slot) slot = item.slot;

  Game.player.equipped[slot] = item;

  // QUEST HOOKS
  if (item.type === "weapon") {
    if (Game.modules?.quests?.completeObjective) {
      Game.modules.quests.completeObjective("wake_up", "equip_weapon");
    } else if (Game.quests?.completeObjective) {
      Game.quests.completeObjective("wake_up", "equip_weapon");
    }
  }

  // Save to localStorage
  try {
    localStorage.setItem("afc_equipped_items", JSON.stringify(Game.player.equipped));
  } catch (e) {
    console.warn("[equipItem] Failed to save:", e);
  }

  // Trigger UI refresh
  if (Game.hooks?.onInventoryUpdated) {
    Game.hooks.onInventoryUpdated();
  }

  console.log(`[Equipment] Equipped ${item.name} in ${slot} slot`);
  return true;
};

/**
 * Unequip an item from a slot
 * @param {string} slot - Slot to unequip (weapon, armor, head, accessory)
 */
Game.unequipItem = function(slot) {
  if (!slot) return false;
  
  // Ensure equipped object exists
  if (!Game.player.equipped) {
    Game.player.equipped = {};
    return false;
  }
  
  if (!Game.player.equipped[slot]) return false;

  const item = Game.player.equipped[slot];
  Game.player.equipped[slot] = null;

  // Save to localStorage
  try {
    localStorage.setItem("afc_equipped_items", JSON.stringify(Game.player.equipped));
  } catch (e) {
    console.warn("[unequipItem] Failed to save:", e);
  }

  if (Game.hooks?.onInventoryUpdated) {
    Game.hooks.onInventoryUpdated();
  }

  console.log(`[Equipment] Unequipped ${item.name} from ${slot} slot`);
  return true;
};

/**
 * Get currently equipped item in a slot
 * @param {string} slot - Slot to check
 */
Game.getEquipped = function(slot) {
  if (!Game.player.equipped) {
    Game.player.equipped = {};
  }
  return Game.player.equipped[slot] || null;
};

/**
 * Load equipped items from localStorage on startup
 */
Game.loadEquippedItems = function() {
  try {
    const saved = localStorage.getItem("afc_equipped_items");
    if (saved) {
      const equipped = JSON.parse(saved);
      if (!Game.player.equipped) {
        Game.player.equipped = {};
      }
      Game.player.equipped = { ...Game.player.equipped, ...equipped };
      console.log("[Equipment] Loaded equipped items");
    }
  } catch (e) {
    console.warn("[Equipment] Failed to load:", e);
  }
};

// Auto-load on script execution (only if PlayerState hasn't initialized)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // Only load if PlayerState hasn't already set equipped
    if (!Game.player.equipped || Object.keys(Game.player.equipped).length === 0) {
      Game.loadEquippedItems();
    }
  });
} else {
  // Only load if PlayerState hasn't already set equipped
  if (!Game.player.equipped || Object.keys(Game.player.equipped).length === 0) {
    Game.loadEquippedItems();
  }
}
