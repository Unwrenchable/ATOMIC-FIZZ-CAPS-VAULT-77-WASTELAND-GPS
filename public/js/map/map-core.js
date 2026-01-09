// map-core.js (Hybrid Version)
// Wasteland Map + POI Selection + MapTiler Styles
// No auto-claim. UI must call Game.claimLocation(window.SelectedPOI)

const MAPTILER_KEY = "YOUR_MAPTILER_KEY_HERE";

const MAP_STYLES = {
  rad_zone_red_ocean: "streets-v2",
  vaulttec_blue_terminal: "basic-v2",
  desert_ruins_explorer: "satellite",
};

const DEFAULT_STYLE = MAP_STYLES.vaulttec_blue_terminal;
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
  const mapEl = document.getElementById("map");
  if (!mapEl) return;
  if (wastelandMap) return;

  console.log("[MapCore] Initializing Wasteland Map…");

  wastelandMap = L.map(mapEl, {
    center: MOJAVE_CENTER,
    zoom: MOJAVE_ZOOM,
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true,
  });

  baseTiles = L.tileLayer(
    `https://api.maptiler.com/maps/${DEFAULT_STYLE}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
    {
      tileSize: 512,
      zoomOffset: -1,
      crossOrigin: true,
    }
  );

  baseTiles.addTo(wastelandMap);

  loadPOIs();
  initMapControls();
  initMapStyleButtons();

  console.log("[MapCore] Map initialized");
}

// ------------------------------------------------------------
// STYLE SWITCHING
// ------------------------------------------------------------
function switchTileStyle(styleKey) {
  if (!baseTiles) return;

  const styleId = MAP_STYLES[styleKey] || DEFAULT_STYLE;

  baseTiles.setUrl(
    `https://api.maptiler.com/maps/${styleId}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
  );

  setRadOverlay(styleKey === "rad_zone_red_ocean");
}

// ------------------------------------------------------------
// STYLE BUTTONS
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
// LOAD POIs (Hybrid)
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
        className: "pipboy-marker",
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
// SELECT POI (Hybrid)
// ------------------------------------------------------------
function selectPOI(poi, marker) {
  // Clear previous selection
  if (selectedMarker) {
    selectedMarker.setStyle({
      radius: 8,
      color: "#00ff88",
      fillColor: "#00ff88",
      fillOpacity: 0.8,
    });
  }

  // Highlight new selection
  marker.setStyle({
    radius: 12,
    color: "#00ff00",
    fillColor: "#00ff00",
    fillOpacity: 1.0,
  });

  selectedMarker = marker;
  window.SelectedPOI = poi;

  console.log("[MapCore] Selected POI:", poi);

  // Notify UI (optional)
  if (window.Game && Game.hooks && typeof Game.hooks.onPOISelected === "function") {
    Game.hooks.onPOISelected(poi);
  }
}

// ------------------------------------------------------------
// MAP CONTROLS
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

          wastelandMap?.setView([lat, lng], 15);
          updateGpsBadge(true, acc);

          if (window.Game && typeof Game.startGPS === "function") {
            Game.startGPS();
          }
        },
        (err) => {
          console.error("GPS error:", err);
          updateGpsBadge(false, null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 10000,
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
