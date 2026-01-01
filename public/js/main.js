// main.js – ATOMIC FIZZ CAPS • WASTELAND GPS
// Complete, fixed, drop-in file with multi-map modes (Stamen Terrain default),
// ESRI Satellite, Stamen Toner, GPS, VATS battle engine, terminals, quests, items,
// collectibles, wallet int// public/js/main.js
// Comprehensive drop-in main script for Pip-Boy Wasteland GPS
// - Robust data loading with graceful fallbacks
// - NFT mintables -> in-game item mapping + leveling
// - Quest activation (only active quests trigger)
// - Multi-map support with tile error handling and OSM fallback
// - Mobile-friendly boot activation and idempotent init
// - Defensive guards to avoid runtime exceptions
// - Debug helpers and minimal CSS safety injection
//
// NOTE: This file is intentionally self-contained and defensive.
// If your project already defines functions like initUi(), renderShopPanel(), etc.,
// this script will call them when available. Adjust paths or names if your project differs.

(function () {
  'use strict';

  //
  // === Global safe defaults ===
  //
  // Ensure a safe global DATA object exists before any other code runs
window.DATA = window.DATA || {
  scavenger: [],
  mintables: [],
  quests: [],
  locations: [],
  collectibles: [],
  factions: []
};


  // Map and UI globals
  let map = window.map || null;
  let mapEl = document.getElementById('map') || null;
  let currentMapLayer = null;
  let terrainLayer = null;
  let tonerLayer = null;
  let satelliteLayer = null;

  // Init guards
  let _gameInitializing = false;
  let _gameInitialized = false;

  //
  // === Utility helpers ===
  //
  function safeLog(...args) {
    try { console.log(...args); } catch (e) { /* ignore */ }
  }
  function safeWarn(...args) {
    try { console.warn(...args); } catch (e) { /* ignore */ }
  }
  function safeError(...args) {
    try { console.error(...args); } catch (e) { /* ignore */ }
  }

  // Simple DOM helper
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

  //
  // === Robust data loader ===
  //
  async function loadDataFile(name) {
    try {
      const url = `/data/${name}.json`;
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) {
        safeWarn(`${name}.json fetch failed:`, res.status, res.statusText);
        if (name === 'scavenger') window.DATA.scavenger = [];
        return;
      }
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const text = await res.text();
      if (!contentType.includes('application/json')) {
        safeWarn(`${name}.json served as ${contentType}; preview:`, text.slice(0, 400));
        if (name === 'scavenger') window.DATA.scavenger = [];
        return;
      }
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        safeWarn(`${name}.json parse error:`, e);
        if (name === 'scavenger') window.DATA.scavenger = [];
        return;
      }
      if (name === 'collectibles') {
        window.DATA.collectiblesPack = {
          id: json.id || null,
          description: json.description || '',
          collectibles: Array.isArray(json.collectibles) ? json.collectibles : []
        };
      } else {
        window.DATA[name] = json;
      }
    } catch (e) {
      safeError(`Failed to load ${name}.json`, e);
      if (name === 'scavenger') window.DATA.scavenger = [];
    }
  }

  async function loadAllData() {
    const names = ['locations', 'quests', 'scavenger', 'collectibles', 'factions', 'mintables'];
    await Promise.all(names.map(async (name) => {
      try {
        await loadDataFile(name);
      } catch (e) {
        safeWarn('loadDataFile failed for', name, e);
        if (name === 'scavenger') window.DATA.scavenger = [];
      }
    }));
  }

  //
  // === NFT -> in-game item mapping and leveling ===
  //
  function nftToGameItem(nft) {
    const meta = nft && nft.metadata ? nft.metadata : {};
    const rarity = (meta.rarity || 'common').toString().toLowerCase();
    const level = Math.max(1, parseInt(meta.level || 1, 10) || 1);
    const basePower = Math.max(1, parseFloat(meta.basePower || 1) || 1);
    const type = meta.type || 'misc';
    const rarityMultiplier = { common: 1, rare: 1.2, epic: 1.45, legendary: 1.8 }[rarity] || 1;
    const power = Math.max(1, Math.round(basePower * rarityMultiplier * (1 + (level - 1) * 0.08)));
    return {
      id: nft.id || (`mint-${Date.now()}-${Math.random().toString(36).slice(2,8)}`),
      owner: nft.owner || null,
      name: nft.title || nft.name || nft.id || 'Unknown Item',
      description: nft.description || '',
      image: nft.image || nft.tokenUri || null,
      type,
      rarity,
      level,
      power,
      tokenUri: nft.tokenUri || null,
      createdAt: nft.timestamp || new Date().toISOString(),
      _xp: nft._xp || 0
    };
  }

  function addItemXp(itemId, xpAmount) {
    const list = window.DATA.mintables || [];
    let item = list.find(i => i.id === itemId);
    if (!item) item = (window.DATA.scavenger || []).find(i => i.id === itemId);
    if (!item) return;
    item._xp = (item._xp || 0) + (xpAmount || 0);
    const newLevel = Math.floor(item._xp / 100) + 1;
    if (newLevel > (item.level || 1)) {
      item.level = newLevel;
      const rarityMultiplier = { common: 1, rare: 1.2, epic: 1.45, legendary: 1.8 }[item.rarity] || 1;
      item.power = Math.max(1, Math.round((item.power || 1) * (1 + 0.08 * (newLevel - 1)) * rarityMultiplier));
      safeLog('Item leveled up', item.id, 'new level', item.level);
    }
  }

  //
  // === Quest helpers ===
  //
  function getActiveQuests() {
    if (!Array.isArray(window.DATA.quests)) return [];
    return window.DATA.quests.filter(q => q && q.active === true);
  }

  function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function startQuest(q) {
    try {
      if (!q) return;
      q.started = true;
      safeLog('Quest started:', q.id || q.name);
      if (typeof window.onQuestStarted === 'function') {
        try { window.onQuestStarted(q); } catch (e) { safeWarn('onQuestStarted handler failed', e); }
      }
      if (typeof renderQuestPanel === 'function') {
        try { renderQuestPanel(q); } catch (e) { safeWarn('renderQuestPanel failed', e); }
      }
    } catch (e) {
      safeWarn('startQuest error', e);
    }
  }

  function checkQuestTriggers(playerLat, playerLng) {
    const active = getActiveQuests();
    active.forEach(q => {
      if (!q || !q.triggerPoi) return;
      const d = distanceMeters(playerLat, playerLng, q.triggerPoi.lat, q.triggerPoi.lng);
      if (d <= (q.radius || 50)) {
        if (!q.started) startQuest(q);
      }
    });
  }

  //
  // === Map initialization and multi-layer handling ===
  //
  function createTileLayers() {
    try {
      terrainLayer = L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', {
        maxZoom: 18,
        attribution: 'Map tiles by Stamen'
      });
    } catch (e) { safeWarn('terrainLayer creation failed', e); terrainLayer = null; }

    try {
      tonerLayer = L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: 'Map tiles by Stamen'
      });
    } catch (e) { safeWarn('tonerLayer creation failed', e); tonerLayer = null; }

    try {
      satelliteLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'OSM'
      });
    } catch (e) { safeWarn('satelliteLayer creation failed', e); satelliteLayer = null; }
  }

  function initMap() {
    // Reuse existing map if present
    if (map && window.L && map instanceof L.Map) {
      if (currentMapLayer && !currentMapLayer._map) {
        try { currentMapLayer.addTo(map); } catch (e) { safeWarn('re-adding currentMapLayer failed', e); }
      }
      setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 200);
      return;
    }

    mapEl = document.getElementById('map');
    if (!mapEl) {
      safeWarn('initMap: #map element not found');
      return;
    }

    try {
      map = L.map(mapEl, {
        center: [39.5, -119.8],
        zoom: 6,
        preferCanvas: true,
        zoomControl: true,
        attributionControl: true
      });
      window.map = map;
    } catch (e) {
      safeError('Leaflet map creation failed', e);
      return;
    }

    createTileLayers();

    currentMapLayer = terrainLayer || satelliteLayer || tonerLayer;
    try { if (currentMapLayer) currentMapLayer.addTo(map); } catch (e) { safeWarn('adding default layer failed', e); }

    // Attach tileerror handlers
    [terrainLayer, tonerLayer, satelliteLayer].forEach(layer => {
      if (!layer || !layer.on) return;
      layer.on('tileerror', (e) => {
        try {
          const src = e && e.tile && e.tile.src ? e.tile.src : 'unknown';
          safeWarn('Tile failed to load:', src);
        } catch (err) { safeWarn('tileerror handler error', err); }
      });
    });

    // Basic click handler for debugging
    map.on('click', (e) => {
      safeLog('map click', e && e.latlng);
    });

    // Ensure map sizing after layout
    setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 250);
  }

  function switchMapStyle(style) {
    if (!map) return;
    try {
      if (currentMapLayer && map.hasLayer && map.hasLayer(currentMapLayer)) map.removeLayer(currentMapLayer);
    } catch (e) { /* ignore */ }

    if (style === 'terrain' && terrainLayer) currentMapLayer = terrainLayer;
    else if (style === 'toner' && tonerLayer) currentMapLayer = tonerLayer;
    else if (style === 'satellite' && satelliteLayer) currentMapLayer = satelliteLayer;
    else currentMapLayer = terrainLayer || satelliteLayer || tonerLayer;

    try {
      if (currentMapLayer) currentMapLayer.addTo(map);
    } catch (e) {
      safeWarn('Failed to add chosen layer, falling back to OSM', e);
      try {
        currentMapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
        currentMapLayer.addTo(map);
      } catch (err) { safeWarn('OSM fallback failed', err); }
    }
    setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 120);
  }

  //
  // === Boot / activation handler (mobile-friendly) ===
  //
  function setupBootActivation() {
    const bootScreen = document.getElementById('bootScreen') || document.querySelector('.boot-screen');
    const bootPrompt = document.getElementById('bootPrompt') || document.querySelector('.boot-prompt');
    const pipboyScreen = document.getElementById('pipboyScreen') || document.querySelector('.pipboy-screen');
    if (!bootScreen) return;

    let activated = false;

    function completeBootFast() {
      const evt = new Event('completeBoot');
      document.dispatchEvent(evt);
    }

    function activate() {
      if (activated) return;
      // If boot text still typing, fast-forward first
      if (bootPrompt && bootPrompt.classList.contains && bootPrompt.classList.contains('typing')) {
        completeBootFast();
        return;
      }
      activated = true;
      try { bootScreen.classList.add('hidden'); } catch (e) { bootScreen.style.display = 'none'; }
      if (pipboyScreen) try { pipboyScreen.classList.remove('hidden'); } catch (e) { pipboyScreen.style.display = ''; }
      window.dispatchEvent(new Event('pipboyReady'));
      removeListeners();
    }

    function onTouch(e) { if (bootScreen.contains(e.target)) { e.preventDefault(); activate(); } }
    function onClick(e) { if (bootScreen.contains(e.target)) { e.preventDefault(); activate(); } }
    function onKey(e) { if (!activated) activate(); }

    function addListeners() {
      bootScreen.addEventListener('touchstart', onTouch, { passive: false });
      bootScreen.addEventListener('click', onClick, { passive: false });
      window.addEventListener('keydown', onKey);
      bootScreen.setAttribute('tabindex', '0');
      bootScreen.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') activate(); });
    }
    function removeListeners() {
      try {
        bootScreen.removeEventListener('touchstart', onTouch);
        bootScreen.removeEventListener('click', onClick);
        window.removeEventListener('keydown', onKey);
      } catch (e) { /* ignore */ }
    }

    addListeners();
  }
  //
  // === UI integration points (no-ops if real implementations exist) ===
  //
  function initUiSafe() {
    if (typeof window.initUi === 'function') {
      try { window.initUi(); return; } catch (e) { safeWarn('external initUi failed', e); }
    }
    // Minimal fallback: ensure some UI elements exist
    safeLog('initUi: no external initUi found, using safe defaults');
  }

  //
  // === Init sequence (idempotent) ===
  //
  async function initGame() {
    if (_gameInitialized || _gameInitializing) return;
    _gameInitializing = true;
    try {
      await loadAllData();

        // after await loadAllData();
  // ensure arrays exist
  window.DATA.scavenger = Array.isArray(window.DATA.scavenger) ? window.DATA.scavenger : [];
  window.DATA.mintables = Array.isArray(window.DATA.mintables) ? window.DATA.mintables : [];
  window.DATA.quests = Array.isArray(window.DATA.quests) ? window.DATA.quests : [];
  window.DATA.locations = Array.isArray(window.DATA.locations) ? window.DATA.locations : [];

  // convert any loaded mintables into in-game items
  if (window.DATA.mintables.length > 0 && typeof nftToGameItem === 'function') {
    window.DATA.mintables = window.DATA.mintables.map(nft => {
      try { return nftToGameItem(nft); } catch (e) { console.warn('nftToGameItem failed for', nft && nft.id, e); return nft; }
     });
    }


      // Init map and UI
      try { initMap(); } catch (e) { safeWarn('initMap error', e); }
      try { initUiSafe(); } catch (e) { safeWarn('initUiSafe error', e); }

      // Ensure map style and sizing
      try { switchMapStyle && switchMapStyle('terrain'); } catch (e) { safeWarn('switchMapStyle failed', e); }
      setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 350);

      // Optional tutorial and status
      try { if (typeof openTutorial === 'function') openTutorial(); } catch (e) { /* ignore */ }
      try { if (typeof setStatus === 'function') setStatus('Pip-Boy online. Request GPS to begin tracking.', 'status-good'); } catch (e) { safeLog('status update skipped'); }

      _gameInitialized = true;
    } catch (err) {
      safeError('initGame failed', err);
    } finally {
      _gameInitializing = false;
    }
  }

  // Listen for pipboyReady event (boot activation will dispatch it)
  window.addEventListener('pipboyReady', () => {
    try { initGame(); } catch (e) { safeWarn('pipboyReady initGame error', e); }
  });

  // Dev/test fallback: attempt init if pipboyReady didn't fire but DOM looks ready
  setTimeout(() => {
    try {
      const mapElementPresent = typeof mapEl !== 'undefined' && mapEl && document.body && document.body.contains(mapEl);
      if (!map && mapElementPresent && !_gameInitialized && !_gameInitializing) {
        initGame();
      }
    } catch (e) { /* ignore */ }
  }, 1200);

  // Setup boot activation immediately
  try { setupBootActivation(); } catch (e) { safeWarn('setupBootActivation failed', e); }

  //
  // === Debug helpers exposed to console ===
  //
  window.__pipboyDebug = {
    forceShowTiles: function () {
      $all('.leaflet-tile-pane').forEach(p => p.style.filter = 'none');
      $all('.leaflet-tile-pane img.leaflet-tile').forEach(img => { img.style.visibility = 'visible'; img.style.opacity = '1'; });
      safeLog('Tiles forced visible');
    },
    hideOverlaysForTest: function () {
      $all('.static-noise, .top-overlay, .overseer-link, .pipboy-screen, .hud').forEach(el => {
        el.dataset._oldDisplay = el.style.display || '';
        el.style.display = 'none';
      });
      setTimeout(() => { if (map && map.invalidateSize) map.invalidateSize(); }, 200);
      safeLog('Overlays hidden for test');
    },
    restoreOverlays: function () {
      $all('[data-_old-display]').forEach(el => {
        el.style.display = el.dataset._oldDisplay || '';
        delete el.dataset._oldDisplay;
      });
      safeLog('Overlays restored');
    },
    reinit: function () {
      _gameInitialized = false;
      initGame();
    },
    showDataSummary: function () {
      safeLog('DATA summary:', {
        scavenger: (window.DATA.scavenger || []).length,
        mintables: (window.DATA.mintables || []).length,
        quests: (window.DATA.quests || []).length,
        locations: (window.DATA.locations || []).length
      });
    }
  };

  //
  // === Minimal CSS safety injection (useful if CSS accidentally hides tiles or blocks pointer events) ===
  //
  (function ensureCssSafety() {
    try {
      const styleId = 'pipboy-mainjs-safety';
      if (document.getElementById(styleId)) return;
      const css = `
        .leaflet-tile-pane { z-index: 10 !important; filter: none !important; opacity: 1 !important; }
        .leaflet-tile-pane img.leaflet-tile { visibility: visible !important; opacity: 1 !important; image-rendering: auto !important; }
        .static-noise, .top-overlay, .overseer-link, .hud, .pipboy-screen { pointer-events: none !important; }
        .map-container, #map { pointer-events: auto !important; touch-action: manipulation !important; z-index: 10 !important; }
        .btn { min-width: 44px; min-height: 44px; touch-action: manipulation; }
      `;
      const s = document.createElement('style');
      s.id = styleId;
      s.appendChild(document.createTextNode(css));
      document.head && document.head.appendChild(s);
    } catch (e) { /* ignore */ }
  }());

  //
  // === Expose integration functions for other modules ===
  //
  window.switchMapStyle = switchMapStyle;
  window.nftToGameItem = nftToGameItem;
  window.addItemXp = addItemXp;
  window.checkQuestTriggers = checkQuestTriggers;
  window.initGame = initGame;

  // Auto-run init if pipboyReady already fired earlier in the page lifecycle
  try {
    if (window._pipboyReadyFired) initGame();
  } catch (e) { /* ignore */ }

  // End of IIFE
}());

