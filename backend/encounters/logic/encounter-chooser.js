"use strict";

const { loadRealAiModule } = require("../../realai/load-module");

function fallbackEncounter(seed = {}) {
  const cell = seed.cell || {};
  const worldstate = seed.worldstate || {};
  const feedbackTags = Array.isArray(cell.feedback_tags) ? cell.feedback_tags : [];
  const unsafe = feedbackTags.includes("unsafe");
  const lastEncounterTime = new Date(seed.player?.last_encounter_time || 0).getTime();

  if (Number.isFinite(lastEncounterTime) && Date.now() - lastEncounterTime < 15000) {
    return { encounter_type: "none", reason: "cooldown or low probability", seed: {} };
  }

  if (worldstate.weather === "dust_storm" || worldstate.weather === "rad_storm") {
    return {
      encounter_type: "hazard",
      reason: "weather hazard",
      seed: {
        player: seed.player,
        region: seed.region,
        cell: seed.cell,
        worldstate: seed.worldstate,
        ar_mode: seed.ar_mode,
        tuning: seed.tuning
      }
    };
  }

  if (seed.ar_mode && cell.engagement === "low") {
    return {
      encounter_type: "npc",
      reason: "AR + low engagement",
      seed: {
        player: seed.player,
        region: seed.region,
        cell: seed.cell,
        worldstate: seed.worldstate,
        ar_mode: seed.ar_mode,
        tuning: seed.tuning
      }
    };
  }

  if (seed.ar_mode && !unsafe) {
    return {
      encounter_type: "dungeon",
      reason: "AR + POI proximity",
      seed: {
        player: seed.player,
        region: seed.region,
        cell: seed.cell,
        worldstate: seed.worldstate,
        ar_mode: seed.ar_mode,
        tuning: seed.tuning
      }
    };
  }

  if (worldstate.raider_activity === "high") {
    return {
      encounter_type: "event",
      reason: "raider activity",
      seed: {
        player: seed.player,
        region: seed.region,
        cell: seed.cell,
        worldstate: seed.worldstate,
        ar_mode: seed.ar_mode,
        tuning: seed.tuning
      }
    };
  }

  if (cell.engagement === "low") {
    return {
      encounter_type: "discovery",
      reason: "boost engagement",
      seed: {
        player: seed.player,
        region: seed.region,
        cell: seed.cell,
        worldstate: seed.worldstate,
        ar_mode: seed.ar_mode,
        tuning: seed.tuning
      }
    };
  }

  return {
    encounter_type: "npc",
    reason: "default",
    seed: {
      player: seed.player,
      region: seed.region,
      cell: seed.cell,
      worldstate: seed.worldstate,
      ar_mode: seed.ar_mode,
      tuning: seed.tuning
    }
  };
}

async function chooseEncounterType(seed = {}) {
  try {
    const mod = await loadRealAiModule("omnibrain.js");
    return mod.decideEncounter(seed);
  } catch (error) {
    console.error("[encounter-chooser] Omnibrain load failed:", error.message);
    return fallbackEncounter(seed);
  }
}

module.exports = {
  chooseEncounterType
};
