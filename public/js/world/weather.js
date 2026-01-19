// weather.js (v2)
// ------------------------------------------------------------
// Region‑Aware, Anomaly‑Aware, Timeline‑Aware Weather Engine
// Integrates: Regions, Factions, Anomalies, Timeline, WorldState
// ------------------------------------------------------------

(function () {
  "use strict";

  const Regions = window.overseerRegions;
  const Factions = window.overseerFaction;
  const Timeline = window.overseerTimeline;
  const WorldState = window.overseerWorldState;

  // ------------------------------------------------------------
  // Weighted pick helper
  // ------------------------------------------------------------
  function weightedPick(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * total;

    for (const [key, weight] of entries) {
      if (roll < weight) return key;
      roll -= weight;
    }
    return entries[entries.length - 1][0];
  }

  // ------------------------------------------------------------
  // Weather tables
  // ------------------------------------------------------------
  const BASE_WEATHER = {
    clear: 1,
    cloudy: 1,
    storm: 0.5,
    rad_storm: 0.1,
    heatwave: 0.3,
    cold_snap: 0.3
  };

  const ANOMALY_WEATHER = {
    anomaly_surge: 0.4,
    distortion_fog: 0.3,
    static_haze: 0.2,
    gamma_lightning: 0.1
  };

  const FACTION_WEATHER = {
    "the_circuit": { emp_storm: 0.4, static_haze: 0.3 },
    "hollow_choir": { ritual_fog: 0.5 },
    "fizzco_remnants": { chemical_smog: 0.5 }
  };

  // ------------------------------------------------------------
  // Main weather roll
  // ------------------------------------------------------------
  function rollWeather() {
    const regionId = WorldState.currentRegion;
    const region = Regions.get(regionId);
    const faction = Factions.getControl(regionId);
    const anomalyLevel = region.anomalyLevel || 0;

    let table = { ...BASE_WEATHER };

    // Region bias
    if (region.weatherBias) {
      table[region.weatherBias] = (table[region.weatherBias] || 0) + 1.5;
    }

    // Anomaly influence
    if (anomalyLevel > 0.3) {
      for (const [k, v] of Object.entries(ANOMALY_WEATHER)) {
        table[k] = (table[k] || 0) + v * anomalyLevel;
      }
    }

    // Faction influence
    if (FACTION_WEATHER[faction]) {
      for (const [k, v] of Object.entries(FACTION_WEATHER[faction])) {
        table[k] = (table[k] || 0) + v;
      }
    }

    // Timeline distortions
    if (Timeline.isUnstable(regionId)) {
      table["distortion_fog"] = (table["distortion_fog"] || 0) + 0.5;
      table["static_haze"] = (table["static_haze"] || 0) + 0.5;
    }

    const type = weightedPick(table);

    return {
      type,
      anomaly: anomalyLevel,
      faction,
      region: regionId,
      timestamp: Date.now()
    };
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  function updateWeather() {
    const w = rollWeather();
    WorldState.currentWeather = w;

    // Overseer hook
    if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
      window.overseer.handleGameEvent({
        type: "weather_change",
        payload: { id: w.type }
      });
    }

    return w;
  }

  function getCurrent() {
    return WorldState.currentWeather || rollWeather();
  }

  // Expose globally
  window.overseerWeather = {
    updateWeather,
    getCurrent
  };
})();
