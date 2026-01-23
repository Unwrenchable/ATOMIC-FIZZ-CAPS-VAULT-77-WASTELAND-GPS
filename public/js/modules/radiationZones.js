// radiationZones.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Radiation Zone Overlay
// Visual green haze over high-radiation regions
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const radZones = {
    layer: null,
    loaded: false,

    async init() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.map) {
        console.warn("radiationZones: worldmap not ready");
        return;
      }

      // Create pane BELOW fog but ABOVE faction borders
      const pane = worldmap.map.createPane("radZonePane");
      pane.style.zIndex = 500;
      pane.style.pointerEvents = "none";

      this.layer = L.geoJSON([], {
        pane: "radZonePane",
        style: () => ({
          color: "#00ff41",
          weight: 1,
          opacity: 0.4,
          fillColor: "#00ff41",
          fillOpacity: 0.15,
          className: "rad-zone"
        })
      }).addTo(worldmap.map);

      this.injectStyles();
      await this.loadZones();

      console.log("radiationZones: initialized");
    },

    injectStyles() {
      const style = document.createElement("style");
      style.textContent = `
        .rad-zone {
          animation: radPulse 4s infinite ease-in-out;
        }

        @keyframes radPulse {
          0% { fill-opacity: 0.10; }
          50% { fill-opacity: 0.20; }
          100% { fill-opacity: 0.10; }
        }
      `;
      document.head.appendChild(style);
    },

    async loadZones() {
      try {
        const res = await fetch("/data/radiation_zones.json");
        const json = await res.json();

        if (!json || !Array.isArray(json.zones)) {
          console.warn("radiationZones: invalid radiation_zones.json");
          return;
        }

        json.zones.forEach(zone => {
          if (!zone.coords) return;

          const geo = {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [zone.coords]
            }
          };

          this.layer.addData(geo);
        });

        this.loaded = true;
      } catch (e) {
        console.error("radiationZones: failed to load radiation_zones.json", e);
      }
    }
  };

  Game.modules.radiationZones = radZones;

  // Wait for map-ready event instead of DOMContentLoaded
  // This ensures the map pane exists before we try to create radiation zone overlays
  window.addEventListener("map-ready", () => {
    // Small delay to ensure map is fully initialized
    setTimeout(() => {
      try {
        radZones.init();
      } catch (e) {
        console.error("radiationZones: init failed", e);
      }
    }, 600);
  });
  
  // Fallback: also try on DOMContentLoaded with a longer delay
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (!radZones.loaded) {
        try {
          radZones.init();
        } catch (e) {
          console.error("radiationZones: fallback init failed", e);
        }
      }
    }, 2500);
  });
})();
