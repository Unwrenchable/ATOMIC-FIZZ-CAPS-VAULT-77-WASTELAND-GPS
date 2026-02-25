// public/js/game/player-state.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Unified Player State Manager
// Handles inventory persistence, quest sync, and backend integration
// This ensures items don't vanish on reload/zone changes
// ------------------------------------------------------------

(function() {
  "use strict";

  window.Game = window.Game || {};
  Game.player = Game.player || {};
  Game.modules = Game.modules || {};

  const STORAGE_KEY = "afc_unified_player_state_v2";
  const AUTO_SAVE_INTERVAL = 15000; // 15 seconds - reduced from 5s for performance
  const BACKEND_SYNC_INTERVAL = 30000; // 30 seconds

  // Default player state structure
  const DEFAULT_STATE = {
    // Inventory: full item objects (not just IDs)
    inventory: [],
    // Equipped items by slot
    equipped: {
      weapon: null,
      armor: null,
      head: null,
      accessory: null
    },
    // Quest state
    questsActive: [],
    questsCompleted: [],
    questObjectives: {},
    // Character stats
    level: 1,
    xp: 0,
    caps: 0,
    // Visited locations for map
    visitedLocations: [],
    // Timestamps
    lastSaved: null,
    lastSynced: null
  };

  // Internal state
  let _state = null;
  let _dirty = false;
  let _syncTimer = null;
  let _backendSyncTimer = null;
  let _wallet = null;

  /**
   * Initialize player state from localStorage
   */
  function init() {
    loadFromStorage();
    
    // Sync Game.player references
    syncGamePlayerReferences();
    
    // Also sync with legacy PLAYER object if it exists
    syncWithLegacyPlayer();
    
    // Start auto-save interval (only saves when dirty)
    setInterval(() => {
      if (_dirty) {
        saveToStorage();
      }
    }, AUTO_SAVE_INTERVAL);
    
    // Start backend sync interval if wallet is connected
    _backendSyncTimer = setInterval(() => {
      if (_wallet) {
        syncWithBackend(_wallet);
      }
    }, BACKEND_SYNC_INTERVAL);
    
    // Listen for visibility changes to save on tab hide
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && _dirty) {
        saveToStorage();
      }
    });
    
    // Save before unload
    window.addEventListener("beforeunload", () => {
      if (_dirty) {
        saveToStorage();
      }
    });

    console.log("[PlayerState] Initialized with", _state.inventory.length, "items");
    return _state;
  }

  /**
   * Load player state from localStorage
   */
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        _state = { ...DEFAULT_STATE, ...parsed };
        
        // Ensure arrays exist
        if (!Array.isArray(_state.inventory)) _state.inventory = [];
        if (!Array.isArray(_state.questsActive)) _state.questsActive = [];
        if (!Array.isArray(_state.questsCompleted)) _state.questsCompleted = [];
        if (!Array.isArray(_state.visitedLocations)) _state.visitedLocations = [];
        
        console.log("[PlayerState] Loaded from storage");
      } else {
        _state = { ...DEFAULT_STATE };
        console.log("[PlayerState] Starting fresh");
      }
      
      // Also try to load from legacy storage and merge
      mergeLegacyStorage();
      
    } catch (e) {
      console.error("[PlayerState] Failed to load:", e);
      _state = { ...DEFAULT_STATE };
    }
  }

  /**
   * Merge data from legacy storage keys
   */
  function mergeLegacyStorage() {
    try {
      // Legacy main.js player state
      const legacyRaw = localStorage.getItem("afc_player_state_v1");
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        
        // Merge caps/xp/level if our state is default
        if (_state.caps === 0 && legacy.caps) _state.caps = legacy.caps;
        if (_state.xp === 0 && legacy.xp) _state.xp = legacy.xp;
        if (_state.level === 1 && legacy.level) _state.level = legacy.level;
        
        // Merge quest arrays
        if (Array.isArray(legacy.questsActive)) {
          legacy.questsActive.forEach(q => {
            if (!_state.questsActive.includes(q)) {
              _state.questsActive.push(q);
            }
          });
        }
        if (Array.isArray(legacy.questsDone)) {
          legacy.questsDone.forEach(q => {
            if (!_state.questsCompleted.includes(q)) {
              _state.questsCompleted.push(q);
            }
          });
        }
        
        // Merge locations
        if (Array.isArray(legacy.visitedLocations)) {
          legacy.visitedLocations.forEach(loc => {
            if (!_state.visitedLocations.includes(loc)) {
              _state.visitedLocations.push(loc);
            }
          });
        }
        
        // Legacy inventory is just IDs - we'll need to resolve them later
        if (Array.isArray(legacy.inventory) && legacy.inventory.length > 0) {
          legacy.inventory.forEach(itemId => {
            // Check if we already have this item
            const exists = _state.inventory.some(i => i.id === itemId);
            if (!exists) {
              // Add as placeholder - will be resolved when item data loads
              _state.inventory.push({
                id: itemId,
                name: itemId,
                type: "unknown",
                _needsResolve: true
              });
            }
          });
        }
        
        _dirty = true;
        console.log("[PlayerState] Merged legacy storage");
      }
      
      // Legacy equipped items
      const equippedRaw = localStorage.getItem("afc_equipped_items");
      if (equippedRaw) {
        const equipped = JSON.parse(equippedRaw);
        if (equipped.weapon && !_state.equipped.weapon) _state.equipped.weapon = equipped.weapon;
        if (equipped.armor && !_state.equipped.armor) _state.equipped.armor = equipped.armor;
        _dirty = true;
      }
      
    } catch (e) {
      console.warn("[PlayerState] Legacy merge error:", e);
    }
  }

  /**
   * Save player state to localStorage
   */
  function saveToStorage() {
    if (!_state) return;
    
    try {
      _state.lastSaved = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
      
      // Also update legacy storage for backward compatibility
      updateLegacyStorage();
      
      _dirty = false;
    } catch (e) {
      console.error("[PlayerState] Failed to save:", e);
    }
  }

  /**
   * Update legacy storage for backward compatibility
   */
  function updateLegacyStorage() {
    try {
      // Update legacy main.js format
      const legacyPayload = {
        inventory: _state.inventory.map(i => i.id),
        questsActive: _state.questsActive,
        questsDone: _state.questsCompleted,
        visitedLocations: _state.visitedLocations,
        xp: _state.xp,
        caps: _state.caps,
        level: _state.level
      };
      localStorage.setItem("afc_player_state_v1", JSON.stringify(legacyPayload));
      
      // Update equipped items
      localStorage.setItem("afc_equipped_items", JSON.stringify(_state.equipped));
    } catch (e) {
      // Ignore legacy sync errors
    }
  }

  /**
   * Sync Game.player references to point to our state
   */
  function syncGamePlayerReferences() {
    Game.player.inventory = _state.inventory;
    Game.player.equipped = _state.equipped;
    Game.player.level = _state.level;
    Game.player.xp = _state.xp;
    Game.player.caps = _state.caps;
  }

  /**
   * Sync with legacy PLAYER object from main.js
   */
  function syncWithLegacyPlayer() {
    if (window.PLAYER) {
      // Two-way sync
      if (_state.caps === 0 && window.PLAYER.caps) _state.caps = window.PLAYER.caps;
      if (_state.xp === 0 && window.PLAYER.xp) _state.xp = window.PLAYER.xp;
      if (_state.level === 1 && window.PLAYER.level) _state.level = window.PLAYER.level;
      
      // Keep PLAYER in sync
      window.PLAYER.caps = _state.caps;
      window.PLAYER.xp = _state.xp;
      window.PLAYER.level = _state.level;
    }
  }

  /**
   * Add item to player inventory
   * @param {Object} item - Full item object with id, name, type, etc.
   * @param {number} quantity - Number to add (default 1)
   */
  function addItem(item, quantity = 1) {
    if (!item || !item.id) {
      console.warn("[PlayerState] Cannot add item without id");
      return false;
    }

    // Check if stackable item already exists
    const existing = _state.inventory.find(i => i.id === item.id);
    
    if (existing && (item.stackable !== false)) {
      // Stack the item
      existing.quantity = (existing.quantity || 1) + quantity;
      console.log(`[PlayerState] Stacked ${quantity}x ${item.name} (total: ${existing.quantity})`);
    } else {
      // Add new item
      const newItem = {
        ...item,
        quantity: quantity,
        acquiredAt: Date.now()
      };
      _state.inventory.push(newItem);
      console.log(`[PlayerState] Added ${quantity}x ${item.name}`);
    }

    _dirty = true;
    saveToStorage(); // Immediate save for items
    
    // Sync references
    syncGamePlayerReferences();
    syncWithLegacyPlayer();
    
    // Also add to legacy PLAYER.inventory
    if (window.PLAYER && Array.isArray(window.PLAYER.inventory)) {
      if (!window.PLAYER.inventory.includes(item.id)) {
        window.PLAYER.inventory.push(item.id);
      }
    }

    // Trigger UI update
    triggerInventoryUpdate();
    
    return true;
  }

  /**
   * Remove item from player inventory
   * @param {string} itemId - Item ID to remove
   * @param {number} quantity - Number to remove (default 1)
   */
  function removeItem(itemId, quantity = 1) {
    const idx = _state.inventory.findIndex(i => i.id === itemId);
    if (idx === -1) return false;

    const item = _state.inventory[idx];
    
    if (item.quantity && item.quantity > quantity) {
      item.quantity -= quantity;
      console.log(`[PlayerState] Removed ${quantity}x ${item.name} (${item.quantity} remaining)`);
    } else {
      _state.inventory.splice(idx, 1);
      console.log(`[PlayerState] Removed ${item.name}`);
      
      // Unequip if this was equipped
      Object.keys(_state.equipped).forEach(slot => {
        if (_state.equipped[slot]?.id === itemId) {
          _state.equipped[slot] = null;
        }
      });
    }

    _dirty = true;
    saveToStorage();
    syncGamePlayerReferences();
    triggerInventoryUpdate();
    
    return true;
  }

  /**
   * Check if player has item
   * @param {string} itemId - Item ID to check
   * @param {number} quantity - Minimum quantity needed (default 1)
   */
  function hasItem(itemId, quantity = 1) {
    const item = _state.inventory.find(i => i.id === itemId);
    if (!item) return false;
    return (item.quantity || 1) >= quantity;
  }

  /**
   * Get item from inventory
   * @param {string} itemId - Item ID
   */
  function getItem(itemId) {
    return _state.inventory.find(i => i.id === itemId) || null;
  }

  /**
   * Equip an item
   * @param {Object|string} itemOrId - Item object or ID
   */
  function equipItem(itemOrId) {
    const item = typeof itemOrId === "string" 
      ? _state.inventory.find(i => i.id === itemOrId)
      : itemOrId;
      
    if (!item) {
      console.warn("[PlayerState] Cannot equip - item not found");
      return false;
    }

    // Determine slot based on item type
    let slot = null;
    if (item.type === "weapon") slot = "weapon";
    else if (item.type === "armor") slot = "armor";
    else if (item.slot) slot = item.slot;
    else slot = "accessory";

    _state.equipped[slot] = item;
    _dirty = true;
    saveToStorage();
    
    // Quest hook for equipping
    if (Game.modules?.quests?.completeObjective) {
      Game.modules.quests.completeObjective("wake_up", "equip_weapon");
    }
    
    console.log(`[PlayerState] Equipped ${item.name} in ${slot} slot`);
    triggerInventoryUpdate();
    
    return true;
  }

  /**
   * Award XP to player
   * @param {number} amount - XP to award
   */
  function awardXP(amount) {
    if (typeof amount !== "number" || amount <= 0) return;
    
    _state.xp += amount;
    
    // Check for level up (100 XP per level)
    const xpPerLevel = 100;
    while (_state.xp >= _state.level * xpPerLevel) {
      _state.xp -= _state.level * xpPerLevel;
      _state.level++;
      console.log(`[PlayerState] LEVEL UP! Now level ${_state.level}`);
      
      // Show level up notification
      if (Game.modules?.worldmap?.showMapMessage) {
        Game.modules.worldmap.showMapMessage(`LEVEL UP! You are now level ${_state.level}`);
      }
    }
    
    _dirty = true;
    syncGamePlayerReferences();
    syncWithLegacyPlayer();
    triggerStatsUpdate();
  }

  /**
   * Award caps to player
   * @param {number} amount - Caps to award
   */
  function awardCaps(amount) {
    if (typeof amount !== "number") return;
    
    _state.caps = Math.max(0, _state.caps + amount);
    _dirty = true;
    syncGamePlayerReferences();
    syncWithLegacyPlayer();
    triggerStatsUpdate();
    
    console.log(`[PlayerState] Caps ${amount >= 0 ? '+' : ''}${amount}. Total: ${_state.caps}`);
  }

  /**
   * Mark quest as active
   * @param {string} questId - Quest ID
   */
  function activateQuest(questId) {
    if (!questId) return;
    if (_state.questsCompleted.includes(questId)) return;
    if (_state.questsActive.includes(questId)) return;
    
    _state.questsActive.push(questId);
    _dirty = true;
    saveToStorage();
    
    console.log(`[PlayerState] Quest activated: ${questId}`);
  }

  /**
   * Complete a quest
   * @param {string} questId - Quest ID
   * @param {Object} rewards - Optional rewards { xp, caps, items[] }
   */
  function completeQuest(questId, rewards = {}) {
    if (!questId) return;
    if (_state.questsCompleted.includes(questId)) return;
    
    // Remove from active
    _state.questsActive = _state.questsActive.filter(q => q !== questId);
    
    // Add to completed
    _state.questsCompleted.push(questId);
    
    // Apply rewards
    if (rewards.xp) awardXP(rewards.xp);
    if (rewards.caps) awardCaps(rewards.caps);
    if (Array.isArray(rewards.items)) {
      rewards.items.forEach(item => addItem(item));
    }
    
    _dirty = true;
    saveToStorage();
    
    console.log(`[PlayerState] Quest completed: ${questId}`);
  }

  /**
   * Mark location as visited
   * @param {string} locationId - Location ID
   */
  function visitLocation(locationId) {
    if (!locationId) return;
    if (_state.visitedLocations.includes(locationId)) return;
    
    _state.visitedLocations.push(locationId);
    _dirty = true;
    
    console.log(`[PlayerState] Discovered: ${locationId}`);
  }

  /**
   * Sync state with backend (for authenticated players)
   * @param {string} wallet - Player wallet address
   */
  async function syncWithBackend(wallet) {
    if (!wallet) return;
    _wallet = wallet;
    
    const apiBase = window.API_BASE || window.BACKEND_URL || "";
    if (!apiBase) return;
    
    try {
      // Load from backend
      const res = await fetch(`${apiBase}/api/player/${wallet}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.profile) {
          // Merge backend data (backend is source of truth for caps/xp from on-chain)
          if (data.profile.caps !== undefined) _state.caps = data.profile.caps;
          if (data.profile.xp !== undefined) _state.xp = data.profile.xp;
          if (data.profile.level !== undefined) _state.level = data.profile.level;
          
          syncGamePlayerReferences();
          syncWithLegacyPlayer();
          console.log("[PlayerState] Synced with backend");
        }
      }
      
      _state.lastSynced = Date.now();
      
    } catch (e) {
      console.warn("[PlayerState] Backend sync failed:", e);
    }
  }

  /**
   * Trigger inventory UI update
   */
  function triggerInventoryUpdate() {
    // Try multiple hooks
    if (Game.hooks?.onInventoryUpdated) {
      Game.hooks.onInventoryUpdated();
    }
    if (Game.ui?.renderInventory) {
      Game.ui.renderInventory();
    }
    
    // Dispatch event for any listeners
    window.dispatchEvent(new CustomEvent("inventoryUpdated", {
      detail: { inventory: _state.inventory }
    }));
  }

  /**
   * Trigger stats UI update
   */
  function triggerStatsUpdate() {
    // Update HUD elements
    const capsEl = document.getElementById("stat-caps");
    const xpEl = document.getElementById("stat-xp");
    const levelEl = document.getElementById("stat-level");
    
    if (capsEl) capsEl.textContent = _state.caps;
    if (levelEl) levelEl.textContent = _state.level;
    if (xpEl) xpEl.textContent = `${_state.xp} / ${_state.level * 100}`;
    
    window.dispatchEvent(new CustomEvent("statsUpdated", {
      detail: { caps: _state.caps, xp: _state.xp, level: _state.level }
    }));
  }

  /**
   * Get current state (read-only copy)
   */
  function getState() {
    return { ..._state };
  }

  /**
   * Get inventory array
   * @returns {Array} Copy of inventory array
   */
  function getInventory() {
    return _state.inventory || [];
  }

  /**
   * Give item from NPC to player (unified method)
   * @param {Object} item - Item to give
   * @param {string} npcName - Name of NPC giving item
   */
  function receiveItemFromNPC(item, npcName = "NPC") {
    if (!item) return false;
    
    const success = addItem(item);
    
    if (success) {
      // Show notification
      const message = `Received ${item.name} from ${npcName}`;
      if (Game.modules?.worldmap?.showMapMessage) {
        Game.modules.worldmap.showMapMessage(message);
      }
      
      console.log(`[PlayerState] ${message}`);
    }
    
    return success;
  }

  // Export the module
  const PlayerState = {
    init,
    getState,
    getInventory,
    addItem,
    removeItem,
    hasItem,
    getItem,
    equipItem,
    awardXP,
    awardCaps,
    activateQuest,
    completeQuest,
    visitLocation,
    syncWithBackend,
    receiveItemFromNPC,
    save: saveToStorage,
    load: loadFromStorage
  };

  // Expose globally
  Game.modules.PlayerState = PlayerState;
  window.PlayerState = PlayerState;

  // Auto-initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
