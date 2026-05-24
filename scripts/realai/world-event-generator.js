import { realai } from "./realai-client.js";
import { buildWorldBrainContextBlock, buildWorldBrainSystemPrompt } from "./world-brain.js";

const eventCache = new Map();
const EVENT_TYPES = new Set(["ambush", "merchant", "storm", "skirmish", "discovery", "hazard"]);
const EVENT_TRIGGERS = new Set(["on_enter_region", "on_travel", "on_wait", "random"]);
const RISK_LEVELS = new Set(["low", "medium", "high"]);
const EVENT_KEYS = [
  "id",
  "title",
  "summary",
  "type",
  "region",
  "trigger",
  "factions_involved",
  "risk_level",
  "player_impact",
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

function parseEvent(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("RealAI returned an empty world event response.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("RealAI did not return valid world event JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function validateEventShape(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new Error("event must be an object.");
  }

  const actualKeys = Object.keys(event).sort();
  const expectedKeys = [...EVENT_KEYS].sort();

  if (actualKeys.length !== expectedKeys.length) {
    throw new Error("event contains the wrong number of keys.");
  }

  for (let index = 0; index < expectedKeys.length; index += 1) {
    if (actualKeys[index] !== expectedKeys[index]) {
      throw new Error("event contains unsupported keys.");
    }
  }

  if (!Array.isArray(event.factions_involved)) {
    throw new Error("event.factions_involved must be an array.");
  }

  const normalized = {
    id: normalizeString(event.id, "event.id", 48),
    title: normalizeString(event.title, "event.title", 48),
    summary: normalizeString(event.summary, "event.summary", 120),
    type: normalizeString(event.type, "event.type", 16),
    region: normalizeString(event.region, "event.region", 64),
    trigger: normalizeString(event.trigger, "event.trigger", 24),
    factions_involved: event.factions_involved.map((faction, index) =>
      normalizeString(faction, `event.factions_involved[${index}]`, 32)
    ),
    risk_level: normalizeString(event.risk_level, "event.risk_level", 8),
    player_impact: normalizeString(event.player_impact, "event.player_impact", 72),
    followup_hook: normalizeString(event.followup_hook, "event.followup_hook", 72)
  };

  if (!EVENT_TYPES.has(normalized.type)) {
    throw new Error("event.type is not supported.");
  }

  if (!EVENT_TRIGGERS.has(normalized.trigger)) {
    throw new Error("event.trigger is not supported.");
  }

  if (!RISK_LEVELS.has(normalized.risk_level)) {
    throw new Error("event.risk_level is not supported.");
  }

  if (countWords(normalized.title) > 6) {
    throw new Error("event.title must be under 6 words.");
  }

  if (countWords(normalized.summary) > 18) {
    throw new Error("event.summary must be under 18 words.");
  }

  if (countWords(normalized.player_impact) > 15) {
    throw new Error("event.player_impact must be under 15 words.");
  }

  if (countWords(normalized.followup_hook) > 12) {
    throw new Error("event.followup_hook must be under 12 words.");
  }

  return normalized;
}

export function buildWorldEventPrompt(player = {}, region = {}, nearbyNPCs = [], worldState = {}) {
  const seed = {
    player,
    region,
    cell: region.cell || {},
    world_state: worldState,
    faction_influence: region.faction_influence || {},
    ar_context: region.ar_context || {},
    time_of_day: region.time_of_day || "unknown",
    difficulty_tuning: region.difficulty_tuning || "balanced",
    engagement_tuning: region.engagement_tuning || "neutral"
  };

  return `
${buildWorldBrainSystemPrompt()}

You are currently generating ONE world event for the wasteland simulation.
Generate ONE compact world event object in JSON ONLY.

Schema:
{
  "id": "string",
  "title": "string",
  "summary": "string",
  "type": "ambush | merchant | storm | skirmish | discovery | hazard",
  "region": "string",
  "trigger": "on_enter_region | on_travel | on_wait | random",
  "factions_involved": ["string"],
  "risk_level": "low | medium | high",
  "player_impact": "string",
  "followup_hook": "string"
}

PLAYER DATA:
${JSON.stringify(player, null, 2)}

REGION DATA:
${JSON.stringify(region, null, 2)}

NEARBY NPCS:
${JSON.stringify(nearbyNPCs, null, 2)}

WORLD STATE:
${JSON.stringify(worldState, null, 2)}

${buildWorldBrainContextBlock(seed)}

RULES:
- Fallout Mojave tone.
- Short, punchy, gritty.
- No paragraphs.
- No extra keys.
- No nested lore.
- title must be under 6 words.
- summary must be under 18 words.
- player_impact must be under 15 words.
- followup_hook must be under 12 words.
- Must reflect region, cell tuning, faction presence, world simulation state, and time of day.
- If AR context is present, make the event readable in 2-3 seconds.
- Always output valid JSON.
  `.trim();
}

export function fallbackWorldEvent(player = {}, region = {}) {
  const key = stableStringify({ player, region });

  return {
    id: `world-event-${simpleHash(key)}`,
    title: "Dust Warning",
    summary: "A dirty storm rolls over the next stretch.",
    type: "storm",
    region: String(region.name || "unknown-region").slice(0, 64),
    trigger: "on_travel",
    factions_involved: [],
    risk_level: "low",
    player_impact: "Visibility drops fast.",
    followup_hook: "Tracks vanish in grit."
  };
}

export async function generateWorldEvent(player = {}, region = {}, nearbyNPCs = [], worldState = {}) {
  const key = stableStringify({ player, region, nearbyNPCs, worldState });

  if (eventCache.has(key)) {
    return eventCache.get(key);
  }

  try {
    const prompt = buildWorldEventPrompt(player, region, nearbyNPCs, worldState);
    const raw = await realai(prompt, "gpt-4o-mini");
    const event = validateEventShape(parseEvent(raw));
    eventCache.set(key, event);
    return event;
  } catch (error) {
    console.error("[world-event-generator] event generation failed:", error.message);
    const event = fallbackWorldEvent(player, region);
    eventCache.set(key, event);
    return event;
  }
}

export function clearWorldEventCache() {
  eventCache.clear();
}
