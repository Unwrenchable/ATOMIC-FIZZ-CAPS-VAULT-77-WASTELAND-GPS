(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const trailModule = {
    trailLayer: null,
    lastPos: null,
    minDistance: 8, // meters between trail points
    maxPoints: 200, // auto-trim to avoid bloat
    points: [],

    init() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap) {
        console.warn("trail: worldmap not loaded yet");
        return;
      }

      // Create trail layer
      this.trailLayer = L.polyline([], {
        color: "#00ff41",
        weight: 2,
        opacity: 0.6,
        className: "pipboy-trail"
      });

      this.trailLayer.addTo(worldmap.map);

      // Patch movement
      const originalSetPos = worldmap.setPlayerPosition.bind(worldmap);

      worldmap.setPlayerPosition = (lat, lng, opts = {}) => {
        originalSetPos(lat, lng, opts);
        this.addTrailPoint(lat, lng);
      };

      console.log("trail: initialized");
    },

    addTrailPoint(lat, lng) {
      const newPoint = L.latLng(lat, lng);

      if (!this.lastPos) {
        this.lastPos = newPoint;
        this.points.push(newPoint);
        this.updateTrail();
        return;
      }

      const dist = this.lastPos.distanceTo(newPoint);
      if (dist < this.minDistance) return;

      this.lastPos = newPoint;
      this.points.push(newPoint);

      // Trim old points
      if (this.points.length > this.maxPoints) {
        this.points.splice(0, this.points.length - this.maxPoints);
      }

      this.updateTrail();
    },

    updateTrail() {
      if (!this.trailLayer) return;
      this.trailLayer.setLatLngs(this.points);
    }
  };

  Game.modules.trail = trailModule;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      trailModule.init();
    } catch (e) {
      console.error("trail: init failed", e);
    }
  });
})();
