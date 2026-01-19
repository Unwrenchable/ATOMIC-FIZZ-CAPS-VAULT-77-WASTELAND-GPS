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

    // Auto-follow state
    autoFollowEnabled: true,
    followTimeout: null,
    followDelay: 5000,

    // --------------------------------------------------------
    // PUBLIC API
    // --------------------------------------------------------
    init(gameState) {
      this.gs = gameState || window.DATA || {};
      if (!this.gs) this.gs = {};

      this.ensurePlayerPosition();
      this.initMap();
      this.loadLocations();
      this.loadWorldOverlays();
    },

    onOpen() {
      try {
        if (!this.map) {
          console.warn("worldmap: map not initialized yet, calling init()");
          this.init(window.gameState || window.DATA || {});
        }

        if (!this.locationsLoaded) {
          this.loadLocations().catch(err =>
            console.warn("worldmap: loadLocations onOpen failed", err)
          );
        } else {
          this.renderPOIMarkers();
        }

        this.ensurePlayerPosition();
        this.initPlayerMarker();
        this.centerOnPlayer(true);

        this.renderWorldLabels();
        this.renderWorldRoads();

        if (this.map) {
          setTimeout(() => {
            try {
              this.map.invalidateSize();
              this.ensurePlayerPosition();
              const pos = this.gs.player.position;
              this.map.setView([pos.lat, pos.lng], this.map.getZoom() || 6);
              this.updateOverlayVisibility(this.map.getZoom() || 6);
            } catch (e) {
              console.warn("worldmap: onOpen view update failed", e);
            }
          }, 50);
        }
      } catch (e) {
        console.error("worldmap: onOpen failed", e);
      }
    },

    // --------------------------------------------------------
    // SAFE PLAYER POSITION
    // --------------------------------------------------------
    ensurePlayerPosition() {
      if (!this.gs) this.gs = {};
      if (!this.gs.player || typeof this.gs.player !== "object") {
        this.gs.player = {};
      }

      const pos = this.gs.player.position;
      if (!pos || typeof pos.lat !== "number" || typeof pos.lng !== "number") {
        this.gs.player.position = {
          lat: 36.11274,
          lng: -115.174301
        };
      }
    },

    // --------------------------------------------------------
    // MAP INITIALIZATION
    // --------------------------------------------------------
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

      this.map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        worldCopyJump: false
      });

      try {
        const southWest = L.latLng(-85, -180);
        const northEast = L.latLng(85, 180);
        this.map.setMaxBounds(L.latLngBounds(southWest, northEast));
      } catch (e) {
        console.warn("worldmap: failed to set max bounds", e);
      }

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
      const startZoom = 6;

      try {
        this.map.setView([pos.lat, pos.lng], startZoom);
      } catch (e) {
        console.warn("worldmap: setView failed", e);
      }

      esriSatelliteTiles.addTo(this.map);

      this.labelLayer = L.layerGroup().addTo(this.map);
      this.roadLayer = L.layerGroup().addTo(this.map);
      const map = L.map("map").setView([36.1, -115.1], 7);
      // Load POIs
      fetch("/data/poi.json")
     .then(r => r.json())
     .then(pois => {
      pois.forEach(poi => {
      L.marker([poi.lat, poi.lng])
        .bindPopup(`<b>${poi.name}</b>`)
        .addTo(map);
        });
        });
      // Load POIs with custom SVG icons
      fetch("/data/poi.json")
      .then(r => r.json())
      .then(pois => {
       pois.forEach(poi => {
       const icon = L.icon({
        iconUrl: `/img/icons/${poi.icon}.svg`,
        iconSize: [24, 24],      // adjust if needed
        iconAnchor: [12, 12],    // center the icon
        popupAnchor: [0, -12]
       });

      L.marker([poi.lat, poi.lng], { icon })
        .bindPopup(`<b>${poi.name}</b>`)
        .addTo(map);
     });
     });
     map.setMinZoom(5);
     map.setMaxZoom(14);
     map.setMaxBounds([
     [49.5, -125],   // top-left
     [31, -102]      // bottom-right
     ]);
     const map = L.map("map").setView([36.1, -115.1], 7);
      // Player marker (static for now)
     const playerIcon = L.icon({
     iconUrl: "/img/icons/player.svg",   // your SVG
     iconSize: [28, 28],
     iconAnchor: [14, 14]
     });

