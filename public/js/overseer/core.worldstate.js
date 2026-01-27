// core.worldstate.js
// World simulation state for Overseer AI awareness
// ---------------------------------------------------------------------------

(function () {
  "use strict";
  
  // World state tracking - shared between game and overseer
  window.overseerWorldState = {
    player: {
      hp: 100,
      rads: 0,
      caps: 0,
      faction: "UNALIGNED",
      location: {
        id: "unknown",
        name: "Unknown Location",
        regionId: null,
        lat: null,
        lng: null
      }
    },
    
    time: {
      hour: 12,
      day: 1,
      isNight: false
    },
    
    weather: {
      current: "clear",
      severity: 0
    },
    
    threat: {
      level: 0,
      nearby: []
    },
    
    // Update player state
    updatePlayer(data) {
      if (data) {
        Object.assign(this.player, data);
      }
    },
    
    // Update location
    updateLocation(loc) {
      if (loc) {
        Object.assign(this.player.location, loc);
      }
    },
    
    // Get current state snapshot
    snapshot() {
      return {
        player: { ...this.player },
        time: { ...this.time },
        weather: { ...this.weather },
        threat: { ...this.threat }
      };
    }
  };
  
})();
