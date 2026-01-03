// public/js/main.js – Player State, Mint Integration, XP/CAPS, Quests, Drawer Tabs (January 03, 2026)
(function () {
  'use strict';

  // ---------------------------
  // GLOBAL DATA
  // ---------------------------
  window.DATA = window.DATA || {
    scavenger: [],
    mintables: [],
    quests: [],
    locations: [],
    collectibles: [],
    factions: [],
    inventory: [],
    settings: {},
    player: null
  };

  // ---------------------------
  // PLAYER STATE (PER-DEVICE)
  // ---------------------------
  const PLAYER_STATE_KEY = 'afc_player_state_v1';

  const PLAYER = {
    inventory: [],       // item ids
    questsActive: [],    // quest ids
    questsDone: [],      // quest ids
    visitedLocations: [],// location ids/names
    xp: 0,
    caps: 0,
    level: 1
  };

  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }
  function safeError(...args) { try { console.error(...args); } catch (e) {} }

  function loadPlayerState() {
    try {
      const raw = localStorage.getItem(PLAYER_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      if (Array.isArray(parsed.inventory)) PLAYER.inventory = parsed.inventory;
      if (Array.isArray(parsed.questsActive)) PLAYER.questsActive = parsed.questsActive;
      if (Array.isArray(parsed.questsDone)) PLAYER.questsDone = parsed.questsDone;
      if (Array.isArray(parsed.visitedLocations)) PLAYER.visitedLocations = parsed.visitedLocations;
      if (typeof parsed.xp === 'number') PLAYER.xp = parsed.xp;
      if (typeof parsed.caps === 'number') PLAYER.caps = parsed.caps;
      if (typeof parsed.level === 'number') PLAYER.level = parsed.level;

      safeLog('Player state loaded');
    } catch (e) {
      safeWarn('Failed to load player state:', e.message);
    }
  }

  function savePlayerState() {
    try {
      const payload = {
        inventory: PLAYER.inventory,
        questsActive: PLAYER.questsActive,
        questsDone: PLAYER.questsDone,
        visitedLocations: PLAYER.visitedLocations,
        xp: PLAYER.xp,
        caps: PLAYER.caps,
        level: PLAYER.level
      };
      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(payload));
    } catch (e) {
      safeWarn('Failed to save player state:', e.message);
    }
  }

  // ---------------------------
  // MAP / GAME CORE
  // ---------------------------

  let map = window.map || null;
  let mapEl = document.getElementById('map') || null;
  let currentMapLayer = null;
  let osmLayer = null;
  let cartoDarkLayer = null;

  let _gameInitializing = false;
  let _gameInitialized = false;
  let _lastPlayerPosition = null;
  let _geoWatchId = null;
  let gpsLocked = false;
  let connectedWallet = false;

  const CONFIG = {
    defaultCenter: [36.1699, -115.1398],
    defaultZoom: 10,
    apiBase: window.location.origin
  };

  async function loadJson(name) {
    try {
      const res = await fetch(`${CONFIG.apiBase}/${name}`);
      if (res.ok) return await res.json();
    } catch (e) {
      safeWarn(`Server fetch failed for /${name}:`, e.message);
    }

    try {
      const res = await fetch(`/data/${name}.json`);
      if (res.ok) return await res.json();
    } catch (e) {
      safeWarn(`Local fallback failed for ${name}.json:`, e.message);
    }

    return null;
  }

  async function loadAllData() {
    const names = ['locations', 'quests', 'mintables', 'scavenger', 'settings'];

    for (const name of names) {
      const data = await loadJson(name);
      if (data !== null) {
        window.DATA[name] = data;
        safeLog(`Loaded ${name}:`, Array.isArray(data) ? data.length : 'object');
      }
    }

    window.DATA.locations = Array.isArray(window.DATA.locations) ? window.DATA.locations : [];
    window.DATA.quests = Array.isArray(window.DATA.quests) ? window.DATA.quests : [];
    window.DATA.mintables = Array.isArray(window.DATA.mintables) ? window.DATA.mintables : [];
    window.DATA.scavenger = Array.isArray(window.DATA.scavenger) ? window.DATA.scavenger : [];
    window.DATA.settings = window.DATA.settings || {};
  }

  function initMap() {
    if (typeof L === 'undefined') {
      safeError('Leaflet not loaded');
      return;
    }

    mapEl = document.getElementById('map');
    if (!mapEl) {
      safeWarn('Map element not found');
      return;
    }

    if (mapEl._leaflet_id) {
      safeLog('Map already initialized - skipping creation, only invalidate size');
      if (map && map.invalidateSize) setTimeout(() => map.invalidateSize(), 200);
      return;
    }

    try {
      map = L.map(mapEl, {
        center: CONFIG.defaultCenter,
        zoom: CONFIG.defaultZoom,
        zoomControl: true,
        attributionControl: false
      });

      window.map = map;
      window._map = map;

      osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      });

      cartoDarkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '© OpenStreetMap © Carto'
      });

      currentMapLayer = cartoDarkLayer || osmLayer;
      if (currentMapLayer) currentMapLayer.addTo(map);

      // Add location markers
      if (Array.isArray(window.DATA.locations)) {
        window.DATA.locations.forEach(loc => {
          if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
            const marker = L.marker([loc.lat, loc.lng]);
            marker.bindPopup(`<strong>${loc.name || 'Location'}</strong>`);
            marker.addTo(map);
          }
        });
      }

      setTimeout(() => map?.invalidateSize?.(), 300);
      safeLog('Map initialized successfully');
    } catch (e) {
      safeError('Map initialization failed:', e);
    }
  }

  // ---------------------------
  // GAMEPLAY HELPERS
  // ---------------------------

  function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function resolveItemById(id) {
    const items = window.DATA.mintables || [];
    return (
      items.find(i => i && (i.id === id || i.slug === id || i.mintableId === id)) ||
      { name: id, description: '' }
    );
  }

  function givePlayerItemById(itemId) {
    if (!itemId) return;
    if (!PLAYER.inventory.includes(itemId)) {
      PLAYER.inventory.push(itemId);
      savePlayerState();
      renderInventoryPanel();
      safeLog('Player received item:', itemId);
    }
  }

  function markLocationVisited(locationIdOrName) {
    if (!locationIdOrName) return;
    if (!PLAYER.visitedLocations.includes(locationIdOrName)) {
      PLAYER.visitedLocations.push(locationIdOrName);
      savePlayerState();
    }
  }

  function activateQuest(questId) {
    if (!questId) return;
    if (PLAYER.questsDone.includes(questId) || PLAYER.questsActive.includes(questId)) return;
    PLAYER.questsActive.push(questId);
    savePlayerState();
    renderQuestsPanel();
    safeLog('Quest activated:', questId);
  }

  function addXP(amount) {
    if (!amount) return;
    PLAYER.xp += amount;
    checkLevelUp();
    savePlayerState();
    updateHUD();
  }

  function addCaps(amount) {
    if (!amount) return;
    PLAYER.caps += amount;
    savePlayerState();
    updateHUD();
  }

  function checkLevelUp() {
    const needed = PLAYER.level * 100;
    if (PLAYER.xp >= needed) {
      PLAYER.xp -= needed;
      PLAYER.level += 1;
      alert(`LEVEL UP! You are now level ${PLAYER.level}`);
    }
  }

  function completeQuest(questId) {
    if (!questId) return;
    if (!PLAYER.questsActive.includes(questId)) return;

    PLAYER.questsActive = PLAYER.questsActive.filter(id => id !== questId);
    if (!PLAYER.questsDone.includes(questId)) PLAYER.questsDone.push(questId);

    const quest = (window.DATA.quests || []).find(q => q && (q.id === questId || q.slug === questId));

    if (quest?.rewards?.items) {
      quest.rewards.items.forEach(itemId => givePlayerItemById(itemId));
    }

    if (quest?.rewards?.xp) addXP(quest.rewards.xp);
    if (quest?.rewards?.caps) addCaps(quest.rewards.caps);

    savePlayerState();
    renderQuestsPanel();
    renderInventoryPanel();
    updateHUD();
    safeLog('Quest completed:', questId);
  }

  function checkQuestTriggersAtPosition(lat, lng) {
    const quests = window.DATA.quests;
    if (!Array.isArray(quests) || !quests.length) return;

    quests.forEach(q => {
      if (!q) return;
      const qId = q.id || q.slug;
      if (!qId) return;

      if (PLAYER.questsDone.includes(qId) || PLAYER.questsActive.includes(qId)) return;

      let triggered = false;

      if (q.trigger && typeof q.trigger.lat === 'number' && typeof q.trigger.lng === 'number') {
        const radius = typeof q.trigger.radius === 'number' ? q.trigger.radius : 75;
        const d = distanceMeters(lat, lng, q.trigger.lat, q.trigger.lng);
        if (d <= radius) triggered = true;
      }

      if (!triggered && q.location) {
        const locs = window.DATA.locations || [];
        const match = locs.find(loc =>
          loc &&
          (loc.id === q.location || loc.slug === q.location || loc.name === q.location)
        );
        if (match && typeof match.lat === 'number' && typeof match.lng === 'number') {
          const d = distanceMeters(lat, lng, match.lat, match.lng);
          if (d <= (match.triggerRadius || 75)) triggered = true;
        }
      }

      if (triggered) activateQuest(qId);
    });
  }

  // ---------------------------
  // PANELS RENDERING
  // ---------------------------

  function renderInventoryPanel() {
    const panel = document.getElementById('panel-items');
    if (!panel) return;

    if (!PLAYER.inventory.length) {
      panel.innerHTML = '<h2>Inventory</h2><p>No items yet — explore the Mojave and claim some caps.</p>';
      return;
    }

    const entries = PLAYER.inventory.map(id => {
      const item = resolveItemById(id);
      const name = item.name || item.id || item.slug || id;
      const desc = item.description || '';
      return `
        <div class="pip-entry">
          <strong>${name}</strong><br>
          <span>${desc}</span>
        </div>
      `;
    }).join('');

    panel.innerHTML = `<h2>Inventory</h2>${entries}`;
  }

  function renderQuestsPanel() {
    const panel = document.getElementById('panel-quests');
    if (!panel) return;

    const quests = window.DATA.quests || [];

    const active = PLAYER.questsActive
      .map(id => quests.find(q => q && (q.id === id || q.slug === id)))
      .filter(Boolean);

    const done = PLAYER.questsDone
      .map(id => quests.find(q => q && (q.id === id || q.slug === id)))
      .filter(Boolean);

    const renderQuest = (q, extraClass) => {
      const name = q.name || q.title || q.id || q.slug || 'Quest';
      const desc = q.description || q.flavor || '';
      return `
        <div class="pip-entry ${extraClass || ''}">
          <strong>${name}</strong><br>
          <span>${desc}</span>
        </div>
      `;
    };

    const activeHtml = active.length
      ? active.map(q => renderQuest(q, 'active')).join('')
      : '<p>No active quests.</p>';

    const doneHtml = done.length
      ? done.map(q => renderQuest(q, 'done')).join('')
      : '<p>No completed quests.</p>';

    panel.innerHTML = `
      <h2>Active Quests</h2>
      ${activeHtml}
      <h2>Completed</h2>
      ${doneHtml}
    `;
  }

  function renderLocationsPanel() {
    const panel = document.getElementById('panel-map');
    if (!panel) return;

    const locs = window.DATA.locations || [];
    if (!locs.length) {
      panel.innerHTML = '<h2>Locations</h2><p>No wasteland locations loaded.</p>';
      return;
    }

    const entries = locs.map(loc => {
      const name = loc.name || loc.id || loc.slug || 'Location';
      const lat = typeof loc.lat === 'number' ? loc.lat.toFixed(5) : '?';
      const lng = typeof loc.lng === 'number' ? loc.lng.toFixed(5) : '?';
      return `
        <div class="pip-entry">
          <strong>${name}</strong><br>
          <span>${lat}, ${lng}</span>
        </div>
      `;
    }).join('');

    panel.innerHTML = `<h2>Locations</h2>${entries}`;
  }

  function updateHUD() {
    const lvlEl = document.getElementById('lvl');
    const capsEl = document.getElementById('caps');
    const xpText = document.getElementById('xpText');
    const xpFill = document.getElementById('xpFill');

    if (lvlEl) lvlEl.textContent = PLAYER.level;
    if (capsEl) capsEl.textContent = PLAYER.caps;

    const needed = PLAYER.level * 100;
    if (xpText) xpText.textContent = `${PLAYER.xp} / ${needed}`;
    if (xpFill) xpFill.style.width = `${Math.min(100, (PLAYER.xp / needed) * 100)}%`;
  }

  // ---------------------------
  // GEOLOCATION
  // ---------------------------

  function startGeolocationWatch() {
    if (!navigator.geolocation || gpsLocked) return;

    _geoWatchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        _lastPlayerPosition = { lat, lng, acc };

        const accDot = document.getElementById('accDot');
        const accText = document.getElementById('accText');
        if (accDot && accText) {
          accText.textContent = `GPS: ${Math.round(acc)}m`;
          accDot.className = acc <= 20 ? 'acc-dot acc-good' : 'acc-dot';
        }

        if (map) {
          if (!map._playerMarker) {
            map._playerMarker = L.circleMarker([lat, lng], {
              radius: 8,
              color: '#00ff66',
              fillColor: '#00ff66',
              fillOpacity: 0.8
            }).addTo(map);
          } else {
            map._playerMarker.setLatLng([lat, lng]);
          }
        }

        const locs = window.DATA.locations || [];
        locs.forEach(loc => {
          if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return;
          const d = distanceMeters(lat, lng, loc.lat, loc.lng);
          const idOrName = loc.id || loc.slug || loc.name;
          if (d <= (loc.triggerRadius || 50) && idOrName) {
            markLocationVisited(idOrName);
          }
        });

        checkQuestTriggersAtPosition(lat, lng);
      },
      err => safeWarn('Geolocation error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  function stopGeolocationWatch() {
    if (_geoWatchId !== null) {
      navigator.geolocation.clearWatch(_geoWatchId);
      _geoWatchId = null;
      gpsLocked = false;
      safeLog('GPS watch stopped');
    }
  }

  // ---------------------------
  // WALLET + MINT
  // ---------------------------

  async function connectWallet() {
    const provider = window.solana;
    if (!provider || !provider.isPhantom) {
      alert('Please install Phantom wallet');
      return;
    }

    try {
      await provider.connect();
      const addr = provider.publicKey.toBase58();
      const btn = document.getElementById('connectWallet');
      if (btn) btn.textContent = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
      connectedWallet = true;
      safeLog('Wallet connected:', addr);
    } catch (e) {
      safeError('Wallet connection failed:', e);
    }
  }

  async function claimMintableFromServer() {
    try {
      const res = await fetch('/api/mint-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();
      if (!data.success) {
        alert('Mint failed: ' + (data.error || 'Unknown error'));
        return;
      }

      const itemId = data.itemId;
      if (itemId) {
        givePlayerItemById(itemId);
        addCaps(5);   // example reward
        addXP(10);    // example reward
      }

      alert(`Minted: ${itemId}`);
    } catch (e) {
      safeError('Mint error:', e);
      alert('Mint failed');
    }
  }

  // ---------------------------
  // UI INIT
  // ---------------------------

  function initUI() {
    const bound = new Set();

    function once(id, fn) {
      if (bound.has(id)) return;
      bound.add(id);
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }

    once('connectWallet', connectWallet);

    once('requestGpsBtn', () => {
      startGeolocationWatch();
      const btn = document.getElementById('requestGpsBtn');
      if (btn) btn.style.display = 'none';
    });

    once('centerBtn', () => {
      if (map && _lastPlayerPosition) map.setView([_lastPlayerPosition.lat, _lastPlayerPosition.lng], 15);
    });

    once('recenterMojave', () => map?.setView(CONFIG.defaultCenter, CONFIG.defaultZoom));

    once('mapModeBtn', () => {
      if (!map) return;
      try {
        if (currentMapLayer) map.removeLayer(currentMapLayer);
        currentMapLayer = currentMapLayer === cartoDarkLayer ? osmLayer : cartoDarkLayer;
        if (currentMapLayer) currentMapLayer.addTo(map);
        setTimeout(() => map?.invalidateSize?.(), 150);
      } catch (e) {
        safeWarn('Map mode switch failed:', e);
      }
    });

    const drawer = document.getElementById('bottom-drawer');
    const drawerToggle = document.getElementById('drawer-toggle');
    if (drawerToggle && drawer) {
      drawerToggle.addEventListener('click', () => {
        drawer.classList.toggle('hidden');
        setTimeout(() => map?.invalidateSize?.(), 260);
      });
    }

    once('gps-lock-btn', () => {
      if (gpsLocked) {
        stopGeolocationWatch();
        alert('GPS unlocked');
      } else {
        startGeolocationWatch();
        gpsLocked = true;
        alert('GPS locked');
      }
    });

    once('claimMintables', () => {
      if (!connectedWallet) {
        alert('Connect wallet first');
        return;
      }
      claimMintableFromServer();
    });

    const drawerTabs = document.querySelectorAll('.tabs .tab');
    drawerTabs.forEach(tab => {
      const tabId = tab.dataset.panel;
      if (bound.has(tabId)) return;
      bound.add(tabId);

      tab.addEventListener('click', () => {
        drawerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.drawer-panels .panel').forEach(p => {
          p.classList.remove('active');
          p.style.display = 'none';
        });

        const panel = document.getElementById(`panel-${tabId}`);
        if (panel) {
          panel.classList.add('active');
          panel.style.display = 'block';
        }

        if (tabId === 'map' && map) setTimeout(() => map.invalidateSize(), 200);

        if (tabId === 'items') renderInventoryPanel();
        if (tabId === 'quests') renderQuestsPanel();
        if (tabId === 'map') renderLocationsPanel();
      });
    });

    if (drawerTabs.length > 0) drawerTabs[0].click();

    safeLog('UI initialized (tabs, buttons, drawer wired)');
  }

  // ---------------------------
  // GAME INIT
  // ---------------------------

  async function initGame() {
    if (_gameInitialized || _gameInitializing) return;
    _gameInitializing = true;

    try {
      loadPlayerState();
      await loadAllData();
      initMap();
      initUI();

      const locCountEl = document.getElementById('locations-count');
      if (locCountEl) locCountEl.textContent = window.DATA.locations.length;

      renderInventoryPanel();
      renderQuestsPanel();
      renderLocationsPanel();
      updateHUD();

      _gameInitialized = true;
      safeLog('Game initialized successfully');
    } catch (e) {
      safeError('Game initialization failed:', e);
    } finally {
      _gameInitializing = false;
    }
  }

  window.addEventListener('pipboyReady', () => {
    safeLog('Pip-Boy ready');
    initGame();
  });

  window.addEventListener('map-ready', () => safeLog('Map ready'));

  setTimeout(() => {
    if (!_gameInitialized && !_gameInitializing) {
      safeLog('Fallback init');
      initGame();
    }
  }, 1500);

  window.__pipboy = {
    reinit: () => { _gameInitialized = false; initGame(); },
    data: () => window.DATA,
    map: () => map,
    location: () => _lastPlayerPosition,
    player: () => PLAYER
  };
})();
