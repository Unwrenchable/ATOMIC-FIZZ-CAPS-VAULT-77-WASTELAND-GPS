// map-core.js
// Wasteland GPS + MapTiler styles + basic GPS UI

// MapTiler config (replace with your real key & style IDs)
const MAPTILER_KEY = "YOUR_MAPTILER_KEY_HERE";

const MAP_STYLES = {
  rad_zone_red_ocean: "rad_zone_red_ocean",
  vaulttec_blue_terminal: "vaulttec_blue_terminal",
  desert_ruins_explorer: "desert_ruins_explorer",
};

const DEFAULT_STYLE = MAP_STYLES.vaulttec_blue_terminal;
const MOJAVE_CENTER = [36.1699, -115.1398];
const MOJAVE_ZOOM = 10;

let wastelandMap = null;
let baseTiles = null;

function initWastelandMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || wastelandMap) return;

  wastelandMap = L.map("map", {
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
}

function switchTileStyle(styleKey) {
  if (!baseTiles) return;

  const styleId = MAP_STYLES[styleKey] || DEFAULT_STYLE;


  baseTiles.setUrl(
    `https://api.maptiler.com/maps/${styleId}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
  );

  setRadOverlay(styleKey === "rad_zone_red_ocean");
}

function initMapStyleButtons() {
  const buttons = Array.from(document.querySelectorAll(".map-style-btn"));
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const style = btn.getAttribute("data-style");
      if (!style) return;
      switchTileStyle(style);
    });
  });
}

async function loadPOIs() {
  try {
    const res = await fetch("/data/map/pois/poi.json");
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data)) return;

    data.forEach((poi) => {
      if (typeof poi.lat !== "number" || typeof poi.lng !== "number") return;

      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: 6,
        color: "#00ff88",
        fillColor: "#00ff88",
        fillOpacity: 0.8,
        className: "pipboy-marker",
      });

      const name = poi.name || "Unknown Location";
      const desc = poi.description || "";
      marker.bindPopup(`<strong>${name}</strong><br>${desc}`);

      marker.addTo(wastelandMap);
    });
  } catch (err) {
    console.error("Failed to load POIs:", err);
  }
}

function initMapControls() {
  const centerBtn = document.getElementById("centerBtn");
  const recenterMojaveBtn = document.getElementById("recenterMojave");
  const requestGpsBtn = document.getElementById("requestGpsBtn");

  if (centerBtn) {
    centerBtn.addEventListener("click", () => {
      if (!wastelandMap) return;
      wastelandMap.setView(MOJAVE_CENTER, MOJAVE_ZOOM);
    });
  }

  if (recenterMojaveBtn) {
    recenterMojaveBtn.addEventListener("click", () => {
      if (!wastelandMap) return;
      wastelandMap.setView(MOJAVE_CENTER, MOJAVE_ZOOM);
    });
  }

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

function setRadOverlay(active) {
  const radFlash = document.getElementById("radFlash");
  if (!radFlash) return;
  radFlash.style.display = active ? "block" : "none";
}
