import { realai } from "./realai-client.js";
import { buildOmnibrainMasterPrompt } from "./world-brain.js";
import { buildRegionInfluence } from "../../systems/region-influence.js";

const decisionCache = new Map();

const ENCOUNTER_TYPES = new Set([
  "npc",
  "dungeon",
  "event",
  "merchant",
  "faction_patrol",
  "hazard",
  "discovery",
  "none"
]);

const DANGER_ADJUSTMENTS = new Set([-2, -1, 0, 1, 2]);
const REWARD_ADJUSTMENTS = new Set([-1, 0, 1]);

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeString(value, label, maxLength) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} must not be empty.`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function parseDecision(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("RealAI returned an empty omnibrain response.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("RealAI did not return valid omnibrain JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function validateSeed(seed) {
  const safeSeed = safeObject(seed);
  const tuning = safeObject(safeSeed.tuning);

  const normalized = {
    player: safeObject(safeSeed.player),
    region: normalizeString(safeSeed.region || "unknown", "seed.region", 64),
    cell: safeObject(safeSeed.cell),
    worldstate: safeObject(safeSeed.worldstate),
    ar_mode: Boolean(safeSeed.ar_mode),
    tuning: {
      danger_adjustment: Number(tuning.danger_adjustment ?? 0),
      reward_adjustment: Number(tuning.reward_adjustment ?? 0),
      interest_boost: Boolean(tuning.interest_boost)
    }
  };

  if (!DANGER_ADJUSTMENTS.has(normalized.tuning.danger_adjustment)) {
    throw new Error("seed.tuning.danger_adjustment is not supported.");
  }

  if (!REWARD_ADJUSTMENTS.has(normalized.tuning.reward_adjustment)) {
    throw new Error("seed.tuning.reward_adjustment is not supported.");
  }

  return normalized;
}

function validateDecision(decision) {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    throw new Error("omnibrain decision must be an object.");
  }

  const encounterType = normalizeString(decision.encounter_type, "decision.encounter_type", 32);
  const reason = normalizeString(decision.reason, "decision.reason", 120);

  if (!ENCOUNTER_TYPES.has(encounterType)) {
    throw new Error("decision.encounter_type is not supported.");
  }

  if (encounterType === "none") {
    return {
      encounter_type: "none",
      reason,
      seed: {}
    };
  }

  return {
    encounter_type: encounterType,
    reason,
    seed: validateSeed(decision.seed)
  };
}

function buildTuning(input = {}) {
  const cell = safeObject(input.cell);
  const worldstate = safeObject(input.worldstate);
  const feedbackTags = Array.isArray(cell.feedback_tags) ? cell.feedback_tags : [];
  const inventory = Array.isArray(input?.player?.inventory) ? input.player.inventory : [];
  const dangerAdjustment =
    cell.danger_feedback === "too_hard" ? -1 : cell.danger_feedback === "too_easy" ? 1 : 0;
  const rewardAdjustment = cell.engagement === "low" || feedbackTags.includes("fun") ? 1 : 0;
  const interestBoost = cell.engagement === "low" || feedbackTags.includes("boring");

  return {
    danger_adjustment:
      worldstate.weather === "rad_storm" ? Math.max(-2, dangerAdjustment - 1) : dangerAdjustment,
    reward_adjustment:
      inventory.length === 0 || feedbackTags.includes("boring") ? 1 : Math.min(1, rewardAdjustment),
    interest_boost: Boolean(interestBoost)
  };
}

function buildFallbackSeed(input = {}) {
  return {
    player: safeObject(input.player),
    region: String(input.region || "unknown").slice(0, 64),
    cell: safeObject(input.cell),
    worldstate: safeObject(input.worldstate),
    ar_mode: Boolean(input.ar_mode),
    tuning: buildTuning(input)
  };
}

function getCooldownValue(cooldowns = {}, key) {
  const value = Number(safeObject(cooldowns)[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function hasSupplies(player = {}) {
  const inventory = Array.isArray(player.inventory) ? player.inventory : [];
  return inventory.length > 0;
}

function getChanceBucket(input = {}) {
  const raw = stableStringify({
    player: input.player?.id || "unknown",
    region: input.region || "unknown",
    cell: input.cell?.id || "cell",
    last_encounter_time: input.player?.last_encounter_time || 0
  });

  let hash = 0;

  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }

  return hash % 100;
}

function isOpposedAlignment(playerAlignment, factions) {
  if (!playerAlignment || !Array.isArray(factions) || factions.length === 0) {
    return false;
  }

  const alignment = String(playerAlignment).toLowerCase();
  const joined = factions.join(" ").toLowerCase();

  if (alignment === "evil" && /ncr|vault|merchant|caravan/.test(joined)) {
    return true;
  }

  if (alignment === "good" && /raider/.test(joined)) {
    return true;
  }

  return false;
}

function pickFallbackEncounter(input = {}) {
  const cell = safeObject(input.cell);
  const worldstate = safeObject(input.worldstate);
  const cooldowns = safeObject(input.cooldowns);
  const feedbackTags = Array.isArray(cell.feedback_tags) ? cell.feedback_tags : [];
  const raiderActivity = worldstate.raider_activity || "low";
  const weather = worldstate.weather || "clear";
  const caravans = Array.isArray(worldstate.caravans) ? worldstate.caravans : [];
  const player = safeObject(input.player);
  const arMode = Boolean(input.ar_mode);
  const regionRules = buildRegionInfluence(String(input.region || "unknown"));
  const regionFactions = Array.isArray(regionRules.factions) ? regionRules.factions : [];
  const encounterCooldown = getCooldownValue(cooldowns, "encounter");
  const dungeonCooldown = getCooldownValue(cooldowns, "dungeon");
  const merchantCooldown = getCooldownValue(cooldowns, "merchant");
  const chanceBucket = getChanceBucket(input);

  if (encounterCooldown > 0) {
    return {
      encounter_type: "none",
      reason: "cooldown or low probability",
      seed: {}
    };
  }

  if (weather === "dust_storm" || weather === "rad_storm") {
    return {
      encounter_type: "hazard",
      reason: "severe weather pushes a hazard encounter",
      seed: buildFallbackSeed(input)
    };
  }

  if (
    dungeonCooldown <= 0 &&
    arMode &&
    !feedbackTags.includes("unsafe") &&
    cell.engagement === "high" &&
    cell.danger_feedback === "balanced"
  ) {
    return {
      encounter_type: "dungeon",
      reason: "safe high-engagement cell favors a dungeon entrance",
      seed: buildFallbackSeed(input)
    };
  }

  if (merchantCooldown <= 0 && caravans.length > 0 && !hasSupplies(player)) {
    return {
      encounter_type: "merchant",
      reason: "nearby caravans and low supplies favor a merchant encounter",
      seed: buildFallbackSeed(input)
    };
  }

  if (regionFactions.length > 0 && isOpposedAlignment(player.alignment, regionFactions)) {
    return {
      encounter_type: "faction_patrol",
      reason: "faction influence clashes with player alignment",
      seed: buildFallbackSeed(input)
    };
  }

  if ((weather === "night_chill" || raiderActivity === "high") && cell.traffic === "high") {
    return {
      encounter_type: "event",
      reason: "worldstate pressure spikes a world event",
      seed: buildFallbackSeed(input)
    };
  }

  if (cell.danger_feedback === "too_easy") {
    return {
      encounter_type: "hazard",
      reason: "easy cell gets a hazard spike",
      seed: buildFallbackSeed(input)
    };
  }

  if (arMode && (cell.engagement === "low" || feedbackTags.includes("boring"))) {
    return {
      encounter_type: "discovery",
      reason: "low engagement cell gets a discovery boost",
      seed: buildFallbackSeed(input)
    };
  }

  if (
    arMode &&
    (cell.traffic === "high" || cell.traffic === "medium") &&
    cell.engagement === "low" &&
    regionFactions.length > 0
  ) {
    return {
      encounter_type: "npc",
      reason: "ar mode and faction presence favor an npc encounter",
      seed: buildFallbackSeed(input)
    };
  }

  if (chanceBucket < 25 && cell.danger_feedback === "balanced" && cell.engagement !== "low") {
    return {
      encounter_type: "none",
      reason: "cooldown or low probability",
      seed: {}
    };
  }

  return {
    encounter_type: arMode ? "npc" : "event",
    reason: arMode ? "ar mode favors a readable npc encounter" : "default fallback event",
    seed: buildFallbackSeed(input)
  };
}

export function buildOmnibrainPrompt(input = {}) {
  const regionRules = buildRegionInfluence(String(input.region || "unknown"));
  return buildOmnibrainMasterPrompt(input, regionRules);
}

export function fallbackEncounterDecision(input = {}) {
  return pickFallbackEncounter(input);
}

export async function decideEncounter(input = {}) {
  const key = stableStringify(input);

  if (decisionCache.has(key)) {
    return decisionCache.get(key);
  }

  try {
    const prompt = buildOmnibrainPrompt(input);
    const raw = await realai(prompt, "gpt-4o-mini");
    const decision = validateDecision(parseDecision(raw));
    decisionCache.set(key, decision);
    return decision;
  } catch (error) {
    console.error("[omnibrain] encounter decision failed:", error.message);
    const decision = fallbackEncounterDecision(input);
    decisionCache.set(key, decision);
    return decision;
  }
}

export function clearOmnibrainCache() {
  decisionCache.clear();
}
