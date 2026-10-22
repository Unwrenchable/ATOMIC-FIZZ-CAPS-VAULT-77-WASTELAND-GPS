"use strict";

const { realai } = require("./realai-client");

const MAX_LORE_SEED_LENGTH = 220;
const ENCOUNTER_DEFAULTS = {
  radiation_storm: { capsAmount: 40, xpAmount: 30, issueNft: true },
  nuke_zone: { capsAmount: 80, xpAmount: 60, issueNft: true },
  combat: { capsAmount: 30, xpAmount: 20, issueNft: false },
  dungeon_escape: { capsAmount: 60, xpAmount: 45, issueNft: true },
  hazard_zone: { capsAmount: 50, xpAmount: 35, issueNft: true },
};

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("realai_plan_not_json");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function buildFallbackPlan(input) {
  const defaults = ENCOUNTER_DEFAULTS[input.encounterType] || ENCOUNTER_DEFAULTS.combat;
  const location = sanitizeText(input.context && input.context.location, 80) || "an uncharted sector";
  const encounterLabel = sanitizeText(input.encounterType, 40).replace(/_/g, " ");

  return {
    source: "fallback",
    capsAmount: defaults.capsAmount,
    xpAmount: defaults.xpAmount,
    issueNft: input.requestNft === false ? false : defaults.issueNft,
    mintableId: input.requestedMintableId || null,
    loreSeed: `Subject endured ${encounterLabel} conditions near ${location}. Dispense calibrated reward package.`,
    reasoning: "Fallback survival reward table applied.",
  };
}

function normalizePlan(rawPlan, input) {
  const fallback = buildFallbackPlan(input);
  const plan = rawPlan && typeof rawPlan === "object" ? rawPlan : {};
  const requestedMintableId = sanitizeText(input.requestedMintableId, 80) || null;

  let issueNft = typeof plan.issueNft === "boolean" ? plan.issueNft : fallback.issueNft;
  if (input.requestNft === true) issueNft = true;
  if (input.requestNft === false) issueNft = false;

  return {
    source: "realai",
    capsAmount: clampInteger(plan.capsAmount, 1, 250, fallback.capsAmount),
    xpAmount: clampInteger(plan.xpAmount, 1, 150, fallback.xpAmount),
    issueNft,
    mintableId: requestedMintableId || sanitizeText(plan.mintableId, 80) || null,
    loreSeed:
      sanitizeText(plan.loreSeed || plan.message, MAX_LORE_SEED_LENGTH) ||
      fallback.loreSeed,
    reasoning: sanitizeText(plan.reasoning || plan.reason, 240) || fallback.reasoning,
  };
}

function hasCloudRealAiConfig() {
  return Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.AI_API_KEY ||
      process.env.AI_PROXY_URL
  );
}

function buildPrompt(input) {
  const location = sanitizeText(input.context && input.context.location, 80) || "unknown sector";
  const notes = sanitizeText(input.context && input.context.notes, 180) || "none";

  return [
    "You are the Atomic Fizz Caps reward planner.",
    "Return only valid JSON.",
    "Decide a fair survival reward plan for the described encounter.",
    "Use integer capsAmount between 1 and 250.",
    "Use integer xpAmount between 1 and 150.",
    'Use boolean issueNft.',
    'Use string loreSeed under 220 characters.',
    'Use optional string reasoning under 240 characters.',
    'Use optional string mintableId when a specific NFT should be queued.',
    "",
    `wallet: ${input.wallet}`,
    `encounterType: ${input.encounterType}`,
    `location: ${location}`,
    `notes: ${notes}`,
    `requestNft: ${input.requestNft !== false}`,
    `requestedMintableId: ${input.requestedMintableId || "none"}`,
  ].join("\n");
}

async function planSurvivalReward(input) {
  const fallback = buildFallbackPlan(input);

  if (!hasCloudRealAiConfig()) {
    return fallback;
  }

  try {
    const raw = await realai(buildPrompt(input));
    return normalizePlan(extractJsonObject(raw), input);
  } catch (error) {
    return {
      ...fallback,
      error: error && error.message ? error.message : "realai_plan_failed",
    };
  }
}

module.exports = {
  ENCOUNTER_DEFAULTS,
  buildFallbackPlan,
  planSurvivalReward,
};