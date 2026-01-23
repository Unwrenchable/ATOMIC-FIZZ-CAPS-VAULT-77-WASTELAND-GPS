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

    // ------------------------------------------------------------
    // INIT
    // ------------------------------------------------------------
    init() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.map) {
        console.warn("fogOfWar: worldmap not ready");
        return;
      }

      // Create fog pane - z-index below weather (450) so weather effects show above fog
      this.fogPane = worldmap.map.createPane("fogPane");
      this.fogPane.style.zIndex = 420;
      this.fogPane.style.pointerEvents = "none";

      // Full fog overlay - reduced opacity from 0.75 to 0.55 for better visibility
      this.fogLayer = L.rectangle(worldmap.map.getBounds(), {
        pane: "fogPane",
        color: "#000",
        weight: 0,
        fillOpacity: 0.55
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

      // Load saved exploration
      this.revealed = this.loadState();
      this.revealed.forEach(poly => this.revealLayer.addData(poly));

      this.injectStyles();
      this.patchMovement(worldmap);

      console.log("fogOfWar: initialized");
    },

    // ------------------------------------------------------------
    // CSS
    // ------------------------------------------------------------
    injectStyles() {
      const style = document.createElement("style");
      style.textContent = `
        .fog-reveal {
          mix-blend-mode: destination-out;
        }
      `;
      document.head.appendChild(style);
    },

    // ------------------------------------------------------------
    // MOVEMENT HOOK
    // ------------------------------------------------------------
    patchMovement(worldmap) {
      const originalSetPos = worldmap.setPlayerPosition.bind(worldmap);

      worldmap.setPlayerPosition = (lat, lng, opts = {}) => {
        originalSetPos(lat, lng, opts);
        this.reveal(lat, lng);
      };
    },

    // ------------------------------------------------------------
    // REVEAL AREA
    // ------------------------------------------------------------
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

      // Save to localStorage
      this.saveState();
    },

    // ------------------------------------------------------------
    // PERSISTENCE
    // ------------------------------------------------------------
    saveState() {
      try {
        const json = JSON.stringify(this.revealed);
        localStorage.setItem("fow_revealed_v1", json);
      } catch (e) {
        console.warn("fogOfWar: failed to save state", e);
      }
    },

    loadState() {
      try {
        const raw = localStorage.getItem("fow_revealed_v1");
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      } catch (e) {
        console.warn("fogOfWar: failed to load state", e);
        return [];
      }
    }
  };

  Game.modules.fogOfWar = fogModule;

  // Wait for map-ready event instead of DOMContentLoaded
  // This ensures the map exists before we try to create fog overlay
  window.addEventListener("map-ready", () => {
    // Small delay to ensure map is fully initialized
    setTimeout(() => {
      try {
        fogModule.init();
      } catch (e) {
        console.error("fogOfWar: init failed", e);
      }
    }, 700);
  });
  
  // Fallback: also try on DOMContentLoaded with a longer delay
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (!fogModule.fogPane) {
        try {
          fogModule.init();
        } catch (e) {
          console.error("fogOfWar: fallback init failed", e);
        }
      }
    }, 3000);
  });
})();
