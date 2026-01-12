// public/js/modules/worldmap.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Pip-Boy World Map Module
// Dual tiles: overview (custom) + Esri World Imagery (high-zoom)
// Overlay: your own labels + roads (JSON-defined)
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

      // Leaflet init – Pip-Boy map
      this.map = L.map(container, {
        zoomControl: false,
        attributionControl: false
      });

      // --------------------------------------------------------
      // BASE LAYERS
      // 1) Custom overview tiles (low zoom, Fallout-style)
      // 2) Esri World Imagery (high zoom, real satellite)
      // --------------------------------------------------------

      const overviewTiles = L.tileLayer("/tiles/world_overview/{z}/{x}/{y}.png", {
        minZoom: 0,
        maxZoom: 4,
        noWrap: true
      });

      const esriSatelliteTiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          minZoom: 4,
          maxZoom: 18,
          noWrap: true
        }
      );

      this.tiles = { overview: overviewTiles, satellite: esriSatelliteTiles };

      const pos = this.gs.player.position;
      const startZoom = 6; // start high enough to see real detail
      this.map.setView([pos.lat, pos.lng], startZoom);

      overviewTiles.addTo(this.map);
      esriSatelliteTiles.addTo(this.map);

      const updateBaseLayerForZoom = () => {
        const z = this.map.getZoom();

        // At low zoom, use your custom overview map
        if (z <= 4) {
          if (!this.map.hasLayer(overviewTiles)) this.map.addLayer(overviewTiles);
          if (this.map.hasLayer(esriSatelliteTiles)) this.map.removeLayer(esriSatelliteTiles);
        } else {
          // At higher zoom, use Esri satellite
          if (!this.map.hasLayer(esriSatelliteTiles)) this.map.addLayer(esriSatelliteTiles);
          if (this.map.hasLayer(overviewTiles)) this.map.removeLayer(overviewTiles);
        }

        this.updateOverlayVisibility(z);
      };

      this.map.on("zoomend", updateBaseLayerForZoom);
      updateBaseLayerForZoom();

      // Overlay layers (labels + roads)
      this.labelLayer = L.layerGroup().addTo(this.map);
      this.roadLayer = L.layerGroup().addTo(this.map);

      // Expose for other modules
      window.map = this.map;

      this.initPlayerMarker();

      // Map ready event
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
    // WORLD OVERLAYS (LABELS + ROADS)
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
          } else {
            console.warn("worldmap: world_labels.json not array");
          }
        } else {
          console.warn("worldmap: no /data/world_labels.json (ok if not yet created)");
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
          } else {
            console.warn("worldmap: world_roads.json not array");
          }
        } else {
          console.warn("worldmap: no /data/world_roads.json (ok if not yet created)");
        }
      } catch (e) {
        console.error("worldmap: failed to load world_roads.json", e);
      }

      if (this.map) {
        this.updateOverlayVisibility(this.map.getZoom());
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

      // Higher importance appears sooner (lower zoom)
      let minZoom = 10;
      if (importance >= 6) minZoom = 3;  // big regions
      else if (importance >= 4) minZoom = 6; // major cities
      else if (importance >= 2) minZoom = 10; // minor locations

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
        return {
          color: "#66ff99",
          weight: 3,
          opacity: 0.9
        };
      }

      if (kind === "major") {
        return {
          color: "#55dd88",
          weight: 2,
          opacity: 0.8
        };
      }

      return {
        color: "#44bb66",
        weight: 1.5,
        opacity: 0.7
      };
    },

    updateOverlayVisibility(zoom) {
      if (!this.map) return;

      // Labels
      if (this.labelLayer) {
        this.labelLayer.eachLayer(layer => {
          const rule = layer._pipboyZoomRule;
          if (!rule) return;
          const visible = zoom >= rule.minZoom && zoom <= (rule.maxZoom || 18);
          if (visible) {
            if (!this.map.hasLayer(layer)) this.map.addLayer(layer);
          } else {
            if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
          }
        });
      }

      // Roads
      if (this.roadLayer) {
        this.roadLayer.eachLayer(layer => {
          const rule = layer._pipboyZoomRule;
          if (!rule) return;
          const visible = zoom >= rule.minZoom && zoom <= (rule.maxZoom || 18);
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
    // LOCATION INTERACTION / ENCOUNTERS
    // --------------------------------------------------------

    async onLocationClick(loc) {
      this.setPlayerPosition(loc.lat, loc.lng);

      if (window.Game?.overseer?.onPOIVisit) {
        try {
          Game.overseer.onPOIVisit(loc);
        } catch (e) {
          console.error("worldmap: overseer onPOIVisit failed:", e);
        }
      }

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
          this.map.setView([pos.lat, pos.lng], this.map.getZoom());
          this.updateOverlayVisibility(this.map.getZoom());
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
