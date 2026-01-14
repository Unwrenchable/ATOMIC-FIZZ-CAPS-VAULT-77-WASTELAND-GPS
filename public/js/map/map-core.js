// ============================================================
// PIP‑BOY TILE MAP CORE (CLEAN VERSION)
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

    map = L.map("map", {
      zoomControl: false,
      attributionControl: false,
      minZoom: 3,
      maxZoom: 6,
      center: [36.1699, -115.1398], // Vegas
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
    // LOAD POIs (if poi-markers.js is present)
    // ------------------------------------------------------------
    if (Game.loadPOIMarkers) {
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
