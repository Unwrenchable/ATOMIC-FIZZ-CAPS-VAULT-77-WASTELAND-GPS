import { realai } from "./realai-client.js";
import { buildWorldBrainContextBlock, buildWorldBrainSystemPrompt } from "./world-brain.js";

const dungeonCache = new Map();
const DIFFICULTY_LEVELS = new Set(["low", "medium", "high"]);
const DUNGEON_KEYS = [
  "id",
  "name",
  "region",
  "difficulty",
  "hazards",
  "enemy_types",
  "loot_flavor",
  "entry_description"
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

function parseDungeon(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("RealAI returned an empty dungeon response.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("RealAI did not return valid dungeon JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function validateDungeonShape(dungeon) {
  if (!dungeon || typeof dungeon !== "object" || Array.isArray(dungeon)) {
    throw new Error("dungeon must be an object.");
  }

  const actualKeys = Object.keys(dungeon).sort();
  const expectedKeys = [...DUNGEON_KEYS].sort();

  if (actualKeys.length !== expectedKeys.length) {
    throw new Error("dungeon contains the wrong number of keys.");
  }

  for (let index = 0; index < expectedKeys.length; index += 1) {
    if (actualKeys[index] !== expectedKeys[index]) {
      throw new Error("dungeon contains unsupported keys.");
    }
  }

  if (!Array.isArray(dungeon.hazards) || !Array.isArray(dungeon.enemy_types)) {
    throw new Error("dungeon hazards and enemy_types must be arrays.");
  }

  const normalized = {
    id: normalizeString(dungeon.id, "dungeon.id", 48),
    name: normalizeString(dungeon.name, "dungeon.name", 72),
    region: normalizeString(dungeon.region, "dungeon.region", 64),
    difficulty: normalizeString(dungeon.difficulty, "dungeon.difficulty", 8),
    hazards: dungeon.hazards.map((hazard, index) =>
      normalizeString(hazard, `dungeon.hazards[${index}]`, 32)
    ),
    enemy_types: dungeon.enemy_types.map((enemyType, index) =>
      normalizeString(enemyType, `dungeon.enemy_types[${index}]`, 32)
    ),
    loot_flavor: normalizeString(dungeon.loot_flavor, "dungeon.loot_flavor", 72),
    entry_description: normalizeString(dungeon.entry_description, "dungeon.entry_description", 120)
  };

  if (!DIFFICULTY_LEVELS.has(normalized.difficulty)) {
    throw new Error("dungeon.difficulty is not supported.");
  }

  if (countWords(normalized.entry_description) > 20) {
    throw new Error("dungeon.entry_description must be 20 words or fewer.");
  }

  return normalized;
}

export function buildDungeonPrompt(seed = {}) {
  return `
${buildWorldBrainSystemPrompt()}

You are currently generating ONE dungeon entrance for the wasteland simulation.
Generate ONE compact dungeon entrance object in JSON ONLY.

Schema:
{
  "id": "string",
  "name": "string",
  "region": "string",
  "difficulty": "low | medium | high",
  "hazards": ["string"],
  "enemy_types": ["string"],
  "loot_flavor": "string",
  "entry_description": "string"
}

SEED DATA:
${JSON.stringify(seed, null, 2)}

${buildWorldBrainContextBlock(seed)}

RULES:
- Fallout Mojave tone.
- Short, punchy, gritty.
- No paragraphs.
- No extra keys.
- No nested lore.
- hazards and enemy_types must stay compact.
- entry_description must be under 20 words.
- Must reflect cell engagement, difficulty feedback, region hazards, faction control, and world simulation state.
- If AR mode is active, make the entrance readable in 2-3 seconds.
- Always output valid JSON.
  `.trim();
}

export function fallbackDungeon(seed = {}) {
  const key = stableStringify(seed);
  const region = String(seed.region || "unknown-region").slice(0, 64);
  const dangerAdjustment = Number(seed?.tuning?.danger_adjustment || 0);

  return {
    id: `dungeon-${simpleHash(key)}`,
    name: "Shuttered Service Hatch",
    region,
    difficulty: dangerAdjustment < 0 ? "low" : dangerAdjustment > 0 ? "high" : "medium",
    hazards: seed?.worldstate?.weather === "rad_storm" ? ["radiation pockets"] : ["loose wiring"],
    enemy_types: ["raider scouts"],
    loot_flavor: "sealed lockers and dusty caps",
    entry_description: "A rusted hatch yawns under flickering wasteland lights."
  };
}

export async function generateDungeon(seed = {}) {
  const key = stableStringify(seed);

  if (dungeonCache.has(key)) {
    return dungeonCache.get(key);
  }

  try {
    const prompt = buildDungeonPrompt(seed);
    const raw = await realai(prompt, "gpt-4o-mini");
    const dungeon = validateDungeonShape(parseDungeon(raw));
    dungeonCache.set(key, dungeon);
    return dungeon;
  } catch (error) {
    console.error("[dungeon-generator] dungeon generation failed:", error.message);
    const dungeon = fallbackDungeon(seed);
    dungeonCache.set(key, dungeon);
    return dungeon;
  }
}

export function clearDungeonCache() {
  dungeonCache.clear();
}
