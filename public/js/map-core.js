// public/js/map-core.js – improved Fallout-style map core
(function () {
  'use strict';

  let map = null;
  let currentMapLayer = null;
  let osmLayer = null;
  let cartoDarkLayer = null;
  let cartoLightLayer = null;

  // POI layer groups (or cluster groups if plugin present)
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

  // -------------------------
  // Icon helpers
  // -------------------------
  function createSvgIcon(url, size = [32, 32], anchor = [16, 32]) {
    return L.icon({
      iconUrl: url,
      iconSize: size,
      iconAnchor: anchor,
      popupAnchor: [0, -Math.round(size[1] / 2)],
      className: 'custom-marker-icon'
    });
  }

  // Default icons map (replace URLs with your SVG/PNG paths)
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
    } catch (e) { safeWarn('osmLayer failed', e); osmLayer = null; }

    try {
      cartoDarkLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 20, attribution: '© OpenStreetMap © Carto', subdomains: ['a', 'b', 'c'] }
      );
    } catch (e) { safeWarn('cartoDarkLayer failed', e); cartoDarkLayer = null; }

    try {
      cartoLightLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 20, attribution: '© OpenStreetMap © Carto', subdomains: ['a', 'b', 'c'] }
      );
    } catch (e) { safeWarn('cartoLightLayer failed', e); cartoLightLayer = null; }

    [osmLayer, cartoDarkLayer, cartoLightLayer].forEach(layer => {
      if (!layer || !layer.on) return;
      layer.on('tileerror', (e) => {
        const src = e && e.tile && e.tile.src ? e.tile.src : 'unknown';
        safeWarn('Tile failed:', src);
      });
    });
  }

  // -------------------------
  // POI layer creation
  // -------------------------
  function createPoiLayerGroup(type) {
    // prefer marker cluster if available
    if (window.L && window.L.markerClusterGroup) {
      return L.markerClusterGroup ? L.markerClusterGroup({ chunkedLoading: true }) : L.layerGroup();
    }
    return L.layerGroup();
  }

  // -------------------------
  // Load POIs from JSON files
  // -------------------------
  async function loadPOIs() {
    // ensure layers exist
    poiLayers.workshop = poiLayers.workshop || createPoiLayerGroup('workshop');
    poiLayers.loot = poiLayers.loot || createPoiLayerGroup('loot');
    poiLayers.turret = poiLayers.turret || createPoiLayerGroup('turret');
    poiLayers.default = poiLayers.default || createPoiLayerGroup('default');

    // helper to add a POI
    function addPoi(p) {
      try {
        const type = (p.type || '').toLowerCase();
        const icon = ICONS[type] || ICONS.default;
        const marker = L.marker([p.lat, p.lon], { icon });
        const popupHtml = `<strong>${p.name || 'POI'}</strong><div style="font-size:12px;margin-top:6px">${p.notes || ''}</div><div style="font-size:11px;color:#9fd">${p.id || ''}</div>`;
        marker.bindPopup(popupHtml);
        // choose layer
        const layer = (type === 'workshop') ? poiLayers.workshop
                    : (type === 'loot') ? poiLayers.loot
                    : (type === 'turret') ? poiLayers.turret
                    : poiLayers.default;
        layer.addLayer ? layer.addLayer(marker) : layer.addLayer(marker); // cluster or layerGroup
      } catch (err) {
        safeWarn('addPoi failed', err, p);
      }
    }

    // try a few known files; keep this list small and explicit
    const urls = [
      'data/map/pois/sample.json',
      'data/map/pois/pois.json',
      'data/map/pois/workshops.json'
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) continue;
        const pois = await res.json();
        if (!Array.isArray(pois)) continue;
        pois.forEach(addPoi);
        safeLog('Loaded POIs from', url, pois.length);
      } catch (e) {
        // ignore missing files; continue to next
      }
    }

    // add layers to map and control
    try {
      if (!map) return;
      // ensure each layer is added once
      Object.keys(poiLayers).forEach(k => {
        const layer = poiLayers[k];
        if (!layer) return;
        if (!map.hasLayer(layer)) layer.addTo(map);
      });

      // add a layer control if not present
      if (!map._layerControl) {
        const overlays = {
          'Workshops': poiLayers.workshop,
          'Loot': poiLayers.loot,
          'Turret Parts': poiLayers.turret,
          'Other POIs': poiLayers.default
        };
        map._layerControl = L.control.layers(null, overlays, { collapsed: false }).addTo(map);
      }
    } catch (e) {
      safeWarn('Failed to attach POI layers to map', e);
    }
  }

  // -------------------------
  // Map init and style switching
  // -------------------------
  function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) {
      safeWarn('initMap: #map element not found');
      return;
    }

    if (map && window.L && map instanceof L.Map) {
      if (currentMapLayer && !currentMapLayer._map) currentMapLayer.addTo(map);
      setTimeout(() => { if (map && map.invalidateSize) map.invalidateSize(); }, 200);
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
      // expose for other scripts
      window._map = map;
    } catch (e) {
      safeWarn('Leaflet map creation failed', e);
      return;
    }

    createTileLayers();

    currentMapLayer = cartoDarkLayer || cartoLightLayer || osmLayer;
    if (currentMapLayer) currentMapLayer.addTo(map);

    // add a small zoom control in top-left styled by your CSS
    try {
      L.control.zoom({ position: 'topleft' }).addTo(map);
    } catch (e) {}

    // load POIs after base map is ready
    setTimeout(() => {
      loadPOIs().catch(err => safeWarn('loadPOIs failed', err));
      // dispatch a map-ready event for other scripts
      try { window.dispatchEvent(new Event('map-ready')); } catch (e) {}
    }, 300);

    setTimeout(() => { if (map && map.invalidateSize) map.invalidateSize(); }, 250);
  }

  function switchMapStyle(style) {
    if (!map) return;
    try { if (currentMapLayer && map.hasLayer(currentMapLayer)) map.removeLayer(currentMapLayer); } catch (e) {}
    if (style === 'dark' && cartoDarkLayer) currentMapLayer = cartoDarkLayer;
    else if (style === 'light' && cartoLightLayer) currentMapLayer = cartoLightLayer;
    else if (style === 'osm' && osmLayer) currentMapLayer = osmLayer;
    else currentMapLayer = cartoDarkLayer || cartoLightLayer || osmLayer;

    try {
      if (currentMapLayer) currentMapLayer.addTo(map);
    } catch (e) {
      safeWarn('switchMapStyle failed, falling back to OSM', e);
      try {
        currentMapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
        currentMapLayer.addTo(map);
      } catch (err) { safeWarn('OSM fallback failed', err); }
    }

    setTimeout(() => { if (map && map.invalidateSize) map.invalidateSize(); }, 150);
  }

  // -------------------------
  // Map mode button
  // -------------------------
  function attachMapModeButton() {
    const btn = document.getElementById('mapModeBtn');
    const mapContainer = document.querySelector('.map-container');
    const staticNoise = document.querySelector('.static-noise');
    const modes = ['dark', 'light', 'osm'];
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

  // -------------------------
  // Safety CSS injection
  // -------------------------
  (function ensureCssSafety() {
    try {
      const id = 'map-core-safety';
      if (document.getElementById(id)) return;
      const css = `
        #map { min-height: 260px; height: 100%; }
        .leaflet-tile-pane { z-index: 10 !important; }
        .leaflet-tile-pane img.leaflet-tile {
          image-rendering: pixelated;
          filter: contrast(1.35) saturate(0.4) hue-rotate(110deg);
        }
        .static-noise, .top-overlay { pointer-events: none; }
        .map-container, #map { pointer-events: auto; }
        .custom-marker-icon { transition: transform .12s ease, filter .12s ease; }
        .custom-marker-icon:hover { transform: translateY(-4px) scale(1.06); filter: drop-shadow(0 0 12px rgba(0,255,102,0.35)); }
      `;
      const s = document.createElement('style');
      s.id = id;
      s.appendChild(document.createTextNode(css));
      document.head.appendChild(s);
    } catch (e) {}
  }());

  // -------------------------
  // Expose functions and init
  // -------------------------
  window.switchMapStyle = switchMapStyle;
  window.initLeafletMapCore = initMap;

  window.addEventListener('pipboyReady', () => {
    try { initMap(); attachMapModeButton(); } catch (e) { safeWarn('pipboyReady -> map init failed', e); }
  });

  // fallback init if pipboyReady not fired
  setTimeout(() => {
    try {
      const el = document.getElementById('map');
      if (el && document.body.contains(el) && !map) { initMap(); attachMapModeButton(); }
    } catch (e) {}
  }, 1200);

}());
