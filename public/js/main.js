// public/js/main.js
// ATOMIC-FIZZ-CAPS • VAULT-77 WASTELAND GPS
// Consolidated, defensive, drop-in main script
// - Single-file consolidation of previous parts
// - Robust data loading with graceful fallbacks
// - Leaflet map init with multi-layer support and tile error handling
// - NFT mintables -> in-game item mapping + XP/leveling
// - Quest activation engine (active quests only)
// - UI rendering for shop, mintables, quests, inventory
// - Geolocation hooks, quest checker, persistence (localStorage)
// - Boot activation, keyboard shortcuts, debug helpers
// - Idempotent exports and safe guards for repeated loads
//
// BACKUP your existing public/js/main.js before replacing.
//
// NOTE: This file is intentionally defensive and verbose to be robust across environments.

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
     Module-scoped globals and config
     ============================================================================ */
  // Map and UI globals
  let map = window.map || null;
  let mapEl = document.getElementById('map') || null;
  let currentMapLayer = null;
  let terrainLayer = null;
  let tonerLayer = null;
  let satelliteLayer = null;
  let osmLayer = null;

  // App state
  let _gameInitializing = false;
  let _gameInitialized = false;
  let _bootActivated = false;
  let _lastPlayerPosition = null;
  let _questCheckInterval = null;
  let _geoWatchId = null;

  // Config
  const CFG = {
    defaultCenter: [39.5, -119.8],
    defaultZoom: 6,
    questCheckMs: 5000,
    mintXpPerAction: 10,
    minMapHeight: 320,
    persistKey: 'atomicfizz_pipboy_v1'
  };

  /* ============================================================================
     Small helpers
     ============================================================================ */
  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }
  function safeError(...args) { try { console.error(...args); } catch (e) {} }
  function $ (sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
  function isFunction(fn) { return typeof fn === 'function'; }
  function nowIso() { return (new Date()).toISOString(); }
  function noop() {}

  /* ============================================================================
     CSS safety injection
     ============================================================================ */
  (function ensureCssSafety() {
    try {
      const styleId = 'pipboy-mainjs-safety';
      if (document.getElementById(styleId)) return;
      const css = `
        .map-container, #map { z-index: 20 !important; pointer-events: auto !important; min-height: ${CFG.minMapHeight}px !important; }
        .static-noise, .top-overlay, .overseer-link, .pipboy-screen, .hud { pointer-events: none !important; z-index: 5 !important; }
        .leaflet-tile-pane img.leaflet-tile { visibility: visible !important; opacity: 1 !important; image-rendering: auto !important; }
        .btn { min-width: 44px; min-height: 44px; touch-action: manipulation; }
        .pipboy-modal { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); background: #071018; color: #fff; padding: 12px; border: 1px solid #234; z-index: 99999; display: none; max-width: 90%; max-height: 80%; overflow: auto; }
        .pipboy-modal .modal-close { position: absolute; right: 8px; top: 8px; background: transparent; border: none; color: #fff; font-size: 18px; cursor: pointer; }
      `;
      const s = document.createElement('style');
      s.id = styleId;
      s.appendChild(document.createTextNode(css));
      document.head && document.head.appendChild(s);
    } catch (e) {}
  }());

  /* ============================================================================
     Persistence helpers (localStorage)
     ============================================================================ */
  function saveState() {
    try {
      const snapshot = {
        DATA: window.DATA,
        ts: Date.now()
      };
      localStorage.setItem(CFG.persistKey, JSON.stringify(snapshot));
      safeLog('Saved state to localStorage');
    } catch (e) { safeWarn('saveState failed', e); }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(CFG.persistKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.DATA) {
        // Merge shallowly to avoid wiping references
        window.DATA = Object.assign(window.DATA || {}, parsed.DATA);
        safeLog('Loaded state from localStorage');
        return parsed;
      }
    } catch (e) { safeWarn('loadState failed', e); }
    return null;
  }

  // Auto-load on script run (non-blocking)
  try { loadState(); } catch (e) {}

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
        return null;
      }
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const text = await res.text();
      if (!contentType.includes('application/json')) {
        safeWarn(`${name}.json served as ${contentType}; preview:`, text.slice(0, 400));
        if (name === 'scavenger') window.DATA.scavenger = [];
        return null;
      }
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        safeWarn(`${name}.json parse error:`, e);
        if (name === 'scavenger') window.DATA.scavenger = [];
        return null;
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
      return json;
    } catch (e) {
      safeError(`Failed to load ${name}.json`, e);
      if (name === 'scavenger') window.DATA.scavenger = [];
      return null;
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
    }, CFG.questCheckMs);
  }

  function stopQuestChecker() {
    if (_questCheckInterval) { clearInterval(_questCheckInterval); _questCheckInterval = null; }
  }

  /* ============================================================================
     Leaflet tile layers and map initialization
     ============================================================================ */
  function createTileLayers() {
    try {
      terrainLayer = L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', {
        maxZoom: 18,
        attribution: 'Stamen Terrain'
      });
    } catch (e) { safeWarn('terrainLayer creation failed', e); terrainLayer = null; }

    try {
      tonerLayer = L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: 'Stamen Toner'
      });
    } catch (e) { safeWarn('tonerLayer creation failed', e); tonerLayer = null; }

    try {
      satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: 'ESRI Satellite'
      });
    } catch (e) { safeWarn('satelliteLayer creation failed', e); satelliteLayer = null; }

    try {
      osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'OSM'
      });
    } catch (e) { safeWarn('osmLayer creation failed', e); osmLayer = null; }
  }

  function attachTileErrorHandlers(layers) {
    try {
      (layers || []).forEach(layer => {
        if (!layer || !layer.on) return;
        try {
          layer.on('tileerror', (e) => {
            try {
              const src = e && e.tile && e.tile.src ? e.tile.src : 'unknown';
              safeWarn('Tile failed to load:', src);
            } catch (err) { safeWarn('tileerror handler error', err); }
          });
        } catch (e) { /* ignore */ }
      });
    } catch (e) { safeWarn('attachTileErrorHandlers failed', e); }
  }

  function safeInitMap() {
    try {
      if (map && window.L && map instanceof L.Map) {
        if (currentMapLayer && !currentMapLayer._map) {
          try { currentMapLayer.addTo(map); } catch (e) { safeWarn('re-adding currentMapLayer failed', e); }
        }
        setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 200);
        return;
      }

      mapEl = document.getElementById('map');
      if (!mapEl) {
        safeWarn('safeInitMap: #map element not found');
        return;
      }

      try {
        map = L.map(mapEl, {
          center: CFG.defaultCenter,
          zoom: CFG.defaultZoom,
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

      attachTileErrorHandlers([terrainLayer, tonerLayer, satelliteLayer, osmLayer]);

      // Basic click handler for debugging
      map.on('click', (e) => { safeLog('map click', e && e.latlng); });

      // Add markers for DATA.locations if present
      try {
        if (Array.isArray(window.DATA.locations) && window.DATA.locations.length) {
          window.DATA.locations.forEach(loc => {
            try {
              if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;
              const marker = L.marker([loc.lat, loc.lng], { title: loc.title || loc.name || '' });
              const popupHtml = `<strong>${loc.title || loc.name || 'Location'}</strong><div>${(loc.description||'').slice(0,300)}</div>`;
              marker.bindPopup(popupHtml);
              marker.addTo(map);
            } catch (e) { /* ignore per-location errors */ }
          });
        }
      } catch (e) { safeWarn('initMap: adding DATA.locations markers failed', e); }

      // Ensure map sizing after layout
      setTimeout(() => { if (map && typeof map.invalidateSize === 'function') map.invalidateSize(); }, 250);
    } catch (e) { safeWarn('safeInitMap failed', e); }
  }

  function switchMapStyle(style) {
    try {
      if (!map) return;
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
     UI rendering helpers
     ============================================================================ */
  function showModal(title, html) {
    try {
      let modal = document.getElementById('pipboy-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pipboy-modal';
        modal.className = 'pipboy-modal';
        modal.innerHTML = `<button class="modal-close">×</button><div class="modal-body"></div>`;
        document.body.appendChild(modal);
        modal.querySelector('.modal-close').addEventListener('click', () => { modal.style.display = 'none'; });
      }
      modal.querySelector('.modal-body').innerHTML = `<h2>${title}</h2>${html}`;
      modal.style.display = 'block';
    } catch (e) { safeWarn('showModal failed', e); }
  }

  function renderShopPanel(containerSelector = '#shopPanel') {
    try {
      const container = document.querySelector(containerSelector);
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
          <div class="shop-thumb"><img src="${item.image || '/assets/placeholder.png'}" alt="${item.title || item.name || ''}" /></div>
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
      list.querySelectorAll('.buy').forEach(b => {
        b.addEventListener('click', (e) => {
          const id = b.getAttribute('data-id');
          safeLog('Shop buy clicked', id);
          if (isFunction(window.handleBuyScavengerItem)) {
            try { window.handleBuyScavengerItem(id); } catch (err) { safeWarn('handleBuyScavengerItem failed', err); }
          } else {
            const item = (window.DATA.scavenger||[]).find(x=>x.id===id);
            if (item) {
              window.DATA.inventory = window.DATA.inventory || [];
              window.DATA.inventory.push(Object.assign({}, item));
              saveState();
              alert('Purchased: ' + (item.title || item.name || item.id));
            } else alert('Item not found');
          }
        });
      });

      list.querySelectorAll('.inspect').forEach(b => {
        b.addEventListener('click', (e) => {
          const id = b.getAttribute('data-id');
          safeLog('Shop inspect clicked', id);
          if (isFunction(window.handleInspectItem)) {
            try { window.handleInspectItem(id); } catch (err) { safeWarn('handleInspectItem failed', err); }
          } else {
            const item = (window.DATA.scavenger||[]).find(x=>x.id===id);
            if (item) {
              const html = `<h3>${item.title || item.name}</h3><p>${item.description || ''}</p>`;
              showModal('Inspect Item', html);
            }
          }
        });
      });
    } catch (e) { safeWarn('renderShopPanel failed', e); }
  }

  function renderMintablesPanel(containerSelector = '#mintablesPanel') {
    try {
      const container = document.querySelector(containerSelector);
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

      list.querySelectorAll('.equip').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          safeLog('Equip clicked', id);
          if (isFunction(window.handleEquipItem)) {
            try { window.handleEquipItem(id); } catch (err) { safeWarn('handleEquipItem failed', err); }
          } else {
            alert('Equip not implemented');
          }
        });
      });

      list.querySelectorAll('.use').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          safeLog('Use clicked', id);
          if (isFunction(window.handleUseMintable)) {
            try { window.handleUseMintable(id); } catch (err) { safeWarn('handleUseMintable failed', err); }
          } else {
            addItemXp(id, CFG.mintXpPerAction);
            saveState();
            alert('Used item: XP awarded');
          }
        });
      });
    } catch (e) { safeWarn('renderMintablesPanel failed', e); }
  }

  function renderQuestPanel(containerSelector = '#questPanel') {
    try {
      const container = document.querySelector(containerSelector) || document.querySelector('#quests');
      if (!container) return;
      const quests = Array.isArray(window.DATA.quests) ? window.DATA.quests : [];
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

      container.querySelectorAll('.start').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          const quest = (window.DATA.quests||[]).find(x=>x.id===id);
          if (quest) startQuest(quest);
        });
      });
      container.querySelectorAll('.complete').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          const quest = (window.DATA.quests||[]).find(x=>x.id===id);
          if (quest) {
            quest.completed = true;
            saveState();
            alert('Quest completed');
            if (isFunction(window.onQuestCompleted)) {
              try { window.onQuestCompleted(quest); } catch (e) { safeWarn('onQuestCompleted failed', e); }
            }
          }
        });
      });
      container.querySelectorAll('.nav').forEach(b => {
        b.addEventListener('click', () => {
          const id = b.getAttribute('data-id');
          const quest = (window.DATA.quests||[]).find(x=>x.id===id);
          if (quest && quest.triggerPoi && map && map.setView) {
            map.setView([quest.triggerPoi.lat, quest.triggerPoi.lng], Math.max(12, map.getZoom()));
          }
        });
      });
    } catch (e) { safeWarn('renderQuestPanel failed', e); }
  }

  function renderScavengerList(containerSelector = '#scavengerList') {
    try {
      const container = document.querySelector(containerSelector);
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
            const item = (window.DATA.scavenger||[]).find(x=>x.id===id);
            if (item) showModal(item.title || item.name || 'Item', `<p>${item.description || ''}</p>`);
          }
        });
      });
    } catch (e) { safeWarn('renderScavengerList failed', e); }
  }

  function renderMintables(containerSelector = '#mintablesList') {
    try {
      const container = document.querySelector(containerSelector);
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
            addItemXp(id, CFG.mintXpPerAction);
            saveState();
            alert('Used item: XP awarded');
          }
        });
      });
    } catch (e) { safeWarn('renderMintables failed', e); }
  }

  function renderInventory(containerSelector = '#inventoryList') {
    try {
      const container = document.querySelector(containerSelector);
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
    } catch (e) { safeWarn('renderInventory failed', e); }
  }

  /* ============================================================================
     Wallet & minting scaffolding
     ============================================================================ */
  async function walletConnectFlow() {
    if (isFunction(window.walletConnectFlow)) {
      try { return await window.walletConnectFlow(); } catch (e) { safeWarn('external walletConnectFlow failed', e); }
    }
    safeLog('walletConnectFlow stub: simulated connect');
    return { connected: true, address: '0xDEMOADDRESS' };
  }

  async function mintItem(nftPayload) {
    if (isFunction(window.handleMint)) {
      try { return await window.handleMint(nftPayload); } catch (e) { safeWarn('external handleMint failed', e); }
    }
    try {
      const item = nftToGameItem(nftPayload);
      window.DATA.mintables = window.DATA.mintables || [];
      window.DATA.mintables.push(item);
      saveState();
      if (isFunction(window.onMintComplete)) {
        try { window.onMintComplete(item); } catch (e) { safeWarn('onMintComplete failed', e); }
      }
      return item;
    } catch (e) { safeWarn('mintItem failed', e); return null; }
  }

  /* ============================================================================
     Geolocation and player position
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
    if (!navigator.geolocation) return null;
    try {
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
    } catch (e) { safeWarn('startGeolocationWatch failed', e); return null; }
  }

  function stopGeolocationWatch() {
    if (_geoWatchId && navigator.geolocation) {
      try { navigator.geolocation.clearWatch(_geoWatchId); } catch (e) {}
      _geoWatchId = null;
    }
  }

  /* ============================================================================
     Boot activation (mobile-friendly)
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
     UI safe init and keyboard shortcuts
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

    // Keyboard shortcuts (Ctrl+M map, Ctrl+S shop, Ctrl+N mintables, Ctrl+Q quests, Ctrl+I inventory)
    document.addEventListener('keydown', (e) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      const key = (e.key || '').toLowerCase();
      if (key === 'm') { activateTab('mapPanel'); e.preventDefault(); }
      if (key === 's') { activateTab('shopPanel'); e.preventDefault(); }
      if (key === 'n') { activateTab('mintablesPanel'); e.preventDefault(); }
      if (key === 'q') { activateTab('questPanel'); e.preventDefault(); }
      if (key === 'i') { activateTab('inventoryPanel'); e.preventDefault(); }
    });

    function activateTab(panelId) {
      try {
        $all('.tab').forEach(t => t.classList.remove('active'));
        $all('.panel').forEach(p => p.classList.add('hidden'));
        const tab = $all('.tab').find(t => t.getAttribute('data-target') === panelId);
        if (tab) tab.classList.add('active');
        const panel = document.getElementById(panelId);
        if (panel) panel.classList.remove('hidden');
        if (panelId === 'mapPanel' && window.map && typeof map.invalidateSize === 'function') setTimeout(()=>map.invalidateSize(), 200);
      } catch (e) { safeWarn('activateTab failed', e); }
    }
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

      // Convert mintables into in-game items if needed
      if (window.DATA.mintables.length > 0 && typeof nftToGameItem === 'function') {
        window.DATA.mintables = window.DATA.mintables.map(nft => {
          try { return nftToGameItem(nft); } catch (e) { safeWarn('nftToGameItem failed for', nft && nft.id, e); return nft; }
        });
      }

      // Initialize map and UI
      try { safeInitMap(); } catch (e) { safeWarn('safeInitMap error', e); }
      try { initUiSafe(); } catch (e) { safeWarn('initUiSafe error', e); }

      // Render panels if present
      try { renderShopPanel('#shopPanel'); } catch (e) {}
      try { renderMintablesPanel('#mintablesPanel'); } catch (e) {}
      try { renderQuestPanel('#questPanel'); } catch (e) {}
      try { renderScavengerList('#scavengerList'); } catch (e) {}
      try { renderMintables('#mintablesList'); } catch (e) {}
      try { renderInventory('#inventoryList'); } catch (e) {}

      // Ensure map style and sizing
      try { switchMapStyle(window.DATA.settings && window.DATA.settings.mapStyle ? window.DATA.settings.mapStyle : 'terrain'); } catch (e) { safeWarn('switchMapStyle failed', e); }
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

  // Auto-run wiring: if pipboyReady event fires, initGame will run
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
     Debug helpers and developer utilities
     ============================================================================ */
  window.__pipboyDebug = window.__pipboyDebug || {};
  window.__pipboyDebug.forceShowTiles = function () {
    $all('.leaflet-tile-pane').forEach(p => p.style.filter = 'none');
    $all('.leaflet-tile-pane img.leaflet-tile').forEach(img => { img.style.visibility = 'visible'; img.style.opacity = '1'; });
    safeLog('Tiles forced visible');
  };
  window.__pipboyDebug.hideOverlaysForTest = function () {
    $all('.static-noise, .top-overlay, .overseer-link, .pipboy-screen, .hud').forEach(el => {
      el.dataset._oldDisplay = el.style.display || '';
      el.style.display = 'none';
    });
    setTimeout(() => { if (map && map.invalidateSize) map.invalidateSize(); }, 200);
    safeLog('Overlays hidden for test');
  };
  window.__pipboyDebug.restoreOverlays = function () {
    $all('[data-_old-display]').forEach(el => {
      el.style.display = el.dataset._oldDisplay || '';
      delete el.dataset._oldDisplay;
    });
    safeLog('Overlays restored');
  };
  window.__pipboyDebug.reinit = function () {
    _gameInitialized = false;
    initGame();
  };
  window.__pipboyDebug.showDataSummary = function () {
    safeLog('DATA summary:', {
      scavenger: (window.DATA.scavenger || []).length,
      mintables: (window.DATA.mintables || []).length,
      quests: (window.DATA.quests || []).length,
      locations: (window.DATA.locations || []).length
    });
  };
  window.__pipboyDebug.simulatePlayerAt = function (lat, lng) {
    onPlayerPosition(lat, lng, 10);
    safeLog('Simulated player at', lat, lng);
  };

  /* ============================================================================
     Minimal offline hints and service worker registration (non-invasive)
     ============================================================================ */
  function registerServiceWorker() {
    try {
      if (!('serviceWorker' in navigator)) { safeLog('Service worker not supported'); return; }
      if (location.protocol === 'http:' && location.hostname !== 'localhost') {
        safeLog('Skipping service worker registration on insecure origin');
        return;
      }
      navigator.serviceWorker.register('/sw.js').then(reg => {
        safeLog('Service worker registered', reg.scope);
      }).catch(err => {
        safeWarn('Service worker registration failed', err);
      });
    } catch (e) { safeWarn('registerServiceWorker failed', e); }
  }

  /* ============================================================================
     Exports (stable single assignments)
     ============================================================================ */
  // Only assign if not already assigned to avoid clobbering other modules
  if (!window.initGame) window.initGame = initGame;
  if (!window.initMap) window.initMap = safeInitMap;
  if (!window.switchMapStyle) window.switchMapStyle = switchMapStyle;
  if (!window.nftToGameItem) window.nftToGameItem = nftToGameItem;
  if (!window.addItemXp) window.addItemXp = addItemXp;
  if (!window.checkQuestTriggers) window.checkQuestTriggers = checkQuestTriggers;
  if (!window.saveState) window.saveState = saveState;
  if (!window.loadState) window.loadState = loadState;
  if (!window.renderShopPanel) window.renderShopPanel = renderShopPanel;
  if (!window.renderMintablesPanel) window.renderMintablesPanel = renderMintablesPanel;
  if (!window.renderQuestPanel) window.renderQuestPanel = renderQuestPanel;
  if (!window.renderScavengerList) window.renderScavengerList = renderScavengerList;
  if (!window.renderMintables) window.renderMintables = renderMintables;
  if (!window.renderInventory) window.renderInventory = renderInventory;
  if (!window.walletConnectFlow) window.walletConnectFlow = walletConnectFlow;
  if (!window.mintItem) window.mintItem = mintItem;
  if (!window.onPlayerPosition) window.onPlayerPosition = onPlayerPosition;
  if (!window.startGeolocationWatch) window.startGeolocationWatch = startGeolocationWatch;
  if (!window.stopGeolocationWatch) window.stopGeolocationWatch = stopGeolocationWatch;

  /* ============================================================================
     Final log
     ============================================================================ */
  safeLog('Pip-Boy main.js consolidated and loaded');

  // End of IIFE
}());
