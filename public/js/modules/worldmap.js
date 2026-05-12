(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // XSS-safe helper: escape HTML special chars before inserting into innerHTML
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = String(str == null ? '' : str);
    return d.innerHTML;
  }

  // ============================================================
  // ICON FALLBACK MAPPING (Enhanced for Afterfall authenticity)
  // Maps iconKey values that don't have SVG files to existing icons
  // ============================================================
  const ICON_FALLBACK_MAP = {
    // NPCs/Characters
    'drifter': 'ghost',
    'courier': 'player',
    'wanderer': 'ghost',
    'settler': 'settlement',
    'wastelander': 'ghost',
    'survivor': 'player',
    'npc': 'ghost',
    'character': 'player',
    
    // Factions without dedicated icons
    'followers': 'medical',
    'institute': 'lab',
    'minutemen': 'settlement',
    'railroad': 'tunnel',
    'brotherhood': 'bos',
    'enclave_faction': 'enclave',
    'ncr_faction': 'ncr',
    'legion_faction': 'legion',
    'gunners': 'raider',
    'super_mutants': 'enemy',
    'mutant': 'enemy',
    'hostile': 'enemy',
    
    // Trading/Commerce
    'trader': 'trading',
    'merchant': 'market',
    'vendor': 'shop',
    'caravan_stop': 'caravan',
    'general_store': 'store',
    'marketplace': 'market',
    'bazaar': 'market',
    
    // Location types without dedicated icons
    'office': 'city',
    'apartment': 'city',
    'residential': 'town',
    'industrial': 'factory',
    'research': 'lab',
    'science': 'lab',
    'laboratory': 'lab',
    'medical_center': 'hospital',
    'clinic_building': 'clinic',
    'military_base': 'military',
    'army': 'military',
    'navy': 'military',
    'air_force': 'airport',
    'vault_entrance': 'vault',
    'vault_door': 'vault',
    'underground': 'tunnel',
    'subway': 'metro',
    'train': 'station',
    'bus': 'station',
    'gas': 'gasstation',
    'fuel_station': 'gasstation',
    'motel_sign': 'motel',
    'inn': 'motel',
    'bar_tavern': 'bar',
    'saloon': 'bar',
    'pub': 'bar',
    'tavern': 'bar',
    'pool_hall': '8ball',
    'billiards': '8ball',
    'poolhall': '8ball',
    'restaurant_cafe': 'restaurant',
    'food': 'restaurant',
    'diner_old': 'diner',
    'church_chapel': 'church',
    'religious': 'religion',
    'chapel': 'church',
    'cemetery_graveyard': 'cemetery',
    'grave': 'graveyard',
    'farm_field': 'farm',
    'agricultural': 'farm',
    'forest_woods': 'forest',
    'wilderness_wild': 'wilderness',
    'mountain_peak': 'mountain',
    'hill': 'mountain',
    'water_body': 'water',
    'lake': 'water',
    'river': 'water',
    'ocean': 'water',
    'dam': 'power',
    'power_plant': 'power',
    'nuclear': 'reactor',
    'radiation': 'rad',
    'radioactive': 'rad',
    'danger_zone': 'danger',
    'hazard': 'danger',
    'warning': 'danger',
    'raider_camp': 'raider',
    'bandit': 'raider',
    'gang': 'raider',
    'ghoul_area': 'ghoul',
    'feral': 'ghoul',
    'boss_area': 'boss',
    'boss_fight': 'boss',
    'legendary': 'boss',
    'quest_marker': 'quest',
    'mission': 'quest',
    'objective': 'quest',
    'task': 'quest',
    'sidequest_marker': 'sidequest',
    'loot_cache': 'loot',
    'treasure': 'loot',
    'stash': 'loot',
    'supply_depot': 'supply',
    'resources': 'supply',
    'supplies': 'supply',
    'tools': 'toolbox',
    'workshop': 'toolbox',
    'scrap': 'scrapyard',
    'junk': 'junkyard',
    'building': 'facility',
    'structure': 'facility',
    'location': 'poi',
    'place': 'poi',
    'site': 'poi',
    'area': 'wasteland',
    'zone': 'wasteland',
    'region': 'wilderness',
    'marker': 'poi',
    
    // Null/Invalid fallback
    'null': 'poi',
    'undefined': 'poi',
    '': 'poi',
    'unknown': 'poi',
    'default': 'poi',
    'generic': 'poi',
    'none': 'poi'
  };

  // Get valid icon name with fallback
  function getValidIcon(iconKey) {
    if (!iconKey || iconKey === 'null' || iconKey === 'undefined') {
      return 'poi';
    }
    return ICON_FALLBACK_MAP[iconKey] || iconKey;
  }
  
  // Create icon HTML with automatic fallback to poi.svg on error
  // This ensures no POI ever shows as a broken image or default Leaflet marker
  function createIconHTML(iconName, size = 32) {
    return `<img src="/img/icons/${iconName}.svg" 
            onerror="this.onerror=null; this.src='/img/icons/poi.svg';" 
            style="width:${size}px;height:${size}px;display:block;" 
            alt="${iconName}" />`;
  }

  // safeFetchJSON: returns parsed JSON or null and logs diagnostics
  async function safeFetchJSON(url, opts = {}) {
    try {
      // Normalize input: accept strings or simple objects containing a URL
      let input = url;
      if (typeof input === 'object' && input !== null) {
        if (typeof input.url === 'string') input = input.url;
        else if (typeof input.file === 'string') input = input.file;
        else if (typeof input.path === 'string') input = input.path;
        else {
          console.warn('[safeFetchJSON] received non-string input, returning null', input);
          return null;
        }
      }

      if (typeof input !== 'string') {
        console.warn('[safeFetchJSON] invalid URL type, returning null', input);
        return null;
      }

      const fullUrl = input.startsWith('/api/') ? `${window.API_BASE}${input}` : input;
      const res = await fetch(fullUrl, opts);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[safeFetchJSON] ${input} returned ${res.status} ${res.statusText}`, text.slice(0, 500));
        return null;
      }

      // Try parsing JSON safely
      const text = await res.text();
      if (!text) {
        console.warn(`[safeFetchJSON] ${input} returned empty body`);
        return null;
      }

      try {
        return JSON.parse(text);
      } catch (err) {
        console.warn(`[safeFetchJSON] ${input} returned invalid JSON (first 200 chars):`, text.slice(0, 200));
        return null;
      }
    } catch (err) {
      console.error(`[safeFetchJSON] failed to fetch ${typeof url === 'string' ? url : JSON.stringify(url)}:`, err && err.message ? err.message : err);
      return null;
    }
  }

  const worldmapModule = {
    gs: null,
    map: null,
    tiles: null,
    playerMarker: null,
    poiMarkers: [],
    poiMarkersCache: new Map(), // Cache markers by POI ID to prevent recreation
    locations: [],
    locationsLoaded: false,
    poisLoaded: false, // Track if static POIs from poi.json are already loaded

    prevPlayerPosition: null,
    labelLayer: null,
    roadLayer: null,
    worldLabels: [],

    autoFollowEnabled: true,
    explorationMode: false,  // When true, disables auto-snap completely
    followTimeout: null,
    followDelay: 5000,
    
    // ------------------------------------------------------------------
    // SIZE/RESIZE HELPERS
    // ------------------------------------------------------------------
    // Legacy retry logic used during initial map open when the container
    // sometimes reports 0×0 on mobile.  In practice a ResizeObserver is now
    // used to automatically invalidate the map any time the container size
    // changes, so these counters are mostly retained for backwards
    // compatibility and diagnostic logging.
    containerRetryCount: 0,
    maxContainerRetries: 10,
    containerRetryDelayMs: 200,
    _pendingOnOpen: false,
    _retryTimeoutId: null,     // tracks the pending retry setTimeout so it can be cancelled
    _loadingLocations: false,  // guard against concurrent loadLocations() calls
    _hasBeenOpened: false,     // true after the first successful map render; prevents zoom-18 snap on every tab switch

    // delays used by pipboy.js when invalidating after a panel switch
    mapInvalidateDelayMs: 150,
    mapInvalidateDelayMsMobile: 400,
    mapSecondInvalidateDelayMs: 300,

    // optional ResizeObserver instance attached to mapContainer
    resizeObserver: null,

    // Returns true for phones/tablets (same logic as pipboy.js)
    isMobileDevice() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || window.innerWidth <= 768;
    },

    // --------------------------------------------------------
    // INIT
    // --------------------------------------------------------
    init(gameState) {
      this.gs = gameState || window.DATA || {};
      this.ensurePlayerPosition();
      this.initMap();
      // loadLocations() is always called by onOpen() immediately after init(),
      // so we do not call it here to avoid a redundant concurrent fetch.
      this.loadWorldOverlays();
    },

    // Helper method to reset retry state
    resetRetryState() {
      this.containerRetryCount = 0;
      this.isRetrying = false;
      if (this._retryTimeoutId !== null) {
        clearTimeout(this._retryTimeoutId);
        this._retryTimeoutId = null;
      }
    },

    // --------------------------------------------------------
    // OBSERVERS
    // --------------------------------------------------------
    // Automatically refresh the map whenever its container changes size.
    // On mobile the panel-body flex layout may take a moment to settle, and
    // relying solely on manual invalidation/delays lead to race conditions
    // where a zero‑height tile canvas is created and never redrawn.  A
    // ResizeObserver guarantees we always catch the transition to a nonzero
    // size.
    setupResizeObserver(container) {
      if (this.resizeObserver || typeof ResizeObserver === 'undefined') return;
      try {
        this.resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              if (this._pendingOnOpen) {
                this._pendingOnOpen = false;
                console.log('[worldmap] container gained dimensions, resuming onOpen');
                this.onOpen();
              } else if (this.map) {
                console.log('[worldmap] container resized, invalidating map');
                this.map.invalidateSize();
              }
            }
          }
        });
        this.resizeObserver.observe(container);
      } catch (e) {
        console.warn('[worldmap] ResizeObserver not available, falling back to retry logic', e);
      }
    },

    onOpen() {
      // If a pending retry timeout exists, this is a fresh external call (the
      // retry-loop callback always nulls _retryTimeoutId before calling onOpen,
      // so a non-null value here means an outside caller pre-empted the chain).
      // Cancel the stale timer and start with a clean retry counter so the new
      // call gets a full set of retries.
      if (this._retryTimeoutId !== null) {
        clearTimeout(this._retryTimeoutId);
        this._retryTimeoutId = null;
        this.containerRetryCount = 0;
      }

      console.log('[worldmap] onOpen called');
      
      // CRITICAL FOR MOBILE: the panel can be flex‑collapsed or still
      // animating when onOpen is called, which means the map container may
      // report 0×0.  Leaflet will happily build a zero‑sized canvas and
      // never repaint it.  We handle this in two ways:
      //  1. setupResizeObserver (called during initMap) watches the element
      //     and invalidates the map whenever it obtains a real size.
      //  2. a simple retry loop keeps re-entering onOpen until the container
      //     reports nonzero dimensions (with a maximum attempt count).
      //  3. if retries are exhausted, _pendingOnOpen is set and a ResizeObserver
      //     is attached early so onOpen is replayed as soon as dimensions arrive.
      const container = document.getElementById("mapContainer");
      if (!container) {
        console.warn('[worldmap] mapContainer element not found in DOM - cannot initialize map');
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        if (this.containerRetryCount < this.maxContainerRetries) {
          this.containerRetryCount++;
          console.log(`[worldmap] container has no dimensions (width: ${rect.width} height: ${rect.height}), retry ${this.containerRetryCount} / ${this.maxContainerRetries}`);
          this._retryTimeoutId = setTimeout(() => {
            this._retryTimeoutId = null; // Mark as consumed before re-entering
            this.onOpen();
          }, this.containerRetryDelayMs);
          return;
        } else {
          console.warn(`[worldmap] container failed to gain dimensions after ${this.maxContainerRetries} retries - waiting for ResizeObserver`);
          this._pendingOnOpen = true;
          this.setupResizeObserver(container);
          return;
        }
      } else {
        // Container has valid dimensions – cancel any pending retry and clear the
        // pending-onOpen flag so the ResizeObserver does not fire an extra onOpen().
        this._pendingOnOpen = false;
        this.resetRetryState();
      }

      // Initialize map if not yet created (happens after boot screen)
      if (!this.map) {
        console.log('[worldmap] map not initialized, initializing now...');
        this.init(window.DATA || {});
      }
      if (!this.map) {
        console.error('[worldmap] map failed to initialize');
        this.updateMapStatus('Map initialization failed - check console');
        return;
      }
      if (!this.locationsLoaded) {
        this.loadLocations();
      } else {
        this.renderPOIMarkers();
      }

      this.ensurePlayerPosition();
      this.initPlayerMarker();

      // Only snap to zoom 18 on the very first open.  On subsequent tab
      // switches we just invalidate the size so Leaflet repaints without
      // resetting the user's current zoom level.
      if (!this._hasBeenOpened) {
        this._hasBeenOpened = true;
        this.centerOnPlayer(true); // zoom-18 GPS snap – first open only
      }

      this.renderWorldLabels();

      // Invalidate size so Leaflet repaints correctly after display:none → block.
      // The redundant setView that previously followed this call has been removed:
      // centerOnPlayer() (above) already called setView on first open, and on
      // subsequent opens we deliberately do NOT want to override the user's zoom.
      if (this.map) {
        this.map.invalidateSize(true);
        this.updateOverlayVisibility(this.map.getZoom() || 7);
        this.updateMapStatus('Map online - Ready');
      }

      // Dispatch mapReady event for modules that depend on the map being initialized
      window.dispatchEvent(new Event('map-ready'));
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
      if (this.map) {
        console.log('[worldmap] map already initialized');
        return;
      }

      const container = document.getElementById("mapContainer");
      if (!container) {
        console.error('[worldmap] mapContainer not found in DOM');
        return;
      }

      // Check if Leaflet is loaded
      if (typeof L === 'undefined') {
        console.error('[worldmap] Leaflet library not loaded, retrying...');
        setTimeout(() => this.initMap(), 500); // Retry after 500ms
        return;
      }

      // Check if container is visible (not hidden by boot screen)
      // On mobile, we want to initialize the map even if not visible yet
      // because the ResizeObserver and retry logic in onOpen() will handle it
      const wristScreen = document.getElementById('pipboyScreen') || document.getElementById('wristScreen');
      if (wristScreen && wristScreen.classList.contains('hidden')) {
        console.log('[worldmap] pipboy screen not yet visible, but continuing with map init (mobile-friendly)');
        // Don't return early - continue with initialization
        // The onOpen() method will handle proper sizing via ResizeObserver
      }

      console.log('[worldmap] initializing map...');

      // Clear any existing map instance on the container
      if (container._leaflet_id) {
        console.warn('[worldmap] clearing existing leaflet instance');
        container._leaflet_id = undefined;
        container.innerHTML = '';
      }

      try {
        this.map = L.map(container, {
          zoomControl: false,        // added manually below with topright position
          attributionControl: false,
          worldCopyJump: false,
          preferCanvas: true, // Better performance
          // Mobile touch settings - enable all touch interactions
          tap: true,
          tapTolerance: 15,
          touchZoom: true,
          dragging: true,
          bounceAtZoomLimits: false,
          // Additional mobile-friendly settings
          scrollWheelZoom: true,
          doubleClickZoom: true,
          boxZoom: true,
          keyboard: true,
          // Inertia for smooth pan on mobile
          inertia: true,
          inertiaDeceleration: 3000,
          inertiaMaxSpeed: 1500
        });
        // Place zoom controls top-right so they don't overlap the map control
        // buttons (bottom-left) or GPS badge (bottom-right)
        L.control.zoom({ position: 'topright' }).addTo(this.map);
        console.log('[worldmap] Leaflet map object created successfully');
        // once the map exists we can watch the container; this will trigger
        // invalidateSize any time the panel resizes (orientation change,
        // keyboard showing/hiding, etc.).  It’s safe to call repeatedly.
        this.setupResizeObserver(container);
        // also react to orientation changes (some mobile browsers don't
        // fire a resize event when the virtual keyboard shows/hides, etc.)
        window.addEventListener('orientationchange', () => {
          if (this.map) {
            console.log('[worldmap] orientationchange -> invalidating map');
            this.map.invalidateSize();
          }
        });
        
        // visualViewport fires when the mobile browser chrome (address bar,
        // keyboard) shows/hides — the regular window resize does NOT always
        // fire in this case.  Without this, Leaflet's touch-event bounding
        // box goes stale so touches in the newly-visible area land in dead
        // zones and gestures stop working.
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', () => {
            if (this.map) {
              this.map.invalidateSize();
            }
          });
        }
        
        // Prevent touch events from propagating outside map container (mobile swipe fix)
        // This stops touch gestures from bubbling up to parent elements
        // which could cause page scroll/navigation. We use passive: true to allow
        // the browser to handle touch gestures smoothly - Leaflet handles its own events.
        container.addEventListener('touchstart', (e) => {
          e.stopPropagation();
        }, { passive: true });
        
        container.addEventListener('touchmove', (e) => {
          e.stopPropagation();
        }, { passive: true });
        
        container.addEventListener('touchend', (e) => {
          e.stopPropagation();
        }, { passive: true });

        // iOS Safari fires non-standard gesture* events for pinch-zoom.
        // Calling preventDefault() here tells Safari to skip its built-in
        // page-zoom behaviour so Leaflet's own pinch handler gets control.
        // Guard flag prevents duplicate listeners if initMap() is called again.
        if (!container._gestureListenersAttached) {
          container._gestureListenersAttached = true;
          container.addEventListener('gesturestart',  (e) => e.preventDefault(), { passive: false });
          container.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
          container.addEventListener('gestureend',    (e) => e.preventDefault(), { passive: false });
        }
        
        // Also prevent any parent scrolling/gestures from interfering
        const panelBody = document.querySelector('#panel-map .panel-body');
        if (panelBody) {
          panelBody.addEventListener('touchstart', (e) => {
            // Only stop propagation if touch is on the map container
            if (container.contains(e.target) || e.target === container) {
              e.stopPropagation();
            }
          }, { passive: true });
          
          panelBody.addEventListener('touchmove', (e) => {
            if (container.contains(e.target) || e.target === container) {
              e.stopPropagation();
            }
          }, { passive: true });
        }
        
      } catch (e) {
        console.error('[worldmap] failed to create map:', e);
        return;
      }

      // Expanded bounds to cover all game regions (Vegas, DC, and beyond)
      // Increased max zoom to 18 to allow closer inspection of player location
      this.map.setMinZoom(3);
      this.map.setMaxZoom(18);
      this.map.setMaxBounds([
        [70, -180],   // Northwest corner (covers Alaska)
        [20, 180]     // Southeast corner (covers all locations)
      ]);

      // Tiles with offline fallback - use OpenStreetMap for better mobile compatibility
      // and custom overview tiles when available.

      // create overview layer pointing at local tiles; may 404 if assets absent.
      // we don't want the whole map to show ugly error-tiles, so watch for
      // failures and drop the layer if the first tile request fails.
      let overviewTiles = null;
      try {
        overviewTiles = L.tileLayer("/tiles/world_overview/{z}/{x}/{y}.png", {
          minZoom: 0,
          maxZoom: 4,
          noWrap: true,
          errorTileUrl: '' // silent errors
        });

        // auto-disable if any tile errors occur (assume missing directory)
        const disableOnError = () => {
          console.warn('[worldmap] overview tile failed to load, disabling layer');
          if (overviewTiles && this.map && this.map.hasLayer(overviewTiles)) {
            this.map.removeLayer(overviewTiles);
          }
          overviewTiles = null;
        };
        overviewTiles.on('tileerror', disableOnError);
        overviewTiles.on('tileload', () => {
          // first successful tile is enough to keep the layer alive
          overviewTiles.off('tileerror', disableOnError);
        });
      } catch (e) {
        console.warn('[worldmap] overviewTiles could not be created', e);
        overviewTiles = null;
      }

      const satelliteTiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          minZoom: 0,
          maxZoom: 19,
          noWrap: true,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          // No errorTileUrl - let failed tiles be transparent instead of black
        }
      );

      // Track tile errors - switch to offline only when we're actually
      // offline or after a lot of failures.  Mobile connections can drop
      // randomly and trigger the grid even though network returns later.
      let tileErrorCount = 0;
      const baseThreshold = 10;
      const maxTileErrors = this.isMobileDevice() ? baseThreshold * 3 : baseThreshold;

      satelliteTiles.on('tileerror', (e) => {
        tileErrorCount++;
        console.warn(`[worldmap] tile load error (${tileErrorCount}/${maxTileErrors})`, e.coords, e.tile && e.tile.src);
        // only enter offline mode if the browser believes it's offline or
        // we've passed the threshold; prevents spurious grid when network is OK
        if ((tileErrorCount >= maxTileErrors || !navigator.onLine) && !this.tiles.offline) {
          console.warn('[worldmap] too many tile errors or offline, switching to offline mode');
          this.switchToOfflineMode();
        }
      });

      // Reset error count on successful tile loads
      satelliteTiles.on('tileload', () => {
        if (tileErrorCount > 0) {
          tileErrorCount = Math.max(0, tileErrorCount - 1);
        }
      });

      // Set initial view FIRST — marks the map as loaded so that subsequent
      // addTo() calls immediately invoke layer.onAdd(), which creates
      // layer._container.  Without this, updateBaseLayerForZoom fires during
      // setView and crashes on layer._container.parentNode (undefined).
      const pos = this.gs.player.position;
      this.map.setView([pos.lat, pos.lng], 15);

      // Add both layers; overview is added but hidden by zoom handler below
      satelliteTiles.addTo(this.map);
      if (overviewTiles) overviewTiles.addTo(this.map);
      
      this.tiles = { satellite: satelliteTiles };
      if (overviewTiles) this.tiles.overview = overviewTiles;

      // if we have overview tiles, swap based on a configurable zoom threshold
      if (overviewTiles) {
        // allow author to tune via settings (load defaults if missing)
        const thresh =
          (window.DATA && window.DATA.settings && window.DATA.settings.ui &&
            typeof window.DATA.settings.ui.overviewMaxZoom === 'number')
            ? window.DATA.settings.ui.overviewMaxZoom
            : 4; // default matches overview tiles' own maxZoom so satellite shows at normal zoom levels

        const updateBaseLayerForZoom = () => {
          if (!this.map) return;
          const z = this.map.getZoom();
          if (isNaN(z)) return;
          // If overview tiles were disabled (e.g. via disableOnError), always show satellite.
          if (!overviewTiles) {
            if (!this.map.hasLayer(satelliteTiles)) this.map.addLayer(satelliteTiles);
            this.updateOverlayVisibility(z);
            return;
          }
          if (z <= thresh) {
            if (!this.map.hasLayer(overviewTiles)) this.map.addLayer(overviewTiles);
            if (this.map.hasLayer(satelliteTiles)) this.map.removeLayer(satelliteTiles);
          } else {
            if (!this.map.hasLayer(satelliteTiles)) this.map.addLayer(satelliteTiles);
            if (this.map.hasLayer(overviewTiles)) this.map.removeLayer(overviewTiles);
          }
          this.updateOverlayVisibility(z);
        };
        this.map.on('zoomend', updateBaseLayerForZoom);
        updateBaseLayerForZoom();
      }
      
      // Update map status
      this.updateMapStatus('Initializing map...');

      // Layers
      this.labelLayer = L.layerGroup().addTo(this.map);
      this.roadLayer = L.layerGroup().addTo(this.map);

      // --------------------------------------------------------
      // LOAD POIs (SVG ICONS) - safe, handles grouped structure
      // Only load once to prevent duplicates
      // --------------------------------------------------------
      if (!this.poisLoaded) {
        (async () => {
          try {
            const poiData = await safeFetchJSON("/data/poi.json");
            if (!poiData) {
              console.error("[worldmap] POI data failed to load or is empty! Check /data/poi.json and network tab.");
              this.showMapMessage('Failed to load map locations. Try refreshing.');
              return;
            }
            // Flatten grouped POI structure (strip, freeside, outer_vegas, etc.)
            const allPois = [];
            if (typeof poiData === 'object' && !Array.isArray(poiData)) {
              Object.entries(poiData).forEach(([groupName, group]) => {
                if (Array.isArray(group)) {
                  allPois.push(...group);
                } else {
                  console.warn(`[worldmap] POI group '${groupName}' is not an array`, group);
                }
              });
            } else if (Array.isArray(poiData)) {
              allPois.push(...poiData);
            } else {
              console.error("[worldmap] POI data is not an object or array", poiData);
              this.showMapMessage('Map locations data format error.');
              return;
            }
            let markerCount = 0;
            allPois.forEach(poi => {
              try {
                // Validate required fields
                if (!poi.id || poi.lat == null || poi.lng == null) {
                  console.warn("[worldmap] skipping invalid POI", poi);
                  return;
                }
                // Check if marker already exists in cache
                if (this.poiMarkersCache.has(poi.id)) {
                  return; // Skip, already loaded
                }
                // Use iconKey (from data) or icon (fallback) with proper fallback mapping
                const rawIconKey = poi.iconKey || poi.icon || 'poi';
                const iconName = getValidIcon(rawIconKey);
                // Check if icon exists in /img/icons/
                const iconPath = `/img/icons/${iconName}.svg`;
                fetch(iconPath, { method: 'HEAD' }).then(resp => {
                  if (!resp.ok) {
                    console.warn(`[worldmap] Icon missing: ${iconPath}`);
                  }
                }).catch(() => {
                  console.warn(`[worldmap] Icon fetch failed: ${iconPath}`);
                });
                // Create icon with fallback error handling using shared helper
                const iconDiv = L.divIcon({
                  className: 'pipboy-poi-marker',
                  html: createIconHTML(iconName, 32),
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
                });
                const marker = L.marker([poi.lat, poi.lng], { icon: iconDiv });
                marker._pipboyData = poi; // Store POI data on marker
                // Enhanced popup with Fallout-style info
                const rarityColor = {
                  common: '#00ff41',
                  rare: '#00d4ff',
                  epic: '#d900ff',
                  legendary: '#ffaa00'
                }[poi.rarity] || '#00ff41';
                marker.bindPopup(`
                  <div style="color: ${rarityColor}; font-family: monospace;">
                    <b>${escapeHtml(poi.name)}</b><br>
                    <small>LVL ${escapeHtml(poi.lvl || '?')} • ${escapeHtml((poi.rarity || 'UNKNOWN').toUpperCase())}</small>
                  </div>
                `);
                marker.addTo(this.map);
                // Cache the marker to prevent recreation
                this.poiMarkersCache.set(poi.id, marker);
                markerCount++;
              } catch (e) {
                console.error("[worldmap] failed to add POI", poi && poi.id, e && e.message ? e.message : e);
                this.showMapMessage('Error rendering a map location.');
              }
            });
            this.poisLoaded = true;
            if (markerCount === 0) {
              this.showMapMessage('No map locations found.');
              console.warn('[worldmap] No POI markers created from poi.json');
            } else {
              console.log(`[worldmap] loaded ${markerCount} static POI markers from poi.json`);
            }
          } catch (err) {
            console.error('[worldmap] POI loading error:', err && err.message ? err.message : err);
            this.showMapMessage('Failed to load map locations.');
          }
        })();
      }

      // --------------------------------------------------------
      // LOAD HIGHWAYS (TopoJSON) - safe
      // --------------------------------------------------------
      (async () => {
        const topo = await safeFetchJSON("/data/highways.topojson");
        if (!topo || !topo.objects) return;
        try {
          if (typeof topojson !== "undefined" && topojson.feature) {
            // The topojson file has 'roads' not 'highways' in objects
            const geo = topojson.feature(topo, topo.objects.roads);
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

      // Initialize exploration mode button
      this.initExplorationControls();

      window.dispatchEvent(new Event("map-ready"));
      
      // Confirm map is ready
      this.updateMapStatus('Map online - Ready');
      console.log('[worldmap] Map initialization complete');
    },

    // Initialize map control buttons
    initExplorationControls() {
      console.log('[worldmap] Initializing exploration controls...');
      const exploreBtn = document.getElementById('exploreToggleBtn');
      if (exploreBtn) {
        console.log('[worldmap] Explore button found, attaching event listener');
        exploreBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[worldmap] Explore button clicked, toggling mode');
          this.toggleExplorationMode();
        });
      } else {
        console.warn('[worldmap] exploreToggleBtn element not found in DOM');
      }

      const expandBtn = document.getElementById('expandMapBtn');
      if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleExpandMap();
        });
      }
    },

    updateMapStatus(text) {
      const statusEl = document.getElementById('mapStatus');
      if (statusEl) {
        statusEl.textContent = text;
      }
    },

    // --------------------------------------------------------
    // AUTO FOLLOW
    // --------------------------------------------------------
    enableAutoFollow() {
      if (!this.map) return;

      // Auto-enter exploration mode the moment the user starts dragging.
      // This eliminates the frustrating 5-second snap-back: once the player
      // intentionally moves the map, we get out of their way immediately.
      // `dragstart` only fires on user-initiated drags, not programmatic setView.
      this.map.on('dragstart', () => {
        if (!this.explorationMode) {
          this.toggleExplorationMode();
        }
      });

      this.map.on("movestart", () => {
        this.autoFollowEnabled = false;
        if (this.followTimeout) clearTimeout(this.followTimeout);
      });

      this.map.on("moveend", () => {
        // Don't auto-snap back if exploration mode is enabled
        if (this.explorationMode) return;
        
        if (this.followTimeout) clearTimeout(this.followTimeout);
        this.followTimeout = setTimeout(() => {
          this.autoFollowEnabled = true;
          this.centerOnPlayer(true);
        }, this.followDelay);
      });
    },

    // Toggle exploration mode - allows free map browsing without snap-back
    toggleExplorationMode() {
      this.explorationMode = !this.explorationMode;
      console.log(`[worldmap] Exploration mode ${this.explorationMode ? 'ENABLED' : 'DISABLED'}`);
      
      // Clear any pending follow timeout
      if (this.followTimeout) {
        clearTimeout(this.followTimeout);
        this.followTimeout = null;
      }
      
      // Update UI button if it exists
      const btn = document.getElementById('exploreToggleBtn');
      const textEl = document.getElementById('exploreText');
      if (btn) {
        btn.classList.toggle('exploration-active', this.explorationMode);
        // Update the text span if it exists, otherwise update button directly
        if (textEl) {
          textEl.textContent = this.explorationMode ? 'RETURN TO PLAYER' : 'EXPLORE MAP';
        } else {
          btn.textContent = this.explorationMode ? 'RETURN TO PLAYER' : 'EXPLORE MAP';
        }
        console.log('[worldmap] Button updated, exploration mode:', this.explorationMode);
      } else {
        console.warn('[worldmap] Could not find exploreToggleBtn to update');
      }
      
      // Show status message and adjust view
      if (this.explorationMode) {
        // Zoom out to a route-planning level so players can see the broader area
        if (this.map) {
          const currentZoom = this.map.getZoom();
          if (currentZoom > 13) {
            this.map.setZoom(10, { animate: true });
          }
        }
        this.showMapMessage('EXPLORE MODE: Pan freely to plan your route');
      } else {
        this.showMapMessage('Following player position');
        this.autoFollowEnabled = true;
        this.centerOnPlayer(true);
      }
      
      return this.explorationMode;
    },

    // Toggle expand-map mode — hides the Pip-Boy header and tabs to give the
    // map more vertical space on small screens.  The pipboy-crt element receives
    // the .map-expanded class; CSS handles the rest.
    toggleExpandMap() {
      const crt = document.querySelector('.pipboy-crt');
      if (!crt) return;

      const isExpanded = crt.classList.toggle('map-expanded');
      const btn = document.getElementById('expandMapBtn');
      const textEl = document.getElementById('expandText');
      if (btn) btn.classList.toggle('expand-active', isExpanded);
      if (textEl) {
        textEl.textContent = isExpanded ? 'COLLAPSE MAP' : 'EXPAND MAP';
      }

      // Let Leaflet recalculate its canvas now that the container has grown
      if (this.map) {
        // Short delay lets the CSS transition complete before invalidating
        setTimeout(() => this.map.invalidateSize(), 50);
      }
    },

    // Manually center on player (useful when in exploration mode)
    manualCenterOnPlayer() {
      if (!this.map) return;
      const pos = this.gs.player.position;
      this.map.setView([pos.lat, pos.lng], this.map.getZoom() || 7, { animate: true });
      this.showMapMessage('Centered on player position');
    },

    centerOnPlayer(fromGPS = false) {
      if (!this.map) return;
      // In exploration mode, never auto-center the map regardless of source
      // (GPS updates still move the player marker but the view stays free)
      if (this.explorationMode) return;
      const pos = this.gs.player.position;
      if (!fromGPS && !this.autoFollowEnabled) return;
      
      // Use setView with zoom 18 for close-up view (about 400 feet above)
      // This feels like being right above the player
      const closeZoom = 18; // GPS locked view - close-up
      const currentZoom = this.map.getZoom() || 15; // Fallback to 15 if not initialized
      
      // When GPS updates, snap to player with close zoom
      if (fromGPS) {
        this.map.setView([pos.lat, pos.lng], closeZoom, { animate: true });
      } else {
        // Manual centering preserves current zoom level
        this.map.setView([pos.lat, pos.lng], currentZoom, { animate: true });
      }
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

      // Use divIcon so the inner arrow can rotate independently of the
      // outer element that Leaflet uses for lat/lng positioning (transform).
      const icon = L.divIcon({
        className: 'player-marker',
        html: '<img class="player-marker-arrow" src="/img/icons/player.svg" width="40" height="40" alt="" draggable="false">',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      this.playerMarker = L.marker([pos.lat, pos.lng], { icon, zIndexOffset: 1000 }).addTo(this.map);
    },

    setPlayerHeading(deg) {
      if (!this.playerMarker) return;

      const normalized = ((deg % 360) + 360) % 360;
      this.lastHeading = normalized;

      // Accumulate rotation to take the shortest path (avoids 359°→1° going
      // the long way round during CSS transition).
      // Seed from the real heading on first call so there is no phantom
      // rotation from 0° to the first actual heading received.
      if (this._markerHeading === undefined) this._markerHeading = normalized;
      let delta = normalized - (this._markerHeading % 360);
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      // Backstop dead zone: skip sub-1° changes to prevent CSS transition
      // re-triggering on pure floating-point noise.
      if (Math.abs(delta) < 1) return;

      this._markerHeading += delta;

      const el = this.playerMarker.getElement();
      if (!el) return;
      const arrow = el.querySelector('.player-marker-arrow');
      if (arrow) arrow.style.transform = `rotate(${this._markerHeading}deg)`;
    },

    setPlayerPosition(lat, lng, opts = {}) {
      const newPos = { lat, lng };

      // Auto-heading from movement only when device compass is not active.
      // When the compass module is running it is the heading authority; computing
      // bearing from GPS deltas while stationary produces random spike values from
      // sub-metre GPS drift, fighting the real compass reading and causing jitter.
      const compassActive = window.Game?.modules?.compass?.hasInit;
      if (this.prevPlayerPosition && opts.heading === undefined && !compassActive) {
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

    updateOverlayVisibility(_zoom) {
      // labels always visible for now
    },

    // --------------------------------------------------------
    // OFFLINE MODE FALLBACK
    // --------------------------------------------------------
    switchToOfflineMode() {
      if (this.tiles.offline) return; // Already in offline mode
      
      console.log('[worldmap] switching to offline canvas tiles');
      
      // Create canvas-based offline tiles
      const CanvasTileLayer = L.GridLayer.extend({
        createTile: function(coords) {
          const tile = document.createElement('canvas');
          const tileSize = this.getTileSize();
          tile.width = tileSize.x;
          tile.height = tileSize.y;
          
          const ctx = tile.getContext('2d');
          
          // Draw offline tile background
          ctx.fillStyle = '#0a1a0a';
          ctx.fillRect(0, 0, tile.width, tile.height);
          
          // Draw grid
          ctx.strokeStyle = '#00ff4133';
          ctx.lineWidth = 1;
          for (let i = 0; i < tile.width; i += 32) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, tile.height);
            ctx.stroke();
          }
          for (let i = 0; i < tile.height; i += 32) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(tile.width, i);
            ctx.stroke();
          }
          
          // Draw coordinates
          ctx.fillStyle = '#00ff41';
          ctx.font = '10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${coords.z}/${coords.x}/${coords.y}`, tile.width / 2, tile.height / 2);
          
          // Draw "OFFLINE" text
          ctx.font = 'bold 12px monospace';
          ctx.fillStyle = '#00ff4166';
          ctx.fillText('OFFLINE', tile.width / 2, tile.height / 2 + 20);
          
          return tile;
        }
      });
      
      this.tiles.offline = new CanvasTileLayer({
        minZoom: 0,
        maxZoom: 19
      });
      
      // Remove satellite tiles and add offline tiles
      if (this.tiles.satellite) {
        this.map.removeLayer(this.tiles.satellite);
      }
      this.tiles.offline.addTo(this.map);
      
      // Show offline message
      this.showMapMessage('MAP OFFLINE - Using grid mode');
      
      // Show retry button
      const retryBtn = document.getElementById('retryMapBtn');
      if (retryBtn) {
        retryBtn.style.display = 'block';
        retryBtn.onclick = () => this.trySwitchToOnlineMode();
      }
    },

    // Try to switch back to online tiles
    trySwitchToOnlineMode() {
      if (!this.tiles.offline) return; // Not in offline mode

      console.log('[worldmap] attempting to switch back to online tiles');

      // Create new satellite tiles (same Esri imagery as initial setup)
      const satelliteTiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          minZoom: 0,
          maxZoom: 19,
          noWrap: true,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          // No errorTileUrl - let failed tiles be transparent
        }
      );

      let tileErrorCount = 0;
      const maxTileErrors = 3; // Be more lenient when trying to go back online

      satelliteTiles.on('tileerror', (_e) => {
        tileErrorCount++;
        if (tileErrorCount >= maxTileErrors) {
          console.warn('[worldmap] still having tile issues, staying offline');
          this.showMapMessage('Still offline - check connection');
        }
      });

      satelliteTiles.on('tileload', () => {
        // If we successfully load some tiles, switch to online mode
        if (this.tiles.offline) {
          console.log('[worldmap] tiles loading successfully, switching to online mode');
          this.map.removeLayer(this.tiles.offline);
          delete this.tiles.offline;
          this.tiles.satellite = satelliteTiles;
          this.showMapMessage('Map online!');

          // Hide retry button
          const retryBtn = document.getElementById('retryMapBtn');
          if (retryBtn) {
            retryBtn.style.display = 'none';
          }
        }
      });

      // Add the new tiles (they'll load in background)
      satelliteTiles.addTo(this.map);
      this.tiles.satellite = satelliteTiles;
    },

    // --------------------------------------------------------
    // LOCATIONS + POI MARKERS
    // --------------------------------------------------------
    async loadLocations() {
      // Prevent concurrent loads – a previous call is already in-flight.
      if (this._loadingLocations) return;
      this._loadingLocations = true;
      try {
        // try API first
        const apiLocations = await safeFetchJSON("/api/locations");
        if (Array.isArray(apiLocations) && apiLocations.length) {
          this.locations = this.filterDiscoveredLocations(apiLocations);
          this.locationsLoaded = true;
          this._loadingLocations = false;
          this.renderPOIMarkers();
          return;
        }

        // fallback to static file
        const staticLocations = await safeFetchJSON("/data/locations.json");
        if (Array.isArray(staticLocations) && staticLocations.length) {
          this.locations = this.filterDiscoveredLocations(staticLocations);
        } else {
          this.locations = [];
          console.warn("[worldmap] no locations available from API or static fallback");
        }
      } catch (e) {
        console.warn("[worldmap] loadLocations error", e && e.message ? e.message : e);
        this.locations = [];
      }
      this.locationsLoaded = true;
      this._loadingLocations = false;
      this.renderPOIMarkers();
    },

    filterDiscoveredLocations(locations) {
      return locations.filter(loc => {
        // Always show canon locations (Fallout lore)
        if (loc.source === "canon" || loc.source === "canon_tv") {
          return true;
        }
        // For generated locations, only show if discovered
        if (loc.source === "generated_world") {
          return Game.modules.PlayerState.isPOIDiscovered(loc.id);
        }
        // Default: show if discovered or if no source (legacy)
        return !loc.source || Game.modules.PlayerState.isPOIDiscovered(loc.id);
      });
    },

    renderPOIMarkers() {
      if (!this.map) return;
      
      // Create a set of current location IDs for efficient lookup
      const currentLocationIds = new Set((this.locations || []).map(loc => loc.id).filter(id => id));
      
      // Remove markers that are no longer in the locations list
      const markersToRemove = [];
      this.poiMarkers.forEach(m => {
        if (m.loc && m.loc.id && !currentLocationIds.has(m.loc.id)) {
          markersToRemove.push(m);
        }
      });
      
      markersToRemove.forEach(m => {
        try {
          if (m.marker && this.map.hasLayer(m.marker)) {
            this.map.removeLayer(m.marker);
            if (m.loc && m.loc.id) {
              this.poiMarkersCache.delete(m.loc.id);
            }
          }
        } catch (e) {
          console.warn("[worldmap] failed to remove POI marker", e);
        }
      });
      
      // Update poiMarkers array to only include markers still on map
      this.poiMarkers = this.poiMarkers.filter(m => 
        !markersToRemove.includes(m)
      );

      // Add or update markers for current locations
      (this.locations || []).forEach((loc, idx) => {
        try {
          // Validate required fields
          if (!loc.id || loc.lat == null || loc.lng == null) {
            console.warn("[worldmap] skipping invalid location", loc);
            return;
          }
          
          // Check if marker already exists in cache
          if (this.poiMarkersCache.has(loc.id)) {
            // Marker already exists, check if it needs updating
            const cachedMarker = this.poiMarkersCache.get(loc.id);
            const cachedData = cachedMarker._pipboyData;
            
            // Only update if position changed
            if (cachedData && (cachedData.lat !== loc.lat || cachedData.lng !== loc.lng)) {
              cachedMarker.setLatLng([loc.lat, loc.lng]);
              cachedMarker._pipboyData = loc;
            }
            return; // Skip creation, marker already exists
          }
          
          // Create new marker
          const marker = this.createPOIMarker(loc, idx);
          marker.addTo(this.map);
          
          // Cache the marker
          this.poiMarkersCache.set(loc.id, marker);
          this.poiMarkers.push({ marker, loc });
        } catch (e) {
          console.warn("[worldmap] failed to create POI marker", loc && loc.id, e && e.message ? e.message : e);
        }
      });
      
      console.log(`[worldmap] POI markers: ${this.poiMarkers.length} dynamic + ${this.poiMarkersCache.size - this.poiMarkers.length} static`);
    },

    createPOIMarker(loc, idx) {
      const rarity = loc.rarity || "common";
      
      // Rarity-based styling for the label
      const rarityColor = {
        common: '#00ff41',
        rare: '#00d4ff',
        epic: '#d900ff',
        legendary: '#ffaa00'
      }[rarity] || '#00ff41';
      
      // Use SVG icon from the icon field, with proper fallback mapping for missing icons
      const rawIconKey = loc.icon || loc.iconKey || 'poi';
      const iconName = getValidIcon(rawIconKey);
      
      // Create divIcon with embedded image and onerror handler using shared helper
      const icon = L.divIcon({
        className: `pipboy-poi-marker poi-marker-${rarity}`,
        html: createIconHTML(iconName, 28),
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon });
      marker._pipboyData = loc;

      // Bind persistent tooltip (location label) that's always visible at higher zoom
      marker.bindTooltip(
        `<span style="color: ${rarityColor}; font-family: 'VT323', monospace; font-size: clamp(11px, 2vw, 13px); text-shadow: 0 0 4px ${rarityColor};">${escapeHtml(loc.name || 'Unknown')}</span>`,
        {
          permanent: false,
          direction: 'top',
          offset: [0, -14],
          className: 'poi-label-tooltip'
        }
      );

      // Bind popup with more details for click interaction
      marker.bindPopup(`
        <div style="color: ${rarityColor}; font-family: 'VT323', monospace;">
          <b>${escapeHtml(loc.name || 'Unknown Location')}</b><br>
          <small>LVL ${escapeHtml(loc.lvl || '?')} • ${escapeHtml((rarity || 'COMMON').toUpperCase())}</small>
        </div>
      `);

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
      // Auto-remove after 5 seconds so the log doesn't accumulate and block the map
      setTimeout(function () {
        if (line.parentNode === log) log.removeChild(line);
      }, 5000);
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

  // Listen for wristReady and pipboyReady events to initialize map
  window.addEventListener('wristReady', () => {
    console.log('[worldmap] wristReady event received, initializing...');
    if (worldmapModule.onOpen) {
      // Use requestAnimationFrame to wait for browser reflow after hidden class is removed
      // This ensures the container has proper dimensions before we try to initialize
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          worldmapModule.onOpen();
        });
      });
    }
  });

  // Legacy support
  window.addEventListener('pipboyReady', () => {
    console.log('[worldmap] pipboyReady event received, initializing (legacy)...');
    if (worldmapModule.onOpen) {
      // Use requestAnimationFrame to wait for browser reflow after hidden class is removed
      // This ensures the container has proper dimensions before we try to initialize
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          worldmapModule.onOpen();
        });
      });
    }
  });

  console.log('[worldmap] module loaded, waiting for wristReady / pipboyReady events');
})();