// Starting position (can be anywhere you want)
const playerLatLng = [36.1699, -115.1398]; // Vegas for now

const playerMarker = L.marker(playerLatLng, { icon: playerIcon }).addTo(map);


      // --------------------------------------------------------
      // LOAD VECTOR ROADS (roads.json)
      // --------------------------------------------------------
      fetch("/data/roads.json")
        .then(res => res.json())
        .then(data => {
          if (!data || !Array.isArray(data.roads)) return;
          data.roads.forEach(road => {
            const poly = L.polyline(road.coords, {
              color: "#00ff41",
              weight: 2.5,
              opacity: 0.9,
              lineJoin: "round",
              lineCap: "round",
              className: "pipboy-road"
            });
            poly.addTo(this.roadLayer);
          });
        })
        .catch(err => console.warn("worldmap: failed to load roads.json", err));

      // Auto-follow
      this.enableAutoFollow();

      window.map = this.map;
      this.initPlayerMarker();

      console.log("worldmap: map initialized");
      window.dispatchEvent(new Event("map-ready"));

      const currentZoom = this.map.getZoom() || startZoom;
      this.updateOverlayVisibility(currentZoom);
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
        this.autoFollowEnabled = false;
        if (this.followTimeout) {
          clearTimeout(this.followTimeout);
          this.followTimeout = null;
        }
      });

      this.map.on("moveend", () => {
        if (this.followTimeout) clearTimeout(this.followTimeout);

        this.followTimeout = setTimeout(() => {
          this.autoFollowEnabled = true;
          this.centerOnPlayer(true);
        }, this.followDelay);
      });
    },

    centerOnPlayer(fromGPS = false) {
      if (!this.map) return;
      this.ensurePlayerPosition();
      if (!this.gs?.player?.position) return;

      const { lat, lng } = this.gs.player.position;

      // Only auto-follow if:
      // - update came from GPS, OR
      // - auto-follow is currently enabled
      if (!fromGPS && !this.autoFollowEnabled) return;

      try {
        if (typeof this.map.panTo === "function") {
          this.map.panTo([lat, lng], {
            animate: true,
            duration: 1.0,
            easeLinearity: 0.25
          });
        } else {
          this.map.setView([lat, lng], this.map.getZoom() || 6);
        }
      } catch (e) {
        console.warn("worldmap: panTo failed, falling back to setView", e);
        try {
          this.map.setView([lat, lng], this.map.getZoom() || 6);
        } catch (err) {
          console.error("worldmap: setView fallback also failed", err);
        }
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
        try {
          this.playerMarker.setLatLng([pos.lat, pos.lng]);
        } catch (e) {
          console.warn("worldmap: failed to update existing playerMarker", e);
        }
        return;
      }

      try {
        const marker = L.circleMarker([pos.lat, pos.lng], {
          radius: 8,
          color: "#00ff66",
          fillColor: "#00ff66",
          fillOpacity: 0.8
        });

        this.playerMarker = marker.addTo(this.map);
      } catch (e) {
        console.error("worldmap: failed to create playerMarker", e);
      }
    },

    // GPS-aware
    setPlayerPosition(lat, lng, opts = {}) {
      if (!this.gs) this.gs = {};
      if (!this.gs.player) this.gs.player = {};
      this.gs.player.position = { lat, lng };

      if (this.playerMarker) {
        try {
          this.playerMarker.setLatLng([lat, lng]);
        } catch (e) {
          console.warn("worldmap: failed to set playerMarker position", e);
        }
      }

      if (opts.fromGPS) {
        this.autoFollowEnabled = true;
        this.centerOnPlayer(true);
      }
    },

    // Called by GPS module
    updatePlayerPosition(lat, lng, opts = {}) {
      this.setPlayerPosition(lat, lng, opts);
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
          if (Array.isArray(json.labels)) {
            this.worldLabels = json.labels;
            this.renderWorldLabels();
          } else if (Array.isArray(json)) {
            this.worldLabels = json;
            this.renderWorldLabels();
          } else {
            console.warn("worldmap: world_labels.json format unexpected");
          }
        } else {
          console.warn("worldmap: world_labels.json fetch returned", resLabels.status);
        }
      } catch (e) {
        console.error("worldmap: failed to load world_labels.json", e);
      }

      if (this.map) {
        this.updateOverlayVisibility(this.map.getZoom() || 6);
      }
    },

    renderWorldLabels() {
      if (!this.map || !this.labelLayer) return;

      try {
        this.labelLayer.clearLayers();
      } catch (e) {
        try {
          this.labelLayer.eachLayer(l => this.labelLayer.removeLayer(l));
        } catch (err) {}
      }

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

    updateOverlayVisibility(zoom) {
      if (!this.map) return;
      const z = typeof zoom === "number" ? zoom : (this.map.getZoom() || 6);

      const toggleLayer = (layerGroup) => {
        if (!layerGroup) return;
        layerGroup.eachLayer(layer => {
          const rule = layer._pipboyZoomRule;
          if (!rule) return;
          const visible = z >= (rule.minZoom || 0) && z <= (rule.maxZoom || 18);
          try {
            if (visible) {
              if (!this.map.hasLayer(layer)) layerGroup.addLayer(layer);
            } else {
              if (this.map.hasLayer(layer)) layerGroup.removeLayer(layer);
            }
          } catch (e) {
            console.warn("worldmap: updateOverlayVisibility layer toggle failed", e);
          }
        });
      };

      toggleLayer(this.labelLayer);
      toggleLayer(this.roadLayer);
    },

    // --------------------------------------------------------
    // LOCATION LOADING + MARKERS
    // --------------------------------------------------------
    async loadLocations() {
      if (this.locationsLoaded) return;

      // Only static file now, no /api/locations
      let data = null;
      try {
        const res = await fetch("/data/locations.json");
        if (!res.ok) {
          console.warn("worldmap: /data/locations.json responded", res.status);
        } else {
          data = await res.json();
        }
      } catch (e) {
        console.warn("worldmap: fetch /data/locations.json failed", e);
      }

      if (!data) {
        console.warn("worldmap: no locations data found; continuing with empty list");
        this.locations = [];
        this.locationsLoaded = true;
        this.renderPOIMarkers();
        return;
      }

      if (Array.isArray(data)) {
        this.locations = data;
      } else if (Array.isArray(data.locations)) {
        this.locations = data.locations;
      } else {
        console.warn("worldmap: locations.json format unexpected, expected array or { locations: [] }");
        this.locations = [];
      }

      this.locationsLoaded = true;
      this.renderPOIMarkers();
      console.log(`worldmap: loaded ${this.locations.length} locations`);
    },

    renderPOIMarkers() {
      if (!this.map || !this.map._loaded) return;

      try {
        this.poiMarkers.forEach(entry => {
          const m = entry && (entry.marker || entry);
          if (m && this.map.hasLayer(m)) this.map.removeLayer(m);
        });
      } catch (e) {
        console.warn("worldmap: error clearing existing POI markers", e);
      }
      this.poiMarkers = [];

      if (!this.locationsLoaded || !Array.isArray(this.locations)) return;

      this.locations.forEach((loc, idx) => {
        if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return;
        try {
          const marker = this.createPOIMarker(loc, idx);
          marker.addTo(this.map);
          this.poiMarkers.push({ marker, loc });
        } catch (e) {
          console.warn("worldmap: failed to create POI marker for", loc, e);
        }
      });
    },

    createPOIMarker(loc, idx) {
      const rarity = loc.rarity || "common";

      const dotClasses = [
        rarity === "epic" ? "epic" : "",
        rarity === "legendary" ? "legendary" : ""
      ].filter(Boolean).join(" ");

      const iconHtml = `
        <div class="pipboy-marker">
          <div class="pipboy-marker-dot ${dotClasses}"></div>
        </div>
      `;

      const icon = L.divIcon({
        className: "pipboy-marker-icon",
        html: iconHtml,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([loc.lat, loc.lng], {
        icon,
        bubblingMouseEvents: false
      });

      marker.on("click", () => {
        this.autoFollowEnabled = false;
        if (this.followTimeout) clearTimeout(this.followTimeout);
        try {
          this.onLocationClick(loc, idx);
        } catch (e) {
          console.error("worldmap: onLocationClick handler threw", e);
        }
      });

      const name = loc.n || loc.name || loc.id || `POI ${idx + 1}`;
      const level = loc.lvl || 1;

      try {
        marker.bindTooltip(
          `${name} (Lv ${level}, ${rarity})`,
          { permanent: false, direction: "top", className: "pipboy-tooltip" }
        );
      } catch (e) {}

      marker._pipboyData = loc;

      return marker;
    },
        // --------------------------------------------------------
    // LOCATION INTERACTION / NPC DIALOG INTEGRATION
    // --------------------------------------------------------
    async onLocationClick(loc, idx) {
      if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") return;

      this.autoFollowEnabled = false;
      if (this.followTimeout) clearTimeout(this.followTimeout);

      try {
        this.setPlayerPosition(loc.lat, loc.lng);
        this.centerOnPlayer(true);
      } catch (e) {
        console.warn("worldmap: setPlayerPosition failed", e);
      }

      if (loc.npcId && Game.modules?.narrative) {
        try {
          Game.modules.narrative.openForNpc(loc.npcId);
          return;
        } catch (e) {
          console.error("worldmap: failed to open NPC dialog:", e);
        }
      }

      if (loc.dialogId && Game.modules?.narrative) {
        try {
          Game.modules.narrative.openByDialogId(loc.dialogId);
          return;
        } catch (e) {
          console.error("worldmap: failed to open dialog by id:", e);
        }
      }

      if (window.Game?.overseer?.onPOIVisit) {
        try {
          Game.overseer.onPOIVisit(loc);
        } catch (e) {
          console.error("worldmap: overseer onPOIVisit failed:", e);
        }
      }

      let weather = null;
      if (Game.modules?.world?.weather) {
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
      if (Game.modules?.world?.encounters) {
        try {
          const worldState = Game.modules.world.state || this.gs.worldState || this.gs;
          const locationForWorld = {
            id: loc.id || `loc_${loc.n || idx}_${loc.lat}_${loc.lng}`,
            name: loc.n || loc.name || "Unknown Location",
            lvl: loc.lvl || 1,
            biome: loc.biome || "temperate_forest",
            type: loc.type || "poi",
            faction: loc.faction || "free_scavs"
          };

          encounterResult = Game.modules.world.encounters.roll(worldState, locationForWorld);
        } catch (e) {
          console.error("worldmap: encounter roll failed:", e);
        }
      }

      this.handleEncounterResult(encounterResult, loc);
    },

    handleEncounterResult(result, loc) {
      const name = loc?.n || loc?.name || "this location";

      if (!result || result.type === "none") {
        this.showMapMessage(`You arrive at ${name}. The wastes are quiet... for now.`);
        return;
      }

      try {
        switch (result.type) {
          case "combat":
            this.showMapMessage(`Hostiles near ${name}!`);
            if (Game.modules?.battle) {
              const encounter = {
                id: `encounter_${name}_${Date.now()}`,
                enemies: (result.enemies?.list || []).map(id => ({ id, damage: 5 })),
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
      } catch (e) {
        console.error("worldmap: handleEncounterResult failed", e);
        this.showMapMessage(`You arrive at ${name}.`);
      }
    },

    showMapMessage(text) {
      try {
        const log = document.getElementById("mapLog");
        if (!log) return;
        const line = document.createElement("div");
        line.textContent = text;
        log.prepend(line);
      } catch (e) {
        console.warn("worldmap: showMapMessage failed", e);
      }
    },

    // --------------------------------------------------------
    // QUEST SUPPORT
    // --------------------------------------------------------
    getNearbyPOIs(radiusMeters) {
      this.ensurePlayerPosition();
      const pos = this.gs.player.position;
      const radius = radiusMeters || 500;

      if (!this.locationsLoaded || !Array.isArray(this.locations)) return [];

      return this.locations
        .map(loc => {
          const d = this.distanceMeters(pos.lat, pos.lng, loc.lat, loc.lng);
          return { poi: loc, distance: d };
        })
        .filter(entry => entry.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
    },

    distanceMeters(lat1, lon1, lat2, lon2) {
      if ([lat1, lon1, lat2, lon2].some(v => typeof v !== "number")) return Infinity;

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
    // CLEANUP / UTIL
    // --------------------------------------------------------
    destroy() {
      try {
        if (this.map) {
          this.map.off();
          this.map.remove();
        }
      } catch (e) {
        console.warn("worldmap: destroy error", e);
      } finally {
        this.map = null;
        this.playerMarker = null;
        this.poiMarkers = [];
        this.locations = [];
        this.locationsLoaded = false;
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


