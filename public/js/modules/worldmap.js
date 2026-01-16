// public/js/modules/worldmap.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Pip-Boy World Map Module
// Esri World Imagery base layer only (no custom tiles)
// Overlays:
//   - Your own labels + roads (JSON-defined)
// Behavior:
//   - Free-look map
//   - Auto-snap back to player after idle (5s)
//   - Smooth GPS centering for travel
//   - NPC dialog auto-opens when clicking POIs with npcId/dialogId
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

    // Overlay layers
    labelLayer: null,
    roadLayer: null,
    worldLabels: [],
    worldRoads: [],

    // Auto-follow: free-look, then snap back after idle
    followTimeout: null,
    followDelay: 5000, // 5 seconds of no movement before snapping back

    init(gameState) {
      this.gs = gameState || (window.DATA || {});
      this.ensurePlayerPosition();
      this.initMap();
      this.loadLocations();
      this.loadWorldOverlays();
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

      if (typeof L === "undefined") {
        console.error("worldmap: Leaflet (L) is not available");
        return;
      }

      // Leaflet init – Pip-Boy map
      this.map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        worldCopyJump: false
      });

      // Optional: limit panning to something Earth-like
      try {
        const southWest = L.latLng(-85, -180);
        const northEast = L.latLng(85, 180);
        const bounds = L.latLngBounds(southWest, northEast);
        this.map.setMaxBounds(bounds);
      } catch (e) {
        console.warn("worldmap: failed to set max bounds", e);
      }

      // --------------------------------------------------------
      // BASE LAYER – ESRI WORLD IMAGERY ONLY
      // --------------------------------------------------------

      const esriSatelliteTiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          minZoom: 0,
          maxZoom: 19,
          noWrap: true
        }
      );

      this.tiles = { satellite: esriSatelliteTiles };

      this.ensurePlayerPosition();
      const pos = this.gs.player.position;
      const startZoom = 6; // start zoomed out a bit over Mojave
      this.map.setView([pos.lat, pos.lng], startZoom);

      esriSatelliteTiles.addTo(this.map);

      // Overlay layers
      this.labelLayer = L.layerGroup().addTo(this.map);
      this.roadLayer = L.layerGroup().addTo(this.map);

      // Auto-follow behavior
      this.enableAutoFollow();

      // Expose for debugging
      window.map = this.map;

      this.initPlayerMarker();

      console.log("worldmap: map initialized");
      window.dispatchEvent(new Event("map-ready"));

      // Ensure overlays respect current zoom
      this.updateOverlayVisibility(this.map.getZoom() || startZoom);
      this.map.on("zoomend", () => {
        this.updateOverlayVisibility(this.map.getZoom() || startZoom);
      });
    },

    // --------------------------------------------------------
    // AUTO-FOLLOW
    // --------------------------------------------------------

    enableAutoFollow() {
      if (!this.map) return;

      this.map.on("movestart", () => {
        if (this.followTimeout) {
          clearTimeout(this.followTimeout);
          this.followTimeout = null;
        }
      });

      this.map.on("moveend", () => {
        if (this.followTimeout) clearTimeout(this.followTimeout);

        this.followTimeout = setTimeout(() => {
          this.centerOnPlayer();
        }, this.followDelay);
      });
    },

    centerOnPlayer() {
      if (!this.map || !this.gs?.player?.position) return;
      const { lat, lng } = this.gs.player.position;

      try {
        this.map.panTo([lat, lng], {
          animate: true,
          duration: 1.0,
          easeLinearity: 0.25
        });
      } catch (e) {
        console.warn("worldmap: panTo failed, falling back to setView", e);
        this.map.setView([lat, lng], this.map.getZoom() || 6);
      }
    },

    // --------------------------------------------------------
    // PLAYER MARKER
    // --------------------------------------------------------

    initPlayerMarker() {
      this.ensurePlayerPosition();
      if (!this.map) return;

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

      this.centerOnPlayer();
    },

    // --------------------------------------------------------
    // WORLD OVERLAYS
    // --------------------------------------------------------

    async loadWorldOverlays() {
      // Labels
      try {
        const resLabels = await fetch("/data/world_labels.json");
        if (resLabels.ok) {
          const json = await resLabels.json();
          if (Array.isArray(json)) {
            this.worldLabels = json;
            this.renderWorldLabels();
          }
        }
      } catch (e) {
        console.error("worldmap: failed to load world_labels.json", e);
      }

      // Roads
      try {
        const resRoads = await fetch("/data/world_roads.json");
        if (resRoads.ok) {
          const json = await resRoads.json();
          if (Array.isArray(json)) {
            this.worldRoads = json;
            this.renderWorldRoads();
          }
        }
      } catch (e) {
        console.error("worldmap: failed to load world_roads.json", e);
      }

      if (this.map) {
        this.updateOverlayVisibility(this.map.getZoom() || 6);
      }
    },

    renderWorldLabels() {
      if (!this.map || !this.labelLayer) return;

      this.labelLayer.clearLayers();

      this.worldLabels.forEach(label => {
        if (typeof label.lat !== "number" || typeof label.lng !== "number") return;

        const zoomRule = this.labelZoomVisibility(label);

        const marker = L.marker([label.lat, label.lng], {
          interactive: false,
          icon: L.divIcon({
            className: `pipboy-label pipboy-label-${label.type || "generic"} ${zoomRule.className || ""}`,
            html: `<div>${label.name}</div>`
          })
        });

        marker._pipboyZoomRule = zoomRule;
        this.labelLayer.addLayer(marker);
      });
    },

    renderWorldRoads() {
      if (!this.map || !this.roadLayer) return;

      this.roadLayer.clearLayers();

      this.worldRoads.forEach(road => {
        if (!Array.isArray(road.points) || road.points.length < 2) return;

        const latlngs = road.points
          .filter(p => typeof p.lat === "number" && typeof p.lng === "number")
          .map(p => [p.lat, p.lng]);

        if (!latlngs.length) return;

        const zoomRule = this.roadZoomVisibility(road);

        const poly = L.polyline(latlngs, this.roadStyle(road));
        poly._pipboyZoomRule = zoomRule;
        this.roadLayer.addLayer(poly);
      });
    },

    labelZoomVisibility(label) {
      const importance = label.importance || 1;

      let minZoom = 10;
      if (importance >= 6) minZoom = 3;
      else if (importance >= 4) minZoom = 6;
      else if (importance >= 2) minZoom = 10;

      return {
        minZoom,
        maxZoom: 18,
        className: ""
      };
    },

    roadZoomVisibility(road) {
      const kind = road.kind || "local";
      let minZoom = 10;

      if (kind === "highway") minZoom = 6;
      if (kind === "major") minZoom = 8;
      if (kind === "local") minZoom = 12;

      return {
        minZoom,
        maxZoom: 18
      };
    },

    roadStyle(road) {
      const kind = road.kind || "local";

      if (kind === "highway") {
        return { color: "#66ff99", weight: 3, opacity: 0.9 };
      }

      if (kind === "major") {
        return { color: "#55dd88", weight: 2, opacity: 0.8 };
      }

      return { color: "#44bb66", weight: 1.5, opacity: 0.7 };
    },

    updateOverlayVisibility(zoom) {
      if (!this.map) return;
      const z = typeof zoom === "number" ? zoom : this.map.getZoom() || 6;

      if (this.labelLayer) {
        this.labelLayer.eachLayer(layer => {
          const rule = layer._pipboyZoomRule;
          if (!rule) return;
          const visible = z >= rule.minZoom && z <= (rule.maxZoom || 18);
          if (visible) {
            if (!this.map.hasLayer(layer)) this.map.addLayer(layer);
          } else {
            if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
          }
        });
      }

      if (this.roadLayer) {
        this.roadLayer.eachLayer(layer => {
          const rule = layer._pipboyZoomRule;
          if (!rule) return;
          const visible = z >= rule.minZoom && z <= (rule.maxZoom || 18);
          if (visible) {
            if (!this.map.hasLayer(layer)) this.map.addLayer(layer);
          } else {
            if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
          }
        });
      }
    },

    // --------------------------------------------------------
    // LOCATION LOADING + MARKERS
    // --------------------------------------------------------

    async loadLocations() {
      if (this.locationsLoaded) return;

      try {
        const res = await fetch("/data/locations.json");
        if (!res.ok) {
          console.warn("worldmap: HTTP error loading /data/locations.json:", res.status);
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
    // LOCATION INTERACTION / NPC DIALOG INTEGRATION
    // --------------------------------------------------------

    async onLocationClick(loc) {
      this.setPlayerPosition(loc.lat, loc.lng);

      // ⭐ NARRATIVE HOOK — auto-open dialog if POI has an NPC
      if (loc.npcId && Game.modules?.narrative) {
        try {
          Game.modules.narrative.openForNpc(loc.npcId);
          return; // dialog takes over
        } catch (e) {
          console.error("worldmap: failed to open NPC dialog:", e);
        }
      }

      // ⭐ Direct dialogId support
      if (loc.dialogId && Game.modules?.narrative) {
        try {
          Game.modules.narrative.openByDialogId(loc.dialogId);
          return;
        } catch (e) {
          console.error("worldmap: failed to open dialog by id:", e);
        }
      }

      // Overseer POI hook
      if (window.Game?.overseer?.onPOIVisit) {
        try {
          Game.overseer.onPOIVisit(loc);
        } catch (e) {
          console.error("worldmap: overseer onPOIVisit failed:", e);
        }
      }

      // Weather system
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

      // Encounter system
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
                damage: 5
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
    // QUEST SUPPORT
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
      const R = 6371000;
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
      this.initMap();
      this.initPlayerMarker();
      this.renderPOIMarkers();
      this.renderWorldLabels();
      this.renderWorldRoads();

      if (this.map) {
        setTimeout(() => {
          this.map.invalidateSize();
          this.ensurePlayerPosition();
          const pos = this.gs.player.position;
          this.map.setView([pos.lat, pos.lng], this.map.getZoom() || 6);
          this.updateOverlayVisibility(this.map.getZoom() || 6);
        }, 50);
      }
    }
  };

  Game.modules.worldmap = worldmapModule;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      worldmapModule.init(window.DATA || {});
    } catch (e) {
      console.error("worldmap: auto-init failed:", e);
    }
  });
})();
