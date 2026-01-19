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
    return lines[Math.floor(Math.random() * lines.length)];
  }

  // ------------------------------------------------------------
  // Main encounter roll
  // ------------------------------------------------------------
  function rollEncounter() {
    const regionId = WorldState.currentRegion;
    const region = Regions.get(regionId);
    const weather = Weather.getCurrent();
    const factionId = Factions.getControl(regionId);
    const rep = Factions.getReputation(factionId);
    const repStatus = Factions.reputationLabel(rep, factionId);

    // ------------------------------------------------------------
    // 1. Timeline Distortion Check
    // ------------------------------------------------------------
    if (Timeline.isUnstable(regionId)) {
      if (Math.random() < Timeline.distortionChance(regionId)) {
        return Timeline.rollEcho(regionId);
      }
    }

    // ------------------------------------------------------------
    // 2. Anomaly Encounter Check
    // ------------------------------------------------------------
    const anomalyLevel = WorldState.getAnomalyLevel(regionId);
    if (anomalyLevel > 0.3) {
      if (Math.random() < anomalyLevel * 0.25) {
        return Anomalies.roll(regionId, weather);
      }
    }

    // ------------------------------------------------------------
    // 3. Micro‑Quest Check
    // ------------------------------------------------------------
    if (Math.random() < (region.questChance || 0.1)) {
      return {
        type: "microquest",
        quest: Microquests.generate(regionId, weather, factionId)
      };
    }

    // ------------------------------------------------------------
    // 4. Faction Patrols / Hostility
    // ------------------------------------------------------------
    if (repStatus === "HOSTILE" && Math.random() < region.threat * 0.6) {
      const enemies = Traits.applyToGroup(
        Regions.pickEnemies(regionId),
        region,
        weather
      );

      return {
        type: "combat",
        faction: factionId,
        enemies,
        loot: Loot.generateLoot({
          regionId,
          factionId,
          npcTraits: enemies.map(e => e.traits)
        }),
        modifier: "hostile_faction"
      };
    }

    if (repStatus === "ALLY" && Math.random() < 0.25) {
      return {
        type: "ally_patrol",
        faction: factionId,
        message: "An allied patrol waves as they pass by."
      };
    }

    // ------------------------------------------------------------
    // 5. Region Encounter Weights
    // ------------------------------------------------------------
    const encounterType = weightedPick(region.encounters);

    switch (encounterType) {
      case "raiders":
      case "mutants":
      case "scavengers":
      case "wildlife": {
        const enemies = Traits.applyToGroup(
          Regions.pickEnemies(regionId, encounterType),
          region,
          weather
        );

        return {
          type: "combat",
          enemies,
          loot: Loot.generateLoot({
            regionId,
            factionId,
            npcTraits: enemies.map(e => e.traits)
          }),
          modifier: "regional"
        };
      }

      case "travelers":
        return {
          type: "traveler",
          npc: Traits.applyToNpc(
            Regions.pickTraveler(regionId),
            region,
            weather
          ),
          message: "A traveler approaches."
        };

      case "merchant":
        return {
          type: "merchant",
          merchant: Regions.pickMerchant(regionId),
          message: "A merchant flags you down."
        };

      case "anomaly":
        return Anomalies.roll(regionId, weather);

      case "event":
        return {
          type: "event",
          event: Regions.pickEvent(regionId)
        };
    }

    // ------------------------------------------------------------
    // 6. Ambient
    // ------------------------------------------------------------
    if (Math.random() < 0.2) {
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
    let roll = Math.random() * total;

    for (const [key, weight] of entries) {
      if (roll < weight) return key;
      roll -= weight;
    }
    return entries[entries.length - 1][0];
  }

  // Expose globally
  window.overseerEncounters = { rollEncounter };
})();
