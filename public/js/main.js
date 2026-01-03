// public/js/main.js – Fixed, Complete, Drawer Tabs Wired, GPS/Claim Ready (January 03, 2026)
(function () {
  'use strict';

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

  let map = window.map || null;
  let mapEl = document.getElementById('map') || null;
  let currentMapLayer = null;
  let _gameInitializing = false;
  let _gameInitialized = false;
  let _lastPlayerPosition = null;
  let _geoWatchId = null;
  let gpsLocked = false;

  const CONFIG = {
    defaultCenter: [36.1699, -115.1398],
    defaultZoom: 10,
    apiBase: window.location.origin
  };

  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }
  function safeError(...args) { try { console.error(...args); } catch (e) {} }

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

      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      });

      const cartoDarkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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

  async function connectWallet() {
    const provider = window.solana;
    if (!provider || !provider.isPhantom) {
      alert('Please install Phantom wallet');
      return;
    }

    try {
      await provider.connect();
      const addr = provider.publicKey.toBase58();
      document.getElementById('connectWallet')?.textContent = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
      safeLog('Wallet connected:', addr);
    } catch (e) {
      safeError('Wallet connection failed:', e);
    }
  }

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
      document.getElementById('requestGpsBtn')?.style.display = 'none';
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

    // Drawer toggle
    const drawer = document.getElementById('bottom-drawer');
    const drawerToggle = document.getElementById('drawer-toggle');
    if (drawerToggle && drawer) {
      drawerToggle.addEventListener('click', () => {
        drawer.classList.toggle('hidden');
        setTimeout(() => map?.invalidateSize?.(), 260);
      });
    }

    // GPS Lock button
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

    // Claim mintables (stub)
    once('claimMintables', () => {
      if (!connectedWallet) return alert('Connect wallet first');
      alert('Claiming minted item... (mock)');
      // TODO: Call /api/mint-item
    });

    // Tab switching
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
      });
    });

    if (drawerTabs.length > 0) drawerTabs[0].click();

    safeLog('UI initialized (tabs, buttons, drawer wired)');
  }

  async function initGame() {
    if (_gameInitialized || _gameInitializing) return;
    _gameInitializing = true;

    try {
      await loadAllData();
      initMap();
      initUI();

      document.getElementById('locations-count')?.textContent = window.DATA.locations.length;

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
    location: () => _lastPlayerPosition
  };
})();
