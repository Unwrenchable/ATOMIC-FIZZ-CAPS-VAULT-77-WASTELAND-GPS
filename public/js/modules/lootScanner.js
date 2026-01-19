// lootScanner.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Short‑Range Loot Scanner
// Highlights nearby POIs within a limited radius
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const scanner = {
    scanRadius: 100, // meters
    pulseInterval: 1500,
    pulseLayer: null,
    lastScanPos: null,

    init() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.map) {
        console.warn("lootScanner: worldmap not ready");
        return;
      }

      this.pulseLayer = L.layerGroup().addTo(worldmap.map);

      // Patch movement
      const originalSetPos = worldmap.setPlayerPosition.bind(worldmap);

      worldmap.setPlayerPosition = (lat, lng, opts = {}) => {
        originalSetPos(lat, lng, opts);
        this.scan(lat, lng);
      };

      console.log("lootScanner: initialized");
    },

    scan(lat, lng) {
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.map || !worldmap.locations) return;

      const pos = L.latLng(lat, lng);

      // Only rescan if player moved enough
      if (this.lastScanPos && this.lastScanPos.distanceTo(pos) < 20) return;
      this.lastScanPos = pos;

      this.pulseLayer.clearLayers();

      worldmap.locations.forEach(loc => {
        if (!loc.lat || !loc.lng) return;

        const dist = pos.distanceTo([loc.lat, loc.lng]);
        if (dist <= this.scanRadius) {
          this.highlight(loc);
        }
      });
    },

    highlight(loc) {
      const marker = L.circleMarker([loc.lat, loc.lng], {
        radius: 10,
        color: "#00ff41",
        weight: 2,
        fillColor: "#00ff41",
        fillOpacity: 0.25,
        className: "scanner-pulse"
      });

      this.pulseLayer.addLayer(marker);

      // Pulse animation
      setTimeout(() => {
        if (this.pulseLayer.hasLayer(marker)) {
          this.pulseLayer.removeLayer(marker);
        }
      }, this.pulseInterval);
    }
  };

  Game.modules.lootScanner = scanner;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      scanner.init();
    } catch (e) {
      console.error("lootScanner: init failed", e);
    }
  });
})();