(function () {
  // ==========================
  // GLOBAL STATE
  // ==========================
  // DOM element reference (never overwrite the Leaflet map variable with this)
  const mapEl = document.getElementById("map");

  // Leaflet map instance (created in initMap)
  let map = null;

  let playerMarker = null;
  let locationsLayer = null;
  let currentPosition = null;

  const MOJAVE_COORDS = [36.1699, -115.1398];
  const DEFAULT_ZOOM = 13;
  const CLAIM_RADIUS_METERS = 50;

  // Player stats
  let lvl = 1;
  let xp = 0;
  let caps = 0;
  let claimedCount = 0;

  const PLAYER_MAX_HP_BASE = 100;
  let playerMaxHp = PLAYER_MAX_HP_BASE;
  let playerHp = PLAYER_MAX_HP_BASE;
  let playerRad = 0; // 0–100
  let walletPubkey = null;

  // Battle state
  let inBattle = false;
  let currentEnemy = null; // { name, type, lvl, rarity, maxHp, hp, baseDamage }
  let currentBattlePoi = null; // location object
  let battleLog = [];

  // Map layers for MAP MODE
  let terrainLayer = null;
  let satelliteLayer = null;
  let tonerLayer = null;
  let currentMapLayer = null;
  let mapModes = ["terrain", "satellite", "toner"];
  let mapModeIndex = 0;

  // ==========================
  // DOM HOOKS
  // ==========================
  const statusEl = document.getElementById("status");
  const accDot = document.getElementById("accDot");
  const accText = document.getElementById("accText");

  const requestGpsBtn = document.getElementById("requestGpsBtn");
  const centerBtn = document.getElementById("centerBtn");
  const recenterMojaveBtn = document.getElementById("recenterMojave");
  const connectWalletBtn = document.getElementById("connectWallet");

  const tabs = document.querySelectorAll(".tab");
  const terminal = document.getElementById("terminal");
  const panelClose = document.getElementById("panelClose");
  const panelTitle = document.getElementById("panelTitle");
  const panelBody = document.getElementById("panelBody");

  const tutorialModal = document.getElementById("tutorialModal");
  const tutorialClose = document.getElementById("tutorialClose");

  const mintModal = document.getElementById("mintModal");
  const mintTitle = document.getElementById("mintTitle");
  const mintMsg = document.getElementById("mintMsg");
  const mintProgressBar = document.getElementById("mintProgressBar");
  const mintCloseBtn = document.getElementById("mintCloseBtn");

  const capsEl = document.getElementById("caps");
  const lvlEl = document.getElementById("lvl");
  const xpTextEl = document.getElementById("xpText");
  const xpFillEl = document.getElementById("xpFill");
  const claimedEl = document.getElementById("claimed");

  const hpFillEl = document.getElementById("hpFill");
  const radFillEl = document.getElementById("radFill");
  const hpTextEl = document.getElementById("hpText");

  const mapContainerEl = document.querySelector(".map-container");
  const staticNoiseEl = document.querySelector(".static-noise");

  // ==========================
  // DATA STORE
  // ==========================
  const DATA = {
    locations: [],
    quests: [],
    scavenger: [],
    collectiblesPack: {
      id: null,
      description: "",
      collectibles: []
    },
    factions: [],
    mintables: []
  };

  // ==========================
  // UTILITIES
  // ==========================
  function setStatus(text, className) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove("status-good", "status-warn", "status-bad");
    if (className) statusEl.classList.add(className);
  }

  function setGpsAccuracy(accMeters) {
    if (!accDot || !accText) return;

    accDot.classList.remove("acc-green", "acc-amber");

    if (accMeters == null) {
      accText.textContent = "GPS: waiting...";
      return;
    }

    accText.textContent = `GPS: ~${Math.round(accMeters)}m`;

    if (accMeters <= 25) {
      accDot.classList.add("acc-green");
    } else if (accMeters > 75) {
      // leave as red (no extra class)
    } else {
      accDot.classList.add("acc-amber");
    }
  }

  function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function rarityLabel(rarity) {
    const r = (rarity || "").toLowerCase();
    if (r === "legendary") return "LEGENDARY";
    if (r === "epic") return "EPIC";
    if (r === "rare") return "RARE";
    return "COMMON";
  }

  function rarityColor(rarity) {
    const r = (rarity || "").toLowerCase();
    if (r === "legendary") return "#ffd700";
    if (r === "epic") return "#ff66ff";
    if (r === "rare") return "#66ccff";
    return "#00ff66";
  }

  function randomChoice(arr) {
    if (!arr || arr.length === 0) return null;
    const idx = Math.floor(Math.random() * arr.length);
    return arr[idx];
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // ==========================
  // PLAYER STATS
  // ==========================
  function updateHud() {
    if (!lvlEl || !capsEl || !claimedEl || !xpTextEl || !xpFillEl || !hpFillEl || !radFillEl || !hpTextEl) return;

    lvlEl.textContent = lvl.toString();
    capsEl.textContent = caps.toString();
    claimedEl.textContent = claimedCount.toString();

    const xpNeeded = 100;
    xpTextEl.textContent = `${xp} / ${xpNeeded}`;
    xpFillEl.style.width = `${clamp((xp / xpNeeded) * 100, 0, 100)}%`;

    const hpPct = clamp((playerHp / playerMaxHp) * 100, 0, 100);
    const radPct = clamp(playerRad, 0, 100);

    hpFillEl.style.width = `${hpPct}%`;
    radFillEl.style.width = `${radPct}%`;
    hpTextEl.textContent = `HP ${Math.round(playerHp)} / ${playerMaxHp}`;
  }

  function addCaps(amount) {
    caps += Math.max(0, amount | 0);
    updateHud();
  }

  function addXp(amount) {
    const xpNeeded = 100;
    xp += Math.max(0, amount | 0);

    while (xp >= xpNeeded) {
      xp -= xpNeeded;
      lvl++;
      playerMaxHp += 5;
      playerHp = playerMaxHp;
      setStatus(`Level up! You are now LVL ${lvl}.`, "status-good");
    }

    updateHud();
  }

  function applyDamageToPlayer(amount) {
    playerHp -= Math.max(0, amount);
    if (playerHp <= 0) {
      playerHp = 0;
    }
    updateHud();
  }

  function healPlayer(amount) {
    playerHp = clamp(playerHp + Math.max(0, amount), 0, playerMaxHp);
    updateHud();
  }

  function incrementClaimed() {
    claimedCount++;
    updateHud();
  }

  // ==========================
  // DATA LOADING
  // ==========================
  // --- robust loader
async function loadDataFile(name) {
  try {
    const res = await fetch(`/data/${name}.json`);
    if (!res.ok) {
      console.warn(`${name}.json fetch failed:`, res.status, res.statusText);
      if (name === 'scavenger') DATA.scavenger = [];
      return;
    }
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();
    if (!contentType.includes('application/json')) {
      console.warn(`${name}.json served as ${contentType}; preview:`, text.slice(0,400));
      if (name === 'scavenger') DATA.scavenger = [];
      return;
    }
    let json;
    try { json = JSON.parse(text); } catch (e) {
      console.warn(`${name}.json parse error:`, e);
      if (name === 'scavenger') DATA.scavenger = [];
      return;
    }
    if (name === 'collectibles') {
      DATA.collectiblesPack = {
        id: json.id || null,
        description: json.description || '',
        collectibles: Array.isArray(json.collectibles) ? json.collectibles : []
      };
    } else {
      DATA[name] = json;
    }
  } catch (e) {
    console.error(`Failed to load ${name}.json`, e);
    if (name === 'scavenger') DATA.scavenger = [];
  }
}

// --- tolerant loader for all files
async function loadAllData() {
  const names = ['locations','quests','scavenger','collectibles','factions','mintables'];
  await Promise.all(names.map(async name => {
    try {
      await loadDataFile(name);
    } catch (e) {
      console.warn('loadDataFile failed for', name, e);
      if (name === 'scavenger') DATA.scavenger = [];
    }
  }));
}

// --- Convert NFT mint metadata into in-game item object
function nftToGameItem(nft) {
  // nft expected shape: { id, owner, title, description, image, metadata: { rarity, level, basePower, type }, tokenUri }
  const meta = nft.metadata || {};
  const rarity = (meta.rarity || 'common').toLowerCase();
  const level = Math.max(1, parseInt(meta.level || 1, 10));
  const basePower = Math.max(1, parseFloat(meta.basePower || 1));
  const type = meta.type || 'misc';

  // scale stats by rarity and level
  const rarityMultiplier = { common:1, rare:1.2, epic:1.45, legendary:1.8 }[rarity] || 1;
  const power = Math.round(basePower * rarityMultiplier * (1 + (level - 1) * 0.08));

  return {
    id: nft.id,
    owner: nft.owner,
    name: nft.title || nft.id,
    description: nft.description || '',
    image: nft.image || null,
    type,
    rarity,
    level,
    power,
    tokenUri: nft.tokenUri || null,
    createdAt: nft.timestamp || new Date().toISOString()
  };
}

// Example: corrected initMap guard (remove stray token)
function initMap() {
  // If map already exists and is a Leaflet map, reuse it
  if (map && window.L && map instanceof L.Map) {
    if (currentMapLayer && !currentMapLayer._map) currentMapLayer.addTo(map);
    setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 200);
    return;
  }
  // ==========================
  // MAP + MULTI-MAP MODES
  // ==========================
  function initMap() {
    // If map already exists and is a Leaflet map, reuse it
    if (map && window.L && map instanceof L.Map) {
      if (currentMapLayer && !currentMapLayer._map) currentMapLayer.addTo(map);
      setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 200);
      return;
    }

    // Create the Leaflet map using the DOM element (mapEl)
    map = L.map(mapEl || "map", {
      zoomControl: false,
      attributionControl: false
    }).setView(MOJAVE_COORDS, DEFAULT_ZOOM);

    // Multiple map layers
    terrainLayer = L.tileLayer(
      "https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg",
      { maxZoom: 18 }
    );

    satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18 }
    );

    tonerLayer = L.tileLayer(
      "https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png",
      { maxZoom: 18 }
    );

    // Default layer: terrain
    currentMapLayer = terrainLayer;
    currentMapLayer.addTo(map);

    locationsLayer = L.layerGroup().addTo(map);
    renderLocations();

    // ensure tiles render if map was initialized while hidden
    setTimeout(() => {
      if (map && typeof map.invalidateSize === "function") map.invalidateSize();
    }, 300);
  }

  function switchMapStyle(style) {
    if (!map || !currentMapLayer) return;

    try {
      map.removeLayer(currentMapLayer);
    } catch (e) {
      // ignore if not present
    }

    if (style === "terrain" && terrainLayer) currentMapLayer = terrainLayer;
    else if (style === "satellite" && satelliteLayer) currentMapLayer = satelliteLayer;
    else if (style === "toner" && tonerLayer) currentMapLayer = tonerLayer;
    else currentMapLayer = terrainLayer || currentMapLayer;

    currentMapLayer.addTo(map);
    setStatus(`Map mode: ${style.toUpperCase()}`, "status-good");
  }

  function initMapModeButton() {
    // Bind to the button you placed in HTML (inside .map-container)
    const btn = document.getElementById("mapModeBtn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      mapModeIndex = (mapModeIndex + 1) % mapModes.length;
      const mode = mapModes[mapModeIndex];
      switchMapStyle(mode);

      // force redraw after switching layers
      if (map && typeof map.invalidateSize === "function") {
        setTimeout(() => map.invalidateSize(), 120);
      }

      // small CRT flicker effect (non-blocking)
      if (mapContainerEl) {
        mapContainerEl.classList.add("crt-glitch");
        if (staticNoiseEl) staticNoiseEl.classList.add("active");
        setTimeout(() => {
          mapContainerEl.classList.remove("crt-glitch");
          if (staticNoiseEl) staticNoiseEl.classList.remove("active");
        }, 520);
      }
    });
  }

  function renderLocations() {
    if (!locationsLayer) return;
    locationsLayer.clearLayers();

    if (!Array.isArray(DATA.locations)) return;

    DATA.locations.forEach(loc => {
      const name = loc.n || "Unknown";
      const marker = L.marker([loc.lat, loc.lng]);
      marker.addTo(locationsLayer);
      marker.bindPopup(name);

      marker.on("click", () => {
        if (inBattle) return;
        openLocationPanel(loc);
      });
    });
  }

  function updatePlayerMarker(lat, lng) {
    currentPosition = { lat, lng };
    if (!map) return;

    if (!playerMarker) {
      playerMarker = L.circleMarker([lat, lng], {
        radius: 7,
        color: "#00ff66",
        fillColor: "#00ff66",
        fillOpacity: 0.8
      }).addTo(map);
    } else {
      playerMarker.setLatLng([lat, lng]);
    }
  }

  function centerOnPlayer() {
    if (currentPosition && map) {
      map.setView([currentPosition.lat, currentPosition.lng], DEFAULT_ZOOM);
    } else {
      setStatus("No GPS lock yet. Request GPS first.", "status-warn");
    }
  }

  function recenterMojave() {
    if (map) {
      map.setView(MOJAVE_COORDS, DEFAULT_ZOOM);
    }
  }

  // ==========================
  // GPS
  // ==========================
  function requestGps() {
    if (!navigator.geolocation) {
      setStatus("GPS not supported on this device.", "status-bad");
      return;
    }

    setStatus("Requesting GPS lock...", "status-warn");

    navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        updatePlayerMarker(latitude, longitude);
        setGpsAccuracy(accuracy);

        if (map && !map._movedOnce) {
          map.setView([latitude, longitude], DEFAULT_ZOOM);
          map._movedOnce = true;
        }

        setStatus("GPS lock acquired.", "status-good");
      },
      err => {
        console.error(err);
        setStatus("GPS error or permission denied.", "status-bad");
        setGpsAccuracy(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000
      }
    );
  }

  // ==========================
  // TERMINAL & MODALS
  // ==========================
  function openTerminalPanel(title, html) {
    if (!panelTitle || !panelBody || !terminal) return;
    panelTitle.textContent = title;
    panelBody.innerHTML = html;
    terminal.classList.remove("hidden");
  }

  function closeTerminalPanel() {
    if (!terminal) return;
    terminal.classList.add("hidden");
  }

  function openTutorial() {
    if (tutorialModal) tutorialModal.classList.remove("hidden");
  }

  function closeTutorial() {
    if (tutorialModal) tutorialModal.classList.add("hidden");
  }

  function openMintModal(title, msg) {
    if (!mintModal || !mintTitle || !mintMsg || !mintProgressBar) return;
    mintTitle.textContent = title;
    mintMsg.textContent = msg;
    mintProgressBar.style.width = "0%";
    mintModal.classList.remove("hidden");
    setTimeout(() => {
      mintProgressBar.style.width = "100%";
    }, 50);
  }

  function closeMintModal() {
    if (!mintModal) return;
    mintModal.classList.add("hidden");
  }

  // ==========================
  // ENEMY GENERATION (E1)
  // ==========================
  function inferEnemyTypeFromPoiName(name) {
    const n = (name || "").toLowerCase();

    if (n.includes("deathclaw") || n.includes("dead wind") || n.includes("quarry"))
      return "deathclaw";
    if (n.includes("black mountain")) return "super_mutant";
    if (n.includes("vault")) return "vault_ghoul";
    if (n.includes("repc") || n.includes("helios") || n.includes("robot") || n.includes("ncrcf"))
      return "robot";
    if (n.includes("strip") || n.includes("atomic wrangler") || n.includes("gomorrah") || n.includes("tops"))
      return "raider";
    if (n.includes("pitt")) return "raider_elite";
    if (n.includes("glow") || n.includes("chernobyl") || n.includes("fukushima"))
      return "irradiated_beast";
    if (n.includes("camp") || n.includes("mccarran") || n.includes("mojave outpost"))
      return "ncr_trooper";
    if (n.includes("cottonwood") || n.includes("fortification") || n.includes("nelson"))
      return "legionary";

    return "wasteland_hostile";
  }

  function buildEnemyForLocation(loc) {
    const name = loc.n || "Unknown Threat";
    const baseLvl = loc.lvl || 1;
    const rarity = (loc.rarity || "common").toLowerCase();
    const type = inferEnemyTypeFromPoiName(name);

    let lvlMultiplier = 1;
    if (rarity === "rare") lvlMultiplier = 1.1;
    else if (rarity === "epic") lvlMultiplier = 1.25;
    else if (rarity === "legendary") lvlMultiplier = 1.5;

    const enemyLvl = Math.max(1, Math.round(baseLvl * lvlMultiplier));

    let baseHp = 60 + enemyLvl * 5;
    let baseDamage = 6 + enemyLvl * 1.2;

    if (type === "deathclaw" || type === "raider_elite") {
      baseHp *= 1.5;
      baseDamage *= 1.6;
    } else if (type === "super_mutant" || type === "irradiated_beast") {
      baseHp *= 1.4;
      baseDamage *= 1.4;
    } else if (type === "robot") {
      baseHp *= 1.2;
      baseDamage *= 1.3;
    }

    let displayName = "Hostile";
    if (type === "deathclaw") displayName = "Deathclaw";
    else if (type === "super_mutant") displayName = "Super Mutant";
    else if (type === "vault_ghoul") displayName = "Vault Ghoul";
    else if (type === "robot") displayName = "Security Automaton";
    else if (type === "raider") displayName = "Raider Thug";
    else if (type === "raider_elite") displayName = "Pitt Forgemaster";
    else if (type === "irradiated_beast") displayName = "Irradiated Beast";
    else if (type === "ncr_trooper") displayName = "NCR Trooper";
    else if (type === "legionary") displayName = "Legionary";
    else displayName = "Wasteland Hostile";

    return {
      name: displayName,
      type,
      lvl: enemyLvl,
      rarity,
      maxHp: Math.round(baseHp),
      hp: Math.round(baseHp),
      baseDamage: baseDamage
    };
  }

  // ==========================
  // BATTLE SCREEN (V1 + B3 + CRT GLITCH)
  // ==========================
  function createBattleScreen() {
    let battleScreen = document.getElementById("battleScreen");
    if (battleScreen) return battleScreen;

    battleScreen = document.createElement("div");
    battleScreen.id = "battleScreen";
    battleScreen.className = "battle-screen hidden";
    battleScreen.innerHTML = `
      <div class="battle-inner">
        <div class="battle-header">
          <div class="battle-title">V.A.T.S. COMBAT SUBSYSTEM</div>
          <div class="battle-subtitle" id="battleSubTitle"></div>
        </div>
        <div class="battle-main">
          <div class="battle-enemy">
            <div class="enemy-silhouette">
              <div class="enemy-outline"></div>
            </div>
            <div class="enemy-info">
              <div id="enemyName" class="enemy-name"></div>
              <div id="enemyLvl" class="enemy-lvl"></div>
              <div class="enemy-hp-bar">
                <div id="enemyHpFill" class="enemy-hp-fill"></div>
              </div>
              <div id="enemyHpText" class="enemy-hp-text"></div>
            </div>
          </div>
          <div class="battle-player">
            <div class="player-label">YOU</div>
            <div class="player-hp-bar">
              <div id="battlePlayerHpFill" class="player-hp-fill"></div>
            </div>
            <div id="battlePlayerHpText" class="player-hp-text"></div>
          </div>
          <div class="battle-grid">
            <button class="btn vats-btn" data-part="head">
              HEAD<br/><small>High crit, low hit</small>
            </button>
            <button class="btn vats-btn" data-part="torso">
              TORSO<br/><small>High hit, normal dmg</small>
            </button>
            <button class="btn vats-btn" data-part="arms">
              ARMS<br/><small>Disarm chance</small>
            </button>
            <button class="btn vats-btn" data-part="legs">
              LEGS<br/><small>Slow target</small>
            </button>
          </div>
          <div class="battle-log-container">
            <div id="battleLog" class="battle-log"></div>
          </div>
          <div class="battle-actions">
            <button class="btn" id="battleUseItemBtn">USE STIMPAK</button>
            <button class="btn" id="battleFleeBtn">ATTEMPT ESCAPE</button>
          </div>
        </div>
      </div>
    `;
    if (mapContainerEl) mapContainerEl.appendChild(battleScreen);
    return battleScreen;
  }

  function updateBattleHud() {
    const battleScreen = document.getElementById("battleScreen");
    if (!battleScreen || !currentEnemy) return;

    const enemyNameEl = battleScreen.querySelector("#enemyName");
    const enemyLvlEl = battleScreen.querySelector("#enemyLvl");
    const enemyHpFillEl = battleScreen.querySelector("#enemyHpFill");
    const enemyHpTextEl = battleScreen.querySelector("#enemyHpText");
    const battlePlayerHpFillEl = battleScreen.querySelector("#battlePlayerHpFill");
    const battlePlayerHpTextEl = battleScreen.querySelector("#battlePlayerHpText");
    const battleSubTitleEl = battleScreen.querySelector("#battleSubTitle");

    enemyNameEl.textContent = currentEnemy.name.toUpperCase();
    enemyLvlEl.textContent = `LVL ${currentEnemy.lvl} – ${rarityLabel(currentEnemy.rarity)}`;

    const enemyHpPct = clamp((currentEnemy.hp / currentEnemy.maxHp) * 100, 0, 100);
    enemyHpFillEl.style.width = `${enemyHpPct}%`;
    enemyHpTextEl.textContent = `${Math.round(currentEnemy.hp)} / ${currentEnemy.maxHp}`;

    const playerHpPct = clamp((playerHp / playerMaxHp) * 100, 0, 100);
    battlePlayerHpFillEl.style.width = `${playerHpPct}%`;
    battlePlayerHpTextEl.textContent = `${Math.round(playerHp)} / ${playerMaxHp}`;

    battleSubTitleEl.textContent =
      currentBattlePoi && currentBattlePoi.n
        ? `ENGAGED NEAR: ${currentBattlePoi.n.toUpperCase()}`
        : "COMBAT ENGAGED";
  }

  function pushBattleLog(line) {
    battleLog.push(line);
    if (battleLog.length > 8) battleLog.shift();

    const battleLogEl = document.getElementById("battleLog");
    if (!battleLogEl) return;
    battleLogEl.innerHTML = battleLog
      .map(l => `<div class="battle-log-line">${l}</div>`)
      .join("");
    battleLogEl.scrollTop = battleLogEl.scrollHeight;
  }

  function applyCrtGlitchTransition(onMidpoint) {
    if (!mapContainerEl || !staticNoiseEl) {
      if (typeof onMidpoint === "function") onMidpoint();
      return;
    }

    mapContainerEl.classList.add("crt-glitch");
    staticNoiseEl.classList.add("active");

    setTimeout(() => {
      if (typeof onMidpoint === "function") onMidpoint();
    }, 200);

    setTimeout(() => {
      mapContainerEl.classList.remove("crt-glitch");
      staticNoiseEl.classList.remove("active");
    }, 600);
  }

  function enterBattle(loc) {
    if (inBattle) return;
    inBattle = true;
    currentBattlePoi = loc;
    currentEnemy = buildEnemyForLocation(loc);
    battleLog = [];

    const battleScreen = createBattleScreen();

    applyCrtGlitchTransition(() => {
      if (mapEl) mapEl.classList.add("hidden");
      battleScreen.classList.remove("hidden");
      updateBattleHud();
      pushBattleLog("V.A.T.S. ONLINE. TARGET ACQUIRED.");
      pushBattleLog(`${currentEnemy.name.toUpperCase()} snarls at you.`);
    });

    hookBattleButtons();
  }

  function exitBattle() {
    inBattle = false;
    currentEnemy = null;
    currentBattlePoi = null;
    battleLog = [];

    const battleScreen = document.getElementById("battleScreen");
    if (!battleScreen) return;

    applyCrtGlitchTransition(() => {
      battleScreen.classList.add("hidden");
      if (mapEl) mapEl.classList.remove("hidden");
      updateHud();
    });
  }

  function hookBattleButtons() {
    const battleScreen = document.getElementById("battleScreen");
    if (!battleScreen) return;

    const vatsBtns = battleScreen.querySelectorAll(".vats-btn");
    const fleeBtn = battleScreen.querySelector("#battleFleeBtn");
    const useItemBtn = battleScreen.querySelector("#battleUseItemBtn");

    vatsBtns.forEach(btn => {
      btn.onclick = () => {
        const part = btn.getAttribute("data-part");
        handlePlayerAttack(part);
      };
    });

    fleeBtn.onclick = () => {
      handlePlayerFlee();
    };

    useItemBtn.onclick = () => {
      handleUseStimpak();
    };
  }

  // ==========================
  // VATS ATTACK RESOLUTION
  // ==========================
  function getVatsProfile(part) {
    switch (part) {
      case "head":
        return { hit: 35, crit: 25, dmgMult: 2.0, effect: "stun" };
      case "torso":
        return { hit: 75, crit: 10, dmgMult: 1.0, effect: null };
      case "arms":
        return { hit: 55, crit: 5, dmgMult: 0.8, effect: "disarm" };
      case "legs":
        return { hit: 65, crit: 5, dmgMult: 0.8, effect: "slow" };
      default:
        return { hit: 60, crit: 5, dmgMult: 1.0, effect: null };
    }
  }

  function computePlayerWeaponBonus() {
    let rarityBonus = 0;
    let critBonus = 0;

    const r = lvl;

    if (r >= 5) rarityBonus += 5;
    if (r >= 10) rarityBonus += 5;
    if (r >= 20) rarityBonus += 10;

    if (r >= 8) critBonus += 5;
    if (r >= 16) critBonus += 5;

    return { rarityBonus, critBonus };
  }

  function handlePlayerAttack(part) {
    if (!currentEnemy || !inBattle) return;

    const profile = getVatsProfile(part);
    const { rarityBonus, critBonus } = computePlayerWeaponBonus();

    const hitChance = clamp(profile.hit + rarityBonus, 5, 95);
    const critChance = clamp(profile.crit + critBonus, 0, 60);

    const roll = Math.random() * 100;
    if (roll > hitChance) {
      pushBattleLog(`You fire at the ${part.toUpperCase()}... MISS.`);
      setTimeout(handleEnemyTurn, 400);
      return;
    }

    const baseWeaponDamage = 10 + lvl * 1.5;
    const dmg = baseWeaponDamage * profile.dmgMult;
    const critRoll = Math.random() * 100;
    let totalDamage = dmg;
    let crit = false;

    if (critRoll < critChance) {
      crit = true;
      totalDamage *= 1.75;
    }

    totalDamage = Math.round(totalDamage);
    currentEnemy.hp = Math.max(0, currentEnemy.hp - totalDamage);

    const critText = crit ? " CRITICAL!" : "";
    pushBattleLog(
      `You hit the ${currentEnemy.name.toUpperCase()}'s ${part.toUpperCase()} for ${totalDamage} DMG.${critText}`
    );

    updateBattleHud();

    if (currentEnemy.hp <= 0) {
      handleBattleWin();
      return;
    }

    setTimeout(handleEnemyTurn, 400);
  }

  function handleEnemyTurn() {
    if (!currentEnemy || !inBattle) return;

    const e = currentEnemy;
    let action = "attack";

    if (e.type === "deathclaw" || e.type === "raider_elite") {
      if (Math.random() < 0.35) action = "heavy_attack";
    } else if (e.type === "super_mutant" || e.type === "irradiated_beast") {
      if (Math.random() < 0.25) action = "smash";
    } else if (e.type === "robot") {
      if (Math.random() < 0.25) action = "stun_blast";
    }

    let damage = 0;
    if (action === "attack") {
      damage = e.baseDamage;
      pushBattleLog(`${e.name} attacks for ${Math.round(damage)} DMG.`);
    } else if (action === "heavy_attack") {
      damage = e.baseDamage * 1.7;
      pushBattleLog(`${e.name} performs a HEAVY SLASH for ${Math.round(damage)} DMG!`);
    } else if (action === "smash") {
      damage = e.baseDamage * 1.5;
      pushBattleLog(`${e.name} SMASHES you for ${Math.round(damage)} DMG!`);
    } else if (action === "stun_blast") {
      damage = e.baseDamage * 0.9;
      pushBattleLog(
        `${e.name} fires a STUN BLAST for ${Math.round(damage)} DMG. Systems flicker.`
      );
    }

    const defMitigation = 1 - Math.min(0.4, lvl * 0.01);
    const finalDamage = Math.max(1, Math.round(damage * defMitigation));

    applyDamageToPlayer(finalDamage);
    updateBattleHud();

    if (playerHp <= 0) {
      handleBattleLoss();
      return;
    }
  }

  function handleUseStimpak() {
    if (!inBattle) return;
    const healAmount = 25 + lvl * 2;
    healPlayer(healAmount);
    pushBattleLog(`You inject a STIMPAK. Restored ${Math.round(healAmount)} HP.`);
    setTimeout(handleEnemyTurn, 400);
  }

  function handlePlayerFlee() {
    if (!inBattle || !currentEnemy) return;

    const fleeChance = clamp(40 + (lvl - currentEnemy.lvl) * 3, 10, 90);
    const roll = Math.random() * 100;
    if (roll < fleeChance) {
      pushBattleLog("You disengage and flee the combat.");
      setStatus("You fled the encounter.", "status-warn");
      setTimeout(exitBattle, 400);
    } else {
      pushBattleLog("You try to flee... but fail.");
      setTimeout(handleEnemyTurn, 400);
    }
  }

  function chooseBattleRewardItem(enemy) {
    const type = enemy.type;

    const pools = {
      deathclaw: ["deathclaw_hide_armor", "glow_blade"],
      super_mutant: ["riot_gear_elite", "super_sledge"],
      vault_ghoul: ["prototype_plasma_rifle", "experiment_log"],
      robot: ["laser_rifle", "prototype_energy_blade", "prototype_gauss_rifle"],
      raider: ["raider_spike_armor", "service_rifle"],
      raider_elite: ["pitt_forge_armor", "pitt_scrap"],
      irradiated_beast: ["gecko_reactor_core", "chernobyl_relic", "fukushima_core"],
      ncr_trooper: ["service_rifle", "megaton_security_armor"],
      legionary: ["raiders_revenge", "centurion_armor"],
      wasteland_hostile: []
    };

    const poolIds = pools[type] || [];
    const idSet = new Set(poolIds);

    const candidates =
      DATA.scavenger.filter(item => idSet.has(item.id)) || [];

    if (candidates.length === 0) {
      const highRarity = DATA.scavenger.filter(item => {
        const r = (item.rarity || "").toLowerCase();
        return r === "legendary" || r === "epic";
      });
      if (highRarity.length > 0) return randomChoice(highRarity);

      return randomChoice(DATA.scavenger);
    }

    return randomChoice(candidates);
  }

  function handleBattleWin() {
    pushBattleLog(`${currentEnemy.name.toUpperCase()} defeated.`);
    setStatus("Enemy defeated.", "status-good");

    const baseXp = 20 + currentEnemy.lvl * 3;
    const rarityBonusMap = {
      common: 0,
      rare: 20,
      epic: 45,
      legendary: 80
    };
    const rarityBonus =
      rarityBonusMap[(currentEnemy.rarity || "").toLowerCase()] || 0;
    const totalXp = baseXp + rarityBonus;
    const totalCaps = 30 + currentEnemy.lvl * 5;

    const rewardItem = chooseBattleRewardItem(currentEnemy);

    addXp(totalXp);
    addCaps(totalCaps);

    let rewardText = `+${totalXp} XP\n+${totalCaps} CAPS\n`;
    if (rewardItem) {
      rewardText += `NFT ITEM: ${rewardItem.name} [${rarityLabel(
        rewardItem.rarity
      )}]`;
    } else {
      rewardText += "No item recovered.";
    }

    openMintModal("BATTLE COMPLETE", rewardText);
    setTimeout(exitBattle, 600);
  }

  function handleBattleLoss() {
    pushBattleLog("You collapse. Combat sequence terminated.");
    setStatus("You were defeated in combat.", "status-bad");

    const lostCaps = Math.min(caps, Math.round(caps * 0.25));
    caps -= lostCaps;
    playerHp = Math.round(playerMaxHp * 0.4);
    playerRad = clamp(playerRad + 10, 0, 100);
    updateHud();

    openMintModal(
      "YOU DIED",
      `You were defeated.\nLost ${lostCaps} CAPS.\nHP partially restored, radiation increased.`
    );

    setTimeout(exitBattle, 600);
  }

  // ==========================
  // LOCATION PANEL (EXPLORATION + BATTLE HOOK)
  // ==========================
  function openLocationPanel(loc) {
    const name = loc.n || "Unknown Location";
    const lvlReq = loc.lvl || 1;
    const rarity = loc.rarity || "common";

    const pack = DATA.collectiblesPack;
    const allCols = Array.isArray(pack.collectibles)
      ? pack.collectibles
      : [];
    const colsForPoi = allCols.filter(c => c.poi === name);

    let collectiblesHtml = "";
    if (colsForPoi.length > 0) {
      collectiblesHtml =
        "<br/><b>COLLECTIBLES AT THIS LOCATION:</b><br/><br/>" +
        colsForPoi
          .map(
            c => `
<b>${c.title}</b><br/>
<small>Type: ${c.type}</small><br/>
<pre style="white-space:pre-wrap;font-family:inherit;margin:4px 0 10px 0;">${c.content}</pre>
`
          )
          .join("");
    }

    const enemyPreview = buildEnemyForLocation(loc);
    const enemyColor = rarityColor(enemyPreview.rarity);

    openTerminalPanel(
      "LOCATION",
      `
<b>${name}</b><br/>
LVL ${lvlReq} – <span style="color:${rarityColor(
        rarity
      )};">${rarityLabel(rarity)}</span><br/>
LAT: ${loc.lat.toFixed(4)}, LNG: ${loc.lng.toFixed(4)}<br/><br/>
Distance: <span id="locDistance">calculating...</span><br/><br/>

<b>LOCAL THREAT:</b><br/>
<span style="color:${enemyColor};">${enemyPreview.name.toUpperCase()}</span><br/>
LVL ${enemyPreview.lvl} – ${rarityLabel(enemyPreview.rarity)}<br/><br/>

<button class="btn" id="exploreBtn">EXPLORE AREA</button>
<button class="btn danger-btn" id="engageBtn">ENGAGE TARGET (V.A.T.S.)</button>

${collectiblesHtml}
      `
    );

    setTimeout(() => {
      const locDistanceEl = document.getElementById("locDistance");
      const exploreBtn = document.getElementById("exploreBtn");
      const engageBtn = document.getElementById("engageBtn");

      if (currentPosition && locDistanceEl) {
        const d = distanceMeters(
          currentPosition.lat,
          currentPosition.lng,
          loc.lat,
          loc.lng
        );
        locDistanceEl.textContent = `${Math.round(d)}m`;
      } else if (locDistanceEl) {
        locDistanceEl.textContent = "GPS not locked";
      }

      if (exploreBtn) {
        exploreBtn.addEventListener("click", () => handleExploreLocation(loc));
      }
      if (engageBtn) {
        engageBtn.addEventListener("click", () => handleEngageLocation(loc));
      }
    }, 0);
  }

  function withinClaimRadius(loc) {
    if (!currentPosition) return false;
    const d = distanceMeters(
      currentPosition.lat,
      currentPosition.lng,
      loc.lat,
      loc.lng
    );
    return d <= CLAIM_RADIUS_METERS;
  }

  function handleExploreLocation(loc) {
    if (!withinClaimRadius(loc)) {
      setStatus("Too far to explore. Get within 50m.", "status-warn");
      return;
    }

    const baseXp = 10 + (loc.lvl || 1) * 1.5;
    const rarityBonusMap = {
      common: 0,
      rare: 8,
      epic: 18,
      legendary: 30
    };
    const rarityBonus =
      rarityBonusMap[(loc.rarity || "").toLowerCase()] || 0;
    const totalXp = Math.round(baseXp + rarityBonus);
    const totalCaps = 15 + (loc.lvl || 1) * 2;

    addXp(totalXp);
    addCaps(totalCaps);
    incrementClaimed();

    openMintModal(
      "AREA SURVEY COMPLETE",
      `You survey the area.\n+${totalXp} XP\n+${totalCaps} CAPS`
    );
    setStatus("Location explored. Threat profile updated.", "status-good");
  }

  function handleEngageLocation(loc) {
    if (!withinClaimRadius(loc)) {
      setStatus("Too far to engage. Get within 50m.", "status-warn");
      return;
    }

    enterBattle(loc);
  }

  // ==========================
  // TABS
  // ==========================
  function renderStatsPanel() {
    openTerminalPanel(
      "STATUS",
      `
LEVEL: ${lvl}<br/>
XP: ${xp} / 100<br/>
CAPS: ${caps}<br/>
CLAIMED LOCATIONS: ${claimedCount}<br/><br/>
HP: ${Math.round(playerHp)} / ${playerMaxHp}<br/>
RADS: ${playerRad}<br/>
      `
    );
  }

  function renderQuestsPanel() {
    if (!Array.isArray(DATA.quests) || DATA.quests.length === 0) {
      openTerminalPanel("QUESTS", "No quests available.");
      return;
    }

    const html = DATA.quests
      .map(q => {
        const typeLabel =
          (q.type || "").toLowerCase() === "side"
            ? "SIDE QUEST"
            : "MAIN QUEST";
        const poiLine = Array.isArray(q.poIs)
          ? q.poIs.join(", ")
          : "Unknown POIs";

        const objectivesHtml = Array.isArray(q.objectives)
          ? q.objectives.map(o => `- ${o}`).join("<br/>")
          : "No objectives listed.";

        const endingsHtml =
          Array.isArray(q.endings) && q.endings.length > 0
            ? q.endings
                .map(
                  e => `
<b>Ending:</b> ${e.description}<br/>
<b>Reward:</b> ${e.reward || "Unknown"}<br/>
<b>Consequence:</b> ${e.consequence || "Unknown"}<br/><br/>
`
                )
                .join("")
            : "Endings TBD.<br/><br/>";

        return `
<div style="margin-bottom:18px;">
  <b>${q.name}</b> <small>(${typeLabel})</small><br/>
  <small>POIs: ${poiLine}</small><br/><br/>
  ${q.description}<br/><br/>
  <b>Objectives:</b><br/>
  ${objectivesHtml}<br/><br/>
  ${endingsHtml}
</div>
`;
      })
      .join("");

    openTerminalPanel("QUESTS", html);
  }

  function renderItemsPanel() {
    const pack = DATA.collectiblesPack;
    const collectibles = Array.isArray(pack.collectibles)
      ? pack.collectibles
      : [];

    if (collectibles.length === 0) {
      openTerminalPanel("ITEMS", "No collectibles available.");
      return;
    }

    const byPoi = {};
    collectibles.forEach(c => {
      const key = c.poi || "Unknown Location";
      if (!byPoi[key]) byPoi[key] = [];
      byPoi[key].push(c);
    });

    const sections = Object.keys(byPoi)
      .sort()
      .map(poi => {
        const entries = byPoi[poi]
          .map(
            c => `
<b>${c.title}</b><br/>
<small>Type: ${c.type}</small><br/>
<pre style="white-space:pre-wrap;font-family:inherit;margin:4px 0 10px 0;">${c.content}</pre>
`
          )
          .join("");

        return `
<div style="margin-bottom:16px;">
  <div><b>POI:</b> ${poi}</div>
  ${entries}
</div>
`;
      })
      .join("");

    const header = `
<b>COLLECTIBLES – ${pack.id || "UNLABELED PACK"}</b><br/>
${pack.description || ""}<br/><br/>
`;

    openTerminalPanel("ITEMS", header + sections);
  }

  function renderShopPanel() {
    if (!Array.isArray(DATA.scavenger) || DATA.scavenger.length === 0) {
      openTerminalPanel(
        "SCAVENGER'S EXCHANGE",
        "No items catalogued for exchange."
      );
      return;
    }

    const html = DATA.scavenger
      .slice(0, 80)
      .map(item => {
        const rColor = rarityColor(item.rarity);
        const rLabel = rarityLabel(item.rarity);
        return `
<span style="color:${rColor};">
  ${item.name} [${rLabel}]
</span><br/>
<small>${item.type} – LVL ${item.levelRequirement ||
          1} – ${item.priceCAPS} CAPS</small><br/><br/>
`;
      })
      .join("");

    openTerminalPanel("SCAVENGER'S EXCHANGE", html);
  }

  function initTabs() {
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        if (inBattle) return;

        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        const panel = tab.getAttribute("data-panel");
        if (panel === "map") {
          closeTerminalPanel();
        } else if (panel === "stat") {
          renderStatsPanel();
        } else if (panel === "items") {
          renderItemsPanel();
        } else if (panel === "quests") {
          renderQuestsPanel();
        } else if (panel === "shop") {
          renderShopPanel();
        }
      });
    });
  }

  // ==========================
  // WALLET
  // ==========================
  function initWallet() {
    if (!connectWalletBtn) return;

    connectWalletBtn.addEventListener("click", async () => {
      if (!window.solana || !window.solana.isPhantom) {
        setStatus("Phantom wallet not detected.", "status-warn");
        return;
      }

      try {
        const resp = await window.solana.connect();
        walletPubkey = resp.publicKey.toString();
        setStatus(
          `Wallet connected: ${walletPubkey.slice(
            0,
            4
          )}...${walletPubkey.slice(-4)}`,
          "status-good"
        );
        connectWalletBtn.textContent = "Wallet Connected";
      } catch (e) {
        console.error(e);
        setStatus("Wallet connection rejected.", "status-bad");
      }
    });
  }

  // ==========================
  // UI INIT
  // ==========================
  function initUi() {
    if (requestGpsBtn) requestGpsBtn.addEventListener("click", requestGps);
    if (centerBtn) centerBtn.addEventListener("click", centerOnPlayer);
    if (recenterMojaveBtn)
      recenterMojaveBtn.addEventListener("click", recenterMojave);

    if (panelClose) panelClose.addEventListener("click", closeTerminalPanel);
    if (mintCloseBtn) mintCloseBtn.addEventListener("click", closeMintModal);
    if (tutorialClose) tutorialClose.addEventListener("click", closeTutorial);

    initTabs();
    initWallet();
    initMapModeButton();
    updateHud();

    // disable accidental top-left overlay stealing clicks by default
    const ol = document.querySelector('.overseer-link');
    if (ol) ol.style.pointerEvents = 'none';
  }

  // ==========================
  // GAME INIT
  // ==========================
  // Init sequence: robust, idempotent, and mobile-friendly
