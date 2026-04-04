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
    // Equipped items by slot — Fallout-style named slots
    equipped: {
      weapon: null,    // right-hand weapon
      head: null,      // helmet / hat
      chest: null,     // body armor / suit
      arms: null,      // arm armor
      legs: null,      // leg armor
      aid: null,       // quick-use consumable
      accessory: null  // misc / quest items
    },
    // Quest state
    questsActive: [],
    questsCompleted: [],
    questObjectives: {},
    // Character stats
    level: 1,
    xp: 0,
    caps: 0,
    // SPECIAL stats — default 5 in each attribute (Fallout standard mid-point)
    // S=Strength, P=Perception, E=Endurance, C=Charisma, I=Intelligence, A=Agility, L=Luck
    special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 },
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
    // BUG FIX: guard against double-initialisation.  If init() is called more
    // than once (e.g. due to a race condition during startup), the previous
    // intervals are leaked because setInterval() returns a new ID each time and
    // the old timers are never cleared.  Clear any existing timers first.
    if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
    if (_backendSyncTimer) { clearInterval(_backendSyncTimer); _backendSyncTimer = null; }

    loadFromStorage();
    
    // Sync Game.player references
    syncGamePlayerReferences();
    
    // Also sync with legacy PLAYER object if it exists
    syncWithLegacyPlayer();
    
    // Start auto-save interval (only saves when dirty)
    _syncTimer = setInterval(() => {
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
        // Ensure equipped object has all Fallout-style slots (migrate old "armor" → "chest")
        const EQ_DEFAULTS = { weapon: null, head: null, chest: null, arms: null, legs: null, aid: null, accessory: null };
        if (!_state.equipped || typeof _state.equipped !== "object") {
          _state.equipped = { ...EQ_DEFAULTS };
        } else {
          // Migrate legacy generic "armor" slot to "chest"
          if (_state.equipped.armor && !_state.equipped.chest) {
            _state.equipped.chest = _state.equipped.armor;
          }
          delete _state.equipped.armor;
          // Fill missing slots with null
          Object.keys(EQ_DEFAULTS).forEach(k => {
            if (!(k in _state.equipped)) _state.equipped[k] = null;
          });
        }
        // Ensure SPECIAL object exists with defaults for any missing keys
        if (!_state.special || typeof _state.special !== 'object') {
          _state.special = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };
        } else {
          const SPECIAL_DEFAULTS = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };
          Object.keys(SPECIAL_DEFAULTS).forEach(k => {
            if (typeof _state.special[k] !== 'number') _state.special[k] = SPECIAL_DEFAULTS[k];
          });
        }
        
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
      
      // Legacy equipped items — migrate old "armor" key → "chest"
      const equippedRaw = localStorage.getItem("afc_equipped_items");
      if (equippedRaw) {
        const equipped = JSON.parse(equippedRaw);
        if (equipped.weapon && !_state.equipped.weapon) _state.equipped.weapon = equipped.weapon;
        // Migrate old generic "armor" slot → "chest"
        const legacyArmor = equipped.armor || equipped.chest;
        if (legacyArmor && !_state.equipped.chest) _state.equipped.chest = legacyArmor;
        if (equipped.head && !_state.equipped.head) _state.equipped.head = equipped.head;
        if (equipped.arms && !_state.equipped.arms) _state.equipped.arms = equipped.arms;
        if (equipped.legs && !_state.equipped.legs) _state.equipped.legs = equipped.legs;
        if (equipped.aid && !_state.equipped.aid) _state.equipped.aid = equipped.aid;
        if (equipped.accessory && !_state.equipped.accessory) _state.equipped.accessory = equipped.accessory;
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
      
      _dirty = false;
    } catch (e) {
      console.error("[PlayerState] Failed to save:", e);
    }
  }

  /**
   * Update legacy storage — DEPRECATED.
   * Previously called on every save, creating three competing localStorage keys
   * (afc_unified_player_state_v2, afc_player_state_v1, afc_equipped_items).
   * A partial write during tab-kill could desync them. Now afc_unified_player_state_v2
   * is the single source of truth. This function is retained only for the one-time
   * migration in mergeLegacyStorage() and should not be called on saves.
  // eslint-disable-next-line no-unused-vars
   */
  function updateLegacyStorage() {
    try {
      // Write legacy main.js format — kept only for external code that may still read it
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
      
      // Write equipped items
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
    Game.player.special = _state.special;
    // Also sync to window.PLAYER.special for VATS and legacy modules
    if (window.PLAYER) {
      window.PLAYER.special = _state.special;
    }
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

    const MAX_INVENTORY_SIZE = 200;

    // Check if item already exists
    const existing = _state.inventory.find(i => i.id === item.id);
    
    // Weapons and armor are unique — never stack or duplicate
    const isUnique = item.type === "weapon" || item.type === "armor";

    if (existing) {
      if (isUnique || item.stackable === false) {
        // Already owned and non-stackable — skip silently.
        // No save needed since inventory is unchanged.
        console.log(`[PlayerState] ${item.name} already owned, skipping duplicate`);
        return true;
      }
      // Stack consumable / ammo / tool etc.
      existing.quantity = (existing.quantity || 1) + quantity;
      console.log(`[PlayerState] Stacked ${quantity}x ${item.name} (total: ${existing.quantity})`);
    } else {
      // Enforce inventory size cap before adding a new slot
      if (_state.inventory.length >= MAX_INVENTORY_SIZE) {
        console.warn(`[PlayerState] Inventory full (${MAX_INVENTORY_SIZE} items) — cannot add ${item.name}`);
        return false;
      }
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

    // Sync removal to legacy PLAYER.inventory (array of ID strings)
    if (window.PLAYER && Array.isArray(window.PLAYER.inventory)) {
      const stillHas = _state.inventory.some(i => i.id === itemId);
      if (!stillHas) {
        const legacyIdx = window.PLAYER.inventory.indexOf(itemId);
        if (legacyIdx !== -1) {
          window.PLAYER.inventory.splice(legacyIdx, 1);
        }
      }
    }

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

    // Quest items cannot be equipped — they are key items only
    if (item.type === "quest" || item.type === "questItem") {
      console.warn("[PlayerState] Cannot equip quest item:", item.name);
      return false;
    }

    // Determine slot based on item type and slot field (Fallout-style)
    let slot;
    if (item.type === "weapon") slot = "weapon";
    else if (item.type === "armor") slot = item.slot || "chest"; // use item.slot (head/chest/arms/legs)
    else if (item.type === "consumable") slot = "aid";
    else if (item.slot) slot = item.slot;
    else slot = "accessory";

    _state.equipped[slot] = item;
    _dirty = true;
    saveToStorage();
    
    // Quest hook: only fire equip_weapon when a weapon is actually equipped
    if (slot === "weapon" && Game.modules?.quests?.completeObjective) {
      Game.modules.quests.completeObjective("wake_up", "equip_weapon");
    }
    
    console.log(`[PlayerState] Equipped ${item.name} in ${slot} slot`);
    triggerInventoryUpdate();
    
    return true;
  }

  /**
   * Unequip an item from a slot
   * @param {string} slot - Slot to clear (weapon, head, chest, arms, legs, aid, accessory)
   */
  function unequipItem(slot) {
    if (!slot || !_state) return false;
    if (!_state.equipped[slot]) return false;

    const item = _state.equipped[slot];
    _state.equipped[slot] = null;
    _dirty = true;
    saveToStorage();

    console.log(`[PlayerState] Unequipped ${item.name} from ${slot} slot`);
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
    const MAX_LEVEL = 100;
    while (_state.xp >= _state.level * xpPerLevel && _state.level < MAX_LEVEL) {
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
    if (typeof amount !== "number" || !Number.isFinite(amount)) return;
    
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

  /**
   * Calculate derived stats from a SPECIAL object
   * Formulas match character creator preview exactly
   * @param {Object} special - SPECIAL stat object {S,P,E,C,I,A,L}
   * @returns {Object} Derived stats
   */
  function calcDerivedStats(special) {
    const sp = special || (_state ? _state.special : null) || { S:5,P:5,E:5,C:5,I:5,A:5,L:5 };
    return {
      maxHP:         90  + (sp.E * 10),
      actionPoints:  60  + (sp.A * 10),
      carryWeight:   150 + (sp.S * 10),
      radResistance: sp.E * 2,
      critChance:    sp.L
    };
  }

  /**
   * Apply background modifiers to SPECIAL (capped 1–10 each)
   * @param {Object} base - Base SPECIAL from player allocation
   * @param {Object} bgModifiers - specialModifiers object from backgrounds.json
   * @returns {Object} Modified SPECIAL
   */
  function applyBackgroundModifiers(base, bgModifiers) {
    if (!bgModifiers) return { ...base };
    const result = { ...base };
    const keys = ['S','P','E','C','I','A','L'];
    keys.forEach(k => {
      if (typeof bgModifiers[k] === 'number') {
        result[k] = Math.min(10, Math.max(1, (result[k] || 5) + bgModifiers[k]));
      }
    });
    return result;
  }

  /**
   * Get derived stats for the current player
   * Incorporates background modifiers from saved appearance if available
   * @returns {Object} Derived stats
   */
  function getDerivedStats() {
    // Fallback uses 5-per-stat (the pre-character-creator default) for returning
    // players who loaded before the SPECIAL allocator was introduced. New players
    // going through character creation will have appearance.special written with
    // their chosen allocation (starting from 1-per-stat) and that path is taken
    // in the try block below.
    let sp = _state ? { ..._state.special } : { S:5,P:5,E:5,C:5,I:5,A:5,L:5 };

    // Try to load background modifiers from saved appearance
    try {
      const encoded = localStorage.getItem('playerAppearance_encoded');
      if (encoded) {
        const decoded = decodeURIComponent(escape(atob(encoded)));
        const appearance = JSON.parse(decoded);
        if (appearance.background && appearance.special) {
          // Use SPECIAL from appearance (character creator allocation)
          sp = { ...appearance.special };
        }
      }
    } catch (e) {
      // Fall back to _state.special silently
    }

    return calcDerivedStats(sp);
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
    unequipItem,
    awardXP,
    awardCaps,
    activateQuest,
    completeQuest,
    visitLocation,
    syncWithBackend,
    receiveItemFromNPC,
    getSpecial: function () { return _state ? { ..._state.special } : { S:5,P:5,E:5,C:5,I:5,A:5,L:5 }; },
    setSpecial: function (key, value) {
      if (!_state || !_state.special) return;
      if (typeof value !== 'number') return;
      _state.special[key] = Math.max(1, Math.min(10, Math.round(value)));
      _dirty = true;
      syncGamePlayerReferences();
      saveToStorage();
    },
    getDerivedStats,
    calcDerivedStats,
    applyBackgroundModifiers,
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
