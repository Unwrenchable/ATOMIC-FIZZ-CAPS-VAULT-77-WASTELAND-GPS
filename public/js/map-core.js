// map-core.js – Fallout-style multi-map core for ATOMIC FIZZ CAPS
(function () {
  'use strict';

  let map = null;
  let currentMapLayer = null;
  let terrainLayer = null;
  let tonerLayer = null;
  let satelliteLayer = null;

  const DEFAULT_CENTER = [36.1699, -115.1398]; // Vegas / Mojave
  const DEFAULT_ZOOM = 13;

  function safeLog(...args) {
    try { console.log(...args); } catch (e) {}
  }
  function safeWarn(...args) {
    try { console.warn(...args); } catch (e) {}
  }

  function createTileLayers() {
    // Terrain (wasteland relief)
    try {
      terrainLayer = L.tileLayer(
        'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
        {
          maxZoom: 18,
          attribution: 'Map tiles by Stamen; Data © OpenStreetMap'
        }
      );
    } catch (e) {
      safeWarn('terrainLayer failed', e);
      terrainLayer = null;
    }

    // Toner (Pip-Boy schematic feel)
    try {
      tonerLayer = L.tileLayer(
        'https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png',
        {
          maxZoom: 18,
          attribution: 'Map tiles by Stamen; Data © OpenStreetMap'
        }
      );
    } catch (e) {
      safeWarn('tonerLayer failed', e);
      tonerLayer = null;
    }

    // Satellite-like fallback with pure OSM tiles (no key)
    try {
      satelliteLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }
      );
    } catch (e) {
      safeWarn('satelliteLayer failed', e);
      satelliteLayer = null;
    }

    [terrainLayer, tonerLayer, satelliteLayer].forEach(layer => {
      if (!layer || !layer.on) return;
      layer.on('tileerror', (e) => {
        const src = e && e.tile && e.tile.src ? e.tile.src : 'unknown';
        safeWarn('Tile failed:', src);
      });
    });
  }

  function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) {
      safeWarn('initMap: #map element not found');
      return;
    }

    // Reuse existing map if created already
    if (map && window.L && map instanceof L.Map) {
      if (currentMapLayer && !currentMapLayer._map) {
        currentMapLayer.addTo(map);
      }
      setTimeout(() => {
        if (map && map.invalidateSize) map.invalidateSize();
      }, 200);
      return;
    }

    try {
      map = L.map(mapEl, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        preferCanvas: true,
        zoomControl: false,
        attributionControl: false
      });
      window.map = map;
    } catch (e) {
      safeWarn('Leaflet map creation failed', e);
      return;
    }

    createTileLayers();

    // Default: toner (most Pip-Boy-like), else terrain, else OSM
    currentMapLayer = tonerLayer || terrainLayer || satelliteLayer;
    if (currentMapLayer) currentMapLayer.addTo(map);

    setTimeout(() => {
      if (map && map.invalidateSize) map.invalidateSize();
    }, 250);
  }

  function switchMapStyle(style) {
    if (!map) return;

    try {
      if (currentMapLayer && map.hasLayer(currentMapLayer)) {
        map.removeLayer(currentMapLayer);
      }
    } catch (e) {
      // ignore
    }

    if (style === 'terrain' && terrainLayer) currentMapLayer = terrainLayer;
    else if (style === 'toner' && tonerLayer) currentMapLayer = tonerLayer;
    else if (style === 'satellite' && satelliteLayer) currentMapLayer = satelliteLayer;
    else currentMapLayer = tonerLayer || terrainLayer || satelliteLayer;

    try {
      if (currentMapLayer) currentMapLayer.addTo(map);
    } catch (e) {
      safeWarn('switchMapStyle failed, falling back to OSM', e);
      try {
        currentMapLayer = L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { maxZoom: 19 }
        );
        currentMapLayer.addTo(map);
      } catch (err) {
        safeWarn('OSM fallback failed', err);
      }
    }

    setTimeout(() => {
      if (map && map.invalidateSize) map.invalidateSize();
    }, 150);
  }

  function attachMapModeButton() {
    const btn = document.getElementById('mapModeBtn');
    const mapContainer = document.querySelector('.map-container');
    const staticNoise = document.querySelector('.static-noise');
    const modes = ['toner', 'terrain', 'satellite'];
    let idx = 0;

    if (!btn) return;

    btn.addEventListener('click', () => {
      idx = (idx + 1) % modes.length;
      const mode = modes[idx];
      switchMapStyle(mode);

      if (mapContainer) {
        mapContainer.classList.add('crt-glitch');
        if (staticNoise) staticNoise.classList.add('active');
        setTimeout(() => {
          mapContainer.classList.remove('crt-glitch');
          if (staticNoise) staticNoise.classList.remove('active');
        }, 520);
      }
    });
  }

  // Minimal CSS safety so overlays don’t kill the map
  (function ensureCssSafety() {
    try {
      const id = 'map-core-safety';
      if (document.getElementById(id)) return;
      const css = `
        #map {
          min-height: 260px;
          height: 100%;
        }
        .leaflet-tile-pane {
          z-index: 10 !important;
        }
        .leaflet-tile-pane img.leaflet-tile {
          image-rendering: pixelated;
          filter: contrast(1.35) saturate(0.4) hue-rotate(110deg);
        }
        .static-noise, .top-overlay, .overseer-link, .hud, .pipboy-screen {
          pointer-events: none;
        }
        .map-container, #map {
          pointer-events: auto;
        }
      `;
      const s = document.createElement('style');
      s.id = id;
      s.appendChild(document.createTextNode(css));
      document.head.appendChild(s);
    } catch (e) {}
  }());

  // Export hooks for your game logic
  window.switchMapStyle = switchMapStyle;
  window.initLeafletMapCore = initMap;

  // Boot integration – your boot.js should dispatch pipboyReady
  window.addEventListener('pipboyReady', () => {
    try {
      initMap();
      attachMapModeButton();
    } catch (e) {
      safeWarn('pipboyReady -> map init failed', e);
    }
  });

  // Dev fallback – if boot never fires but DOM is ready
  setTimeout(() => {
    try {
      const el = document.getElementById('map');
      if (el && document.body.contains(el) && !map) {
        initMap();
        attachMapModeButton();
      }
    } catch (e) {}
  }, 1200);
}());
