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
    // Durability for equipped items (0-100)
    durability: {
      weapon: 100,
      head: 100,
      chest: 100,
      arms: 100,
      legs: 100
    },
    // Quest state
    questsActive: [],
    questsCompleted: [],
    questObjectives: {},
    // Character stats
    level: 1,
    xp: 0,
    caps: 0,
    karma: 0,
    // SPECIAL stats — default 5 in each attribute (Fallout standard mid-point)
    // S=Strength, P=Perception, E=Endurance, C=Charisma, I=Intelligence, A=Agility, L=Luck
    special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 },
    // Survival stats
    survival: {
      radiation: 0,    // 0-1000
      hunger: 100,     // 0-100
      thirst: 100,     // 0-100
      lastUpdated: Date.now()
    },
    // Chem addiction levels (0-100) for each chem type
    addiction: {
      jet: 0,
      psycho: 0,
      buffout: 0,
      mentats: 0
    },
    // Perks acquired by player
    perks: [],
    // Companions
    companions: [],
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
  let _survivalTimer = null;
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
    if (_survivalTimer) { clearInterval(_survivalTimer); _survivalTimer = null; }

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
    
    // Start survival update interval (every 5 minutes)
    _survivalTimer = setInterval(() => {
      updateSurvival();
    }, 5 * 60 * 1000); // 5 minutes
    
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
        if (!Array.isArray(_state.perks)) _state.perks = [];
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
        // Ensure survival object exists with defaults
        if (!_state.survival || typeof _state.survival !== 'object') {
          _state.survival = { radiation: 0, hunger: 100, thirst: 100, lastUpdated: Date.now() };
        } else {
          if (typeof _state.survival.radiation !== 'number') _state.survival.radiation = 0;
          if (typeof _state.survival.hunger !== 'number') _state.survival.hunger = 100;
          if (typeof _state.survival.thirst !== 'number') _state.survival.thirst = 100;
          if (typeof _state.survival.lastUpdated !== 'number') _state.survival.lastUpdated = Date.now();
        }
        // Ensure addiction object exists with defaults
        if (!_state.addiction || typeof _state.addiction !== 'object') {
          _state.addiction = { jet: 0, psycho: 0, buffout: 0, mentats: 0 };
        } else {
          const ADDICTION_DEFAULTS = { jet: 0, psycho: 0, buffout: 0, mentats: 0 };
          Object.keys(ADDICTION_DEFAULTS).forEach(k => {
            if (typeof _state.addiction[k] !== 'number') _state.addiction[k] = ADDICTION_DEFAULTS[k];
          });
        // Ensure durability object exists
        if (!_state.durability || typeof _state.durability !== 'object') {
          _state.durability = { weapon: 100, head: 100, chest: 100, arms: 100, legs: 100 };
        } else {
          const DURABILITY_DEFAULTS = { weapon: 100, head: 100, chest: 100, arms: 100, legs: 100 };
          Object.keys(DURABILITY_DEFAULTS).forEach(k => {
            if (typeof _state.durability[k] !== 'number') _state.durability[k] = DURABILITY_DEFAULTS[k];
          });
        }
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
   * Sync with legacy PLAYER object if it exists
   */
  function syncWithLegacyPlayer() {
    if (window.PLAYER) {
      // Sync basic properties
      window.PLAYER.inventory = _state.inventory;
      window.PLAYER.equipped = _state.equipped;
      window.PLAYER.level = _state.level;
      window.PLAYER.xp = _state.xp;
      window.PLAYER.caps = _state.caps;
      window.PLAYER.special = _state.special;
    }
  }

  /**
   * Update survival stats periodically
   */
  function updateSurvival() {
    if (!_state || !_state.survival) return;
    
    const now = Date.now();
    const lastUpdate = _state.survival.lastUpdated || now;
    const timeDiff = now - lastUpdate;
    
    // Decay every 10 minutes (600000 ms)
    const decayInterval = 10 * 60 * 1000; // 10 minutes
    const decayCycles = Math.floor(timeDiff / decayInterval);
    
    if (decayCycles > 0) {
      // Hunger and thirst decrease by 1 per cycle
      _state.survival.hunger = Math.max(0, _state.survival.hunger - decayCycles);
      _state.survival.thirst = Math.max(0, _state.survival.thirst - decayCycles);
      _state.survival.lastUpdated = now;
      
      // Hardcore mode: death at 0 hunger or thirst
      if (_state.survival.hunger <= 0 || _state.survival.thirst <= 0) {
        // Set HP to 0 if player is alive
        if (window.PLAYER && window.PLAYER.hp > 0) {
          window.PLAYER.hp = 0;
          console.log("[PlayerState] Player died from starvation/dehydration");
          // Trigger death overlay or something
          if (Game.modules?.battle?._showDeathOverlay) {
            Game.modules.battle._showDeathOverlay();
          }
        }
      }
      
      _dirty = true;
      syncGamePlayerReferences();
      triggerSurvivalUpdate();
    }
  }

  /**
   * Decay durability of equipped items on use
   * @param {string} slot - Equipment slot (weapon, head, chest, arms, legs)
   * @param {number} amount - Amount to decay (default 5)
   */
  function decayDurability(slot, amount = 5) {
    if (!_state.durability || !_state.durability[slot]) return;
    _state.durability[slot] = Math.max(0, _state.durability[slot] - amount);
    _dirty = true;
    console.log(`[PlayerState] ${slot} durability decayed by ${amount} to ${_state.durability[slot]}`);
    if (_state.durability[slot] <= 0) {
      // Item breaks
      unequipItem(slot);
      console.log(`[PlayerState] ${slot} item broke!`);
    }
  }

  /**
   * Repair durability of equipped item
   * @param {string} slot - Equipment slot
   * @param {number} amount - Amount to repair (default 25)
   */
  function repairDurability(slot, amount = 25) {
    if (!_state.durability || !_state.durability[slot]) return;
    _state.durability[slot] = Math.min(100, _state.durability[slot] + amount);
    _dirty = true;
    console.log(`[PlayerState] ${slot} durability repaired by ${amount} to ${_state.durability[slot]}`);
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
    const itemWeight = item.weight || 0;
    const additionalWeight = itemWeight * quantity;

    // Check carry weight limit
    const currentWeight = getTotalCarryWeight();
    const maxWeight = getMaxCarryWeight();
    if (currentWeight + additionalWeight > maxWeight) {
      console.warn(`[PlayerState] Cannot add ${item.name} — would exceed carry weight limit (${currentWeight + additionalWeight}/${maxWeight})`);
      return false;
    }

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

  // Cache for armor sets data
  let _armorSetsCache = null;

  /**
   * Get active armor set bonuses
   * @returns {Promise<Object>} Active set bonuses { damageResist: number, ... }
   */
  async function getActiveSetBonuses() {
    const bonuses = { damageResist: 0 };
    if (!_state || !_state.equipped) return bonuses;

    // Load armor sets data if not cached
    if (!_armorSetsCache) {
      try {
        const response = await fetch('/data/items/armor_sets.json');
        if (response.ok) {
          _armorSetsCache = await response.json();
        } else {
          console.warn('[PlayerState] Could not load armor_sets.json for set bonuses');
          return bonuses;
        }
      } catch (e) {
        console.warn('[PlayerState] Error loading armor_sets.json:', e);
        return bonuses;
      }
    }

    // Check each set
    for (const setKey in _armorSetsCache) {
      const setData = _armorSetsCache[setKey];
      if (!setData.pieceIds) continue;

      let piecesEquipped = 0;
      const totalPieces = Object.keys(setData.pieceIds).length;

      // Check if all pieces are equipped
      for (const slot in setData.pieceIds) {
        const pieceId = setData.pieceIds[slot];
        const equippedItem = _state.equipped[slot];
        if (equippedItem && equippedItem.id === pieceId) {
          piecesEquipped++;
        }
      }

      // If full set equipped, apply bonuses
      if (piecesEquipped === totalPieces && setData.fullSetBonus) {
        if (setData.fullSetBonus.damageResist) {
          bonuses.damageResist += setData.fullSetBonus.damageResist;
        }
        // Could add other bonuses here in the future
      }
    }

    return bonuses;
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
    // BUG-047 FIX: cap at MAX_CAPS to match backend/lib/caps.js limit.
    // Previously there was no ceiling, so rapid reward farming or DevTools
    // manipulation could push the client-side balance beyond 999,999,999,
    // causing display overflows in the Pip-Boy UI and potential bypass of
    // client-side affordability gates.
    const MAX_CAPS = 999_999_999;
    _state.caps = Math.max(0, Math.min(_state.caps + amount, MAX_CAPS));
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
          if (data.profile.karma !== undefined) _state.karma = data.profile.karma;
          if (data.profile.survival) {
            // Merge survival stats, but keep local lastUpdated if more recent
            _state.survival = { ..._state.survival, ...data.profile.survival };
            if (data.profile.survival.lastUpdated < _state.survival.lastUpdated) {
              _state.survival.lastUpdated = data.profile.survival.lastUpdated;
            }
          }
          
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
   * Trigger survival UI update
   */
  function triggerSurvivalUpdate() {
    window.dispatchEvent(new CustomEvent("survivalUpdated", {
      detail: { survival: _state ? { ..._state.survival } : null }
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
    
    // Update survival stats
    const radEl = document.getElementById("stat-rad-label");
    const radBar = document.getElementById("stat-rad-bar");
    const hungerEl = document.getElementById("stat-hunger-label");
    const hungerBar = document.getElementById("stat-hunger-bar");
    const thirstEl = document.getElementById("stat-thirst-label");
    const thirstBar = document.getElementById("stat-thirst-bar");
    
    if (_state && _state.survival) {
      const radPct = Math.min(100, (_state.survival.radiation / 1000) * 100);
      if (radEl) radEl.textContent = `${Math.round(radPct)}%`;
      if (radBar) radBar.style.width = `${radPct}%`;
      
      const hungerPct = (_state.survival.hunger / 100) * 100;
      if (hungerEl) hungerEl.textContent = `${Math.round(hungerPct)}%`;
      if (hungerBar) hungerBar.style.width = `${hungerPct}%`;
      
      const thirstPct = (_state.survival.thirst / 100) * 100;
      if (thirstEl) thirstEl.textContent = `${Math.round(thirstPct)}%`;
      if (thirstBar) thirstBar.style.width = `${thirstPct}%`;
    }
    
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
   * Get effective SPECIAL stats, reduced by hunger/thirst and withdrawal
   * @returns {Object} Effective special stats
   */
  function getEffectiveSpecial() {
    if (!_state || !_state.special || !_state.survival) return { S:5,P:5,E:5,C:5,I:5,A:5,L:5 };
    
    const base = { ..._state.special };
    const hunger = _state.survival.hunger;
    const thirst = _state.survival.thirst;
    
    // Hunger/thirst reduce SPECIAL stats
    // At 0 hunger/thirst, -50% reduction
    const hungerPenalty = Math.max(0, (100 - hunger) / 200); // 0 to 0.5
    const thirstPenalty = Math.max(0, (100 - thirst) / 200); // 0 to 0.5
    const totalPenalty = hungerPenalty + thirstPenalty;
    
    // Apply withdrawal penalties
    const withdrawalPenalties = getWithdrawalPenalties();
    
    const effective = {};
    for (const key in base) {
      let stat = base[key];
      // Apply hunger/thirst penalty
      stat = Math.max(1, Math.floor(stat * (1 - totalPenalty)));
      // Apply withdrawal penalty
      stat = Math.max(1, stat + (withdrawalPenalties[key] || 0));
      effective[key] = stat;
    }
    
    return effective;
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
   * Get player's acquired perks
   * @returns {Array} Array of perk IDs
   */
  function getPerks() {
    return _state ? [..._state.perks] : [];
  }

  /**
   * Add a perk to player
   * @param {string} perkId - Perk ID to add
   */
  function addPerk(perkId) {
    if (!perkId || !_state) return false;
    if (_state.perks.includes(perkId)) return true; // Already has it
    
    _state.perks.push(perkId);
    _dirty = true;
    saveToStorage();
    
    console.log(`[PlayerState] Perk acquired: ${perkId}`);
    return true;
  }

  /**
   * Check if player has a specific perk
   * @param {string} perkId - Perk ID to check
   * @returns {boolean} True if player has the perk
   */
  function hasPerk(perkId) {
    return _state && _state.perks.includes(perkId);
  }

  /**
   * Calculate total carry weight of inventory
   * @returns {number} Total weight in lbs
   */
  function getTotalCarryWeight() {
    if (!_state || !_state.inventory) return 0;
    return _state.inventory.reduce((total, item) => {
      const weight = item.weight || 0;
      const qty = item.quantity || 1;
      return total + (weight * qty);
    }, 0);
  }

  /**
   * Get maximum carry weight based on Strength stat
   * @returns {number} Max weight in lbs (base 150 + Strength * 10)
   */
  function getMaxCarryWeight() {
    if (!_state || !_state.special) return 150;
    const strength = _state.special.S || 5;
    return 150 + (strength * 10);
  }

  /**
   * Check if player is over encumbered
   * @returns {boolean} True if carrying more than max weight
   */
  function isOverEncumbered() {
    return getTotalCarryWeight() > getMaxCarryWeight();
  }

  /**
   * Use RadAway to reduce radiation
   * @param {number} amount - Amount to reduce (default 100)
   */
  function useRadAway(amount = 100) {
    if (!_state || !_state.survival) return false;
    _state.survival.radiation = Math.max(0, _state.survival.radiation - amount);
    _dirty = true;
    saveToStorage();
    triggerSurvivalUpdate();
    console.log(`[PlayerState] Used RadAway, radiation reduced by ${amount}`);
    return true;
  }

  /**
   * Use a consumable item
   * @param {Object} item - The item to use
   * @returns {boolean} Success
   */
  function useItem(item) {
    if (!item || !item.id) return false;
    
    // Check if item exists in inventory
    const invItem = _state.inventory.find(i => i.id === item.id);
    if (!invItem || (invItem.quantity || 1) <= 0) return false;
    
    // Handle different consumable types
    if (item.type === 'consumable') {
      if (item.tags && item.tags.includes('healing')) {
        // Healing items (stimpak)
        const healAmount = item.heal || 20;
        if (_state.hp !== undefined) {
          _state.hp = Math.min(_state.maxHp || 100, _state.hp + healAmount);
        }
        console.log(`[PlayerState] Used ${item.name}, healed ${healAmount} HP`);
      } else if (item.tags && item.tags.includes('radiation')) {
        // Radiation items (radaway, radx)
        const radAmount = item.id === 'radaway' ? 100 : (item.id === 'radx' ? 50 : 0);
        if (radAmount > 0) {
          _state.survival.radiation = Math.max(0, _state.survival.radiation - radAmount);
        }
        console.log(`[PlayerState] Used ${item.name}, radiation reduced by ${radAmount}`);
      } else if (item.tags && item.tags.includes('food')) {
        // Food items
        consumeFood(25);
        console.log(`[PlayerState] Used ${item.name}, hunger restored`);
      } else if (item.tags && item.tags.includes('drink')) {
        // Drink items
        consumeWater(25);
        console.log(`[PlayerState] Used ${item.name}, thirst restored`);
      } else if (item.tags && item.tags.includes('chem')) {
        // Chem items - handle addiction
        useChem(item);
        console.log(`[PlayerState] Used chem ${item.name}`);
      } else {
        console.log(`[PlayerState] Used ${item.name} (unknown effect)`);
      }
      
      // Remove one from inventory
      if (invItem.quantity > 1) {
        invItem.quantity--;
      } else {
        const index = _state.inventory.indexOf(invItem);
        _state.inventory.splice(index, 1);
      }
      
      _dirty = true;
      saveToStorage();
      triggerInventoryUpdate();
      return true;
    }
    
    return false;
  }

  /**
   * Use a chem and handle addiction
   * @param {Object} chem - The chem item
   */
  function useChem(chem) {
    if (!chem || !chem.id || !_state.addiction) return;
    
    const chemType = chem.id; // jet, psycho, buffout, mentats
    if (!(chemType in _state.addiction)) return;
    
    // Increase addiction level
    const intelligence = _state.special.I || 5;
    const baseAddictionIncrease = 10; // Base increase per use
    const intelligenceReduction = Math.max(0, (intelligence - 5) * 2); // -2% per INT above 5
    const addictionIncrease = Math.max(1, baseAddictionIncrease - intelligenceReduction);
    
    _state.addiction[chemType] = Math.min(100, _state.addiction[chemType] + addictionIncrease);
    
    console.log(`[PlayerState] Chem addiction for ${chemType} increased to ${_state.addiction[chemType]}`);
    
    // Apply immediate effects based on chem type
    // This could be expanded with specific stat boosts
    if (chem.id === 'jet') {
      // Jet: temporary agility boost (could be implemented with timed effects)
    } else if (chem.id === 'psycho') {
      // Psycho: temporary strength boost
    } else if (chem.id === 'buffout') {
      // Buffout: temporary strength boost
    } else if (chem.id === 'mentats') {
      // Mentats: temporary intelligence boost
    }
  }

  /**
   * Get current addiction levels
   * @returns {Object} Addiction levels
   */
  function getAddiction() {
    return _state ? { ..._state.addiction } : { jet: 0, psycho: 0, buffout: 0, mentats: 0 };
  }

  /**
   * Get withdrawal penalties for battles
   * @returns {Object} Stat penalties { S: number, P: number, etc. }
   */
  function getWithdrawalPenalties() {
    if (!_state || !_state.addiction) return {};
    
    const penalties = { S: 0, P: 0, E: 0, C: 0, I: 0, A: 0, L: 0 };
    
    // Check each chem for withdrawal
    Object.keys(_state.addiction).forEach(chemType => {
      const level = _state.addiction[chemType];
      if (level >= 20) { // Withdrawal threshold
        // Random stat debuffs based on chem type
        const random = crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF;
        const debuff = Math.floor(random * 3) + 1; // 1-3 points
        
        switch (chemType) {
          case 'jet':
            penalties.A -= debuff; // Agility penalty
            break;
          case 'psycho':
            penalties.S -= debuff; // Strength penalty
            penalties.P -= debuff; // Perception penalty
            break;
          case 'buffout':
            penalties.S -= debuff; // Strength penalty
            penalties.E -= debuff; // Endurance penalty
            break;
          case 'mentats':
            penalties.I -= debuff; // Intelligence penalty
            penalties.P -= debuff; // Perception penalty
            break;
        }
      }
    });
    
    return penalties;
  }

  /**
   * Consume food to restore hunger
   * @param {number} amount - Amount to restore (default 25)
   */
  function consumeFood(amount = 25) {
    if (!_state || !_state.survival) return false;
    _state.survival.hunger = Math.min(100, _state.survival.hunger + amount);
    _dirty = true;
    saveToStorage();
    triggerSurvivalUpdate();
    console.log(`[PlayerState] Consumed food, hunger restored by ${amount}`);
    return true;
  }

  /**
   * Consume water to restore thirst
   * @param {number} amount - Amount to restore (default 25)
   */
  function consumeWater(amount = 25) {
    if (!_state || !_state.survival) return false;
    _state.survival.thirst = Math.min(100, _state.survival.thirst + amount);
    _dirty = true;
    saveToStorage();
    triggerSurvivalUpdate();
    console.log(`[PlayerState] Consumed water, thirst restored by ${amount}`);
    return true;
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
    getActiveSetBonuses,
    awardXP,
    awardCaps,
    activateQuest,
    completeQuest,
    visitLocation,
    syncWithBackend,
    receiveItemFromNPC,
    getSpecial: function () { return getEffectiveSpecial(); },
    getKarma: function () { return _state ? _state.karma || 0 : 0; },
    modifyKarma: function (delta) {
      if (!_state) return;
      if (typeof delta !== 'number' || !isFinite(delta)) return;
      _state.karma = (_state.karma || 0) + delta;
      _dirty = true;
      syncGamePlayerReferences();
      saveToStorage();
      triggerStatsUpdate();
    },
    setSpecial: function (key, value) {
      if (!_state || !_state.special) return;
      if (typeof value !== 'number') return;
      _state.special[key] = Math.max(1, Math.min(10, Math.round(value)));
      _dirty = true;
      syncGamePlayerReferences();
      saveToStorage();
    },
    getPerks,
    addPerk,
    hasPerk,
    getTotalCarryWeight,
    getMaxCarryWeight,
    isOverEncumbered,
    applyBackgroundModifiers,
    save: saveToStorage,
    load: loadFromStorage,
    // Survival functions
    getSurvival: function () { return _state ? { ..._state.survival } : { radiation: 0, hunger: 100, thirst: 100, lastUpdated: Date.now() }; },
    useRadAway,
    consumeFood,
    consumeWater,
    updateSurvival,
    // Chem and addiction functions
    useItem,
    getAddiction,
    getWithdrawalPenalties,
    // Durability functions
    decayDurability,
    repairDurability,
    getDurability: function () { return _state ? { ..._state.durability } : {}; }

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
