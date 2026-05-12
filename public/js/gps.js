// public/js/gps.js
// Stable GPS wrapper for Pocket-Boy + Worldmap

window.Game = window.Game || {};

Game.gps = {
  lastUpdate: 0,
  coords: { lat: null, lng: null },
  ready: false,
  watchId: null,
  snapToPlayer: true, // Enable auto-snap to player position

  // Debounce state — GPS fires every 1-3 s on mobile; we only propagate
  // updates that cross a meaningful distance threshold OR enough time has
  // elapsed, to avoid redundant encounter rolls and marker re-renders.
  _lastProcessedLat: null,
  _lastProcessedLng: null,
  _lastProcessedTime: 0,
  // Minimum movement (metres) OR minimum interval (ms) to trigger a full update.
  _minMovementMetres: 10,
  _minIntervalMs: 15000,

  // Called only after worldmap is ready
  init() {
    if (this.ready) return;
    this.ready = true;

    console.log("[gps] init (delayed until map-ready)");

    this.startWatch();
    this.updateGPSBadge('acquiring');
  },

  startWatch() {
    if (!navigator.geolocation) {
      console.warn("[gps] Geolocation not supported");
      this.updateGPSBadge('unavailable');
      return;
    }

    // Prevent duplicate watchers
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    // Use lower accuracy (network-based) when the page is not visible to save
    // battery; switch back to high accuracy (GPS chip) when visible again.
    const hidden = document.hidden;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => this.handleError(err),
      {
        enableHighAccuracy: !hidden,
        maximumAge: hidden ? 60000 : 10000,
        timeout: 15000
      }
    );
  },

  handleError(err) {
    console.warn("[gps] Error:", err.message);
    let status = 'error';
    let retry = false;

    switch (err.code) {
      case err.PERMISSION_DENIED:
        status = 'error';
        // Don't retry on permission denied
        break;
      case err.POSITION_UNAVAILABLE:
        status = 'error';
        retry = true;
        break;
      case err.TIMEOUT:
        status = 'error';
        retry = true;
        break;
      default:
        status = 'error';
        retry = true;
    }

    this.updateGPSBadge(status);

    if (retry && this.retryCount < 3) {
      this.retryCount = (this.retryCount || 0) + 1;
      console.log(`[gps] Retrying GPS (${this.retryCount}/3) in 2 seconds...`);
      setTimeout(() => this.startWatch(), 2000);
    } else {
      this.retryCount = 0;
    }
  },

  // Haversine distance in metres between two lat/lng points.
  _distanceMetres(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in metres
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  handlePosition(pos) {
    const { latitude, longitude, accuracy } = pos.coords;

    // Sanity check
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      console.warn("[gps] Invalid coords");
      this.updateGPSBadge('error');
      return;
    }

    this.coords = { lat: latitude, lng: longitude };
    this.lastUpdate = Date.now();

    // Debounce: skip expensive map/encounter work if the player hasn't moved
    // more than _minMovementMetres AND the minimum interval hasn't elapsed.
    const now = Date.now();
    const hasPrev = this._lastProcessedLat !== null;
    const movedEnough = hasPrev
      ? this._distanceMetres(this._lastProcessedLat, this._lastProcessedLng, latitude, longitude) >= this._minMovementMetres
      : true;
    const timeElapsed = (now - this._lastProcessedTime) >= this._minIntervalMs;

    if (hasPrev && !movedEnough && !timeElapsed) {
      // Update gameState position silently so other systems can read it,
      // but skip the heavy worldmap update + encounter rolls.
      if (!window.gameState) window.gameState = {};
      if (!gameState.player) gameState.player = {};
      gameState.player.position = { lat: latitude, lng: longitude };
      this.updateGPSBadge(accuracy < 50 ? 'good' : 'fair');
      return;
    }

    this._lastProcessedLat = latitude;
    this._lastProcessedLng = longitude;
    this._lastProcessedTime = now;

    // Update gameState safely
    if (!window.gameState) window.gameState = {};
    if (!gameState.player) gameState.player = {};
    gameState.player.position = { lat: latitude, lng: longitude };

    // Update GPS badge with accuracy
    this.updateGPSBadge(accuracy < 50 ? 'good' : 'fair');

    // Update worldmap - use correct path to module
    const worldmap = window.Game?.modules?.worldmap;
    if (worldmap && worldmap.map && worldmap.updatePlayerPosition) {
      worldmap.updatePlayerPosition(latitude, longitude, { fromGPS: true });
      
      // Force snap to player if enabled
      if (this.snapToPlayer && worldmap.centerOnPlayer) {
        worldmap.autoFollowEnabled = true;
        worldmap.centerOnPlayer(true);
      }
    }
  },

  updateGPSBadge(status) {
    const dot = document.getElementById('accDot');
    const text = document.getElementById('accText');
    
    if (!dot || !text) return;

    // Remove all status classes
    dot.classList.remove('acc-good', 'acc-bad', 'acc-fair');

    switch (status) {
      case 'good':
        dot.classList.add('acc-good');
        text.textContent = 'GPS: LOCKED';
        break;
      case 'fair':
        dot.classList.add('acc-fair');
        text.textContent = 'GPS: TRACKING';
        break;
      case 'acquiring':
        dot.classList.add('acc-fair');
        text.textContent = 'GPS: ACQUIRING...';
        break;
      case 'error':
        dot.classList.add('acc-bad');
        text.textContent = 'GPS: ERROR';
        break;
      case 'unavailable':
        dot.classList.add('acc-bad');
        text.textContent = 'GPS: UNAVAILABLE';
        break;
      default:
        dot.classList.add('acc-bad');
        text.textContent = 'GPS: OFFLINE';
    }
  },

  // Used by worldmap.js
  ensurePlayerPosition() {
    return this.coords;
  },

  // Toggle snap-to-player behavior
  setSnapToPlayer(enabled) {
    this.snapToPlayer = enabled;
    console.log("[gps] snapToPlayer:", enabled);
  }
};

// Delay GPS init until worldmap is ready
window.addEventListener("map-ready", () => {
  console.log("[gps] map-ready received → starting GPS");
  Game.gps.init();
});

// Page Visibility API — switch accuracy mode to save battery when the
// page is in the background, restore full-accuracy GPS when it returns.
if (!window._gpsVisibilityBound) {
  window._gpsVisibilityBound = true;
  document.addEventListener('visibilitychange', function () {
    if (!Game.gps.ready) return;
    // Restart the watcher so the options (enableHighAccuracy / maximumAge)
    // are updated to reflect the new visibility state.
    Game.gps.startWatch();
  });
}
