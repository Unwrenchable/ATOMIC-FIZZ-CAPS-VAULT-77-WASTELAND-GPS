// public/js/game-engine.js
// Unified core game engine for Atomic Fizz Caps
// - Core gameplay only (no UI rendering)
// - Hybrid map (MapTiler visual + old claim logic)
// - Hybrid claim system (old loot + new world logic)
// - Uses existing globals: gameState, inventory, world, encounters, ITEMS_DB
// - Exposes a clean API under window.Game

(function () {
  'use strict';

  if (!window.gameState) {
    console.warn("[GameEngine] window.gameState not found. Did you load game-state.js first?");
    window.gameState = {
      player: {
        level: 1,
        hp: 100,
        maxHp: 100,
        caps: 0,
        xp: 0,
        xpToNext: 100,
        rads: 0,
        position: { lat: 36.1699, lng: -115.1398 },
        equipped: { weapon: null, armor: null },
        claimed: new Set(),
      },
      inventory: {
        weapons: [],
        ammo: [],
        armor: [],
        consumables: [],
        questItems: [],
        misc: [],
      },
      quests: {},
      encounters: { active: null },
    };
  }

  const gs = window.gameState;

  // -----------------------------------------
  // CONFIG
  // -----------------------------------------
  const API_BASE = window.location.origin;
  const CLAIM_RADIUS_METERS = 50;
  const MAX_RADS = 1000;

  const PLAYER_STATE_KEY = 'afc_player_state_v2'; // new engine key

  // -----------------------------------------
  // INTERNAL STATE
  // -----------------------------------------
  let walletProvider = null;
  let walletAddress = null;
  let gpsWatchId = null;
  let lastAccuracy = 999;

  // Optional external hooks the UI can subscribe to
  const hooks = {
    onPlayerUpdated: null,   // fn(player)
    onInventoryUpdated: null,// fn(inventory)
    onQuestsUpdated: null,   // fn(quests)
    onClaimResult: null,     // fn(result)
    onError: null,           // fn(err)
  };

  // -----------------------------------------
  // UTILITIES
  // -----------------------------------------
  function safeLog(...args) { try { console.log(...args); } catch (_) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (_) {} }
  function safeError(...args) { try { console.error(...args); } catch (_) {} }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function fireHook(name, payload) {
    const fn = hooks[name];
    if (typeof fn === 'function') {
      try { fn(payload); } catch (e) { safeError(`[GameEngine] hook ${name} error:`, e); }
    }
  }

  // -----------------------------------------
  // LOCAL PERSISTENCE
  // -----------------------------------------
  function savePlayerState() {
    try {
      const p = gs.player;
      const payload = {
        level: p.level,
        hp: p.hp,
        maxHp: p.maxHp,
        caps: p.caps,
        xp: p.xp,
        xpToNext: p.xpToNext,
        rads: p.rads,
        equipped: p.equipped,
        claimed: Array.from(p.claimed || []),
        position: p.position,
      };
      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(payload));
    } catch (e) {
      safeWarn("[GameEngine] Failed to save player state:", e.message);
    }
  }

  function loadPlayerState() {
    try {
      const raw = localStorage.getItem(PLAYER_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      const p = gs.player;
      p.level = typeof parsed.level === 'number' ? parsed.level : p.level;
      p.hp = typeof parsed.hp === 'number' ? parsed.hp : p.hp;
      p.maxHp = typeof parsed.maxHp === 'number' ? parsed.maxHp : p.maxHp;
      p.caps = typeof parsed.caps === 'number' ? parsed.caps : p.caps;
      p.xp = typeof parsed.xp === 'number' ? parsed.xp : p.xp;
      p.xpToNext = typeof parsed.xpToNext === 'number' ? parsed.xpToNext : p.xpToNext;
      p.rads = typeof parsed.rads === 'number' ? parsed.rads : p.rads;
      p.equipped = parsed.equipped || p.equipped;
      p.position = parsed.position || p.position;

      if (Array.isArray(parsed.claimed)) {
        p.claimed = new Set(parsed.claimed);
      } else if (!p.claimed) {
        p.claimed = new Set();
      }

      safeLog("[GameEngine] Player state loaded from localStorage");
    } catch (e) {
      safeWarn("[GameEngine] Failed to load player state:", e.message);
    }
  }

  // -----------------------------------------
  // XP / CAPS / LEVELING
  // -----------------------------------------
  function addXP(amount) {
    if (!amount || isNaN(amount)) return;
    const p = gs.player;
    p.xp += amount;

    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level++;
      p.xpToNext = Math.floor(p.xpToNext * 1.5);
      p.maxHp += 10;
      p.hp = p.maxHp;
      safeLog(`[GameEngine] LEVEL UP -> ${p.level}`);
      // UI can react via onPlayerUpdated
    }

    savePlayerState();
    fireHook('onPlayerUpdated', getPlayer());
  }

  function addCaps(amount) {
    if (!amount || isNaN(amount)) return;
    gs.player.caps += amount;
    savePlayerState();
    fireHook('onPlayerUpdated', getPlayer());
  }

  function addRads(amount) {
    if (!amount || isNaN(amount)) return;
    const p = gs.player;
    p.rads = clamp(p.rads + amount, 0, MAX_RADS);
    savePlayerState();
    fireHook('onPlayerUpdated', getPlayer());
  }

  // -----------------------------------------
  // INVENTORY / GEAR
  // -----------------------------------------
  function addGearItem(gear) {
    if (!gear || !gear.id) return;
    gs.inventory.weapons.push(gear); // treat as weapon-type gear by default
    fireHook('onInventoryUpdated', getInventory());
  }

  function applyGearBonuses() {
    const p = gs.player;
    let hpBonus = 0;
    let capsBonus = 0;
    let radResist = 0;

    const eq = p.equipped || {};
    Object.values(eq).forEach(g => {
      if (!g || !Array.isArray(g.effects)) return;
      g.effects.forEach(e => {
        if (e.type === 'maxHp') hpBonus += e.val;
        if (e.type === 'capsBonus') capsBonus += e.val;
        if (e.type === 'radResist') radResist += e.val;
      });
    });

    p.maxHp = 100 + (p.level - 1) * 10 + hpBonus;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    p.capsBonus = capsBonus;
    p.radResist = radResist;
    savePlayerState();
    fireHook('onPlayerUpdated', getPlayer());
  }

  // -----------------------------------------
  // QUESTS
  // -----------------------------------------
  function triggerQuest(questId) {
    if (!questId) return false;
    if (!gs.quests[questId]) {
      gs.quests[questId] = { state: 'not_started', currentStepIndex: 0 };
    }
    const st = gs.quests[questId];
    if (st.state === 'completed') return false;
    if (st.state === 'active') return true;

    st.state = 'active';
    st.currentStepIndex = 0;
    fireHook('onQuestsUpdated', getQuests());
    safeLog("[GameEngine] Quest triggered:", questId);
    return true;
  }

  function completeQuest(questId, rewards) {
    if (!questId) return;
    const st = gs.quests[questId] || { state: 'not_started', currentStepIndex: 0 };
    st.state = 'completed';
    gs.quests[questId] = st;

    if (rewards) {
      if (rewards.xp) addXP(rewards.xp);
      if (rewards.caps) addCaps(rewards.caps);
      if (Array.isArray(rewards.items)) {
        // You can wire this into inventory.addItemToInventory or gear
        rewards.items.forEach(id => {
          // simple misc item drop
          gs.inventory.misc.push({ id, name: id });
        });
        fireHook('onInventoryUpdated', getInventory());
      }
    }

    fireHook('onQuestsUpdated', getQuests());
  }

  // -----------------------------------------
  // GPS + POSITION
  // -----------------------------------------
  function updatePlayerPosition(lat, lng, acc) {
    gs.player.position = { lat, lng };
    lastAccuracy = acc != null ? acc : lastAccuracy;
    savePlayerState();
    // Also inform world/encounters systems if they exist
    if (window.world && typeof window.world.getCurrentRegion === 'function') {
      const region = window.world.getCurrentRegion();
      safeLog("[GameEngine] Current region:", region && region.id);
    }
    if (window.encounters && typeof window.encounters.maybeTriggerEncounter === 'function') {
      window.encounters.maybeTriggerEncounter();
    }
    fireHook('onPlayerUpdated', getPlayer());
  }

  function startGPS() {
    if (!navigator.geolocation || gpsWatchId !== null) return;

    gpsWatchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        updatePlayerPosition(latitude, longitude, accuracy);
      },
      err => {
        safeWarn("[GameEngine] GPS error:", err.message || err);
        fireHook('onError', err);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  function stopGPS() {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      gpsWatchId = null;
      safeLog("[GameEngine] GPS stopped");
    }
  }

  // -----------------------------------------
  // WALLET + PLAYER LOAD
  // -----------------------------------------
  async function connectWallet() {
    const provider = window.solana || window.phantom?.solana;
    if (!provider || !provider.isPhantom) {
      const err = new Error("Phantom wallet not detected");
      fireHook('onError', err);
      throw err;
    }

    try {
      const res = await provider.connect();
      walletProvider = provider;
      walletAddress = res.publicKey.toString();
      safeLog("[GameEngine] Wallet connected:", walletAddress);

      // Attempt to load backend player state (if route exists)
      try {
        const playerRes = await fetch(`${API_BASE}/player/${walletAddress}`);
        if (playerRes.ok) {
          const data = await playerRes.json();
          hydratePlayerFromBackend(data);
        } else {
          safeLog("[GameEngine] New player or backend /player not ready");
        }
      } catch (e) {
        safeWarn("[GameEngine] /player load failed:", e.message);
      }

      fireHook('onPlayerUpdated', getPlayer());
      return walletAddress;
    } catch (e) {
      safeError("[GameEngine] Wallet connection failed:", e);
      fireHook('onError', e);
      throw e;
    }
  }

  function hydratePlayerFromBackend(data) {
    if (!data || typeof data !== 'object') return;
    const p = gs.player;

    if (typeof data.level === 'number') p.level = data.level;
    if (typeof data.hp === 'number') p.hp = data.hp;
    if (typeof data.maxHp === 'number') p.maxHp = data.maxHp;
    if (typeof data.caps === 'number') p.caps = data.caps;
    if (typeof data.xp === 'number') p.xp = data.xp;
    if (typeof data.xpToNext === 'number') p.xpToNext = data.xpToNext;
    if (typeof data.rads === 'number') p.rads = data.rads;
    if (data.equipped) p.equipped = data.equipped;

    if (Array.isArray(data.claimed)) {
      p.claimed = new Set(data.claimed);
    } else if (!p.claimed) {
      p.claimed = new Set();
    }

    // gear, quests, etc.
    if (Array.isArray(data.gear)) {
      gs.inventory.weapons = data.gear.slice();
    }
    if (data.quests && typeof data.quests === 'object') {
      gs.quests = data.quests;
    }

    savePlayerState();
  }

  // -----------------------------------------
  // HYBRID CLAIM SYSTEM
  // -----------------------------------------

  // Engine-level claim entry point.
  // UI should pass a POI-like object:
  // { n: name, lat, lng, lvl, rarity, id? }
  async function claimLocation(loc) {
    try {
      // Validation
      if (!walletProvider || !walletAddress) {
        throw new Error("Wallet not connected");
      }
      if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
        throw new Error("Invalid location for claim");
      }

      const pPos = gs.player.position;
      const acc = lastAccuracy;
      const dist = distanceMeters(pPos.lat, pPos.lng, loc.lat, loc.lng);

      if (acc > CLAIM_RADIUS_METERS) {
        throw new Error(`GPS accuracy too low (${Math.round(acc)}m)`);
      }
      if (dist > CLAIM_RADIUS_METERS) {
        throw new Error(`Too far from location (${Math.round(dist)}m)`);
      }

      if (!gs.player.claimed) gs.player.claimed = new Set();
      if (gs.player.claimed.has(loc.n || loc.id)) {
        throw new Error("Already claimed this location");
      }

      // Build claim message (compatible with old engine)
      const spotName = loc.n || loc.id || "UNKNOWN";
      const now = Date.now();
      const message = `Claim:${spotName}:${now}`;
      const encoded = new TextEncoder().encode(message);
      const signed = await walletProvider.signMessage(encoded);
      const sigBase58 = window.bs58 ? window.bs58.encode(signed) : null;

      if (!sigBase58) {
        throw new Error("Base58 encoder (bs58) not available on window");
      }

      const resp = await fetch(`${API_BASE}/find-loot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          spot: spotName,
          message,
          signature: sigBase58,
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Claim failed");
      }

      // Apply claim effects (hybrid of old logic)
      handleClaimSuccess(loc, data);

      const result = {
        ok: true,
        location: loc,
        backend: data,
      };

      fireHook('onClaimResult', result);
      return result;
    } catch (err) {
      safeWarn("[GameEngine] Claim error:", err.message || err);
      const result = { ok: false, error: err.message || String(err) };
      fireHook('onClaimResult', result);
      fireHook('onError', err);
      return result;
    }
  }

  function handleClaimSuccess(loc, data) {
    const p = gs.player;
    const name = loc.n || loc.id || "UNKNOWN";

    if (!p.claimed) p.claimed = new Set();
    p.claimed.add(name);

    // CAPS
    const capsFound = typeof data.capsFound === 'number' ? data.capsFound : 0;
    addCaps(capsFound);

    // XP (base + rarity)
    const rarity = loc.rarity || 'common';
    const baseXp =
      rarity === 'legendary' ? 150 :
      rarity === 'epic' ? 100 :
      rarity === 'rare' ? 60 :
      30;

    addXP(baseXp);

    // RADS, mitigated by gear
    const radBase =
      rarity === 'legendary' ? 120 :
      rarity === 'epic' ? 80 :
      rarity === 'rare' ? 50 :
      20;

    const radResist = p.radResist || 0;
    const effectiveRads = Math.max(5, radBase - radResist / 3);
    addRads(effectiveRads);

    // Optional quest updates from backend
    if (data.quests && typeof data.quests === 'object') {
      gs.quests = data.quests;
      fireHook('onQuestsUpdated', getQuests());
    }

    // Gear drop: use backend data or client-side RNG fallback
    let gearDropped = null;
    if (Array.isArray(data.gear) && data.gear.length) {
      data.gear.forEach(g => addGearItem(g));
      gearDropped = data.gear[data.gear.length - 1];
    } else {
      // Fallback: simple rarity-based chance (client side)
      const DROP_CHANCE = { legendary: 0.35, epic: 0.18, rare: 0.09, common: 0.04 };
      const chance = DROP_CHANCE[rarity] || DROP_CHANCE.common;
      if (Math.random() < chance) {
        const g = generateFallbackGear(rarity);
        addGearItem(g);
        gearDropped = g;
      }
    }

    applyGearBonuses();
    savePlayerState();

    // This is where old engine would show modals / play SFX.
    // We just expose the data via onClaimResult and let UI handle it.
    safeLog("[GameEngine] Claim success at", name, {
      capsFound,
      baseXp,
      effectiveRads,
      gearDropped,
    });
  }

  function generateFallbackGear(rarity) {
    const GEAR_NAMES = {
      common: ['Pipe Rifle', '10mm Pistol', 'Leather Armor', 'Vault Suit'],
      rare: ['Hunting Rifle', 'Combat Shotgun', 'Laser Pistol', 'Metal Armor'],
      epic: ['Plasma Rifle', 'Gauss Rifle', 'Combat Armor', 'T-51b Power Armor'],
      legendary: ['Alien Blaster', 'Fat Man', "Lincoln's Repeater", 'Experimental MIRV'],
    };

    const EFFECT_POOL = {
      common: [{ type: 'maxHp', min: 5, max: 20 }, { type: 'radResist', min: 20, max: 60 }],
      rare: [
        { type: 'maxHp', min: 25, max: 50 },
        { type: 'radResist', min: 70, max: 140 },
        { type: 'capsBonus', min: 10, max: 25 },
      ],
      epic: [
        { type: 'maxHp', min: 50, max: 90 },
        { type: 'radResist', min: 150, max: 250 },
        { type: 'capsBonus', min: 25, max: 45 },
        { type: 'xpBonus', min: 15, max: 30 },
      ],
      legendary: [
        { type: 'maxHp', min: 100, max: 180 },
        { type: 'radResist', min: 300, max: 500 },
        { type: 'capsBonus', min: 40, max: 80 },
        { type: 'critDrop', min: 20, max: 40 },
      ],
    };

    function randomEffect(rarityKey) {
      const pool = EFFECT_POOL[rarityKey] || EFFECT_POOL.common;
      const eff = pool[Math.floor(Math.random() * pool.length)];
      const val = eff.min + Math.floor(Math.random() * (eff.max - eff.min + 1));
      return { type: eff.type, val };
    }

    const names = GEAR_NAMES[rarity] || GEAR_NAMES.common;
    const effectCount =
      rarity === 'legendary' ? 3 :
      rarity === 'epic' ? 2 :
      rarity === 'rare' ? 2 : 1;

    const effects = Array.from({ length: effectCount }, () => randomEffect(rarity));

    return {
      id: `gear_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: names[Math.floor(Math.random() * names.length)],
      rarity,
      effects,
      nftMint: null,
    };
  }

  // -----------------------------------------
  // MAP INTEGRATION HOOKS
  // -----------------------------------------

  // Called when the MapTiler map is ready (from map-core.js or ui-wiring.js).
  // Here we just ensure the engine knows about current position, etc.
  function onMapReady() {
    safeLog("[GameEngine] Map ready hook");
    // If you want, you can add map-related engine logic here later.
  }

  // Called when Pip-Boy UI is ready.
  function onPipboyReady() {
    safeLog("[GameEngine] Pip-Boy ready hook");
    // For now we just ensure player state is loaded and hooks can run.
    fireHook('onPlayerUpdated', getPlayer());
    fireHook('onInventoryUpdated', getInventory());
    fireHook('onQuestsUpdated', getQuests());
  }

  // -----------------------------------------
  // PUBLIC GETTERS
  // -----------------------------------------
  function getPlayer() {
    return JSON.parse(JSON.stringify(gs.player));
  }

  function getInventory() {
    return JSON.parse(JSON.stringify(gs.inventory));
  }

  function getQuests() {
    return JSON.parse(JSON.stringify(gs.quests));
  }

  function getStats() {
    const p = gs.player;
    return {
      level: p.level,
      hp: p.hp,
      maxHp: p.maxHp,
      caps: p.caps,
      xp: p.xp,
      xpToNext: p.xpToNext,
      rads: p.rads,
      radResist: p.radResist || 0,
    };
  }

  // -----------------------------------------
  // ENGINE INIT
  // -----------------------------------------
  function init() {
    safeLog("[GameEngine] Initializing hybrid engine...");
    loadPlayerState();

    // Ensure claimed set exists
    if (!gs.player.claimed) {
      gs.player.claimed = new Set();
    }

    // Optional: start GPS automatically if you want
    // startGPS();

    fireHook('onPlayerUpdated', getPlayer());
    fireHook('onInventoryUpdated', getInventory());
    fireHook('onQuestsUpdated', getQuests());
  }

  // -----------------------------------------
  // EXPORT
  // -----------------------------------------
  window.Game = {
    // lifecycle
    init,
    onMapReady,
    onPipboyReady,

    // hooks
    hooks, // { onPlayerUpdated, onInventoryUpdated, onQuestsUpdated, onClaimResult, onError }

    // wallet
    connectWallet,

    // claims
    claimLocation,

    // gps
    startGPS,
    stopGPS,

    // stats / data
    getPlayer,
    getInventory,
    getQuests,
    getStats,

    // xp / caps (if UI ever needs to call directly)
    addXP,
    addCaps,
    addRads,

    // gear
    applyGearBonuses,
  };

  safeLog("[GameEngine] Game engine loaded and ready");
})();
