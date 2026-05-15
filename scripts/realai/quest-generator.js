import { realai } from "./realai-client.js";
import { regionQuestFlavor } from "../../systems/region-influence.js";
import { buildWorldBrainContextBlock, buildWorldBrainSystemPrompt } from "./world-brain.js";

const questCache = new Map();
const QUEST_TYPES = new Set(["fetch", "rescue", "hunt", "escort", "investigate", "sabotage"]);
const RISK_LEVELS = new Set(["low", "medium", "high"]);

const QUEST_KEYS = [
  "id",
  "title",
  "summary",
  "giver",
  "region",
  "type",
  "objective",
  "location_hint",
  "risk_level",
  "reward",
  "followup_hook"
];

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

function simpleHash(input) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function buildQuestKey(npc = {}, player = {}, region = {}) {
  return stableStringify({ npc, player, region });
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

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function parseQuest(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("RealAI returned an empty quest response.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("RealAI did not return valid quest JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function validateQuestShape(quest) {
  if (!quest || typeof quest !== "object" || Array.isArray(quest)) {
    throw new Error("quest must be an object.");
  }

  const actualKeys = Object.keys(quest).sort();
  const expectedKeys = [...QUEST_KEYS].sort();

  if (actualKeys.length !== expectedKeys.length) {
    throw new Error("quest contains the wrong number of keys.");
  }

  for (let index = 0; index < expectedKeys.length; index += 1) {
    if (actualKeys[index] !== expectedKeys[index]) {
      throw new Error("quest contains unsupported keys.");
    }
  }

  const normalized = {
    id: normalizeString(quest.id, "quest.id", 48),
    title: normalizeString(quest.title, "quest.title", 64),
    summary: normalizeString(quest.summary, "quest.summary", 120),
    giver: normalizeString(quest.giver, "quest.giver", 64),
    region: normalizeString(quest.region, "quest.region", 64),
    type: normalizeString(quest.type, "quest.type", 16),
    objective: normalizeString(quest.objective, "quest.objective", 96),
    location_hint: normalizeString(quest.location_hint, "quest.location_hint", 72),
    risk_level: normalizeString(quest.risk_level, "quest.risk_level", 8),
    reward: normalizeString(quest.reward, "quest.reward", 24),
    followup_hook: normalizeString(quest.followup_hook, "quest.followup_hook", 72)
  };

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized.id)) {
    throw new Error("quest.id must be lowercase kebab-case.");
  }

  if (!QUEST_TYPES.has(normalized.type)) {
    throw new Error("quest.type is not supported.");
  }

  if (!RISK_LEVELS.has(normalized.risk_level)) {
    throw new Error("quest.risk_level is not supported.");
  }

  if (countWords(normalized.title) > 8) {
    throw new Error("quest.title must be under 8 words.");
  }

  if (countWords(normalized.summary) > 20) {
    throw new Error("quest.summary must be under 20 words.");
  }

  if (countWords(normalized.objective) > 15) {
    throw new Error("quest.objective must be under 15 words.");
  }

  if (countWords(normalized.location_hint) > 12) {
    throw new Error("quest.location_hint must be under 12 words.");
  }

  if (countWords(normalized.followup_hook) > 12) {
    throw new Error("quest.followup_hook must be under 12 words.");
  }

  return normalized;
}

export function buildQuestPrompt(npc = {}, player = {}, region = {}) {
  const flavoredRegion = {
    ...region,
    flavor: region.flavor || regionQuestFlavor(region.name)
  };
  const worldBrainSeed = {
    player,
    region: flavoredRegion,
    cell: region.cell || {},
    world_state: region.world_state || {},
    faction_influence: region.faction_influence || {},
    ar_context: region.ar_context || {},
    time_of_day: region.time_of_day || "unknown",
    difficulty_tuning: region.difficulty_tuning || "balanced",
    engagement_tuning: region.engagement_tuning || "neutral"
  };

  return `
${buildWorldBrainSystemPrompt()}

You are currently generating ONE quest for the wasteland simulation.
Generate ONE compact quest object in JSON ONLY.

Schema:
{
  "id": "string",
  "title": "string",
  "summary": "string",
  "giver": "string",
  "region": "string",
  "type": "string",
  "objective": "string",
  "location_hint": "string",
  "risk_level": "string",
  "reward": "string",
  "followup_hook": "string"
}

NPC DATA:
${JSON.stringify(npc, null, 2)}

PLAYER DATA:
${JSON.stringify(player, null, 2)}

REGION DATA:
${JSON.stringify(flavoredRegion, null, 2)}

${buildWorldBrainContextBlock(worldBrainSeed)}

RULES:
- Fallout Mojave tone.
- Short, punchy, gritty.
- No paragraphs.
- No extra keys.
- No nested lore.
- id must be lowercase kebab-case.
- title must be under 8 words.
- summary must be under 20 words.
- objective must be under 15 words.
- location_hint must be under 12 words.
- followup_hook must be under 12 words.
- type must be one of: fetch, rescue, hunt, escort, investigate, sabotage.
- risk_level must be one of: low, medium, high.
- Must reflect NPC personality, faction, and attitude.
- Must reflect region dangers, cell tuning, and world simulation state.
- Must reflect player alignment, style, and engagement tuning.
- If AR context is present, make the hook readable in 2-3 seconds.
- Always output valid JSON.
  `.trim();
}

export function fallbackQuest(npc = {}, region = {}) {
  const regionName = String(region.name || "unknown-region");
  const hash = simpleHash(buildQuestKey(npc, {}, region));

  return {
    id: `fallback-quest-${hash}`,
    title: "Local Trouble",
    summary: "Help with a small issue nearby.",
    giver: String(npc.name || "Unknown Giver").slice(0, 64),
    region: regionName.slice(0, 64),
    type: "fetch",
    objective: "Retrieve lost supplies",
    location_hint: "nearby ruins",
    risk_level: "low",
    reward: "caps",
    followup_hook: "more work later"
  };
}

export async function generateQuest(npc = {}, player = {}, region = {}) {
  const key = buildQuestKey(npc, player, region);

  if (questCache.has(key)) {
    return questCache.get(key);
  }

  try {
    const prompt = buildQuestPrompt(npc, player, region);
    const raw = await realai(prompt, "gpt-4o-mini");
    const quest = validateQuestShape(parseQuest(raw));
    questCache.set(key, quest);
    return quest;
  } catch (error) {
    console.error("[quest-generator] quest generation failed:", error.message);
    const quest = fallbackQuest(npc, region);
    questCache.set(key, quest);
    return quest;
  }
}

export function clearQuestCache() {
  questCache.clear();
}
