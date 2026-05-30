"use strict";

const { getJSON } = require("../lib/redis");

const TRAFFIC_LEVELS = new Set(["high", "medium", "low"]);
const DANGER_LEVELS = new Set(["too_easy", "balanced", "too_hard"]);
const ENGAGEMENT_LEVELS = new Set(["high", "low"]);
const KNOWN_FEEDBACK_TAGS = new Set(["fun", "boring", "unsafe"]);

function clampCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function normalizeFeedbackTags(value, stats = {}) {
  const tags = new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);

  if (clampCount(stats.fun_votes) > clampCount(stats.boring_votes)) {
    tags.add("fun");
  }

  if (clampCount(stats.boring_votes) > 0) {
    tags.add("boring");
  }

  if (clampCount(stats.unsafe_votes) > 0) {
    tags.add("unsafe");
  }

  return [...tags].filter((tag) => KNOWN_FEEDBACK_TAGS.has(tag));
}

function deriveTraffic(stats = {}) {
  const visits = clampCount(stats.visits);

  if (visits > 100) {
    return "high";
  }

  if (visits > 20) {
    return "medium";
  }

  return "low";
}

function deriveDangerFeedback(stats = {}) {
  const encounters = Math.max(1, clampCount(stats.encounters));
  const deaths = clampCount(stats.deaths);
  const wins = clampCount(stats.wins);
  const deathRate = deaths / encounters;
  const winRate = wins / encounters;

  if (deathRate > 0.4) {
    return "too_hard";
  }

  if (winRate > 0.75 && deaths === 0) {
    return "too_easy";
  }

  return "balanced";
}

function deriveEngagement(stats = {}) {
  const visits = Math.max(1, clampCount(stats.visits));
  const churns = clampCount(stats.churns);

  return churns / visits > 0.3 ? "low" : "high";
}

function normalizeStoredTuning(cellId, value = {}) {
  const feedbackTags = normalizeFeedbackTags(value.feedback_tags, value);

  return {
    id: cellId,
    traffic: TRAFFIC_LEVELS.has(value.traffic) ? value.traffic : "low",
    danger_feedback: DANGER_LEVELS.has(value.danger_feedback) ? value.danger_feedback : "balanced",
    engagement: ENGAGEMENT_LEVELS.has(value.engagement) ? value.engagement : "high",
    feedback_tags: feedbackTags
  };
}

function deriveTuningFromStats(cellId, stats = {}) {
  return {
    id: cellId,
    traffic: deriveTraffic(stats),
    danger_feedback: deriveDangerFeedback(stats),
    engagement: deriveEngagement(stats),
    feedback_tags: normalizeFeedbackTags(null, stats)
  };
}

async function getCellTuning(cellId) {
  if (!cellId || typeof cellId !== "string") {
    throw new Error("Cell ID is required.");
  }

  const storedTuning = await getJSON(`cell:tuning:${cellId}`);

  if (storedTuning && typeof storedTuning === "object" && !Array.isArray(storedTuning)) {
    return normalizeStoredTuning(cellId, storedTuning);
  }

  const storedStats = await getJSON(`cell:stats:${cellId}`);

  if (storedStats && typeof storedStats === "object" && !Array.isArray(storedStats)) {
    return deriveTuningFromStats(cellId, storedStats);
  }

  return {
    id: cellId,
    traffic: "low",
    danger_feedback: "balanced",
    engagement: "high",
    feedback_tags: []
  };
}

module.exports = {
  getCellTuning
};
