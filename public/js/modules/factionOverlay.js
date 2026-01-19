// factionOverlay.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Faction Territory Overlay
// Visual map overlay for faction-controlled regions
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const factionOverlay = {
    layer: null,
    loaded: false,

    async init() {
      const worldmap = Game.modules.worldmap;
      if (!worldmap || !worldmap.map) {
        console.warn("factionOverlay: worldmap not ready");
        return;
      }

      // Create a custom pane BELOW POIs but ABOVE roads
      const pane = worldmap.map.createPane("factionOverlayPane");
      pane.style.zIndex = 350;
      pane.style.pointerEvents = "none";

      // Create the layer
      this.layer = L.geoJSON([], {
        pane: "factionOverlayPane",
        style: feature => this.styleForFaction(feature.properties.faction)
      }).addTo(worldmap.map);

      // Load faction region polygons
      await this.loadRegions();

      console.log("factionOverlay: initialized");
    },

    async loadRegions() {
      try {
        const res = await fetch("/data/faction_regions.json");
        const json = await res.json();

        if (!json || !Array.isArray(json.regions)) {
          console.warn("factionOverlay: invalid faction_regions.json");
          return;
        }

        json.regions.forEach(region => {
          if (!region.coords || !region.faction) return;

          const geo = {
            type: "Feature",
            properties: { faction: region.faction },
            geometry: {
              type: "Polygon",
              coordinates: [region.coords]
            }
          };

          this.layer.addData(geo);
        });

        this.loaded = true;
      } catch (e) {
        console.error("factionOverlay: failed to load faction_regions.json", e);
      }
    },

    styleForFaction(factionId) {
      // Pip‑Boy green
      const base = "#00ff41";

      // Optional: customize per faction
      const colors = {
        fizzco_remnants: base,
        iron_wastes_militia: base,
        radborne_tribes: base,
        crater_syndicate: base,
        hollow_choir: base,
        the_circuit: base,
        dustwalkers: base,
        deepwatch: base,
        free_scavs: base,
        feral_broods: base
      };

      return {
        color: colors[factionId] || base,
        weight: 2,
        opacity: 0.7,
        fillOpacity: 0.05
      };
    }
  };

  Game.modules.factionOverlay = factionOverlay;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      factionOverlay.init();
    } catch (e) {
      console.error("factionOverlay: init failed", e);
    }
  });
})();
