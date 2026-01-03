// public/js/main.js - Fixed and Complete
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
  let osmLayer = null;
  let cartoDarkLayer = null;

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

  /* Data loader */
  async function loadJson(url) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      safeWarn(`Failed to load ${url}:`, e.message);
      return null;
    }
  }

  async function loadAllData() {
    const files = ['locations', 'quests', 'mintables', 'scavenger', 'settings'];
    
    for (const name of files) {
      try {
        // Try API endpoint first
        let data = await loadJson(`${CONFIG.apiBase}/${name}`);
        
        // Fallback to /data/ directory
        if (!data) {
          data = await loadJson(`/data/${name}.json`);
        }
        
        if (data) {
          window.DATA[name] = data;
          safeLog(`Loaded ${name}:`, Array.isArray(data) ? data.length : 'object');
        }
      } catch (e) {
        safeWarn(`Failed to load ${name}:`, e);
      }
    }
    
    // Ensure arrays
    window.DATA.locations = Array.isArray(window.DATA.locations) ? window.DATA.locations : [];
    window.DATA.quests = Array.isArray(window.DATA.quests) ? window.DATA.quests : [];
    window.DATA.mintables = Array.isArray(window.DATA.mintables) ? window.DATA.mintables : [];
    window.DATA.scavenger = Array.isArray(window.DATA.scavenger) ? window.DATA.scavenger : [];
  }

  /* Map initialization */
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

    // Reuse existing map
    if (map && map instanceof L.Map) {
      setTimeout(() => {
        if (map.invalidateSize) map.invalidateSize();
      }, 200);
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
      osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      });

      // Carto Dark layer
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

        // Update GPS badge
        const accDot = document.getElementById('accDot');
        const accText = document.getElementById('accText');
        if (accDot && accText) {
          accText.textContent = `GPS: ${Math.round(acc)}m`;
          accDot.className = acc <= 20 ? 'acc-dot acc-good' : 'acc-dot';
        }

        // Update player marker
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
      (err) => {
        safeWarn('Geolocation error:', err);
      },
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

  /* UI Initialization */
  function initUI() {
    // Connect wallet button
    const walletBtn = document.getElementById('connectWallet');
    if (walletBtn) {
      walletBtn.addEventListener('click', connectWallet);
    }

    // Request GPS button
    const gpsBtn = document.getElementById('requestGpsBtn');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => {
        startGeolocationWatch();
        gpsBtn.style.display = 'none';
      });
    }

    // Center map button
    const centerBtn = document.getElementById('centerBtn');
    if (centerBtn) {
      centerBtn.addEventListener('click', () => {
        if (map && _lastPlayerPosition) {
          map.setView([_lastPlayerPosition.lat, _lastPlayerPosition.lng], 15);
        }
      });
    }

    // Recenter Mojave button
    const mojaveBtn = document.getElementById('recenterMojave');
    if (mojaveBtn) {
      mojaveBtn.addEventListener('click', () => {
        if (map) {
          map.setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
        }
      });
    }

    // Map mode button
    const mapModeBtn = document.getElementById('mapModeBtn');
    if (mapModeBtn) {
      mapModeBtn.addEventListener('click', () => {
        if (!map) return;
        
        try {
          if (currentMapLayer) map.removeLayer(currentMapLayer);
          
          // Toggle between layers
          if (currentMapLayer === cartoDarkLayer) {
            currentMapLayer = osmLayer;
          } else {
            currentMapLayer = cartoDarkLayer;
          }
          
          if (currentMapLayer) currentMapLayer.addTo(map);
          setTimeout(() => {
            if (map && map.invalidateSize) map.invalidateSize();
          }, 150);
        } catch (e) {
          safeWarn('Map mode switch failed:', e);
        }
      });
    }

    // Drawer toggle
    const drawer = document.getElementById('bottom-drawer');
    const drawerToggle = document.getElementById('drawer-toggle');
    
    if (drawer && drawerToggle) {
      drawerToggle.addEventListener('click', () => {
        drawer.classList.toggle('hidden');
        setTimeout(() => {
          if (map && map.invalidateSize) map.invalidateSize();
        }, 260);
      });
    }

    // Tutorial modal
    const tutorialModal = document.getElementById('tutorialModal');
    const tutorialClose = document.getElementById('tutorialClose');
    const openTutorial = document.getElementById('openTutorial');
    
    if (tutorialClose && tutorialModal) {
      tutorialClose.addEventListener('click', () => {
        tutorialModal.classList.add('hidden');
        tutorialModal.style.display = 'none';
      });
    }
    
    if (openTutorial && tutorialModal) {
      openTutorial.addEventListener('click', () => {
        tutorialModal.classList.remove('hidden');
        tutorialModal.style.display = 'flex';
      });
    }

    safeLog('UI initialized');
  }

  /* Main initialization */
  async function initGame() {
    if (_gameInitialized || _gameInitializing) return;
    _gameInitializing = true;

    try {
      await loadAllData();
      initMap();
      initUI();

      // Update location count
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

  // Fallback initialization
  setTimeout(() => {
    if (!_gameInitialized && !_gameInitializing) {
      safeLog('Starting fallback initialization');
      initGame();
    }
  }, 1500);

  /* Expose for debugging */
  window.__pipboy = {
    reinit: () => {
      _gameInitialized = false;
      initGame();
    },
    data: () => window.DATA,
    map: () => map,
    location: () => _lastPlayerPosition
  };

}());
