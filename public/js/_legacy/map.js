// ------------------------------------------------------------
// Leaflet Init (Fallout Pip‑Boy Style)
// ------------------------------------------------------------

// Create the map instance
const map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 2,
  maxZoom: 19,
  worldCopyJump: true
});

// Add CRT overlay class to the map container
const mapEl = document.getElementById("map");
if (mapEl) {
  mapEl.classList.add("map-crt");
}

// ------------------------------------------------------------
// Theme Switching (Fallout Green / Amber / Blue)
// ------------------------------------------------------------
function setMapTheme(theme) {
  document.body.classList.remove("fallout-green", "fallout-amber", "fallout-blue");
  document.body.classList.add(theme);
}

// Default theme on load
setMapTheme("fallout-green");

// ------------------------------------------------------------
// Default View (center of your world map)
// ------------------------------------------------------------
map.setView([0, 0], 3);
