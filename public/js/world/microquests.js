// microquests.js (v2)
// ------------------------------------------------------------
// Procedural Micro‑Quest Engine
// Region‑aware, faction‑aware, anomaly‑aware, weather‑aware,
// timeline‑aware, NPC‑trait‑aware.
// ------------------------------------------------------------

(function () {
  "use strict";

  const WorldState = window.overseerWorldState;
  const Regions = window.overseerRegions;
  const Factions = window.overseerFaction;
  const Weather = window.overseerWeather;
  const Timeline = window.overseerTimeline;
  const Anomalies = window.overseerAnomalies;
  const Traits = window.overseerNpcTraits;

  // ------------------------------------------------------------
  // Quest Templates
  // ------------------------------------------------------------
  const QUESTS = {
    traveler_help: {
      weight: 1,
      generate(region, faction, weather) {
        return {
          id: "traveler_help",
          title: "Help a Stranded Traveler",
          description: `A lone traveler is stuck in ${region.name}. They need assistance.`,
          steps: [
            "Approach the traveler",
            "Provide aid or supplies",
            "Escort them to safety"
          ],
          reward: ["caps", "random_loot"]
        };
      }
    },

    caravan_defense: {
      weight: 1,
      generate(region, faction, weather) {
        return {
          id: "caravan_defense",
          title: "Defend a Caravan",
          description: `A caravan under ${faction.name} protection is being stalked near ${region.name}.`,
          steps: [
            "Locate the caravan",
            "Defend against attackers",
            "Escort them to the next checkpoint"
          ],
          reward: ["faction_rep", "ammo_pack"]
        };
      }
    },

    anomaly_scan: {
      weight: 1,
      generate(region, faction, weather) {
        return {
          id: "anomaly_scan",
          title: "Scan Anomaly Field",
          description: `Strange readings detected in ${region.name}. Investigate the anomaly.`,
          steps: [
            "Travel to the anomaly site",
            "Deploy scanning device",
            "Collect anomaly samples"
          ],
          reward: ["anomaly_item", "xp"]
        };
      }
    },

    weather_rescue: {
      weight: 1,
      generate(region, faction, weather) {
        return {
          id: "weather_rescue",
          title: "Weather Rescue",
          description: `Severe ${weather.type} conditions have stranded survivors in ${region.name}.`,
          steps: [
            "Reach the stranded group",
            "Provide shelter or supplies",
            "Guide them to safety"
          ],
          reward: ["survival_gear", "caps"]
        };
      }
    },

    timeline_echo: {
      weight: 1,
      generate(region, faction, weather) {
        return {
          id: "timeline_echo",
          title: "Investigate Timeline Echo",
          description: `A temporal distortion has appeared in ${region.name}. Echoes of past events are repeating.`,
          steps: [
            "Locate the echo",
            "Observe the distortion",
            "Stabilize or disrupt the loop"
          ],
          reward: ["echo_item", "xp"]
        };
      }
    }
  };

  // ------------------------------------------------------------
  // Weighted pick helper
  // ------------------------------------------------------------
  function weightedPick(entries) {
    const total = entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * total;

    for (const entry of entries) {
      if (roll < entry.weight) return entry;
      roll -= entry.weight;
    }
    return entries[entries.length - 1];
  }

  // ------------------------------------------------------------
  // Main generator
  // ------------------------------------------------------------
  function generate(regionId, weather, factionId) {
    const region = Regions.get(regionId);
    const faction = Factions.getFaction(factionId);
    const anomalyLevel = WorldState.getAnomalyLevel(regionId);
    const timelineUnstable = Timeline.isUnstable(regionId);

    let pool = [];

    // Region‑based quests
    pool.push(QUESTS.traveler_help);

    // Faction‑based quests
    if (faction) pool.push(QUESTS.caravan_defense);

    // Anomaly‑based quests
    if (anomalyLevel > 0.3) pool.push(QUESTS.anomaly_scan);

    // Weather‑based quests
    if (weather.type !== "clear") pool.push(QUESTS.weather_rescue);

    // Timeline‑based quests
    if (timelineUnstable) pool.push(QUESTS.timeline_echo);

    // Pick one
    const questTemplate = weightedPick(pool);
    const quest = questTemplate.generate(region, faction || {}, weather);

    // Notify Overseer
    if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
      window.overseer.handleGameEvent({
        type: "quest_update",
        payload: { id: quest.id, step: "generated" }
      });
    }

    return quest;
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  window.overseerMicroquests = {
    generate
  };
})();

