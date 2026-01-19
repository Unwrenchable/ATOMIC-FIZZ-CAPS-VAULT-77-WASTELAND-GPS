// public/js/gps.js
// Stable GPS wrapper for Pip‑Boy + Worldmap

window.Game = window.Game || {};

Game.gps = {
  lastUpdate: 0,
  coords: { lat: null, lng: null },
  ready: false,
  watchId: null,

  // Called only after worldmap is ready
  init() {
    if (this.ready) return;
    this.ready = true;

    console.log("[gps] init (delayed until map-ready)");

    this.startWatch();
  },

  startWatch() {
    if (!navigator.geolocation) {
      console.warn("[gps] Geolocation not supported");
      return;
    }

    // Prevent duplicate watchers
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => console.warn("[gps] Error:", err.message),
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000
      }
    );
  },

  handlePosition(pos) {
    const { latitude, longitude } = pos.coords;

    // Sanity check
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      console.warn("[gps] Invalid coords");
      return;
    }

    this.coords = { lat: latitude, lng: longitude };
    this.lastUpdate = Date.now();

    // Update gameState safely
    if (!window.gameState) window.gameState = {};
    if (!gameState.player) gameState.player = {};
    gameState.player.position = { lat: latitude, lng: longitude };

    // Update worldmap only if it's fully ready
    if (window.worldmap && worldmap.map && worldmap.updatePlayerPosition) {
      worldmap.updatePlayerPosition(latitude, longitude, { fromGPS: true });
    }
  },

  // Used by worldmap.js
  ensurePlayerPosition() {
    return this.coords;
  }
};

// Delay GPS init until worldmap is ready
window.addEventListener("map-ready", () => {
  console.log("[gps] map-ready received → starting GPS");
  Game.gps.init();
});
