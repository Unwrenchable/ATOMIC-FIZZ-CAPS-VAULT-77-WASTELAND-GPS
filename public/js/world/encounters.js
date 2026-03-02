// encounters.js (v2)
// ------------------------------------------------------------
// World‑Aware Procedural Encounter Orchestrator
// Integrates: Regions, Weather, Factions, Traits, Loot,
// Micro‑Quests, Anomalies, Timeline, Overseer, WorldState.
// ------------------------------------------------------------

(function () {
  "use strict";

  const Regions = window.overseerRegions;
  const Weather = window.overseerWeather;
  const Factions = window.overseerFaction;
  const Loot = window.overseerLoot;
  const Microquests = window.overseerMicroquests;
  const Anomalies = window.overseerAnomalies;
  const Timeline = window.overseerTimeline;
  const WorldState = window.overseerWorldState;
  const Traits = window.overseerNpcTraits;

  // Secure RNG: use browser CSPRNG instead of predictable Math.random()
  const _rngBuf = new Uint32Array(1);
  function _secureRandom() {
    crypto.getRandomValues(_rngBuf);
    return _rngBuf[0] / 0x100000000;
  }

  // ------------------------------------------------------------
  // Ambient flavor
  // ------------------------------------------------------------
  function rollAmbientFor(region, faction) {
    const lines = [
      `You notice fresh tracks left by ${faction} in ${region.name}.`,
      `${region.name} carries distant echoes of ${faction} activity.`,
      `Discarded gear bearing ${faction} colors lies half‑buried.`,
      `A cairn marked with ${faction} sigils watches over the wastes.`
    ];
    return lines[Math.floor(_secureRandom() * lines.length)];
  }

  // ------------------------------------------------------------
  // Main encounter roll
  // ------------------------------------------------------------
  function rollEncounter() {
    // Guard: ensure world state is available
    if (!WorldState || !Regions) {
      return { type: "none", reason: "world_not_ready" };
    }

    const regionId = WorldState.currentRegion;
    const region = Regions.get(regionId);
    
    // Guard: ensure region exists
    if (!region) {
      return { type: "none", reason: "no_region" };
    }

    const weather = Weather?.getCurrent?.() || { type: "clear" };
    const factionId = Factions?.getControl?.(regionId);
    const rep = Factions?.getReputation?.(factionId) || 0;
    const repStatus = Factions?.reputationLabel?.(rep, factionId) || "NEUTRAL";

    // ------------------------------------------------------------
    // 1. Timeline Distortion Check
    // ------------------------------------------------------------
    if (Timeline?.isUnstable?.(regionId)) {
      if (_secureRandom() < (Timeline?.distortionChance?.(regionId) || 0)) {
        const echo = Timeline?.rollEcho?.(regionId);
        if (echo) return echo;
      }
    }

    // ------------------------------------------------------------
    // 2. Anomaly Encounter Check
    // ------------------------------------------------------------
    const anomalyLevel = Math.max(0, Math.min(1, WorldState.getAnomalyLevel?.(regionId) || 0));
    if (anomalyLevel > 0.3) {
      if (_secureRandom() < anomalyLevel * 0.25) {
        const anomalyResult = Anomalies?.roll?.(regionId, weather);
        if (anomalyResult) return anomalyResult;
      }
    }

    // ------------------------------------------------------------
    // 3. Micro‑Quest Check
    // ------------------------------------------------------------
    if (_secureRandom() < (region.questChance || 0.1)) {
      const quest = Microquests?.generate?.(regionId, weather, factionId);
      if (quest) {
        return {
          type: "microquest",
          quest
        };
      }
    }

    // ------------------------------------------------------------
    // 4. Faction Patrols / Hostility
    // ------------------------------------------------------------
    if (repStatus === "HOSTILE" && _secureRandom() < (region.threat || 0.5) * 0.6) {
      const baseEnemies = Regions.pickEnemies?.(regionId) || [];
      const enemies = Traits?.applyToGroup?.(baseEnemies, region, weather) || baseEnemies;

      return {
        type: "combat",
        faction: factionId,
        enemies,
        loot: Loot?.generateLoot?.({
          regionId,
          factionId,
          npcTraits: enemies.map(e => e.traits || [])
        }) || [],
        modifier: "hostile_faction"
      };
    }

    if (repStatus === "ALLY" && _secureRandom() < 0.25) {
      return {
        type: "ally_patrol",
        faction: factionId,
        message: "An allied patrol waves as they pass by."
      };
    }

    // ------------------------------------------------------------
    // 5. Region Encounter Weights
    // ------------------------------------------------------------
    const encounterType = weightedPick(region.encounters || {});

    switch (encounterType) {
      case "raiders":
      case "mutants":
      case "scavengers":
      case "wildlife": {
        const regionalEnemies = Regions.pickEnemies?.(regionId, encounterType) || [];
        const enemies = Traits?.applyToGroup?.(regionalEnemies, region, weather) || regionalEnemies;

        return {
          type: "combat",
          enemies,
          loot: Loot?.generateLoot?.({
            regionId,
            factionId,
            npcTraits: enemies.map(e => e.traits || [])
          }) || [],
          modifier: "regional"
        };
      }

      case "travelers":
        return {
          type: "traveler",
          npc: Traits?.applyToNpc?.(
            Regions.pickTraveler?.(regionId) || {},
            region,
            weather
          ) || {},
          message: "A traveler approaches."
        };

      case "merchant":
        return {
          type: "merchant",
          merchant: Regions.pickMerchant?.(regionId) || {},
          message: "A merchant flags you down."
        };

      case "anomaly":
        return Anomalies?.roll?.(regionId, weather) || { type: "ambient_anomaly" };

      case "event":
        return {
          type: "event",
          event: Regions.pickEvent?.(regionId) || {}
        };
    }

    // ------------------------------------------------------------
    // 6. Ambient
    // ------------------------------------------------------------
    if (_secureRandom() < 0.2) {
      return {
        type: "ambient",
        description: rollAmbientFor(region, factionId)
      };
    }

    // ------------------------------------------------------------
    // 7. No Encounter
    // ------------------------------------------------------------
    return { type: "none" };
  }

  // ------------------------------------------------------------
  // Weighted pick helper
  // ------------------------------------------------------------
  function weightedPick(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = _secureRandom() * total;

    for (const [key, weight] of entries) {
      if (roll < weight) return key;
      roll -= weight;
    }
    return entries[entries.length - 1][0];
  }

  // Expose globally
  window.overseerEncounters = { rollEncounter };
})();
