// map-core.js (No-key Fallout-style OSM hybrid)
// Wasteland Map + POI Selection + Retro-inspired styles

// ------------------------------------------------------------
// MAP STYLE DEFINITIONS (no API keys)
// ------------------------------------------------------------

const MAP_STYLES = {
  // Dark, high-contrast – great under green CRT overlay
  pipboy_terminal: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors, © Carto"
    }
  },

  // Classic OSM streets – good for “desert explorer”
  desert_ruins_explorer: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  },

  // Harsh black‑and‑white – feels like a cold “winter scan”
  winter_recon: {
    url: "https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png",
    options: {
      maxZoom: 20,
      attribution: "Map tiles by Stamen Design, Data © OpenStreetMap"
    }
  }
};

const DEFAULT_STYLE_KEY = "pipboy_terminal";
const MOJAVE_CENTER = [36.1699, -115.1398];
const MOJAVE_ZOOM = 10;

let wastelandMap = null;
let baseTiles = null;
let poiMarkers = {};
let selectedMarker = null;

window.SelectedPOI = null; // UI reads this when showing CLAIM button

// ------------------------------------------------------------
// INIT MAP
// ------------------------------------------------------------
function initWastelandMap() {
  // NOTE: your index.html uses id="mapContainer"
  const mapEl = document.getElementById("mapContainer");
  if (!mapEl) {
    console.error("[MapCore] #mapContainer not found");
    return;
  }
  if (wastelandMap) return;

  console.log("[MapCore] Initializing Wasteland Map…");

  wastelandMap = L.map(mapEl, {
    center: MOJAVE_CENTER,
    zoom: MOJAVE_ZOOM,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true
  });

  // Apply default style
  const style = MAP_STYLES[DEFAULT_STYLE_KEY];
  if (!style) {
    console.error("[MapCore] Default style missing:", DEFAULT_STYLE_KEY);
    return;
  }

  baseTiles = L.tileLayer(style.url, style.options);
  baseTiles.addTo(wastelandMap);

  loadPOIs();
  initMapControls();
  initMapStyleButtons();

  console.log("[MapCore] Map initialized");

  // Let the rest of the game know
  window.dispatchEvent(new Event("map-ready"));
}

// ------------------------------------------------------------
// STYLE SWITCHING
// ------------------------------------------------------------
function switchTileStyle(styleKey) {
  if (!baseTiles) return;

  const style = MAP_STYLES[styleKey] || MAP_STYLES[DEFAULT_STYLE_KEY];
  if (!style) return;

  baseTiles.setUrl(style.url);
  // Some providers need options changed too; easiest: recreate layer
  // but to keep it simple we just change URL here.

  // Optional radiation overlay hook
  setRadOverlay(styleKey === "pipboy_terminal");
}

// ------------------------------------------------------------
// STYLE BUTTONS (expects .map-style-btn with data-style="pipboy_terminal", etc.)
// ------------------------------------------------------------
function initMapStyleButtons() {
  const buttons = document.querySelectorAll(".map-style-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const style = btn.dataset.style;
      if (style) switchTileStyle(style);
    });
  });
}

// ------------------------------------------------------------
// LOAD POIs
// ------------------------------------------------------------
async function loadPOIs() {
  try {
    const res = await fetch("/data/map/pois/poi.json");
    if (!res.ok) return;

    const data = await res.json();
    if (!Array.isArray(data)) return;

    data.forEach((poi) => {
      if (typeof poi.lat !== "number" || typeof poi.lng !== "number") return;

      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: 8,
        color: "#00ff88",
        fillColor: "#00ff88",
        fillOpacity: 0.8,
        className: "pipboy-marker"
      });

      marker.addTo(wastelandMap);

      // Store POI
      poiMarkers[poi.id || poi.name] = marker;

      // Click → select POI (NO auto-claim)
      marker.on("click", () => {
        selectPOI(poi, marker);
      });
    });

    console.log("[MapCore] POIs loaded:", data.length);
  } catch (err) {
    console.error("[MapCore] Failed to load POIs:", err);
  }
}

// ------------------------------------------------------------
// SELECT POI
// ------------------------------------------------------------
function selectPOI(poi, marker) {
  // Clear previous selection
  if (selectedMarker) {
    selectedMarker.setStyle({
      radius: 8,
      color: "#00ff88",
      fillColor: "#00ff88",
      fillOpacity: 0.8
    });
  }

  // Highlight new selection
  marker.setStyle({
    radius: 12,
    color: "#00ff00",
    fillColor: "#00ff00",
    fillOpacity: 1.0
  });

  selectedMarker = marker;
  window.SelectedPOI = poi;

  console.log("[MapCore] Selected POI:", poi);

  // Notify UI hook if present
  if (window.Game && Game.hooks && typeof Game.hooks.onPOISelected === "function") {
    Game.hooks.onPOISelected(poi);
  }
}

// ------------------------------------------------------------
// MAP CONTROLS
// Expects a button with id="request-gps" if you want manual GPS start
// ------------------------------------------------------------
function initMapControls() {
  const requestGpsBtn = document.getElementById("request-gps");

  if (requestGpsBtn && "geolocation" in navigator) {
    requestGpsBtn.addEventListener("click", () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;

          if (wastelandMap) {
            wastelandMap.setView([lat, lng], 15);
          }
          updateGpsBadge(true, acc);

          // Optional hook into your game loop
          if (window.Game && typeof Game.startGPS === "function") {
            Game.startGPS();
          }
        },
        (err) => {
          console.error("[MapCore] GPS error:", err);
          updateGpsBadge(false, null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000
        }
      );
    });
  }
}

// ------------------------------------------------------------
// GPS BADGE
// ------------------------------------------------------------
function updateGpsBadge(ok, accuracy) {
  const accDot = document.getElementById("accDot");
  const accText = document.getElementById("accText");

  if (!accDot || !accText) return;

  if (ok) {
    accDot.style.background = "#00ff41";
    accDot.style.boxShadow = "0 0 6px #00ff41";
    accText.textContent = accuracy
      ? `GPS: LOCK (${Math.round(accuracy)}m)`
      : "GPS: LOCK";
  } else {
    accDot.style.background = "red";
    accDot.style.boxShadow = "0 0 6px red";
    accText.textContent = "GPS: ERROR";
  }
}

// ------------------------------------------------------------
// RAD OVERLAY
// ------------------------------------------------------------
function setRadOverlay(active) {
  const radFlash = document.getElementById("radFlash");
  if (radFlash) radFlash.style.display = active ? "block" : "none";
}

// ------------------------------------------------------------
// EXPORT
// ------------------------------------------------------------
window.initWastelandMap = initWastelandMap;
window.switchTileStyle = switchTileStyle;
