"use strict";

const { loadRealAiModule } = require("./load-module");

function buildRegionContext(seed = {}) {
  return {
    name: String(seed.region || "unknown").slice(0, 64),
    cell: seed.cell || {},
    faction_influence: seed.worldstate?.factions || {},
    ar_context: {
      enabled: Boolean(seed.ar_mode),
      mode: seed.ar_mode ? "ar" : "map"
    },
    difficulty_tuning: seed.tuning?.danger_adjustment < 0 ? "lowered" : seed.tuning?.danger_adjustment > 0 ? "raised" : "balanced",
    engagement_tuning: seed.tuning?.interest_boost ? "boosted" : "neutral"
  };
}

async function generateWorldEvent(seed = {}) {
  const mod = await loadRealAiModule("world-event-generator.js");
  return mod.generateWorldEvent(seed.player || {}, buildRegionContext(seed), [], seed.worldstate || {});
}

module.exports = {
  generateWorldEvent
};
