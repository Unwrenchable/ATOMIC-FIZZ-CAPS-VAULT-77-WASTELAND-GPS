// encounterHeatmap.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Encounter Heatmap Module
// Visual shading based on encounter likelihood
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const heatmap = {
    layer: null,
    lastPos: null,
    updateDistance: 50, // meters
    radius: 800, // meters for shading circle

    init() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.map) {
        console.warn("encounterHeatmap: worldmap not ready");
        return;
      }

      // Create pane BELOW fog but ABOVE faction borders
      const pane = worldmap.map.createPane("encounterHeatPane");
      pane.style.zIndex = 400;
      pane.style.pointerEvents = "none";

      this.layer = L.layerGroup().addTo(worldmap.map);

      this.injectStyles();
      this.patchMovement(worldmap);

      console.log("encounterHeatmap: initialized");
    },

    injectStyles() {
      const style = document.createElement("style");
      style.textContent = `
        .encounter-heat {
          mix-blend-mode: screen;
          opacity: 0.25;
        }
      `;
      document.head.appendChild(style);
    },

    patchMovement(worldmap) {
      const originalSetPos = worldmap.setPlayerPosition.bind(worldmap);

      worldmap.setPlayerPosition = (lat, lng, opts = {}) => {
        originalSetPos(lat, lng, opts);
        this.updateHeat(lat, lng);
      };
    },

    updateHeat(lat, lng) {
      const pos = L.latLng(lat, lng);

      if (this.lastPos && this.lastPos.distanceTo(pos) < this.updateDistance) return;
      this.lastPos = pos;

      const world = Game.modules.world;
      if (!world || !world.encounters || !world.encounters.getDangerLevel) return;

      // Ask your encounter engine for danger level
      const danger = world.encounters.getDangerLevel({
        lat,
        lng,
        biome: "auto",
        region: "auto"
      });

      // Normalize danger 0–1
      const level = Math.max(0, Math.min(1, danger || 0));

      this.drawHeat(pos, level);
    },

    drawHeat(pos, level) {
      this.layer.clearLayers();

      if (level <= 0) return;

      const color = "#00ff41";

      const circle = L.circle(pos, {
        radius: this.radius * level,
        color,
        weight: 0,
        fillColor: color,
        fillOpacity: 0.15 + level * 0.25,
        className: "encounter-heat"
      });

      this.layer.addLayer(circle);
    }
  };

  Game.modules.encounterHeatmap = heatmap;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      heatmap.init();
    } catch (e) {
      console.error("encounterHeatmap: init failed", e);
    }
  });
})();
