
// factions.js (v2)
// ------------------------------------------------------------
// Unified Faction Influence Engine
// Loads: canon factions + custom factions
// Provides: reputation, region control, hostility, patrols,
// loot bias, weather influence, overseer hooks.
// ------------------------------------------------------------

(function () {
  "use strict";

  const WorldState = window.overseerWorldState;

  // Internal storage
  let CANON = {};
  let CUSTOM = {};
  let ALL = {};

  // ------------------------------------------------------------
  // Load both faction files
  // ------------------------------------------------------------
  async function loadFactions() {
    if (Object.keys(ALL).length > 0) return ALL;

    // Load canon factions
    const canonRes = await fetch("/data/factions/factions.json");
    const canonData = await canonRes.json();
    CANON = {};
    canonData.forEach(f => CANON[f.id] = f);

    // Load custom factions
    const customRes = await fetch("/data/factions/factions_custom.json");
    const customData = await customRes.json();
    CUSTOM = {};
    customData.factions.forEach(f => CUSTOM[f.id] = f);

    // Merge
    ALL = { ...CANON, ...CUSTOM };
    return ALL;
  }

  // ------------------------------------------------------------
  // Get faction object
  // ------------------------------------------------------------
  function getFaction(id) {
    return ALL[id] || null;
  }

  // ------------------------------------------------------------
  // Reputation
  // ------------------------------------------------------------
  function getReputation(factionId) {
    return WorldState.getReputation(factionId);
  }

  function reputationLabel(rep, factionId) {
    const f = getFaction(factionId);
    if (!f || !f.reputationLevels) {
      // fallback generic scale
      if (rep >= 75) return "ALLY";
      if (rep >= 40) return "FRIENDLY";
      if (rep >= 10) return "NEUTRAL";
      if (rep >= -20) return "UNFRIENDLY";
      return "HOSTILE";
    }

    // Map numeric rep to faction-specific labels
    const levels = f.reputationLevels;
    if (rep <= -75) return levels[0];
    if (rep <= -40) return levels[1];
    if (rep <= -10) return levels[2];
    if (rep <= 10) return levels[3];
    if (rep <= 40) return levels[4];
    if (rep <= 75) return levels[5];
    return levels[levels.length - 1];
  }

  // ------------------------------------------------------------
  // Region Control
  // ------------------------------------------------------------
  function getControl(regionId) {
    return WorldState.getFactionControl(regionId);
  }

  function setControl(regionId, factionId) {
    WorldState.setFactionControl(regionId, factionId);
  }

  // ------------------------------------------------------------
  // Hostility
  // ------------------------------------------------------------
  function isHostile(factionA, factionB) {
    const A = getFaction(factionA);
    if (!A) return false;

    if (A.enemies && A.enemies.includes("everyone")) return true;
    return A.enemies && A.enemies.includes(factionB);
  }

  // ------------------------------------------------------------
  // Patrol Logic
  // ------------------------------------------------------------
  function rollPatrol(regionId) {
    const factionId = getControl(regionId);
    if (!factionId) return null;

    const f = getFaction(factionId);
    if (!f || !f.patrolChance) return null;

    if (Math.random() < f.patrolChance) {
      return {
        type: "patrol",
        faction: factionId,
        message: `${f.name} patrol spotted in the area.`
      };
    }

    return null;
  }

  // ------------------------------------------------------------
  // Loot Bias
  // ------------------------------------------------------------
  function getLootBias(factionId) {
    const f = getFaction(factionId);
    return f ? f.lootBias : null;
  }

  // ------------------------------------------------------------
  // Weather Influence
  // ------------------------------------------------------------
  function getWeatherInfluence(factionId) {
    const f = getFaction(factionId);
    return f ? f.weatherInfluence : null;
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  window.overseerFaction = {
    loadFactions,
    getFaction,
    getReputation,
    reputationLabel,
    getControl,
    setControl,
    isHostile,
    rollPatrol,
    getLootBias,
    getWeatherInfluence
  };
})();
