// map-core.js — Fallout-style Leaflet map engine with POI loader and CRT effects

window.Game = window.Game || {};
Game.map = Game.map || {};

Game.map.init = async function () {
  const mapEl = document.getElementById("mapContainer");
  if (!mapEl) return console.warn("[MapCore] #mapContainer not found");

  const map = L.map(mapEl, {
    zoomControl: false,
    attributionControl: false,
    minZoom: 2,
    maxZoom: 18,
    zoomSnap: 0.5,
    wheelPxPerZoomLevel: 60,
  }).setView([36.1699, -115.1398], 10);

  Game.map.instance = map;

  // Default style
  const style = localStorage.getItem("mapStyle") || "pipboy_terminal";
  Game.map.setStyle(style);

  // Style switcher
  document.querySelectorAll(".map-style-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const style = btn.dataset.style;
      Game.map.setStyle(style);
    });
  });

  // GPS request
  const gpsBtn = document.getElementById("request-gps");
  if (gpsBtn) {
    gpsBtn.addEventListener("click", () => {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        map.setView([latitude, longitude], 13);
        document.getElementById("accText").textContent = `GPS: ±${Math.round(accuracy)}m`;
        document.getElementById("accDot").style.background = "#00ff41";
        document.getElementById("accDot").style.boxShadow = "0 0 6px #00ff41";
      });
    });
  }

  // Load POIs
  try {
    const res = await fetch("/data/map/pois/poi.json");
    const pois = await res.json();
    Game.map.renderPOIs(pois);
    document.getElementById("mapStatus").textContent = `LOCATIONS: ${pois.length}`;
    console.log(`[MapCore] POIs loaded: ${pois.length}`);
  } catch (err) {
    console.warn("[MapCore] Failed to load POIs", err);
    document.getElementById("mapStatus").textContent = "ERROR LOADING POIs";
  }

  // Dispatch ready event
  setTimeout(() => {
    document.dispatchEvent(new CustomEvent("map-ready"));
  }, 100);
};

Game.map.setStyle = function (style) {
  localStorage.setItem("mapStyle", style);
  if (Game.map.tileLayer) Game.map.instance.removeLayer(Game.map.tileLayer);

  const styleURLs = {
    pipboy_terminal: "https://api.maptiler.com/maps/dataviz-dark/256/{z}/{x}/{y}.png?key=YOUR_KEY",
    desert_ruins_explorer: "https://api.maptiler.com/maps/topo-v2/256/{z}/{x}/{y}.png?key=YOUR_KEY",
    winter_recon: "https://api.maptiler.com/maps/winter/256/{z}/{x}/{y}.png?key=YOUR_KEY",
  };

  const url = styleURLs[style] || styleURLs.pipboy_terminal;
  Game.map.tileLayer = L.tileLayer(url, { tileSize: 256 }).addTo(Game.map.instance);
};

Game.map.renderPOIs = function (pois) {
  pois.forEach((poi) => {
    const marker = L.marker([poi.lat, poi.lng], {
      icon: L.divIcon({
        className: "pipboy-marker",
        html: `<div style="font-size:10px;">📍</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      title: poi.name,
    }).addTo(Game.map.instance);

    marker.on("click", () => {
      if (Game.hooks.onPOISelected) Game.hooks.onPOISelected(poi);
    });
  });
};

// Auto-init
window.initWastelandMap = Game.map.init;
document.addEventListener("DOMContentLoaded", Game.map.init);
