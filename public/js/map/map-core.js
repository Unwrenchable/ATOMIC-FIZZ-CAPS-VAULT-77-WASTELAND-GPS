// ============================================================
// PIP‑BOY TILE MAP CORE (FINAL CLEAN VERSION)
// ============================================================

window.Game = window.Game || {};
const Game = window.Game;

(function () {
  let map = null;

  // ------------------------------------------------------------
  // INIT MAP (runs once)
  // ------------------------------------------------------------
  function initMap() {
    if (map) return map;

    console.log("Pip‑Boy MapCore: init");

    // Create Leaflet map
    map = L.map("map", {
      zoomControl: false,
      attributionControl: false,
      minZoom: 3,
      maxZoom: 6,
      center: [36.1699, -115.1398], // Vegas default
      zoom: 4
    });

    // ------------------------------------------------------------
    // TILE LAYER (your world tiles)
    // ------------------------------------------------------------
    L.tileLayer("/tiles/world_overview/{z}/{x}/{y}.png", {
      tileSize: 256,
      noWrap: true,
      maxZoom: 6,
      minZoom: 3
    }).addTo(map);

    // ------------------------------------------------------------
    // PLAYER MARKER (created by worldstate.js)
    // ------------------------------------------------------------
    if (typeof Game.initPlayerMarker === "function") {
      Game.initPlayerMarker();
    }

    // ------------------------------------------------------------
    // LOAD POIs (if poi-markers.js defines loader)
    // ------------------------------------------------------------
    if (typeof Game.loadPOIMarkers === "function") {
      Game.loadPOIMarkers(map);
    }

    Game.map = map;
    return map;
  }

  // ------------------------------------------------------------
  // AUTO‑INIT
  // ------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", initMap);
})();
