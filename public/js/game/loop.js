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
  const ENCOUNTER_COOLDOWN_MS = 30000;

  let lastRegion = null;
  let lastEncounterKey = null;
  let lastEncounterAt = 0;

  // ------------------------------------------------------------
  // Region Change Handler
  // ------------------------------------------------------------
  function handleRegionChange() {
    // Guard: ensure WorldState and Regions are available with required methods
    if (!WorldState || typeof WorldState.getRegion !== "function") {
      return;
    }
    if (!Regions || typeof Regions.get !== "function") {
      return;
    }

    const regionId = WorldState.getRegion();
    if (regionId !== lastRegion) {
      lastRegion = regionId;

      const region = Regions.get(regionId);

      // Weather reacts to region (guard: Weather may not be available)
      if (Weather && typeof Weather.updateWeather === "function") {
        Weather.updateWeather(region);
      }

      // Overseer reacts to region change
      if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
        window.overseer.handleGameEvent({
          type: "location",
          payload: { regionId }
        });
      }
    }
  }

  function getEncounterKey(encounter) {
    if (!encounter || !encounter.type) return null;
    const id =
      encounter.id ||
      encounter.quest?.id ||
      encounter.event?.id ||
      encounter.npc?.id ||
      encounter.merchant?.id;
    return id ? `${encounter.type}:${id}` : encounter.type;
  }

  // ------------------------------------------------------------
  // World Tick
  // ------------------------------------------------------------
  function worldTick() {
    // Guard: ensure WorldState is available and has the required method
    if (!WorldState || typeof WorldState.getRegion !== "function") {
      return;
    }

    const regionId = WorldState.getRegion();

    // Guard: ensure Regions is available before using it
    if (!Regions || typeof Regions.get !== "function") {
      return;
    }

    const region = Regions.get(regionId);

    // 1. Region change detection
    handleRegionChange();

    // 2. Weather update (guard: Weather may not be available)
    // Note: tick() is preferred if available, otherwise fall back to updateWeather()
    if (Weather) {
      if (typeof Weather.tick === "function") {
        Weather.tick(region);
      } else if (typeof Weather.updateWeather === "function") {
        Weather.updateWeather(region);
      }
    }

    // 3. Timeline instability tick (guard: methods may not exist)
    const hasInstabilityMethods =
      typeof WorldState.getGlobalInstability === "function" &&
      typeof WorldState.setGlobalInstability === "function";
    if (hasInstabilityMethods && Math.random() < 0.05) {
      const instability = WorldState.getGlobalInstability() + 0.01;
      WorldState.setGlobalInstability(instability);
    }

    // 4. Anomaly drift (guard: methods may not exist)
    const hasAnomalyMethods =
      typeof WorldState.getAnomalyLevel === "function" &&
      typeof WorldState.setAnomalyLevel === "function";
    if (hasAnomalyMethods) {
      const anomaly = WorldState.getAnomalyLevel(regionId);
      if (Math.random() < 0.1) {
        const drift = Math.max(0, Math.min(1, anomaly + (Math.random() * 0.1 - 0.05)));
        WorldState.setAnomalyLevel(regionId, drift);
      }
    }

    // 5. Random encounter (guard: Encounters may not be available)
    const canRollEncounter = Encounters && typeof Encounters.rollEncounter === "function";
    if (canRollEncounter && Math.random() < ENCOUNTER_CHANCE) {
      const encounter = Encounters.rollEncounter();
      const key = getEncounterKey(encounter);
      const now = Date.now();

      if (key && key === lastEncounterKey && now - lastEncounterAt < ENCOUNTER_COOLDOWN_MS) {
        return;
      }

      if (key) {
        lastEncounterKey = key;
        lastEncounterAt = now;
      }
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
