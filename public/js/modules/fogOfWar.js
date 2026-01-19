// fogOfWar.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Fog of War Module
// Darkens unexplored map areas and reveals around the player
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const fogModule = {
    fogPane: null,
    fogLayer: null,
    revealLayer: null,
    revealed: [],
    revealRadius: 500, // meters
    lastPos: null,

    init() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.map) {
        console.warn("fogOfWar: worldmap not ready");
        return;
      }

      // Create fog pane
      this.fogPane = worldmap.map.createPane("fogPane");
      this.fogPane.style.zIndex = 600;
      this.fogPane.style.pointerEvents = "none";

      // Full fog overlay
      this.fogLayer = L.rectangle(worldmap.map.getBounds(), {
        pane: "fogPane",
        color: "#000",
        weight: 0,
        fillOpacity: 0.75
      }).addTo(worldmap.map);

      // Reveal layer (mask)
      this.revealLayer = L.geoJSON([], {
        pane: "fogPane",
        style: {
          color: "#000",
          weight: 0,
          fillOpacity: 0,
          className: "fog-reveal"
        }
      }).addTo(worldmap.map);

      this.injectStyles();
      this.patchMovement(worldmap);

      console.log("fogOfWar: initialized");
    },

    injectStyles() {
      const style = document.createElement("style");
      style.textContent = `
        .fog-reveal {
          mix-blend-mode: destination-out;
        }
      `;
      document.head.appendChild(style);
    },

    patchMovement(worldmap) {
      const originalSetPos = worldmap.setPlayerPosition.bind(worldmap);

      worldmap.setPlayerPosition = (lat, lng, opts = {}) => {
        originalSetPos(lat, lng, opts);
        this.reveal(lat, lng);
      };
    },

    reveal(lat, lng) {
      const newPos = L.latLng(lat, lng);

      if (this.lastPos && this.lastPos.distanceTo(newPos) < 10) return;
      this.lastPos = newPos;

      // Create reveal circle polygon using Turf.js
      const circle = turf.circle([lng, lat], this.revealRadius / 1000, {
        steps: 32,
        units: "kilometers"
      });

      this.revealed.push(circle);
      this.revealLayer.addData(circle);
    }
  };

  Game.modules.fogOfWar = fogModule;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      fogModule.init();
    } catch (e) {
      console.error("fogOfWar: init failed", e);
    }
  });
})();
