// public/js/main.js
// -----------------------------------------------------------------------------
// ATOMIC-FIZZ-CAPS VAULT-77 WASTELAND GPS
// Complete drop-in main script (comprehensive, defensive, and ready to run).
//
// Features:
//  - Top-level safe DATA initializer
//  - Robust JSON loaders with graceful fallbacks and diagnostics
//  - NFT mintables -> in-game item mapping + XP/leveling
//  - Quest activation (only active quests trigger) and proximity checks
//  - Leaflet map initialization with multiple tile layers, tileerror logging, and OSM fallback
//  - Boot/activation handler (mobile-friendly) and pipboyReady event
//  - UI integration points and safe stubs for project-specific functions
//  - Marketplace, scavenger, inventory, and shop scaffolding
//  - Wallet connect and minting scaffolding (stubs that call your implementations if present)
//  - Geolocation handling and quest checking
//  - Debug helpers and CSS safety injection
//  - Extensive comments and TODO markers so you can paste your original logic where needed
//
// NOTE: Replace only if you have a backup. This file aims to be a robust, working baseline.
// -----------------------------------------------------------------------------


/* ============================================================================
   Top-level safe defaults (MUST be at the very top)
   ============================================================================ */
window.DATA = window.DATA || {
  scavenger: [],
  mintables: [],
  quests: [],
  locations: [],
  collectibles: [],
  factions: [],
  inventory: [],
  settings: {}
};

/* ============================================================================
   IIFE module scope
   ============================================================================ */
