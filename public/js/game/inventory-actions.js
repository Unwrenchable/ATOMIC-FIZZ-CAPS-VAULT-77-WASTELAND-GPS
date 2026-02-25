// public/js/game/inventory-actions.js
// Unified inventory actions - uses PlayerState for persistence

window.Game = window.Game || {};
Game.player = Game.player || {};
// Don't initialize inventory array - let PlayerState manage it
// Game.player.inventory will be set by PlayerState.syncGamePlayerReferences()

/**
 * Give an item to the player (unified method)
 * Uses PlayerState for persistence so items survive reload
 * @param {Object} item - Item object with id, name, type, etc.
 * @param {number} quantity - Number of items to give (default 1)
 */
Game.giveItem = function (item, quantity = 1) {
  if (!item) {
    console.warn("[giveItem] No item provided");
    return false;
  }

  // Ensure item has required fields
  if (!item.id) {
    item.id = item.name ? item.name.toLowerCase().replace(/\s+/g, "_") : `item_${Date.now()}`;
  }

  // Use PlayerState if available (persists to localStorage)
  if (Game.modules?.PlayerState?.addItem) {
    return Game.modules.PlayerState.addItem(item, quantity);
  }

  // Fallback: direct inventory manipulation (won't persist properly)
  console.warn("[giveItem] PlayerState not loaded - item may not persist");
  
  // Ensure Game.player.inventory exists
  if (!Game.player.inventory) {
    Game.player.inventory = [];
  }
  
  // Add to Game.player.inventory
  const existing = Game.player.inventory.find(i => i.id === item.id);
  if (existing && item.stackable !== false) {
    existing.quantity = (existing.quantity || 1) + quantity;
  } else {
    Game.player.inventory.push({ ...item, quantity });
  }

  // Also add to legacy PLAYER.inventory
  if (window.PLAYER && Array.isArray(window.PLAYER.inventory)) {
    if (!window.PLAYER.inventory.includes(item.id)) {
      window.PLAYER.inventory.push(item.id);
    }
  }

  // Trigger UI refresh
  if (Game.hooks?.onInventoryUpdated) {
    Game.hooks.onInventoryUpdated();
  }

  return true;
};

/**
 * Give item from NPC interaction
 * Shows notification and properly persists
 * @param {Object} item - Item to give
 * @param {string} npcName - Name of the NPC giving the item
 */
Game.receiveItemFromNPC = function(item, npcName = "NPC") {
  if (!item) return false;

  // Use PlayerState method if available
  if (Game.modules?.PlayerState?.receiveItemFromNPC) {
    return Game.modules.PlayerState.receiveItemFromNPC(item, npcName);
  }

  // Fallback
  const success = Game.giveItem(item);
  if (success) {
    console.log(`[Inventory] Received ${item.name} from ${npcName}`);
  }
  return success;
};

/**
 * Remove item from inventory
 * @param {string} itemId - ID of item to remove
 * @param {number} quantity - Number to remove (default 1)
 */
Game.removeItem = function(itemId, quantity = 1) {
  if (!itemId) return false;

  // Use PlayerState if available
  if (Game.modules?.PlayerState?.removeItem) {
    return Game.modules.PlayerState.removeItem(itemId, quantity);
  }

  // Fallback - ensure inventory exists
  if (!Game.player.inventory) {
    Game.player.inventory = [];
    return false;
  }
  
  const idx = Game.player.inventory.findIndex(i => i.id === itemId);
  if (idx === -1) return false;

  const item = Game.player.inventory[idx];
  if (item.quantity && item.quantity > quantity) {
    item.quantity -= quantity;
  } else {
    Game.player.inventory.splice(idx, 1);
  }

  if (Game.hooks?.onInventoryUpdated) {
    Game.hooks.onInventoryUpdated();
  }

  return true;
};

/**
 * Check if player has an item
 * @param {string} itemId - Item ID to check
 * @param {number} quantity - Minimum quantity needed (default 1)
 */
Game.hasItem = function(itemId, quantity = 1) {
  if (!itemId) return false;

  // Use PlayerState if available
  if (Game.modules?.PlayerState?.hasItem) {
    return Game.modules.PlayerState.hasItem(itemId, quantity);
  }

  // Fallback - ensure inventory exists
  if (!Game.player.inventory) {
    return false;
  }
  
  const item = Game.player.inventory.find(i => i.id === itemId);
  if (!item) return false;
  return (item.quantity || 1) >= quantity;
};