let _gameInitializing = false;
let _gameInitialized = false;

async function initGame() {
  if (_gameInitialized || _gameInitializing) return;
  _gameInitializing = true;

  try {
    // Load all data (tolerant loader should already be in place)
    await loadAllData();

    // Ensure arrays exist so later code can safely push/iterate
    DATA.scavenger = Array.isArray(DATA.scavenger) ? DATA.scavenger : [];
    DATA.mintables = Array.isArray(DATA.mintables) ? DATA.mintables : [];

    // Convert any loaded mintables (NFT metadata) into in-game items
    if (DATA.mintables.length > 0 && typeof nftToGameItem === "function") {
      DATA.mintables = DATA.mintables.map(nft => {
        try { return nftToGameItem(nft); } catch (e) { console.warn("nftToGameItem failed for", nft && nft.id, e); return nft; }
      });
    }

    // Initialize map and UI (initMap is guarded to reuse existing map)
    try { initMap(); } catch (e) { console.warn("initMap error", e); }
    try { initUi(); } catch (e) { console.warn("initUi error", e); }

    // Ensure a sensible map style is active and the map is sized correctly
    try {
      switchMapStyle && switchMapStyle("terrain");
    } catch (e) {
      console.warn("switchMapStyle failed", e);
    }
    setTimeout(() => {
      if (map && typeof map.invalidateSize === "function") map.invalidateSize();
    }, 350);

    // Optional: open tutorial only if function exists and not already shown
    try { if (typeof openTutorial === "function") openTutorial(); } catch (e) { /* ignore */ }

    // Friendly status update (safe if setStatus exists)
    try { setStatus && setStatus("Pip-Boy online. Request GPS to begin tracking.", "status-good"); } catch (e) { /* ignore */ }

    _gameInitialized = true;
  } catch (err) {
    console.error("initGame failed", err);
  } finally {
    _gameInitializing = false;
  }
}

// Trigger init when pipboy is ready (idempotent)
window.addEventListener("pipboyReady", () => {
  try { initGame(); } catch (e) { console.warn("pipboyReady initGame error", e); }
});

// Dev/test fallback: attempt init if pipboyReady didn't fire but DOM looks ready
setTimeout(() => {
  try {
    const mapElementPresent = typeof mapEl !== "undefined" && mapEl && document.body && document.body.contains(mapEl);
    if (!map && mapElementPresent && !_gameInitialized && !_gameInitializing) {
      initGame();
    }
  } catch (e) {
    // ignore; pipboyReady will call initGame when ready
  }
}, 1200);


}}());