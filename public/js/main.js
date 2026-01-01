// public/js/main.js
// ATOMIC-FIZZ-CAPS VAULT-77 WASTELAND GPS
// Consolidated drop-in main script
// - Merges Parts 1–3 into a single defensive file
// - Removes duplicates, fixes CFG -> CONFIG, replaces string-eval timeouts/intervals
// - Guards Leaflet and DOM usage, consolidates exports
// - Ready to paste into repo: public/js/main.js
//
// Notes:
// - This file is intentionally defensive: it checks for missing DOM elements, missing Leaflet,
//   and missing optional plugins (marker cluster). It avoids eval-style string timeouts/intervals.
// - If you have custom UI functions (initUi, handleMint, etc.) this file will call them when present.
// - Adjust tile URLs or CSP headers on your server if tiles are blocked by CSP/CORB.

(function () {
  'use strict';

  /* ============================================================================
     Top-level safe defaults
     ============================================================================ */
  // Ensure DATA exists to avoid ReferenceErrors from other scripts
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
     Module-scoped globals and state
     ============================================================================ */
  // Map and UI globals
  let map = window.map || null;
  let mapEl = document.getElementById('map') || null;
  let currentMapLayer = null;
  let terrainLayer = null;
  let tonerLayer = null;
  let satelliteLayer = null;
  let osmLayer = null;
  let locationsLayer = null;
  let clusterLayer = null;

  // App state
  let _gameInitializing = false;
  let _gameInitialized = false;
  let _bootActivated = false;
  let _lastPlayerPosition = null;
  let _questCheckInterval = null;
  let _geoWatchId = null;

  // Config (single source) - FIXED: Changed defaultCenter to Mojave/Vegas area to match locations
  const CONFIG = {
    defaultCenter: [36.1699, -115.1398],  // Vault 22 / Mojave Wasteland
    defaultZoom: 10,  // Closer zoom for better initial view
    questCheckMs: 5000,
    mintXpPerAction: 10,
    minMapHeight: 320,
    mapTileTimeoutMs: 8000,
    tileProviders: {
      terrain: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
      toner: 'https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    }
  };

  /* ============================================================================
     Small helpers
     ============================================================================ */
  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }
  function safeError(...args) { try { console.error(...args); } catch (e) {} }
  function $ (sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
  function $all(sel) { try { return Array.from(document.querySelectorAll(sel)); } catch (e) { return []; } }
  function isFunction(fn) { return typeof fn === 'function'; }
  function nowIso() { return (new Date()).toISOString(); }

  /* ============================================================================
     Minimal CSS safety injection
     ============================================================================ */
  (function ensureCssSafety() {
    try {
      const styleId = 'pipboy-mainjs-safety';
      if (document.getElementById(styleId)) return;
      const css = `
        .map-container, #map { z-index: 20 !important; pointer-events: auto !important; min-height: ${CONFIG.minMapHeight}px !important; }
        .static-noise, .top-overlay, .overseer-link, .pipboy-screen, .hud { pointer-events: none !important; z-index: 5 !important; }
        .leaflet-tile-pane img.leaflet-tile { visibility: visible !important; opacity: 1 !important; image-rendering: auto !important; }
        .btn { min-width: 44px; min-height: 44px; touch-action: manipulation; }
      `;
      const s = document.createElement('style');
      s.id = styleId;
      s.appendChild(document.createTextNode(css));
      document.head && document.head.appendChild(s);
    } catch (e) {}
  }());

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
        try { checkQuestTriggers(_lastPlayerPosition.lat, _lastPlayerPosition.lng); } catch (e) { safeWarn('checkQuestTriggers failed', e); }
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
    // Guard Leaflet presence
    if (typeof L === 'undefined') {
      safeWarn('Leaflet (L) is not available; map layers will not be created.');
      terrainLayer = tonerLayer = satelliteLayer = osmLayer = null;
      return;
    }

    try {
      terrainLayer = L.tileLayer(CONFIG.tileProviders.terrain, { maxZoom: 18, attribution: 'Stamen Terrain' });
    } catch (e) { safeWarn('terrainLayer creation failed', e); terrainLayer = null; }

    try {
      tonerLayer = L.tileLayer(CONFIG.tileProviders.toner, { maxZoom: 18, attribution: 'Stamen Toner' });
    } catch (e) { safeWarn('tonerLayer creation failed', e); tonerLayer = null; }

    try {
      satelliteLayer = L.tileLayer(CONFIG.tileProviders.satellite, { maxZoom: 18, attribution: 'Esri/World Imagery' });
    } catch (e) { safeWarn('satelliteLayer creation failed', e); satelliteLayer = null; }

    try {
      osmLayer = L.tileLayer(CONFIG.tileProviders.osm, { maxZoom: 19, attribution: 'OSM' });
    } catch (e) { safeWarn('osmLayer creation failed', e); osmLayer = null; }
  }

  function addTileErrorHandlers(layer) {
    if (!layer || !layer.on) return;
    try {
      let loadTimer = null;
      // No string eval: use functions
      layer.on('loading', () => {
        if (loadTimer) clearTimeout(loadTimer);
        loadTimer = setTimeout(() => {
          safeWarn('Tile loading timeout for layer', layer);
        }, CONFIG.mapTileTimeoutMs);
      });
      layer.on('load', () => {
        if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
      });
      layer.on('tileerror', (e) => {
        try {
          const src = e && e.tile && e.tile.src ? e.tile.src : 'unknown';
          safeWarn('Tile failed to load:', src);
        } catch (err) { safeWarn('tileerror handler error', err); }
      });
    } catch (e) { safeWarn('addTileErrorHandlers failed', e); }
  }

  function initMap() {
    // If Leaflet missing, bail gracefully
    if (typeof L === 'undefined') {
      safeWarn('Leaflet not loaded; initMap aborted.');
      return;
    }

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

    // Attach tileerror handlers
    [terrainLayer, tonerLayer, satelliteLayer, osmLayer].forEach(layer => addTileErrorHandlers(layer));

    // Create locations layer and optional cluster
    try {
      if (typeof L.markerClusterGroup !== 'undefined') {
        clusterLayer = L.markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false });
        locationsLayer = clusterLayer;
        map.addLayer(clusterLayer);
      } else {
        locationsLayer = L.layerGroup().addTo(map);
      }
    } catch (e) {
      safeWarn('locations layer creation failed', e);
      locationsLayer = L.layerGroup().addTo(map);
    }

    // Add markers for DATA.locations if present
    try {
      if (Array.isArray(window.DATA.locations) && window.DATA.locations.length) {
        window.DATA.locations.forEach(loc => {
          try {
            if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;
            const marker = L.marker([loc.lat, loc.lng]);
            if (loc.title) marker.bindPopup(`<strong>${loc.title}</strong>`);
            marker.addTo(locationsLayer);
            marker.on('click', () => {
              if (isFunction(window.onLocationClick)) {
                try { window.onLocationClick(loc); } catch (e) { safeWarn('onLocationClick failed', e); }
              }
            });
          } catch (e) { /* ignore per-location errors */ }
        });
      }
    } catch (e) { safeWarn('initMap: adding DATA.locations markers failed', e); }

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
    else if (style === 'osm' && osmLayer) currentMapLayer = osmLayer;
    else currentMapLayer = terrainLayer || osmLayer || tonerLayer || satelliteLayer;

    try {
      if (currentMapLayer) currentMapLayer.addTo(map);
    } catch (e) {
      safeWarn('Failed to add chosen layer, falling back to OSM', e);
      try {
        currentMapLayer = L.tileLayer(CONFIG.tileProviders.osm, { maxZoom: 19 });
        currentMapLayer.addTo(map);
      } catch (err) { safeWarn('OSM fallback failed', err); }
    }
    setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 120);
  }

  /* ============================================================================
     Event bus and persistence
     ============================================================================ */
  const EventBus = (function () {
    const subs = {};
    return {
      on: (evt, fn) => {
        subs[evt] = subs[evt] || [];
        subs[evt].push(fn);
        return () => { subs[evt] = (subs[evt] || []).filter(f => f !== fn); };
      },
      emit: (evt, payload) => {
        (subs[evt] || []).forEach(fn => {
          try { fn(payload); } catch (e) { safeWarn('EventBus handler failed', e); }
        });
      }
    };
  }());

  const PERSIST_KEY = 'atomicfizz_pipboy_v1';
  function saveState() {
    try {
      const snapshot = {
        DATA: window.DATA,
        ts: Date.now()
      };
      localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
      safeLog('Saved state to localStorage');
    } catch (e) { safeWarn('saveState failed', e); }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(PERSIST_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.DATA) {
        // Merge carefully to avoid wiping runtime defaults
        window.DATA = Object.assign(window.DATA || {}, parsed.DATA);
        safeLog('Loaded state from localStorage');
        return parsed;
      }
    } catch (e) { safeWarn('loadState failed', e); }
    return null;
  }

  // Auto-load on script run (safe)
  try { loadState(); } catch (e) { safeWarn('initial loadState failed', e); }

  /* ============================================================================
     Marketplace, mintables, wallet flow
     ============================================================================ */
  function renderShopPanel(containerSelector) {
    try {
      const container = document.querySelector(containerSelector || '#shopPanel');
      if (!container) return;
      container.innerHTML = '';
      const items = Array.isArray(window.DATA.scavenger) ? window.DATA.scavenger : [];
      if (!items.length) {
        container.innerHTML = '<div class="empty">No shop items available.</div>';
        return;
      }
      const list = document.createElement('div');
      list.className = 'shop-list';
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.innerHTML = `
          <div class="shop-thumb"><img src="${item.image || '/assets/placeholder.png'}" alt="${(item.title||item.name||'')}" /></div>
          <div class="shop-body">
            <div class="shop-title">${item.title || item.name || 'Unnamed'}</div>
            <div class="shop-desc">${(item.description || '').slice(0,140)}</div>
            <div class="shop-meta">Lvl ${item.level || 1} • ${item.rarity || 'common'}</div>
            <div class="shop-actions">
              <button class="btn buy" data-id="${item.id}">Buy</button>
              <button class="btn inspect" data-id="${item.id}">Inspect</button>
            </div>
          </div>
        `;
        list.appendChild(card);
      });
      container.appendChild(list);

      // Delegated handlers
      container.querySelectorAll('.buy').forEach(b => {
        b.addEventListener('click', (e) => {
          const id = b.getAttribute('data-id');
          safeLog('Shop buy clicked', id);
          EventBus.emit('shop:buy', { id });
          if (isFunction(window.handleBuyScavengerItem)) {
            try { window.handleBuyScavengerItem(id); } catch (err) { safeWarn('handleBuyScavengerItem failed', err); }
          } else {
            // default: add to inventory
            const item = (window.DATA.scavenger || []).find(x => x.id === id);
            if (item) {
              window.DATA.inventory = window.DATA.inventory || [];
              window.DATA.inventory.push(Object.assign({}, item));
              saveState();
              try { showModal('Purchase', `<p>Purchased: ${item.title || item.name || item.id}</p>`); } catch (e) {}
            } else {
              try { showModal('Purchase', `<p>Item not found</p>`); } catch (e) {}
            }
          }
        });
      });

      container.querySelectorAll('.inspect').forEach(b => {
        b.addEventListener('click', (e) => {
          const id = b.getAttribute('data-id');
          safeLog('Shop inspect clicked', id);
          EventBus.emit('shop:inspect', { id });
          if (isFunction(window.handleInspectItem)) {
            try { window.handleInspectItem(id); } catch (err) { safeWarn('handleInspectItem failed', err); }
          } else {
            const item = (window.DATA.scavenger || []).find(x => x.id === id);
            if (item) {
              const html = `<h3>${item.title || item.name}</h3><p>${item.description || ''}</p>`;
              showModal('Inspect Item', html);
            }
          }
        });
      });
    } catch (e) {
      safeWarn('renderShopPanel failed', e);
    }
  }

  async function walletConnect() {
    if (isFunction(window.walletConnectFlow)) {
      try { return await window.walletConnectFlow(); } catch (e) { safeWarn('external walletConnectFlow failed', e); }
    }
    // Safe stub: simulate connection
    safeLog('walletConnect stub: simulated connect');
    return { connected: true, address: '0xDEMOADDRESS' };
  }

  async function mintItem(nftPayload) {
    if (isFunction(window.handleMint)) {
      try { return await window.handleMint(nftPayload); } catch (e) { safeWarn('external handleMint failed', e); }
    }
    // Default: convert payload to game item and add to mintables
    try {
      const item = nftToGameItem(nftPayload);
      window.DATA.mintables = window.DATA.mintables || [];
      window.DATA.mintables.push(item);
      saveState();
      EventBus.emit('mint:complete', { item });
      return item;
    } catch (e) { safeWarn('mintItem failed', e); return null; }
  }

  function renderMintablesPanel(containerSelector) {
    try {
      const container = document.querySelector(containerSelector || '#mintablesPanel');
      if (!container) return;
      container.innerHTML = '';
      const items = Array.isArray(window.DATA.mintables) ? window.DATA.mintables : [];
      if (!items.length) {
        container.innerHTML = '<div class="empty">No mintables available.</div>';
        return;
      }
      const list = document.createElement('div');
      list.className = 'mint-list';
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'mint-card';
        card.innerHTML = `
          <div class="mint-thumb"><img src="${item.image || '/assets/placeholder.png'}" alt="${item.name || ''}" /></div>
          <div class="mint-body">
            <div class="mint-title">${item.name || 'Unnamed NFT'}</div>
            <div class="mint-desc">${(item.description || '').slice(0,120)}</div>
            <div class="mint-meta">Lvl ${item.level || 1} • ${item.rarity || 'common'} • Power ${item.power || 0}</div>
            <div class="mint-actions">
              <button class="btn equip" data-id="${item.id}">Equip</button>
              <button class="btn use" data-id="${item.id}">Use</button>
            </div>
          </div>
        `;
        list.appendChild(card);
      });
      container.appendChild(list);

      container.querySelectorAll('.equip').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          safeLog('Equip clicked', id);
          EventBus.emit('mint:equip', { id });
          if (isFunction(window.handleEquipItem)) {
            try { window.handleEquipItem(id); } catch (err) { safeWarn('handleEquipItem failed', err); }
          } else {
            try { showModal('Equip', `<p>Equip not implemented for ${id}</p>`); } catch (e) {}
          }
        });
      });

      container.querySelectorAll('.use').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          safeLog('Use clicked', id);
          EventBus.emit('mint:use', { id });
          if (isFunction(window.handleUseMintable)) {
            try { window.handleUseMintable(id); } catch (err) { safeWarn('handleUseMintable failed', err); }
          } else {
            addItemXp(id, CONFIG.mintXpPerAction || 10);
            saveState();
            try { showModal('Use', `<p>Used item: XP awarded to ${id}</p>`); } catch (e) {}
          }
        });
      });
    } catch (e) {
      safeWarn('renderMintablesPanel failed', e);
    }
  }

  /* ============================================================================
     Quest rendering and UI helpers
     ============================================================================ */
  function renderQuestPanel(q) {
    try {
      const container = document.querySelector('#questPanel') || document.querySelector('#quests');
      if (!container) return;
      // If q provided, render single quest; otherwise render active quests
      const quests = q ? [q] : (Array.isArray(window.DATA.quests) ? window.DATA.quests.filter(x => x) : []);
      container.innerHTML = '';
      if (!quests.length) {
        container.innerHTML = '<div class="empty">No quests available.</div>';
        return;
      }
      quests.forEach(quest => {
        const el = document.createElement('div');
        el.className = 'quest-card' + (quest.started ? ' started' : '');
        el.innerHTML = `
          <div class="quest-title">${quest.name || quest.id || 'Quest'}</div>
          <div class="quest-desc">${(quest.description || '').slice(0,200)}</div>
          <div class="quest-meta">Radius: ${quest.radius || 50}m • Active: ${quest.active ? 'yes' : 'no'}</div>
          <div class="quest-actions">
            ${quest.started ? '<button class="btn complete" data-id="'+(quest.id||'')+'">Complete</button>' : '<button class="btn start" data-id="'+(quest.id||'')+'">Start</button>'}
            <button class="btn nav" data-id="${quest.id||''}">Navigate</button>
          </div>
        `;
        container.appendChild(el);
      });

      // Attach handlers
      container.querySelectorAll('.start').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          const quest = (window.DATA.quests || []).find(x => x.id === id);
          if (quest) startQuest(quest);
        });
      });
      container.querySelectorAll('.complete').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          const quest = (window.DATA.quests || []).find(x => x.id === id);
          if (quest) {
            quest.completed = true;
            saveState();
            try { showModal('Quest', `<p>Quest completed: ${quest.name || quest.id}</p>`); } catch (e) {}
            EventBus.emit('quest:completed', { quest });
          }
        });
      });
      container.querySelectorAll('.nav').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          const quest = (window.DATA.quests || []).find(x => x.id === id);
          if (quest && quest.triggerPoi && map && map.setView) {
            map.setView([quest.triggerPoi.lat, quest.triggerPoi.lng], Math.max(12, map.getZoom()));
          }
        });
      });
    } catch (e) {
      safeWarn('renderQuestPanel failed', e);
    }
  }

  /* ============================================================================
     Modal helper (very small)
     ============================================================================ */
  function showModal(title, html) {
    try {
      let modal = document.getElementById('pipboy-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pipboy-modal';
        modal.className = 'pipboy-modal';
        modal.innerHTML = `<div class="modal-inner"><button class="modal-close">×</button><div class="modal-body"></div></div>`;
        document.body.appendChild(modal);
        modal.querySelector('.modal-close').addEventListener('click', () => { modal.style.display = 'none'; });
      }
      modal.querySelector('.modal-body').innerHTML = `<h2>${title}</h2>${html}`;
      modal.style.display = 'block';
    } catch (e) { safeWarn('showModal failed', e); }
  }

  /* ============================================================================
     Analytics and telemetry stubs
     ============================================================================ */
  function analyticsTrack(eventName, payload) {
    try {
      if (isFunction(window.analyticsTrackEvent)) {
        try { window.analyticsTrackEvent(eventName, payload); return; } catch (e) { safeWarn('analyticsTrackEvent failed', e); }
      }
      safeLog('ANALYTICS', eventName, payload);
    } catch (e) {}
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
     Boot / activation handler (mobile-friendly)
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
      // If boot text still typing, fast-forward first
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
      } catch (e) { /* ignore */ }
    }

    addListeners();
  }

  /* ============================================================================
     UI integration and safe init
     ============================================================================ */
  function initUiSafe() {
    if (typeof window.initUi === 'function') {
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

    // ADDED: Center and Mojave button handlers
    const centerBtn = document.getElementById('centerBtn');
    if (centerBtn) {
      centerBtn.addEventListener('click', () => {
        if (map) {
          if (_lastPlayerPosition) {
            map.setView([_lastPlayerPosition.lat, _lastPlayerPosition.lng], 15);
          } else {
            map.setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
          }
        }
      });
    }

    const recenterMojave = document.getElementById('recenterMojave');
    if (recenterMojave) {
      recenterMojave.addEventListener('click', () => {
        if (map) {
          map.setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
        }
      });
    }

    // ADDED: Map mode button cycling
    const mapModeBtn = document.getElementById('mapModeBtn');
    if (mapModeBtn) {
      mapModeBtn.addEventListener('click', () => {
        const styles = ['toner', 'terrain', 'satellite', 'osm'];
        let currentIdx = 0;
        if (currentMapLayer === tonerLayer) currentIdx = 0;
        else if (currentMapLayer === terrainLayer) currentIdx = 1;
        else if (currentMapLayer === satelliteLayer) currentIdx = 2;
        else if (currentMapLayer === osmLayer) currentIdx = 3;
        const nextIdx = (currentIdx + 1) % styles.length;
        switchMapStyle(styles[nextIdx]);
      });
    }

    // Render lists if present
    if (document.querySelector('#scavengerList')) renderScavengerList('#scavengerList');
    if (document.querySelector('#mintablesList')) renderMintablesPanel('#mintablesPanel');
    if (document.querySelector('#inventoryList')) renderInventory('#inventoryList');
  }

  /* ============================================================================
     Render helpers for scavenger/inventory (simple)
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
            showModal('Buy', `<p>Buy flow not implemented for ${id}</p>`);
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
            const item = (window.DATA.scavenger || []).find(x => x.id === id);
            if (item) {
              const html = `<h3>${item.title || item.name}</h3><p>${item.description || ''}</p>`;
              showModal('Inspect Item', html);
            }
          }
        });
      });
    } catch (e) {
      safeWarn('renderScavengerList failed', e);
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
      try { if (isFunction(window.setStatus)) setStatus && setStatus('Pip-Boy online. Request GPS to begin tracking.', 'status-good'); } catch (e) { safeLog('status update skipped'); }

      _gameInitialized = true;
      safeLog('initGame completed');
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

  /* ============================================================================
     Expose integration functions for other modules
     ============================================================================ */
  window.initMap = initMap;
  window.switchMapStyle = switchMapStyle;
  window.nftToGameItem = nftToGameItem;
  window.addItemXp = addItemXp;
  window.checkQuestTriggers = checkQuestTriggers;
  window.initGame = initGame;
  window.renderShopPanel = renderShopPanel;
  window.renderMintablesPanel = renderMintablesPanel;
  window.renderQuestPanel = renderQuestPanel;
  window.walletConnect = walletConnect;
  window.mintItem = mintItem;
  window.saveState = saveState;
  window.loadState = loadState;
  window.showModal = showModal;
  window.analyticsTrack = analyticsTrack;
  window.quickSmokeTests = function () {
    safeLog('Smoke: DATA summary', {
      scav: (window.DATA.scavenger || []).length,
      mint: (window.DATA.mintables || []).length,
      quests: (window.DATA.quests || []).length,
      locs: (window.DATA.locations || []).length
    });
  };

  // Auto-run init if pipboyReady already fired earlier in the page lifecycle
  try {
    if (window._pipboyReadyFired) initGame();
  } catch (e) { /* ignore */ }

  // End of IIFE
}());