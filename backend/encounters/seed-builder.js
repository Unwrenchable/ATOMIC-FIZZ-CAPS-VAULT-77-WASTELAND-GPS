"use strict";

const { quantizeToCellId } = require("../geo/cell");
const { getCellTuning } = require("../db/cell-tuning");
const { getWorldState } = require("../world/worldstate");

function normalizeGps(gps = {}) {
  const lat = Number(gps.lat);
  const lng = Number(gps.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("GPS coordinates are required.");
  }

  return { lat, lng };
}

function normalizePlayer(player = {}) {
  if (!player || typeof player !== "object" || Array.isArray(player)) {
    throw new Error("Player payload is required.");
  }

  return {
    id: String(player.id || "wanderer").slice(0, 64),
    level: Number.isFinite(Number(player.level)) ? Number(player.level) : 1,
    alignment: String(player.alignment || "neutral").slice(0, 16),
    style: String(player.style || "wasteland drifter").slice(0, 80),
    inventory: Array.isArray(player.inventory) ? player.inventory : [],
    recent_outcomes: Array.isArray(player.recent_outcomes) ? player.recent_outcomes : [],
    last_encounter_time: player.last_encounter_time || 0
  };
}

function normalizeCooldowns(cooldowns = {}) {
  const source = cooldowns && typeof cooldowns === "object" && !Array.isArray(cooldowns) ? cooldowns : {};

  return {
    encounter: Number.isFinite(Number(source.encounter)) ? Number(source.encounter) : 0,
    dungeon: Number.isFinite(Number(source.dungeon)) ? Number(source.dungeon) : 0,
    merchant: Number.isFinite(Number(source.merchant)) ? Number(source.merchant) : 0
  };
}

function deriveTuning(cell = {}, worldstate = {}) {
  const feedbackTags = Array.isArray(cell.feedback_tags) ? cell.feedback_tags : [];
  let dangerAdjustment = 0;

  if (cell.danger_feedback === "too_hard") {
    dangerAdjustment = -1;
  } else if (cell.danger_feedback === "too_easy") {
    dangerAdjustment = 1;
  }

  if (worldstate.weather === "rad_storm") {
    dangerAdjustment = Math.max(-2, dangerAdjustment - 1);
  }

  return {
    danger_adjustment: dangerAdjustment,
    reward_adjustment: cell.engagement === "low" || feedbackTags.includes("fun") ? 1 : 0,
    interest_boost: cell.engagement === "low" || feedbackTags.includes("boring")
  };
}

async function buildEncounterSeed(player, gps, region, ar_mode, app, cooldowns = {}) {
  const normalizedGps = normalizeGps(gps);
  const normalizedPlayer = normalizePlayer(player);
  const normalizedRegion = String(region || "unknown").trim().slice(0, 64) || "unknown";
  const cellId = quantizeToCellId(normalizedGps.lat, normalizedGps.lng);
  const cell = await getCellTuning(cellId);
  const worldstate = await getWorldState(normalizedRegion, app);

  return {
    player: normalizedPlayer,
    gps: normalizedGps,
    region: normalizedRegion,
    cell,
    worldstate,
    ar_mode: Boolean(ar_mode),
    cooldowns: normalizeCooldowns(cooldowns),
    tuning: deriveTuning(cell, worldstate)
  };
}

module.exports = {
  buildEncounterSeed
};
