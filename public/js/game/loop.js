// loop.js (v1)
// ------------------------------------------------------------
// Core Game Loop
// Drives: region updates, weather, encounters, anomalies,
// timeline, Overseer reactions, and world ticks.
// ------------------------------------------------------------

(function () {
  "use strict";

  const WorldState = window.overseerWorldState;
  const Weather = window.overseerWeather;
  const Encounters = window.overseerEncounters;
  const Regions = window.overseerRegions;
  const Timeline = window.overseerTimeline;
  const Anomalies = window.overseerAnomalies;

  // ------------------------------------------------------------
  // CONFIG
  // ------------------------------------------------------------
  const TICK_INTERVAL = 6000; // 6 seconds per world tick
  const ENCOUNTER_CHANCE = 0.35; // 35% chance per tick

  let lastRegion = null;

  // ------------------------------------------------------------
  // Region Change Handler
  // ------------------------------------------------------------
  function handleRegionChange() {
    const regionId = WorldState.getRegion();
    if (regionId !== lastRegion) {
      lastRegion = regionId;

      const region = Regions.get(regionId);

      // Weather reacts to region
      Weather.updateWeather(region);

      // Overseer reacts to region change
      if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
        window.overseer.handleGameEvent({
          type: "location",
          payload: { regionId }
        });
      }
    }
  }

  // ------------------------------------------------------------
  // World Tick
  // ------------------------------------------------------------
  function worldTick() {
    const regionId = WorldState.getRegion();
    const region = Regions.get(regionId);

    // 1. Region change detection
    handleRegionChange();

    // 2. Weather tick
    Weather.tick(region);

    // 3. Timeline instability tick
    if (Math.random() < 0.05) {
      const instability = WorldState.getGlobalInstability() + 0.01;
      WorldState.setGlobalInstability(instability);
    }

    // 4. Anomaly drift
    const anomaly = WorldState.getAnomalyLevel(regionId);
    if (Math.random() < 0.1) {
      const drift = anomaly + (Math.random() * 0.1 - 0.05);
      WorldState.setAnomalyLevel(regionId, drift);
    }

    // 5. Random encounter
    if (Math.random() < ENCOUNTER_CHANCE) {
      const encounter = Encounters.rollEncounter();
      handleEncounter(encounter);
    }
  }

  // ------------------------------------------------------------
  // Encounter Handler
  // ------------------------------------------------------------
  function handleEncounter(encounter) {
    if (!encounter) return;

    // Notify Overseer
    if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
      window.overseer.handleGameEvent({
        type: "encounter",
        payload: { encounterType: encounter.type }
      });
    }

    // Push to UI (if you have a UI event bus)
    if (window.gameUI && typeof window.gameUI.pushEncounter === "function") {
      window.gameUI.pushEncounter(encounter);
    }
  }

  // ------------------------------------------------------------
  // Start Loop
  // ------------------------------------------------------------
  function start() {
    setInterval(worldTick, TICK_INTERVAL);
  }

  // Expose globally
  window.overseerGameLoop = { start };
})();
