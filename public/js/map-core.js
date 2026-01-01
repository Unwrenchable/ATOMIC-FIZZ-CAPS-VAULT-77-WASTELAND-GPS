// map-core.js – Fallout-style multi-map core for ATOMIC FIZZ CAPS
(function () {
  'use strict';

  let map = null;
  let currentMapLayer = null;
  let osmLayer = null;
  let cartoDarkLayer = null;
  let cartoLightLayer = null;

  const DEFAULT_CENTER = [36.1699, -115.1398]; // Vegas / Mojave
  const DEFAULT_ZOOM = 13;

  function safeLog(...args) {
    try { console.log(...args); } catch (e) {}
  }
  function safeWarn(...args) {
    try { console.warn(...args); } catch (e) {}
  }

  function createTileLayers() {
    try {
      // Standard OSM tiles (no API key)
      osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
          subdomains: ["a", "b", "c"]
        }
      );
    } catch (e) {
      safeWarn("osmLayer failed", e);
      osmLayer = null;
    }

    try {
      // Carto Dark basemap (Pip-Boy feel, no key)
      cartoDarkLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          attribution: "© OpenStreetMap © Carto",
          subdomains: ["a", "b", "c"]
        }
      );
    } catch (e) {
      safeWarn("cartoDarkLayer failed", e);
      cartoDarkLayer = null;
    }

    try {
      // Carto Light basemap (terrain-like fallback, no key)
      cartoLightLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 20,
          attribution: "© OpenStreetMap © Carto",
          subdomains: ["a", "b", "c"]
        }
      );
    } catch (e) {
      safeWarn("cartoLightLayer failed", e);
      cartoLightLayer = null;
    }

    [osmLayer, cartoDarkLayer, cartoLightLayer].forEach(layer => {
      if (!layer || !layer.on) return;
      layer.on("tileerror", (e) => {
        const src = e && e.tile && e.tile.src ? e.tile.src : "unknown";
        safeWarn("Tile failed:", src);
      });
    });
  }

  function initMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl) {
      safeWarn("initMap: #map element not found");
      return;
    }

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
      safeWarn("Leaflet map creation failed", e);
      return;
    }

    createTileLayers();

    // Default: Carto Dark (most Pip-Boy-like), else Carto Light, else OSM
    currentMapLayer = cartoDarkLayer || cartoLightLayer || osmLayer;
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
    } catch (e) {}

    if (style === "dark" && cartoDarkLayer) currentMapLayer = cartoDarkLayer;
    else if (style === "light" && cartoLightLayer) currentMapLayer = cartoLightLayer;
    else if (style === "osm" && osmLayer) currentMapLayer = osmLayer;
    else currentMapLayer = cartoDarkLayer || cartoLightLayer || osmLayer;

    try {
      if (currentMapLayer) currentMapLayer.addTo(map);
    } catch (e) {
      safeWarn("switchMapStyle failed, falling back to OSM", e);
      try {
        currentMapLayer = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          { maxZoom: 19 }
        );
        currentMapLayer.addTo(map);
      } catch (err) {
        safeWarn("OSM fallback failed", err);
      }
    }

    setTimeout(() => {
      if (map && map.invalidateSize) map.invalidateSize();
    }, 150);
  }

  function attachMapModeButton() {
    const btn = document.getElementById("mapModeBtn");
    const mapContainer = document.querySelector(".map-container");
    const staticNoise = document.querySelector(".static-noise");
    const modes = ["dark", "light", "osm"];
    let idx = 0;

    if (!btn) return;

    btn.addEventListener("click", () => {
      idx = (idx + 1) % modes.length;
      const mode = modes[idx];
      switchMapStyle(mode);

      if (mapContainer) {
        mapContainer.classList.add("crt-glitch");
        if (staticNoise) staticNoise.classList.add("active");
        setTimeout(() => {
          mapContainer.classList.remove("crt-glitch");
          if (staticNoise) staticNoise.classList.remove("active");
        }, 520);
      }
    });
  }

  (function ensureCssSafety() {
    try {
      const id = "map-core-safety";
      if (document.getElementById(id)) return;
      const css = `
        #map { min-height: 260px; height: 100%; }
        .leaflet-tile-pane { z-index: 10 !important; }
        .leaflet-tile-pane img.leaflet-tile {
          image-rendering: pixelated;
          filter: contrast(1.35) saturate(0.4) hue-rotate(110deg);
        }
        .static-noise, .top-overlay, .overseer-link, .hud, .pipboy-screen {
          pointer-events: none;
        }
        .map-container, #map { pointer-events: auto; }
      `;
      const s = document.createElement("style");
      s.id = id;
      s.appendChild(document.createTextNode(css));
      document.head.appendChild(s);
    } catch (e) {}
  }());

  window.switchMapStyle = switchMapStyle;
  window.initLeafletMapCore = initMap;

  window.addEventListener("pipboyReady", () => {
    try {
      initMap();
      attachMapModeButton();
    } catch (e) {
      safeWarn("pipboyReady -> map init failed", e);
    }
  });

  setTimeout(() => {
    try {
      const el = document.getElementById("map");
      if (el && document.body.contains(el) && !map) {
        initMap();
        attachMapModeButton();
      }
    } catch (e) {}
  }, 1200);
}());
