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
    
    prevPlayerPosition: null,
    labelLayer: null,
    roadLayer: null,
    worldLabels: [],

    autoFollowEnabled: true,
    followTimeout: null,
    followDelay: 5000,

    // --------------------------------------------------------
    // INIT
    // --------------------------------------------------------
    init(gameState) {
      this.gs = gameState || window.DATA || {};
      this.ensurePlayerPosition();
      this.initMap();
      this.loadLocations();
      this.loadWorldOverlays();
    },

    onOpen() {
      if (!this.map) this.init(window.DATA || {});
      if (!this.locationsLoaded) this.loadLocations();
      else this.renderPOIMarkers();

      this.ensurePlayerPosition();
      this.initPlayerMarker();
      this.centerOnPlayer(true);

      this.renderWorldLabels();

      setTimeout(() => {
        try {
          this.map.invalidateSize();
          const pos = this.gs.player.position;
          this.map.setView([pos.lat, pos.lng], this.map.getZoom() || 6);
          this.updateOverlayVisibility(this.map.getZoom() || 6);
        } catch (e) {}
      }, 50);
    },

    // --------------------------------------------------------
    // SAFE PLAYER POSITION
    // --------------------------------------------------------
    ensurePlayerPosition() {
      if (!this.gs.player) this.gs.player = {};
      if (
        !this.gs.player.position ||
        typeof this.gs.player.position.lat !== "number" ||
        typeof this.gs.player.position.lng !== "number"
      ) {
        this.gs.player.position = { lat: 36.11274, lng: -115.174301 };
      }
    },

    // --------------------------------------------------------
    // MAP INITIALIZATION (CLEAN + SINGLE MAP)
    // --------------------------------------------------------
    initMap() {
      if (this.map) return;

      const container = document.getElementById("mapContainer");
      if (!container) return;

      this.map = L.map(container, {
        zoomControl: false,
        attributionControl: false,
        worldCopyJump: false
      });

      // Regional bounds
      this.map.setMinZoom(5);
      this.map.setMaxZoom(14);
      this.map.setMaxBounds([
        [49.5, -125],
        [31, -102]
      ]);

      // Tiles
      const tiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { minZoom: 0, maxZoom: 19, noWrap: true }
      );
      tiles.addTo(this.map);
      this.tiles = { satellite: tiles };

      // Start view
      const pos = this.gs.player.position;
      this.map.setView([pos.lat, pos.lng], 7);

      // Layers
      this.labelLayer = L.layerGroup().addTo(this.map);
      this.roadLayer = L.layerGroup().addTo(this.map);

      // --------------------------------------------------------
      // LOAD POIs (SVG ICONS)
      // --------------------------------------------------------
      fetch("/data/poi.json")
        .then(r => r.json())
        .then(pois => {
          if (!Array.isArray(pois)) return;
          pois.forEach(poi => {
            const icon = L.icon({
              iconUrl: `/img/icons/${poi.icon}.svg`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            L.marker([poi.lat, poi.lng], { icon })
              .bindPopup(`<b>${poi.name}</b>`)
              .addTo(this.map);
          });
        });

      // --------------------------------------------------------
      // LOAD HIGHWAYS (TopoJSON)
      // --------------------------------------------------------
      fetch("/data/highways.topojson")
        .then(r => r.json())
        .then(topo => {
          if (!topo || !topo.objects) return;
          const geo = topojson.feature(topo, topo.objects.highways);

          L.geoJSON(geo, {
            style: {
              color: "#00ff41",
              weight: 2,
              opacity: 0.9,
              className: "pipboy-road"
            }
          }).addTo(this.roadLayer);
        });

      // Auto-follow
      this.enableAutoFollow();

      // Player marker
      this.initPlayerMarker();

      // Overlay visibility
      this.updateOverlayVisibility(this.map.getZoom());
      this.map.on("zoomend", () => {
        this.updateOverlayVisibility(this.map.getZoom());
      });

      window.dispatchEvent(new Event("map-ready"));
    },

    // --------------------------------------------------------
    // AUTO FOLLOW
    // --------------------------------------------------------
    enableAutoFollow() {
      if (!this.map) return;

      this.map.on("movestart", () => {
        this.autoFollowEnabled = false;
        if (this.followTimeout) clearTimeout(this.followTimeout);
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
      const pos = this.gs.player.position;
      if (!fromGPS && !this.autoFollowEnabled) return;
      this.map.panTo([pos.lat, pos.lng], { animate: true });
    },

    // --------------------------------------------------------
    // PLAYER MARKER (SVG + ROTATION)
    // --------------------------------------------------------
    initPlayerMarker() {
      const pos = this.gs.player.position;

      if (this.playerMarker) {
        this.playerMarker.setLatLng([pos.lat, pos.lng]);
        return;
      }

      const icon = L.icon({
        iconUrl: "/img/icons/player.svg",
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      this.playerMarker = L.marker([pos.lat, pos.lng], { icon }).addTo(this.map);
    },

    setPlayerHeading(deg) {
      if (!this.playerMarker) return;
      const el = this.playerMarker.getElement();
      if (el) el.style.transform = `rotate(${deg}deg)`;
    },

    setPlayerPosition(lat, lng, opts = {}) {
  const newPos = { lat, lng };

  // Auto-heading from movement if no explicit heading provided
  if (this.prevPlayerPosition && opts.heading === undefined) {
    const h = this.computeHeading(
      this.prevPlayerPosition.lat,
      this.prevPlayerPosition.lng,
      newPos.lat,
      newPos.lng
    );
    if (!isNaN(h)) this.setPlayerHeading(h);
  }

  this.prevPlayerPosition = newPos;
  this.gs.player.position = newPos;

  if (this.playerMarker) {
    this.playerMarker.setLatLng([lat, lng]);
  }

  if (opts.heading !== undefined) {
    this.setPlayerHeading(opts.heading);
  }
  computeHeading(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const toDeg = r => (r * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let brng = toDeg(Math.atan2(y, x)); // -180..180
  if (brng < 0) brng += 360;          // 0..360

  return brng;
},

  if (opts.fromGPS) {
    this.centerOnPlayer(true);
  }
},


    updatePlayerPosition(lat, lng, opts = {}) {
      this.setPlayerPosition(lat, lng, opts);
    },

    // --------------------------------------------------------
    // WORLD LABELS
    // --------------------------------------------------------
    async loadWorldOverlays() {
      try {
        const res = await fetch("/data/world_labels.json");
        const json = await res.json();
        this.worldLabels = Array.isArray(json.labels) ? json.labels : json;
        this.renderWorldLabels();
      } catch (e) {}
    },

    renderWorldLabels() {
      this.labelLayer.clearLayers();
      this.worldLabels.forEach(label => {
        const icon = L.divIcon({
          className: "pipboy-label",
          html: `<div>${label.name}</div>`
        });
        L.marker([label.lat, label.lng], { icon, interactive: false })
          .addTo(this.labelLayer);
      });
    },

    updateOverlayVisibility(zoom) {
      // labels always visible for now
    },

    // --------------------------------------------------------
    // LOCATIONS + POI MARKERS
    // --------------------------------------------------------
    async loadLocations() {
      try {
        const res = await fetch("/data/locations.json");
        const data = await res.json();
        this.locations = Array.isArray(data) ? data : data.locations || [];
      } catch (e) {
        this.locations = [];
      }
      this.locationsLoaded = true;
      this.renderPOIMarkers();
    },

    renderPOIMarkers() {
      this.poiMarkers.forEach(m => this.map.removeLayer(m.marker));
      this.poiMarkers = [];

      this.locations.forEach((loc, idx) => {
        const marker = this.createPOIMarker(loc, idx);
        marker.addTo(this.map);
        this.poiMarkers.push({ marker, loc });
      });
    },

    createPOIMarker(loc, idx) {
      const rarity = loc.rarity || "common";
      const dotClass =
        rarity === "epic" ? "epic" :
        rarity === "legendary" ? "legendary" : "";

      const icon = L.divIcon({
        className: "pipboy-marker-icon",
        html: `<div class="pipboy-marker"><div class="pipboy-marker-dot ${dotClass}"></div></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon });
      marker._pipboyData = loc;

      marker.on("click", () => {
        this.autoFollowEnabled = false;
        this.onLocationClick(loc, idx);
      });

      return marker;
    },

    // --------------------------------------------------------
    // LOCATION INTERACTION + ENCOUNTERS
    // --------------------------------------------------------
    async onLocationClick(loc, idx) {
      this.setPlayerPosition(loc.lat, loc.lng, { fromGPS: true });

      if (loc.npcId && Game.modules?.narrative) {
        Game.modules.narrative.openForNpc(loc.npcId);
        return;
      }

      if (loc.dialogId && Game.modules?.narrative) {
        Game.modules.narrative.openByDialogId(loc.dialogId);
        return;
      }

      if (window.Game?.overseer?.onPOIVisit) {
        Game.overseer.onPOIVisit(loc);
      }

      let encounter = null;
      if (Game.modules?.world?.encounters) {
        const worldState = Game.modules.world.state || this.gs.worldState || this.gs;
        encounter = Game.modules.world.encounters.roll(worldState, {
          id: loc.id || `loc_${idx}`,
          name: loc.name || "Unknown Location",
          lvl: loc.lvl || 1,
          biome: loc.biome || "temperate_forest",
          type: loc.type || "poi"
        });
      }

      this.handleEncounterResult(encounter, loc);
    },

    handleEncounterResult(result, loc) {
      const name = loc.name || "this location";

      if (!result || result.type === "none") {
        this.showMapMessage(`You arrive at ${name}.`);
        return;
      }

      switch (result.type) {
        case "combat":
          this.showMapMessage(`Hostiles near ${name}!`);
          if (Game.modules?.battle) {
            Game.modules.battle.start({
              id: `enc_${Date.now()}`,
              enemies: (result.enemies?.list || []).map(id => ({ id, damage: 5 })),
              rewards: result.rewards || {}
            });
          }
          break;

        case "merchant":
          this.showMapMessage(`A merchant caravan is near ${name}.`);
          break;

        case "boss":
          this.showMapMessage(`A powerful presence lurks at ${name}...`);
          break;

        case "event":
          this.showMapMessage(result.event?.description || `Something strange happens at ${name}.`);
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
    // CLEANUP
    // --------------------------------------------------------
    destroy() {
      if (this.map) {
        this.map.off();
        this.map.remove();
      }
      this.map = null;
      this.playerMarker = null;
      this.poiMarkers = [];
      this.locations = [];
      this.locationsLoaded = false;
    }
  };

  Game.modules.worldmap = worldmapModule;

  document.addEventListener("DOMContentLoaded", () => {
    worldmapModule.init(window.DATA || {});
  });
})();
