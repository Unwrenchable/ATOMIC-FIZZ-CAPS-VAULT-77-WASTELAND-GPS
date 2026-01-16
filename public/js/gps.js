// public/js/gps.js
// Simple GPS wrapper for Pip‑Boy + Worldmap

window.Game = window.Game || {};

Game.gps = {
  lastUpdate: 0,
  coords: { lat: null, lng: null },

  // Called by Pip‑Boy on startup
  init() {
    console.log("[gps] init");
    this.watchPosition();
  },

  // Browser geolocation
  watchPosition() {
    if (!navigator.geolocation) {
      console.warn("[gps] Geolocation not supported");
      return;
    }

    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.coords = { lat: latitude, lng: longitude };
        this.lastUpdate = Date.now();

        // Update player marker on map
        if (window.worldmap && worldmap.updatePlayerPosition) {
          worldmap.updatePlayerPosition(latitude, longitude);
        }
      },
      (err) => {
        console.warn("[gps] Error:", err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  },

  // Used by worldmap.js
  ensurePlayerPosition() {
    return this.coords;
  }
};

// Auto‑init
document.addEventListener("DOMContentLoaded", () => Game.gps.init());
