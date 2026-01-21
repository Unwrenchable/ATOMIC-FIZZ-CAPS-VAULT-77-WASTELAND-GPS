(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // safeFetchJSON: returns parsed JSON or null and logs diagnostics
  async function safeFetchJSON(url, opts = {}) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[safeFetchJSON] ${url} returned ${res.status} ${res.statusText}`, text.slice(0, 500));
        return null;
      }
      const text = await res.text();
      if (!text) {
        console.warn(`[safeFetchJSON] ${url} returned empty body`);
        return null;
      }
      try {
        return JSON.parse(text);
      } catch (err) {
        console.warn(`[safeFetchJSON] ${url} returned invalid JSON (first 200 chars):`, text.slice(0, 200));
        return null;
      }
    } catch (err) {
      console.error(`[safeFetchJSON] failed to fetch ${url}:`, err && err.message ? err.message : err);
      return null;
    }
  }

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
      // LOAD POIs (SVG ICONS) - safe, handles grouped structure
      // --------------------------------------------------------
      (async () => {
        const poiData = await safeFetchJSON("/data/poi.json");
        if (!poiData) return;
        
        // Flatten grouped POI structure (strip, freeside, outer_vegas, etc.)
        const allPois = [];
        if (typeof poiData === 'object') {
          Object.values(poiData).forEach(group => {
            if (Array.isArray(group)) {
              allPois.push(...group);
            }
          });
        } else if (Array.isArray(poiData)) {
          allPois.push(...poiData);
        }
        
        allPois.forEach(poi => {
          try {
            // Use iconKey (from data) or icon (fallback)
            const iconName = poi.iconKey || poi.icon || 'poi';
            const icon = L.icon({
              iconUrl: `/img/icons/${iconName}.svg`,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
              className: 'poi-marker'
            });
            
            const marker = L.marker([poi.lat, poi.lng], { icon });
            
            // Enhanced popup with Fallout-style info
            const rarityColor = {
              common: '#00ff41',
              rare: '#00d4ff',
              epic: '#d900ff',
              legendary: '#ffaa00'
            }[poi.rarity] || '#00ff41';
            
            marker.bindPopup(`
              <div style="color: ${rarityColor}; font-family: monospace;">
                <b>${poi.name}</b><br>
                <small>LVL ${poi.lvl || '?'} • ${(poi.rarity || 'UNKNOWN').toUpperCase()}</small>
              </div>
            `);
            
            marker.addTo(this.map);
          } catch (e) {
            console.warn("[worldmap] failed to add POI", poi && poi.id, e && e.message ? e.message : e);
          }
        });
        
        console.log(`[worldmap] loaded ${allPois.length} POI markers`);
      })();

      // --------------------------------------------------------
      // LOAD HIGHWAYS (TopoJSON) - safe
      // --------------------------------------------------------
      (async () => {
        const topo = await safeFetchJSON("/data/highways.topojson");
        if (!topo || !topo.objects) return;
        try {
          if (typeof topojson !== "undefined" && topojson.feature) {
            const geo = topojson.feature(topo, topo.objects.highways);
            L.geoJSON(geo, {
              style: {
                color: "#00ff41",
                weight: 2,
                opacity: 0.9,
                className: "pipboy-road"
              }
            }).addTo(this.roadLayer);
          } else {
            console.warn("[worldmap] topojson not available; skipping highways overlay");
          }
        } catch (e) {
          console.warn("[worldmap] failed to render highways topojson:", e && e.message ? e.message : e);
        }
      })();

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

      if (opts.fromGPS) {
        this.centerOnPlayer(true);
      }
    },

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

    updatePlayerPosition(lat, lng, opts = {}) {
      this.setPlayerPosition(lat, lng, opts);
    },

    // --------------------------------------------------------
    // WORLD LABELS
    // --------------------------------------------------------
    async loadWorldOverlays() {
      try {
        const json = await safeFetchJSON("/data/world_labels.json");
        if (!json) return;
        this.worldLabels = Array.isArray(json.labels) ? json.labels : json;
        this.renderWorldLabels();
      } catch (e) {
        console.warn("[worldmap] loadWorldOverlays failed", e && e.message ? e.message : e);
      }
    },

    renderWorldLabels() {
      if (!this.labelLayer) return;
      this.labelLayer.clearLayers();
      (this.worldLabels || []).forEach(label => {
        try {
          const icon = L.divIcon({
            className: "pipboy-label",
            html: `<div>${label.name}</div>`
          });
          L.marker([label.lat, label.lng], { icon, interactive: false })
            .addTo(this.labelLayer);
        } catch (e) {
          console.warn("[worldmap] failed to render label", label && label.name, e && e.message ? e.message : e);
        }
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
        // try API first
        const apiLocations = await safeFetchJSON("/api/locations");
        if (Array.isArray(apiLocations) && apiLocations.length) {
          this.locations = apiLocations;
          this.locationsLoaded = true;
          this.renderPOIMarkers();
          return;
        }

        // fallback to static file
        const staticLocations = await safeFetchJSON("/data/locations.json");
        if (Array.isArray(staticLocations) && staticLocations.length) {
          this.locations = staticLocations;
        } else {
          this.locations = [];
          console.warn("[worldmap] no locations available from API or static fallback");
        }
      } catch (e) {
        console.warn("[worldmap] loadLocations error", e && e.message ? e.message : e);
        this.locations = [];
      }
      this.locationsLoaded = true;
      this.renderPOIMarkers();
    },

    renderPOIMarkers() {
      if (!this.map) return;
      this.poiMarkers.forEach(m => {
        try {
          if (m.marker && this.map.hasLayer(m.marker)) this.map.removeLayer(m.marker);
        } catch (e) {}
      });
      this.poiMarkers = [];

      (this.locations || []).forEach((loc, idx) => {
        try {
          const marker = this.createPOIMarker(loc, idx);
          marker.addTo(this.map);
          this.poiMarkers.push({ marker, loc });
        } catch (e) {
          console.warn("[worldmap] failed to create POI marker", loc && loc.id, e && e.message ? e.message : e);
        }
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

      // Check for NPC encounters (doesn't bypass other encounters)
      let npcEncounter = null;
      if (Game.modules?.npcSpawn) {
        npcEncounter = Game.modules.npcSpawn.checkForNPCEncounter(loc);
      }

      // Check for regular world encounters
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

      // Handle NPC encounter first if present, then regular encounter
      if (npcEncounter) {
        this.handleEncounterResult(npcEncounter, loc);
      }
      
      // Still process regular encounters if present
      if (encounter) {
        this.handleEncounterResult(encounter, loc);
      } else if (!npcEncounter) {
        // Only show arrival message if no encounters occurred
        this.handleEncounterResult(null, loc);
      }
    },

    handleEncounterResult(result, loc) {
      const name = loc.name || "this location";

      if (!result || result.type === "none") {
        this.showMapMessage(`You arrive at ${name}.`);
        return;
      }

      switch (result.type) {
        case "npc":
          if (result.npc) {
            this.showMapMessage(`${result.npc.name} is at ${name}.`);
            if (Game.modules?.npcSpawn) {
              Game.modules.npcSpawn.triggerNPCApproach(result.npc, loc);
            }
          }
          break;

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
