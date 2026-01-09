// worldmap.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Pip-Boy World Map Module (Resurrected)
// New Vegas style: green CRT UI over real-world tiles
// Integrates with Game.modules.world, quests, battle, inventory
// ------------------------------------------------------------

(function () {
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
      this.gs = gameState;
      this.ensurePlayerPosition();
      this.initMap();
      this.loadLocations();
    },

    ensurePlayerPosition() {
      if (!this.gs.player) this.gs.player = {};
      if (!this.gs.player.position) {
        // Default to New Vegas Strip if no position yet
        this.gs.player.position = {
          lat: 36.11274,
          lng: -115.174301
        };
      }
    },

    initMap() {
      if (this.map) return;

      const container = document.getElementById("map");
      if (!container) {
        console.warn("worldmap: #map container not found");
        return;
      }

      // Basic Leaflet init – you can replace with your MapTiler tiles
      this.map = L.map(container, {
        zoomControl: false,
        attributionControl: false
      });

      this.tiles = L.tileLayer(
        // TODO: replace with your MapTiler URL
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 18,
          minZoom: 2
        }
      ).addTo(this.map);

      const pos = this.gs.player.position;
      this.map.setView([pos.lat, pos.lng], 7);

      this.initPlayerMarker();
      this.applyCRTTheme();
    },

    applyCRTTheme() {
      const container = document.getElementById("mapPanel");
      if (!container) return;
      container.classList.add("pipboy-map", "pipboy-green");
      // You can style .pipboy-map, .pipboy-green in CSS:
      // - green tint overlay
      // - scanlines
      // - Pip-Boy frame, etc.
    },

    initPlayerMarker() {
      const pos = this.gs.player.position;

      if (this.playerMarker) {
        this.playerMarker.setLatLng([pos.lat, pos.lng]);
        return;
      }

      const playerIcon = L.divIcon({
        className: "pipboy-player-marker",
        html: "▲",
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      this.playerMarker = L.marker([pos.lat, pos.lng], {
        icon: playerIcon
      }).addTo(this.map);
    },

    setPlayerPosition(lat, lng) {
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
        // Adjust path to wherever locations.json actually lives
        const res = await fetch("locations.json");
        this.locations = await res.json();
        this.locationsLoaded = true;
        this.renderPOIMarkers();
      } catch (e) {
        console.error("worldmap: failed to load locations.json", e);
      }
    },

    renderPOIMarkers() {
      if (!this.map || !this.locationsLoaded) return;

      // Clear old markers
      this.poiMarkers.forEach(m => this.map.removeLayer(m));
      this.poiMarkers = [];

      this.locations.forEach((loc, idx) => {
        const marker = this.createPOIMarker(loc, idx);
        marker.addTo(this.map);
        this.poiMarkers.push({ marker, loc });
      });
    },

    createPOIMarker(loc, idx) {
      const rarity = loc.rarity || "common";

      const icon = L.divIcon({
        className: `pipboy-poi-marker rarity-${rarity}`,
        html: this.getMarkerGlyphFor(loc),
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon });

      marker.on("click", () => {
        this.onLocationClick(loc, idx);
      });

      marker.bindTooltip(
        `${loc.n} (Lv ${loc.lvl || 1}, ${rarity})`,
        { permanent: false, direction: "top", className: "pipboy-tooltip" }
      );

      return marker;
    },

    getMarkerGlyphFor(loc) {
      // You can get fancier with types later; for now use rarity
      switch (loc.rarity) {
        case "legendary": return "✶"; // star
        case "epic": return "◆";
        case "rare": return "⬤";
        default: return "·";
      }
    },

    // --------------------------------------------------------
    // LOCATION INTERACTION / ENCOUNTERS
    // --------------------------------------------------------

    async onLocationClick(loc) {
      // Move player to this location
      this.setPlayerPosition(loc.lat, loc.lng);

      // Get weather from world module
      let weather = null;
      if (Game.modules.world && Game.modules.world.weather) {
        weather = Game.modules.world.weather.at(
          Game.modules.world.state || this.gs.worldState || this.gs,
          {
            biome: loc.biome || "temperate_forest",
            continent: loc.continent || "north_america"
          }
        );
      }

      // Roll encounter using world module if available
      let encounterResult = null;
      if (Game.modules.world && Game.modules.world.encounters) {
        const worldState = Game.modules.world.state || this.gs.worldState || this.gs;
        const locationForWorld = {
          id: loc.id || `loc_${loc.n}_${loc.lat}_${loc.lng}`,
          name: loc.n,
          lvl: loc.lvl || 1,
          biome: loc.biome || "temperate_forest",
          type: loc.type || "poi",
          faction: loc.faction || "free_scavs"
        };

        encounterResult = Game.modules.world.encounters.roll(
          worldState,
          locationForWorld
        );
      }

      this.handleEncounterResult(encounterResult, loc);
    },

    handleEncounterResult(result, loc) {
      if (!result || result.type === "none") {
        this.showMapMessage(`You arrive at ${loc.n}. The wastes are quiet... for now.`);
        return;
      }

      switch (result.type) {
        case "combat":
          this.showMapMessage(`Hostiles near ${loc.n}!`);
          if (Game.modules.battle) {
            // Basic mapping: wrap enemies into the format battle module expects
            const encounter = {
              id: `encounter_${loc.n}_${Date.now()}`,
              enemies: (result.enemies.list || []).map(id => ({
                id,
                damage: 5 // default; your enemy system can enrich this later
              })),
              rewards: result.rewards || {}
            };
            Game.modules.battle.start(encounter);
          }
          break;

        case "merchant":
          this.showMapMessage(`A merchant caravan has appeared near ${loc.n}.`);
          // Later: open merchant UI, use Game.modules.world.merchants.inventory
          break;

        case "boss":
          this.showMapMessage(`You sense a powerful presence at ${loc.n}...`);
          // Hook into boss UI / battle later
          break;

        case "event":
          this.showMapMessage(result.event?.description || `Something strange happens near ${loc.n}.`);
          break;

        case "ambient":
          this.showMapMessage(result.description || `The air feels heavy around ${loc.n}.`);
          break;

        default:
          this.showMapMessage(`You arrive at ${loc.n}.`);
      }
    },

    showMapMessage(text) {
      // Simple Pip-Boy style log area (optional)
      let log = document.getElementById("mapLog");
      if (!log) return;
      const line = document.createElement("div");
      line.textContent = text;
      log.prepend(line);
    },

    // --------------------------------------------------------
    // QUEST SUPPORT: getNearbyPOIs(radiusMeters)
    // Used by your quests module already
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
    // UI HOOK
    // --------------------------------------------------------

    onOpen() {
      // Called when the Pip-Boy Map tab is opened
      this.initMap();
      this.initPlayerMarker();
      this.renderPOIMarkers();

      if (this.map) {
        setTimeout(() => {
          this.map.invalidateSize();
          const pos = this.gs.player.position;
          this.map.setView([pos.lat, pos.lng], this.map.getZoom());
        }, 50);
      }
    }
  };

  Game.modules.worldmap = worldmapModule;
})();