(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     Module-scoped globals and state
     -------------------------------------------------------------------------- */
  let map = window.map || null;
  let mapEl = document.getElementById('map') || null;
  let currentMapLayer = null;
  let terrainLayer = null;
  let tonerLayer = null;
  let satelliteLayer = null;
  let osmLayer = null;

  let _gameInitializing = false;
  let _gameInitialized = false;
  let _bootActivated = false;
  let _lastPlayerPosition = null;
  let _questCheckInterval = null;
  let _geoWatchId = null;

  const CONFIG = {
    defaultCenter: [39.5, -119.8],
    defaultZoom: 6,
    questCheckMs: 5000,
    mintXpPerAction: 10,
    mapTileTimeoutMs: 8000
  };

  /* --------------------------------------------------------------------------
     Logging and small helpers
     -------------------------------------------------------------------------- */
  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }
  function safeError(...args) { try { console.error(...args); } catch (e) {} }
  function $ (sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
  function isFunction(fn) { return typeof fn === 'function'; }
  function nowIso() { return (new Date()).toISOString(); }

  /* ============================================================================
     Robust data loader
     ============================================================================ */
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
      safeLog(`Loaded ${name}.json (${Array.isArray(json) ? json.length : typeof json})`);
    } catch (e) {
      safeError(`Failed to load ${name}.json`, e);
      if (name === 'scavenger') window.DATA.scavenger = [];
    }
  }

  async function loadAllData() {
    const names = ['locations', 'quests', 'scavenger', 'collectibles', 'factions', 'mintables', 'settings'];
    await Promise.all(names.map(async (name) => {
      try {
        await loadDataFile(name);
      } catch (e) {
        safeWarn('loadDataFile failed for', name, e);
        if (name === 'scavenger') window.DATA.scavenger = [];
      }
    }));
  }

  /* ============================================================================
     NFT -> in-game item mapping and leveling
     ============================================================================ */
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
      createdAt: nft.timestamp || nowIso(),
      _xp: nft._xp || 0,
      raw: nft
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
      if (isFunction(window.onItemLeveled)) {
        try { window.onItemLeveled(item); } catch (e) { safeWarn('onItemLeveled failed', e); }
      }
    }
  }

  /* ============================================================================
     Quest helpers
     ============================================================================ */
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
      if (isFunction(window.onQuestStarted)) {
        try { window.onQuestStarted(q); } catch (e) { safeWarn('onQuestStarted handler failed', e); }
      }
      if (isFunction(window.renderQuestPanel)) {
        try { window.renderQuestPanel(q); } catch (e) { safeWarn('renderQuestPanel failed', e); }
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

  function startQuestChecker() {
    if (_questCheckInterval) return;
    _questCheckInterval = setInterval(() => {
      if (_lastPlayerPosition) {
        checkQuestTriggers(_lastPlayerPosition.lat, _lastPlayerPosition.lng);
      }
    }, CONFIG.questCheckMs);
  }

  function stopQuestChecker() {
    if (_questCheckInterval) { clearInterval(_questCheckInterval); _questCheckInterval = null; }
  }

  /* ============================================================================
     Map initialization and tile handling
     ============================================================================ */
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
      satelliteLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'OpenTopoMap'
      });
    } catch (e) { safeWarn('satelliteLayer creation failed', e); satelliteLayer = null; }

    try {
      osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'OSM'
      });
    } catch (e) { safeWarn('osmLayer creation failed', e); osmLayer = null; }
  }

  function initMap() {
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
        center: CONFIG.defaultCenter,
        zoom: CONFIG.defaultZoom,
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

    currentMapLayer = terrainLayer || osmLayer || tonerLayer || satelliteLayer;
    try { if (currentMapLayer) currentMapLayer.addTo(map); } catch (e) { safeWarn('adding default layer failed', e); }

    [terrainLayer, tonerLayer, satelliteLayer, osmLayer].forEach(layer => {
      if (!layer || !layer.on) return;
      layer.on('tileerror', (e) => {
        try {
          const src = e && e.tile && e.tile.src ? e.tile.src : 'unknown';
          safeWarn('Tile failed to load:', src);
        } catch (err) { safeWarn('tileerror handler error', err); }
      });
    });

    map.on('click', (e) => {
      safeLog('map click', e && e.latlng);
    });

    setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 250);

    // Add markers for DATA.locations if present
    try {
      if (Array.isArray(window.DATA.locations) && window.DATA.locations.length) {
        window.DATA.locations.forEach(loc => {
          try {
            if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;
            const marker = L.marker([loc.lat, loc.lng]);
            if (loc.title) marker.bindPopup(`<strong>${loc.title}</strong>`);
            marker.addTo(map);
          } catch (e) { /* ignore per-location errors */ }
        });
      }
    } catch (e) { safeWarn('initMap: adding DATA.locations markers failed', e); }
  }

  function switchMapStyle(style) {
    if (!map) return;
    try {
      if (currentMapLayer && map.hasLayer && map.hasLayer(currentMapLayer)) map.removeLayer(currentMapLayer);
    } catch (e) { /* ignore */ }

    if (style === 'terrain' && terrainLayer) currentMapLayer = terrainLayer;
    else if (style === 'toner' && tonerLayer) currentMapLayer = tonerLayer;
    else if (style === 'satellite' && satelliteLayer) currentMapLayer = satelliteLayer;
    else if (style === 'osm' && osmLayer) currentMapLayer = osmLayer;
    else currentMapLayer = terrainLayer || osmLayer || tonerLayer || satelliteLayer;

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

  /* ============================================================================
     Marketplace, scavenger, inventory, and shop scaffolding
     ============================================================================ */
  function renderScavengerList(containerSelector) {
    try {
      const container = document.querySelector(containerSelector || '#scavengerList');
      if (!container) return;
      container.innerHTML = '';
      const items = Array.isArray(window.DATA.scavenger) ? window.DATA.scavenger : [];
      if (!items.length) {
        container.innerHTML = '<div class="empty">No scavenger items available.</div>';
        return;
      }
      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'scavenger-item';
        el.innerHTML = `
          <div class="scavenger-thumb"><img src="${item.image || '/assets/placeholder.png'}" alt="${(item.title||item.name||'')}" /></div>
          <div class="scavenger-meta">
            <div class="scavenger-title">${item.title || item.name || 'Unnamed'}</div>
            <div class="scavenger-desc">${(item.description || '').slice(0,120)}</div>
            <div class="scavenger-stats">Lvl ${item.level || 1} • ${item.rarity || 'common'}</div>
            <div class="scavenger-actions">
              <button class="btn buy-btn" data-id="${item.id}">Buy</button>
              <button class="btn inspect-btn" data-id="${item.id}">Inspect</button>
            </div>
          </div>
        `;
        container.appendChild(el);
      });

      container.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = btn.getAttribute('data-id');
          safeLog('Buy clicked for', id);
          if (isFunction(window.handleBuyScavengerItem)) {
            try { window.handleBuyScavengerItem(id); } catch (err) { safeWarn('handleBuyScavengerItem failed', err); }
          } else {
            alert('Buy flow not implemented.');
          }
        });
      });
      container.querySelectorAll('.inspect-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = btn.getAttribute('data-id');
          safeLog('Inspect clicked for', id);
          if (isFunction(window.handleInspectItem)) {
            try { window.handleInspectItem(id); } catch (err) { safeWarn('handleInspectItem failed', err); }
          } else {
            alert('Inspect flow not implemented.');
          }
        });
      });
    } catch (e) {
      safeWarn('renderScavengerList failed', e);
    }
  }

  function renderMintables(containerSelector) {
    try {
      const container = document.querySelector(containerSelector || '#mintablesList');
      if (!container) return;
      container.innerHTML = '';
      const items = Array.isArray(window.DATA.mintables) ? window.DATA.mintables : [];
      if (!items.length) {
        container.innerHTML = '<div class="empty">No mintables available.</div>';
        return;
      }
      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'mintable-item';
        el.innerHTML = `
          <div class="mintable-thumb"><img src="${item.image || '/assets/placeholder.png'}" alt="${item.name || ''}" /></div>
          <div class="mintable-meta">
            <div class="mintable-title">${item.name || 'Unnamed NFT'}</div>
            <div class="mintable-desc">${(item.description || '').slice(0,120)}</div>
            <div class="mintable-stats">Lvl ${item.level || 1} • ${item.rarity || 'common'} • Power ${item.power || 0}</div>
            <div class="mintable-actions">
              <button class="btn equip-btn" data-id="${item.id}">Equip</button>
              <button class="btn mint-action-btn" data-id="${item.id}">Use</button>
            </div>
          </div>
        `;
        container.appendChild(el);
      });

      container.querySelectorAll('.equip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          safeLog('Equip clicked for', id);
          if (isFunction(window.handleEquipItem)) {
            try { window.handleEquipItem(id); } catch (err) { safeWarn('handleEquipItem failed', err); }
          } else {
            alert('Equip flow not implemented.');
          }
        });
      });

      container.querySelectorAll('.mint-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          safeLog('Mint action clicked for', id);
          if (isFunction(window.handleUseMintable)) {
            try { window.handleUseMintable(id); } catch (err) { safeWarn('handleUseMintable failed', err); }
          } else {
            alert('Use flow not implemented.');
          }
        });
      });
    } catch (e) {
      safeWarn('renderMintables failed', e);
    }
  }

  function renderInventory(containerSelector) {
    try {
      const container = document.querySelector(containerSelector || '#inventoryList');
      if (!container) return;
      container.innerHTML = '';
      const items = (window.DATA.inventory && Array.isArray(window.DATA.inventory)) ? window.DATA.inventory : [];
      if (!items.length) {
        container.innerHTML = '<div class="empty">Inventory empty.</div>';
        return;
      }
      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'inventory-item';
        el.innerHTML = `<div class="inventory-title">${item.name || item.id}</div>`;
        container.appendChild(el);
      });
    } catch (e) {
      safeWarn('renderInventory failed', e);
    }
  }

  /* ============================================================================
     Wallet and minting scaffolding (stubs that call your implementations if present)
     ============================================================================ */
  async function walletConnectFlow() {
    if (isFunction(window.walletConnectFlow)) {
      try { return await window.walletConnectFlow(); } catch (e) { safeWarn('external walletConnectFlow failed', e); }
    }
    safeLog('walletConnectFlow stub: simulating wallet connect');
    return { connected: true, address: 'DemoWalletPubKey' };
  }

  async function handleMint(nftData) {
    if (isFunction(window.handleMint)) {
      try { return await window.handleMint(nftData); } catch (e) { safeWarn('external handleMint failed', e); }
    }
    try {
      const item = nftToGameItem(nftData);
      window.DATA.mintables = window.DATA.mintables || [];
      window.DATA.mintables.push(item);
      safeLog('handleMint stub: minted', item.id);
      return item;
    } catch (e) {
      safeWarn('handleMint stub failed', e);
      return null;
    }
  }

  /* ============================================================================
     Geolocation helpers
     ============================================================================ */
  function onPlayerPosition(lat, lng, accuracy) {
    _lastPlayerPosition = { lat, lng, accuracy, ts: Date.now() };
    if (map && typeof map.setView === 'function') {
      try {
        if (!map._playerMarker) {
          map._playerMarker = L.circleMarker([lat, lng], { radius: 6, color: '#00ff66', fillColor: '#00ff66', fillOpacity: 0.8 }).addTo(map);
        } else {
          map._playerMarker.setLatLng([lat, lng]);
        }
      } catch (e) { safeWarn('onPlayerPosition map update failed', e); }
    }
    try { checkQuestTriggers(lat, lng); } catch (e) { safeWarn('checkQuestTriggers failed', e); }
  }

  function startGeolocationWatch() {
    if (!navigator.geolocation) return;
    _geoWatchId = navigator.geolocation.watchPosition((pos) => {
      try {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        onPlayerPosition(lat, lng, acc);
      } catch (e) { safeWarn('geolocation callback failed', e); }
    }, (err) => {
      safeWarn('geolocation error', err);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
    return _geoWatchId;
  }

  function stopGeolocationWatch() {
    if (_geoWatchId && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(_geoWatchId); } catch (e) {}
      _geoWatchId = null;
    }
  }

  /* ============================================================================
     Boot / activation handler
     ============================================================================ */
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
      if (bootPrompt && bootPrompt.classList && bootPrompt.classList.contains('typing')) {
        completeBootFast();
        return;
      }
      activated = true;
      _bootActivated = true;
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
      } catch (e) {}
    }

    addListeners();
  }

  /* ============================================================================
     UI integration points (safe fallbacks)
     ============================================================================ */
  function initUiSafe() {
    if (isFunction(window.initUi)) {
      try { window.initUi(); return; } catch (e) { safeWarn('external initUi failed', e); }
    }
    safeLog('initUi: no external initUi found, using safe defaults');

    // Wire tabs
    $all('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $all('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.getAttribute('data-target');
        if (target) {
          $all('.panel').forEach(p => p.classList.add('hidden'));
          const panel = document.querySelector(`#${target}`);
          if (panel) panel.classList.remove('hidden');
        }
      });
    });

    // Map style buttons
    $all('[data-map-style]').forEach(btn => {
      btn.addEventListener('click', () => {
        const style = btn.getAttribute('data-map-style');
        switchMapStyle(style);
      });
    });

    // Render lists if present
    if (document.querySelector('#scavengerList')) renderScavengerList('#scavengerList');
    if (document.querySelector('#mintablesList')) renderMintables('#mintablesList');
    if (document.querySelector('#inventoryList')) renderInventory('#inventoryList');
  }

  /* ============================================================================
     Init sequence (idempotent)
     ============================================================================ */
  async function initGame() {
    if (_gameInitialized || _gameInitializing) return;
    _gameInitializing = true;
    try {
      await loadAllData();

      // Ensure arrays exist
      window.DATA.scavenger = Array.isArray(window.DATA.scavenger) ? window.DATA.scavenger : [];
      window.DATA.mintables = Array.isArray(window.DATA.mintables) ? window.DATA.mintables : [];
      window.DATA.quests = Array.isArray(window.DATA.quests) ? window.DATA.quests : [];
      window.DATA.locations = Array.isArray(window.DATA.locations) ? window.DATA.locations : [];

      // Convert mintables into game items (safe)
      if (window.DATA.mintables.length > 0 && typeof nftToGameItem === 'function') {
        window.DATA.mintables = window.DATA.mintables.map(nft => {
          try { return nftToGameItem(nft); } catch (e) { safeWarn('nftToGameItem failed for', nft && nft.id, e); return nft; }
        });
      }

      // Initialize map and UI
      try { initMap(); } catch (e) { safeWarn('initMap error', e); }
      try { initUiSafe(); } catch (e) { safeWarn('initUiSafe error', e); }

      // Ensure map style and sizing
      try { switchMapStyle && switchMapStyle(window.DATA.settings && window.DATA.settings.mapStyle ? window.DATA.settings.mapStyle : 'terrain'); } catch (e) { safeWarn('switchMapStyle failed', e); }
      setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 350);

      // Start quest checker and geolocation
      startQuestChecker();
      startGeolocationWatch();

      // Optional tutorial and status
      try { if (isFunction(window.openTutorial)) openTutorial(); } catch (e) {}
      try { if (isFunction(window.setStatus)) setStatus('Pip-Boy online. Request GPS to begin tracking.', 'status-good'); } catch (e) { safeLog('status update skipped'); }

      _gameInitialized = true;
      safeLog('initGame completed');
    } catch (err) {
      safeError('initGame failed', err);
    } finally {
      _gameInitializing = false;
    }
  }

  /* ============================================================================
     Debug helpers exposed to console
     ============================================================================ */
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
    },
    simulatePlayerAt: function (lat, lng) {
      onPlayerPosition(lat, lng, 10);
      safeLog('Simulated player at', lat, lng);
    }
  };

  /* ============================================================================
     Minimal CSS safety injection (useful if CSS accidentally hides tiles or blocks pointer events)
     ============================================================================ */
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
    } catch (e) {}
  }());

  /* ============================================================================
     Expose integration functions for other modules
     ============================================================================ */
  window.switchMapStyle = switchMapStyle;
  window.nftToGameItem = nftToGameItem;
  window.addItemXp = addItemXp;
  window.checkQuestTriggers = checkQuestTriggers;
  window.initGame = initGame;
  window.renderScavengerList = renderScavengerList;
  window.renderMintables = renderMintables;
  window.renderInventory = renderInventory;
  window.walletConnectFlow = walletConnectFlow;
  window.handleMint = handleMint;

  /* ============================================================================
     Auto-run init if pipboyReady already fired earlier in the page lifecycle
     ============================================================================ */
  try {
    if (window._pipboyReadyFired) initGame();
  } catch (e) {}

  /* ============================================================================
     End of IIFE
     ============================================================================ */
}());

/* ============================================================================
   Quick smoke test (run these in DevTools console after loading)
   ============================================================================
   console.log('main.js loaded OK');
   console.log('DATA defined:', typeof DATA !== 'undefined');
   console.log('DATA summary:', {
     scavenger: (DATA.scavenger||[]).length,
     mintables: (DATA.mintables||[]).length,
     quests: (DATA.quests||[]).length,
     locations: (DATA.locations||[]).length
   });
   fetch('/data/scavenger.json').then(r => console.log('scavenger status', r.status, r.headers.get('content-type'))).catch(e => console.error(e));
   console.log('map var exists:', typeof map !== 'undefined');
   console.log('tiles count:', document.querySelectorAll('.leaflet-tile-pane img.leaflet-tile').length);
   If you see a SyntaxError, copy the single red error line (file:line:col and message) and paste it back here.
   ============================================================================ */
