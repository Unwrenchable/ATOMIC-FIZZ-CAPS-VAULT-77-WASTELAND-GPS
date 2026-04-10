// public/js/gps.js
// Stable GPS wrapper for Pocket-Boy + Worldmap

window.Game = window.Game || {};

Game.gps = {
  lastUpdate: 0,
  coords: { lat: null, lng: null },
  ready: false,
  watchId: null,
  snapToPlayer: true, // Enable auto-snap to player position

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
      (err) => {
        console.warn("[gps] Error:", err.message);
        this.updateGPSBadge('error');
      },
      {
        enableHighAccuracy: !hidden,
        maximumAge: hidden ? 60000 : 10000,
        timeout: 15000
      }
    );
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
