// public/js/main.js – Fixed, Complete, and Drawer Tabs Fully Wired (January 03, 2026)
(function () {
  'use strict';

  // Top-level safe defaults
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

  /* Module-scoped globals */
  let map = window.map || null;
  let mapEl = document.getElementById('map') || null;
  let currentMapLayer = null;
  let _gameInitializing = false;
  let _gameInitialized = false;
  let _lastPlayerPosition = null;
  let _geoWatchId = null;

  const CONFIG = {
    defaultCenter: [36.1699, -115.1398],
    defaultZoom: 10,
    apiBase: window.location.origin
  };

  /* Logging helpers */
  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }
  function safeError(...args) { try { console.error(...args); } catch (e) {} }

  /* Data loader - uses server endpoints first, falls back to local JSON */
  async function loadJson(name) {
    try {
      // Try server endpoint first
      const res = await fetch(`${CONFIG.apiBase}/${name}`);
      if (res.ok) return await res.json();
    } catch (e) {
      safeWarn(`Server fetch failed for /${name}:`, e.message);
    }

    // Fallback to local file
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

    // Ensure sane defaults
    window.DATA.locations = Array.isArray(window.DATA.locations) ? window.DATA.locations : [];
    window.DATA.quests = Array.isArray(window.DATA.quests) ? window.DATA.quests : [];
    window.DATA.mintables = Array.isArray(window.DATA.mintables) ? window.DATA.mintables : [];
    window.DATA.scavenger = Array.isArray(window.DATA.scavenger) ? window.DATA.scavenger : [];
    window.DATA.settings = window.DATA.settings || {};
  }

  /* Map initialization - with guard against duplicate init */
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

    // Guard: prevent reinitialization
    if (mapEl._leaflet_id) {
      safeLog('Map already initialized - skipping creation, only invalidate size');
      if (map && map.invalidateSize) {
        setTimeout(() => map.invalidateSize(), 200);
      }
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

      // OSM layer
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      });

      // Carto Dark layer (fallback)
      const cartoDarkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '© OpenStreetMap © Carto'
      });

      currentMapLayer = cartoDarkLayer || osmLayer;
      if (currentMapLayer) currentMapLayer.addTo(map);

      // Add location markers (if data exists)
      if (Array.isArray(window.DATA.locations)) {
        window.DATA.locations.forEach(loc => {
          if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
            const marker = L.marker([loc.lat, loc.lng]);
            if (loc.n || loc.name) {
              marker.bindPopup(`<strong>${loc.n || loc.name}</strong><br>Level: ${loc.lvl || 1}`);
            }
            marker.addTo(map);
          }
        });
      }

      setTimeout(() => {
        if (map && map.invalidateSize) map.invalidateSize();
      }, 300);

      safeLog('Map initialized successfully');
    } catch (e) {
      safeError('Map initialization failed:', e);
    }
  }

  /* Geolocation */
  function startGeolocationWatch() {
    if (!navigator.geolocation) {
      safeWarn('Geolocation not supported');
      return;
    }

    _geoWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;

        _lastPlayerPosition = { lat, lng, accuracy: acc };

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
      (err) => safeWarn('Geolocation error:', err),
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  }

  /* Wallet connection */
  async function connectWallet() {
    const provider = window.solana;
    if (!provider || !provider.isPhantom) {
      alert('Please install Phantom wallet from phantom.app');
      return;
    }

    try {
      await provider.connect();
      const addr = provider.publicKey.toBase58();

      const btn = document.getElementById('connectWallet');
      if (btn) {
        btn.textContent = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
      }

      safeLog('Wallet connected:', addr);
    } catch (e) {
      safeError('Wallet connection failed:', e);
    }
  }

  /* UI Initialization - Cleaned up, no duplicates */
  function initUI() {
    // Prevent multiple bindings
    const bound = new Set();

    function once(id, fn) {
      if (bound.has(id)) return;
      bound.add(id);
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    }

    // Wallet
    once('connectWallet', connectWallet);

    // GPS request
    once('requestGpsBtn', () => {
      startGeolocationWatch();
      const btn = document.getElementById('requestGpsBtn');
      if (btn) btn.style.display = 'none';
    });

    // Center buttons
    once('centerBtn', () => {
      if (map && _lastPlayerPosition) {
        map.setView([_lastPlayerPosition.lat, _lastPlayerPosition.lng], 15);
      }
    });

    once('recenterMojave', () => {
      if (map) map.setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
    });

    // Map mode toggle
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

    // Drawer outer toggle
    const drawer = document.getElementById('bottom-drawer');
    const drawerToggle = document.getElementById('drawer-toggle');
    if (drawer && drawerToggle && !bound.has('drawer-toggle')) {
      bound.add('drawer-toggle');
      drawerToggle.addEventListener('click', () => {
        drawer.classList.toggle('hidden');
        setTimeout(() => map?.invalidateSize?.(), 260);
      });
    }

    // Tutorial modal
    const tutorialModal = document.getElementById('tutorialModal');
    once('tutorialClose', () => {
      if (tutorialModal) {
        tutorialModal.classList.add('hidden');
        tutorialModal.style.display = 'none';
      }
    });
    once('openTutorial', () => {
      if (tutorialModal) {
        tutorialModal.classList.remove('hidden');
        tutorialModal.style.display = 'flex';
      }
    });

    // Inner drawer tabs switching
    const drawerTabs = document.querySelectorAll('.drawer-tabs button');
    drawerTabs.forEach(tab => {
      const tabId = `tab-${tab.dataset.tab}`;
      if (bound.has(tabId)) return;
      bound.add(tabId);

      tab.addEventListener('click', () => {
        drawerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.drawer-panels .panel').forEach(p => {
          p.classList.remove('active');
          p.style.display = 'none';
        });

        const panelId = `panel-${tab.dataset.tab}`;
        const target = document.getElementById(panelId);
        if (target) {
          target.classList.add('active');
          target.style.display = 'block';
        }

        safeLog(`Drawer tab switched to: ${tab.dataset.tab}`);
        if (tab.dataset.tab === 'map' && map) {
          setTimeout(() => map.invalidateSize(), 200);
        }
      });
    });

    // Activate first tab by default
    if (drawerTabs.length > 0 && !bound.has('default-tab')) {
      bound.add('default-tab');
      drawerTabs[0].click();
    }

    safeLog('UI initialized (drawer tabs wired, no duplicates)');
  }

  /* Main game initialization */
  async function initGame() {
    if (_gameInitialized || _gameInitializing) return;
    _gameInitializing = true;

    try {
      await loadAllData();
      initMap();
      initUI();

      const locCount = document.getElementById('locations-count');
      if (locCount) {
        locCount.textContent = window.DATA.locations.length;
      }

      _gameInitialized = true;
      safeLog('Game initialized successfully');
    } catch (e) {
      safeError('Game initialization failed:', e);
    } finally {
      _gameInitializing = false;
    }
  }

  /* Event listeners */
  window.addEventListener('pipboyReady', () => {
    safeLog('Pip-Boy ready event received');
    initGame();
  });

  window.addEventListener('map-ready', () => {
    safeLog('Map ready event received');
  });

  // Fallback init
  setTimeout(() => {
    if (!_gameInitialized && !_gameInitializing) {
      safeLog('Fallback initialization triggered');
      initGame();
    }
  }, 1500);

  /* Debugging helpers */
  window.__pipboy = {
    reinit: () => {
      _gameInitialized = false;
      initGame();
    },
    data: () => window.DATA,
    map: () => map,
    location: () => _lastPlayerPosition
  };

})();
