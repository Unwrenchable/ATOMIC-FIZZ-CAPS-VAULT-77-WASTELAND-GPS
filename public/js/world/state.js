// state.js (WorldState v2)
// ------------------------------------------------------------
// Central World State Engine
// Tracks: region, weather, factions, anomalies, timeline,
// flags, player, memory hooks.
// ------------------------------------------------------------

(function () {
  "use strict";

  const WorldState = {
    // --------------------------------------------------------
    // CORE STATE
    // --------------------------------------------------------
    currentRegion: null,
    currentWeather: null,

    factionControl: {},     // regionId -> factionId
    anomalyLevels: {},      // regionId -> 0..1
    timeline: {
      unstableRegions: [],  // array of regionIds
      globalInstability: 0  // 0..1
    },

    worldFlags: {},         // arbitrary global flags
    events: [],             // queued world events

    player: {
      hp: 100,
      caps: 0,
      inventory: [],
      perks: [],
      reputation: {}        // factionId -> numeric rep
    },

    // --------------------------------------------------------
    // REGION
    // --------------------------------------------------------
    setRegion(regionId) {
      this.currentRegion = regionId;

      // Notify Overseer
      if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
        window.overseer.handleGameEvent({
          type: "location",
          payload: { regionId }
        });
      }
    },

    getRegion() {
      return this.currentRegion;
    },

    // --------------------------------------------------------
    // WEATHER
    // --------------------------------------------------------
    setWeather(weatherObj) {
      this.currentWeather = weatherObj;

      if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
        window.overseer.handleGameEvent({
          type: "weather_change",
          payload: { id: weatherObj.type }
        });
      }
    },

    getWeather() {
      return this.currentWeather;
    },

    // --------------------------------------------------------
    // FACTION CONTROL
    // --------------------------------------------------------
    setFactionControl(regionId, factionId) {
      this.factionControl[regionId] = factionId;
    },

    getFactionControl(regionId) {
      return this.factionControl[regionId] || null;
    },

    // --------------------------------------------------------
    // ANOMALY LEVELS
    // --------------------------------------------------------
    setAnomalyLevel(regionId, level) {
      this.anomalyLevels[regionId] = Math.max(0, Math.min(1, level));
    },

    getAnomalyLevel(regionId) {
      return this.anomalyLevels[regionId] || 0;
    },

    // --------------------------------------------------------
    // TIMELINE
    // --------------------------------------------------------
    markRegionUnstable(regionId) {
      if (!this.timeline.unstableRegions.includes(regionId)) {
        this.timeline.unstableRegions.push(regionId);
      }
    },

    markRegionStable(regionId) {
      this.timeline.unstableRegions = this.timeline.unstableRegions.filter(
        (id) => id !== regionId
      );
    },

    isRegionUnstable(regionId) {
      return this.timeline.unstableRegions.includes(regionId);
    },

    setGlobalInstability(value) {
      this.timeline.globalInstability = Math.max(0, Math.min(1, value));
    },

    getGlobalInstability() {
      return this.timeline.globalInstability;
    },

    // --------------------------------------------------------
    // WORLD FLAGS
    // --------------------------------------------------------
    setFlag(key, value = true) {
      this.worldFlags[key] = value;
    },

    getFlag(key) {
      return this.worldFlags[key];
    },

    // --------------------------------------------------------
    // PLAYER STATE
    // --------------------------------------------------------
    setPlayerHp(hp) {
      this.player.hp = hp;
    },

    addCaps(amount) {
      this.player.caps = (this.player.caps || 0) + amount;
      if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
        window.overseer.handleGameEvent({
          type: "caps",
          payload: { caps: this.player.caps }
        });
      }
    },

    addInventoryItem(itemId) {
      this.player.inventory.push(itemId);
      if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
        window.overseer.handleGameEvent({
          type: "inventory",
          payload: { itemId }
        });
      }
    },

    setReputation(factionId, value) {
      this.player.reputation[factionId] = value;
    },

    getReputation(factionId) {
      return this.player.reputation[factionId] || 0;
    },

    // --------------------------------------------------------
    // EVENTS
    // --------------------------------------------------------
    queueEvent(evt) {
      this.events.push(evt);
    },

    nextEvent() {
      return this.events.shift() || null;
    }
  };

  // Expose globally
  window.overseerWorldState = WorldState;
})();
