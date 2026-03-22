// anomalies.js (v2)
// ------------------------------------------------------------
// Anomaly Engine
// Generates: anomaly encounters, glitch mobs, distortion events,
// unstable region effects, echo shards, Overseer static bursts.
// ------------------------------------------------------------

(function () {
  "use strict";

  const _WorldState = window.overseerWorldState;
  const Regions = window.overseerRegions;
  const _Weather = window.overseerWeather;
  const _Timeline = window.overseerTimeline;

  // Secure RNG: use browser CSPRNG instead of predictable Math.random()
  const _rngBuf = new Uint32Array(1);
  function _secureRandom() {
    crypto.getRandomValues(_rngBuf);
    return _rngBuf[0] / 0x100000000;
  }

  // ------------------------------------------------------------
  // Anomaly encounter templates
  // ------------------------------------------------------------
  const ANOMALY_EVENTS = {
    glitch_mob: {
      weight: 1,
      generate(_region, _weather) {
        return {
          type: "anomaly_combat",
          enemies: [
            { id: "glitch_beast", lvl: _region.threat * 10 + 3 },
            { id: "static_walker", lvl: _region.threat * 10 + 2 }
          ],
          description: "Reality flickers. Glitch‑touched creatures phase into view."
        };
      }
    },

    distortion_field: {
      weight: 1,
      generate(_region, _weather) {
        return {
          type: "anomaly_field",
          effect: "distortion",
          description: "A shimmering distortion bends the air. Time feels wrong here."
        };
      }
    },

    echo_ghost: {
      weight: 1,
      generate(_region, _weather) {
        return {
          type: "timeline_echo",
          description: "A ghostly figure repeats a moment from another timeline.",
          reward: "echo_shard"
        };
      }
    },

    anomaly_storm: {
      weight: 1,
      generate(_region, _weather) {
        return {
          type: "anomaly_storm",
          intensity: Math.floor(_secureRandom() * 3) + 1,
          description: "A surge of unstable energy erupts across the region."
        };
      }
    }
  };

  // ------------------------------------------------------------
  // Weighted pick helper
  // ------------------------------------------------------------
  function weightedPick(entries) {
    const total = entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = _secureRandom() * total;

    for (const entry of entries) {
      if (roll < entry.weight) return entry;
      roll -= entry.weight;
    }
    return entries[entries.length - 1];
  }

  // ------------------------------------------------------------
  // Main anomaly roll
  // ------------------------------------------------------------
  function roll(regionId, weather) {
    const region = Regions.get(regionId);
    const anomalyLevel = _WorldState.getAnomalyLevel(regionId);
    const timelineUnstable = _Timeline.isUnstable(regionId);

    let pool = [];

    // Base anomaly chance
    if (anomalyLevel > 0.1) pool.push(ANOMALY_EVENTS.glitch_mob);
    if (anomalyLevel > 0.2) pool.push(ANOMALY_EVENTS.distortion_field);
    if (anomalyLevel > 0.3) pool.push(ANOMALY_EVENTS.anomaly_storm);

    // Timeline echoes
    if (timelineUnstable) pool.push(ANOMALY_EVENTS.echo_ghost);

    if (pool.length === 0) {
      return {
        type: "ambient_anomaly",
        description: "A faint hum vibrates through the air. Something feels off."
      };
    }

    const event = weightedPick(pool);
    const result = event.generate(region, weather);

    // Overseer static burst
    if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
      window.overseer.handleGameEvent({
        type: "anomaly_event",
        payload: { id: result.type }
      });
    }

    return result;
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  window.overseerAnomalies = {
    roll
  };
})();

