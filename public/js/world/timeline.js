// timeline.js (v2)
// ------------------------------------------------------------
// Timeline Distortion Engine
// Controls: unstable regions, echo events, time loops,
// flickering weather, Overseer glitch reactions.
// ------------------------------------------------------------

(function () {
  "use strict";

  const WorldState = window.overseerWorldState;
  const Regions = window.overseerRegions;

  // ------------------------------------------------------------
  // Echo event templates
  // ------------------------------------------------------------
  const ECHO_EVENTS = {
    ghost_npc: {
      weight: 1,
      generate(region) {
        return {
          type: "echo_ghost",
          description: `A ghostly figure repeats a moment from another timeline in ${region.name}.`,
          reward: "echo_shard"
        };
      }
    },

    loop_event: {
      weight: 1,
      generate(region) {
        return {
          type: "time_loop",
          description: `A moment repeats itself in ${region.name}. You feel déjà vu.`,
          effect: "repeat_next_encounter"
        };
      }
    },

    flicker_weather: {
      weight: 1,
      generate(region) {
        return {
          type: "weather_flicker",
          description: `The sky flickers between states. Time is unstable here.`,
          effect: "weather_glitch"
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
  // Timeline instability logic
  // ------------------------------------------------------------
  function isUnstable(regionId) {
    return WorldState.timeline.unstableRegions.includes(regionId);
  }

  function distortionChance(regionId) {
    const global = WorldState.timeline.globalInstability || 0;
    const region = Regions.get(regionId);
    const anomaly = WorldState.getAnomalyLevel(regionId);

    // Timeline instability is influenced by:
    // - global instability
    // - region anomaly level
    // - region personality
    let base = global * 0.4 + anomaly * 0.4;

    if (region.personality === "unstable") base += 0.2;
    if (region.personality === "mysterious") base += 0.1;

    return Math.min(1, base);
  }

  // ------------------------------------------------------------
  // Roll a timeline echo event
  // ------------------------------------------------------------
  function rollEcho(regionId) {
    const region = Regions.get(regionId);

    let pool = [
      ECHO_EVENTS.ghost_npc,
      ECHO_EVENTS.loop_event,
      ECHO_EVENTS.flicker_weather
    ];

    const event = weightedPick(pool);
    const result = event.generate(region);

    // Notify Overseer
    if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
      window.overseer.handleGameEvent({
        type: "timeline_event",
        payload: { id: result.type }
      });
    }

    return result;
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  window.overseerTimeline = {
    isUnstable,
    distortionChance,
    rollEcho
  };
})();

