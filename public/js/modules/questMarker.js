// questMarker.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Quest Marker Module
// Shows a glowing marker for the active quest objective
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const questMarker = {
    marker: null,
    currentObjective: null,

    init() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.map) {
        console.warn("questMarker: worldmap not ready");
        return;
      }

      // Create marker layer
      this.marker = L.circleMarker([0, 0], {
        radius: 12,
        color: "#00ff41",
        weight: 3,
        fillColor: "#00ff41",
        fillOpacity: 0.25,
        className: "quest-marker"
      });

      this.injectStyles();

      // Patch quest updates
      const quest = Game.modules.world?.quest;
      if (quest && quest.onObjectiveChange) {
        const original = quest.onObjectiveChange.bind(quest);

        quest.onObjectiveChange = (obj) => {
          original(obj);
          this.updateObjective(obj);
        };
      }

      console.log("questMarker: initialized");
    },

    injectStyles() {
      const style = document.createElement("style");
      style.textContent = `
        .quest-marker {
          animation: questPulse 2s infinite ease-in-out;
        }

        @keyframes questPulse {
          0% { r: 10; opacity: 0.4; }
          50% { r: 14; opacity: 0.8; }
          100% { r: 10; opacity: 0.4; }
        }
      `;
      document.head.appendChild(style);
    },

    updateObjective(obj) {
      const worldmap = Game.modules.worldmap;
      if (!obj || !obj.lat || !obj.lng) {
        this.removeMarker();
        return;
      }

      this.currentObjective = obj;

      this.marker.setLatLng([obj.lat, obj.lng]);
      this.marker.addTo(worldmap.map);
    },

    removeMarker() {
      const worldmap = Game.modules.worldmap;
      if (worldmap && worldmap.map && this.marker) {
        worldmap.map.removeLayer(this.marker);
      }
    }
  };

  Game.modules.questMarker = questMarker;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      questMarker.init();
    } catch (e) {
      console.error("questMarker: init failed", e);
    }
  });
})();
