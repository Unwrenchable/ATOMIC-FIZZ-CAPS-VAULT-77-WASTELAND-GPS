// public/js/map-core.js – Fallout-style map core (Updated Jan 03, 2026)
(function () {
  'use strict';

  let map = null;
  let currentMapLayer = null;
  let osmLayer = null;
  let cartoDarkLayer = null;
  let cartoLightLayer = null;

  // POI layer groups
  let poiLayers = {
    workshop: null,
    loot: null,
    turret: null,
    default: null
  };

  const DEFAULT_CENTER = [36.1699, -115.1398]; // Vegas / Mojave
  const DEFAULT_ZOOM = 13;

  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }

  // ------------------------------------------------------------
  // Fallout theme helper (body class based)
  // ------------------------------------------------------------
  function setMapTheme(theme) {
    document.body.classList.remove('fallout-green', 'fallout-amber', 'fallout-blue');
    if (theme) {
      document.body.classList.add(theme);
    }
  }

  // -------------------------
  // Icon helpers
  // -------------------------
  function createSvgIcon(url, size = [32, 32], anchor = [16, 32]) {
    try {
      return L.icon({
        iconUrl: url,
        iconSize: size,
        iconAnchor: anchor,
        popupAnchor: [0, -Math.round(size[1] / 2)],
        className: 'custom-marker-icon'
      });
    } catch (e) {
      safeWarn('Failed to create custom icon:', url, e);
      return null;
    }
  }

  const ICONS = {
    workshop: createSvgIcon('/img/icons/workshop.svg', [36, 36], [18, 36]),
    loot: createSvgIcon('/img/icons/loot.svg', [32, 32], [16, 32]),
    turret: createSvgIcon('/img/icons/turret.svg', [30, 30], [15, 30]),
    player: createSvgIcon('/img/icons/player.svg', [40, 40], [20, 40]),
    default: L.icon({
      iconUrl: '/leaflet/images/marker-icon.png',
      iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
      shadowUrl: '/leaflet/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  };

  // -------------------------
  // Tile layers
  // -------------------------
  function createTileLayers() {
    try {
      osmLayer = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '© OpenStreetMap contributors', subdomains: ['a', 'b', 'c'] }
      );
    } catch (e) { safeWarn('OSM layer failed', e); }

    try {
      cartoDarkLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 20, attribution: '© OpenStreetMap © Carto', subdomains: ['a', 'b', 'c'] }
      );
    } catch (e) { safeWarn('Carto Dark layer failed', e); }

    try {
      cartoLightLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 20, attribution: '© OpenStreetMap © Carto', subdomains: ['a', 'b', 'c'] }
      );
    } catch (e) { safeWarn('Carto Light layer failed', e); }

    // Tile error logging
    [osmLayer, cartoDarkLayer, cartoLightLayer].forEach(layer => {
      if (layer) {
        layer.on('tileerror', e => {
          safeWarn('Tile load failed:', e.url || 'unknown');
        });
      }
    });
  }

  // -------------------------
  // POI layer creation
  // -------------------------
  function createPoiLayerGroup() {
    return L.markerClusterGroup ? L.markerClusterGroup({ chunkedLoading: true }) : L.layerGroup();
  }

  // -------------------------
  // Safe POI addition
  // -------------------------
  function addPoi(poi) {
    const lat = Number(poi.lat ?? poi.latitude ?? poi.y);
    const lng = Number(poi.lng ?? poi.lon ?? poi.longitude ?? poi.x);

    if (isNaN(lat) || isNaN(lng)) {
      safeWarn('Skipping invalid POI (bad lat/lng):', poi);
      return;
    }

    try {
      const type = (poi.type || 'default').toLowerCase();
      const icon = ICONS[type] || ICONS.default;
      const marker = L.marker([lat, lng], { icon });

      const popupHtml = `
        <strong>${poi.name || 'Unnamed POI'}</strong><br>
        Type: ${poi.type || 'unknown'}<br>
        ${poi.description || poi.notes || ''}<br>
        <small>ID: ${poi.id || 'N/A'}</small>
      `;
      marker.bindPopup(popupHtml);

      const layerKey =
        type === 'workshop' ? 'workshop' :
        type === 'loot' ? 'loot' :
        type === 'turret' ? 'turret' :
        'default';

      if (!poiLayers[layerKey]) {
        poiLayers[layerKey] = createPoiLayerGroup();
      }

      poiLayers[layerKey].addLayer(marker);
      safeLog(`Added POI: ${poi.id || poi.name} at [${lat}, ${lng}]`);
    } catch (err) {
      safeWarn('addPoi failed:', err, poi);
    }
  }

  // -------------------------
  // Load POIs from JSON files
  // -------------------------
  async function loadPOIs() {
    Object.keys(poiLayers).forEach(k => {
      if (!poiLayers[k]) poiLayers[k] = createPoiLayerGroup();
    });

    const urls = [
      '/data/map/pois/sample.json',
      '/data/map/pois/pois.json',
      '/data/map/pois/workshops.json'
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) {
          safeWarn(`POI file not found: ${url} (HTTP ${res.status})`);
          continue;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          safeWarn(`Invalid POI data (not array): ${url}`);
          continue;
        }

        data.forEach(addPoi);
        safeLog(`Loaded ${data.length} POIs from ${url}`);
      } catch (e) {
        safeWarn(`Failed to load POIs from ${url}:`, e);
      }
    }

    if (map) {
      Object.values(poiLayers).forEach(layer => {
        if (layer && !map.hasLayer(layer)) {
          layer.addTo(map);
        }
      });

      if (!map._layerControl) {
        const overlays = {
          'Workshops': poiLayers.workshop,
          'Loot': poiLayers.loot,
          'Turrets': poiLayers.turret,
          'Other POIs': poiLayers.default
        };
        map._layerControl = L.control.layers(null, overlays, { collapsed: false }).addTo(map);
      }
    }
  }

  // -------------------------
  // Map Initialization
  // -------------------------
  function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) {
      safeWarn('Map element #map not found');
      return;
    }

    // ensure CRT class (in case HTML didn’t add it)
    mapEl.classList.add('map-crt');

    // Prevent double init
    if (map && map instanceof L.Map) {
      setTimeout(() => map.invalidateSize(), 200);
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
      window._map = map;
      window.map = map;
    } catch (e) {
      safeWarn('Map creation failed:', e);
      return;
    }

    // Marker icon default fix (moved out of HTML)
    try {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/images/marker-icon-2x.png',
        iconUrl: '/images/marker-icon.png',
        shadowUrl: '/images/marker-shadow.png'
      });
    } catch (e) {
      safeWarn('Marker default icon override failed:', e);
    }

    createTileLayers();

    // Default to dark / Pip‑Boy green
    currentMapLayer = cartoDarkLayer || osmLayer;
    if (currentMapLayer) currentMapLayer.addTo(map);
    setMapTheme('fallout-green');

    L.control.zoom({ position: 'topleft' }).addTo(map);

    setTimeout(() => {
      loadPOIs().catch(e => safeWarn('POI loading failed:', e));
      window.dispatchEvent(new Event('map-ready'));
    }, 300);

    setTimeout(() => map.invalidateSize(), 250);
  }

  // -------------------------
  // Map Style Switcher (wired to Fallout themes)
  // -------------------------
  function switchMapStyle(style) {
    if (!map) return;

    if (currentMapLayer && map.hasLayer(currentMapLayer)) {
      map.removeLayer(currentMapLayer);
    }

    if (style === 'dark' && cartoDarkLayer) {
      currentMapLayer = cartoDarkLayer;
      setMapTheme('fallout-green');
    } else if (style === 'light' && cartoLightLayer) {
      currentMapLayer = cartoLightLayer;
      setMapTheme('fallout-amber');
    } else if (style === 'osm' && osmLayer) {
      currentMapLayer = osmLayer;
      setMapTheme('fallout-blue');
    } else {
      currentMapLayer = cartoDarkLayer || osmLayer;
      setMapTheme('fallout-green');
    }

    if (currentMapLayer) currentMapLayer.addTo(map);
    setTimeout(() => map.invalidateSize(), 150);
  }

  // -------------------------
  // Attach Map Mode Button
  // -------------------------
  function attachMapModeButton() {
    const btn = document.getElementById('mapModeBtn');
    if (!btn) return;

    const modes = ['dark', 'light', 'osm'];
    let idx = 0;

    btn.addEventListener('click', () => {
      idx = (idx + 1) % modes.length;
      switchMapStyle(modes[idx]);
    });
  }

  // -------------------------
  // Safety CSS (pixelated green tiles etc.)
  // -------------------------
  (function injectSafetyCss() {
    const id = 'map-core-safety';
    if (document.getElementById(id)) return;

    const css = `
      #map { min-height: 260px; height: 100%; width: 100%; position: relative; }
      .leaflet-container { background: #0a1f0a; }
      .leaflet-tile-pane img.leaflet-tile {
        image-rendering: pixelated;
        filter: contrast(1.35) saturate(0.4) hue-rotate(110deg);
      }
      .static-noise, .top-overlay {
        pointer-events: none !important;
        z-index: 2 !important;
      }
      #map, .map-container {
        pointer-events: auto !important;
        z-index: 1 !important;
      }
    `;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  })();

  // -------------------------
  // Init & Export
  // -------------------------
  window.switchMapStyle = switchMapStyle;
  window.initLeafletMapCore = initMap;

  window.addEventListener('pipboyReady', () => {
    try {
      initMap();
      attachMapModeButton();
    } catch (e) {
      safeWarn('pipboyReady → map init failed', e);
    }
  });

  // Fallback init
  setTimeout(() => {
    if (document.getElementById('map') && !map) {
      initMap();
      attachMapModeButton();
    }
  }, 1200);

})();
