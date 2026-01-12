// public/js/modules/worldmap.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Pip-Boy World Map Module (Resurrected)
// New Vegas style: green CRT UI over real-world tiles
// Integrates with Game.modules.world, quests, battle, inventory
// Uses #mapContainer inside Pip-Boy MAP panel
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const worldmapModule = {
    gs: null,
    map: null,
    tiles: null,
    playerMarker: null,
    poiMarkers: [],
    locations: [],
    locationsLoaded: false,

    init(gameState) {
      this.gs = gameState || (window.DATA || {});
      this.ensurePlayerPosition();
      this.initMap();
      this.loadLocations();
    },

    ensurePlayerPosition() {
      if (!this.gs.player) this.gs.player = {};
      if (!this.gs.player.position) {
        // Default to Mojave / Vegas strip if no position yet
        this.gs.player.position = {
          lat: 36.11274,
          lng: -115.174301
        };
      }
    },

    initMap() {
      if (this.map) return;

      const container = document.getElementById("mapContainer");
      if (!container) {
        console.warn("worldmap: #mapContainer not found");
        return;
      }

      // Leaflet init – can replace tiles with MapTiler later
      this.map = L.map(container, {
        zoomControl: false,
        attributionControl: false
      });

      this.tiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",

        {
          maxZoom: 18,
          minZoom: 2
        }
      ).addTo(this.map);

      const pos = this.gs.player.position;
      this.map.setView([pos.lat, pos.lng], 12);

      // Expose to window so main.js can attach and update markers
      window.map = this.map;

      this.initPlayerMarker();

      // Let main.js know map is ready
      window.dispatchEvent(new Event("map-ready"));
    },

    initPlayerMarker() {
      this.ensurePlayerPosition();
      const pos = this.gs.player.position;

      if (this.playerMarker) {
        this.playerMarker.setLatLng([pos.lat, pos.lng]);
        return;
      }

      const marker = L.circleMarker([pos.lat, pos.lng], {
        radius: 8,
        color: "#00ff66",
        fillColor: "#00ff66",
        fillOpacity: 0.8
      });

      this.playerMarker = marker.addTo(this.map);
    },

    setPlayerPosition(lat, lng) {
      if (!this.gs.player) this.gs.player = {};
      this.gs.player.position = { lat, lng };

      if (this.playerMarker) {
        this.playerMarker.setLatLng([lat, lng]);
      }
      if (this.map) {
        this.map.setView([lat, lng], this.map.getZoom());
      }
    },

    // --------------------------------------------------------
    // LOCATION LOADING + MARKERS
    // --------------------------------------------------------

    async loadLocations() {
      if (this.locationsLoaded) return;

      try {
        // Your locations live under /data/locations.json
        const res = await fetch("/data/locations.json");
        if (!res.ok) {
          console.error("worldmap: HTTP error loading /data/locations.json:", res.status);
          return;
        }

        const json = await res.json();
        if (!Array.isArray(json)) {
          console.error("worldmap: expected array in locations.json");
          return;
        }

        this.locations = json;
        this.locationsLoaded = true;
        this.renderPOIMarkers();

        console.log(`worldmap: loaded ${this.locations.length} locations`);
      } catch (e) {
        console.error("worldmap: failed to load locations.json", e);
      }
    },

    renderPOIMarkers() {
      if (!this.map || !this.locationsLoaded) return;

      // Clear old markers
      this.poiMarkers.forEach(m => this.map.removeLayer(m.marker || m));
      this.poiMarkers = [];

      this.locations.forEach((loc, idx) => {
        if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return;
        const marker = this.createPOIMarker(loc, idx);
        marker.addTo(this.map);
        this.poiMarkers.push({ marker, loc });
      });
    },

    createPOIMarker(loc, idx) {
      const rarity = loc.rarity || "common";

      // Use Pip-Boy marker classes (styled in pipboy.css)
      const iconHtml = `
        <div class="pipboy-marker">
          <div class="pipboy-marker-dot ${rarity === "epic" ? "epic" : ""} ${rarity === "legendary" ? "legendary" : ""}"></div>
        </div>
      `;

      const icon = L.divIcon({
        className: "pipboy-marker-icon",
        html: iconHtml,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon });

      marker.on("click", () => {
        this.onLocationClick(loc, idx);
      });

      const name = loc.n || loc.name || loc.id || `POI ${idx + 1}`;
      const level = loc.lvl || 1;

      marker.bindTooltip(
        `${name} (Lv ${level}, ${rarity})`,
        { permanent: false, direction: "top", className: "pipboy-tooltip" }
      );

      return marker;
    },

    // --------------------------------------------------------
    // LOCATION INTERACTION / ENCOUNTERS
    // --------------------------------------------------------

    async onLocationClick(loc) {
      // Move player to this location
      this.setPlayerPosition(loc.lat, loc.lng);

      // Notify Overseer, if present
      if (window.Game?.overseer?.onPOIVisit) {
        try {
          Game.overseer.onPOIVisit(loc);
        } catch (e) {
          console.error("worldmap: overseer onPOIVisit failed:", e);
        }
      }

      // Get weather from world module
      let weather = null;
      if (Game.modules.world && Game.modules.world.weather) {
        try {
          weather = Game.modules.world.weather.at(
            Game.modules.world.state || this.gs.worldState || this.gs,
            {
              biome: loc.biome || "temperate_forest",
              continent: loc.continent || "north_america"
            }
          );
        } catch (e) {
          console.error("worldmap: weather lookup failed:", e);
        }
      }

      // Roll encounter using world module if available
      let encounterResult = null;
      if (Game.modules.world && Game.modules.world.encounters) {
        try {
          const worldState = Game.modules.world.state || this.gs.worldState || this.gs;
          const locationForWorld = {
            id: loc.id || `loc_${loc.n}_${loc.lat}_${loc.lng}`,
            name: loc.n || loc.name || "Unknown Location",
            lvl: loc.lvl || 1,
            biome: loc.biome || "temperate_forest",
            type: loc.type || "poi",
            faction: loc.faction || "free_scavs"
          };

          encounterResult = Game.modules.world.encounters.roll(
            worldState,
            locationForWorld
          );
        } catch (e) {
          console.error("worldmap: encounter roll failed:", e);
        }
      }

      this.handleEncounterResult(encounterResult, loc);
    },

    handleEncounterResult(result, loc) {
      const name = loc.n || loc.name || "this location";

      if (!result || result.type === "none") {
        this.showMapMessage(`You arrive at ${name}. The wastes are quiet... for now.`);
        return;
      }

      switch (result.type) {
        case "combat":
          this.showMapMessage(`Hostiles near ${name}!`);
          if (Game.modules.battle) {
            const encounter = {
              id: `encounter_${name}_${Date.now()}`,
              enemies: (result.enemies?.list || []).map(id => ({
                id,
                damage: 5 // placeholder; your enemy system can enrich it
              })),
              rewards: result.rewards || {}
            };
            Game.modules.battle.start(encounter);
          }
          break;

        case "merchant":
          this.showMapMessage(`A merchant caravan has appeared near ${name}.`);
          break;

        case "boss":
          this.showMapMessage(`You sense a powerful presence at ${name}...`);
          break;

        case "event":
          this.showMapMessage(result.event?.description || `Something strange happens near ${name}.`);
          break;

        case "ambient":
          this.showMapMessage(result.description || `The air feels heavy around ${name}.`);
          break;

        default:
          this.showMapMessage(`You arrive at ${name}.`);
      }
    },

    showMapMessage(text) {
      const log = document.getElementById("mapLog");
      if (!log) return;
      const line = document.createElement("div");
      line.textContent = text;
      log.prepend(line);
    },

    // --------------------------------------------------------
    // QUEST SUPPORT: getNearbyPOIs(radiusMeters)
    // --------------------------------------------------------

    getNearbyPOIs(radiusMeters) {
      this.ensurePlayerPosition();
      const pos = this.gs.player.position;
      const radius = radiusMeters || 500;

      if (!this.locationsLoaded) return [];

      return this.locations
        .map(loc => {
          const d = this.distanceMeters(pos.lat, pos.lng, loc.lat, loc.lng);
          return { poi: loc, distance: d };
        })
        .filter(entry => entry.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
    },

    distanceMeters(lat1, lon1, lat2, lon2) {
      const R = 6371000; // meters
      const toRad = deg => (deg * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },

    // --------------------------------------------------------
    // UI HOOK (called when MAP tab opens, if you want)
    // --------------------------------------------------------

    onOpen() {
      this.initMap();
      this.initPlayerMarker();
      this.renderPOIMarkers();

      if (this.map) {
        setTimeout(() => {
          this.map.invalidateSize();
          this.ensurePlayerPosition();
          const pos = this.gs.player.position;
          this.map.setView([pos.lat, pos.lng], this.map.getZoom());
        }, 50);
      }
    }
  };

  Game.modules.worldmap = worldmapModule;

  // Optional: auto-init when script loads, using global DATA
  document.addEventListener("DOMContentLoaded", () => {
    try {
      worldmapModule.init(window.DATA || {});
    } catch (e) {
      console.error("worldmap: auto-init failed:", e);
    }
  });
})();
