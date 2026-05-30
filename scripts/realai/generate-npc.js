import { realai } from "./realai-client.js";
import { extractJson } from "../overseer/json-extract.js";
import { buildWorldBrainContextBlock, buildWorldBrainSystemPrompt } from "./world-brain.js";

const npcCache = new Map();

const ROOT_KEYS = [
  "id",
  "name",
  "gender",
  "appearance",
  "animation_profile",
  "interaction_profile",
  "background",
  "stats",
  "dialogue_hooks"
];

const APPEARANCE_KEYS = [
  "body_type",
  "hair",
  "face",
  "clothing",
  "notable_feature",
  "color_palette",
  "silhouette"
];

const ANIMATION_KEYS = [
  "idle",
  "walk",
  "gesture"
];

const INTERACTION_KEYS = [
  "attitude_toward_player",
  "interaction_style",
  "distance_behavior",
  "eye_contact"
];

const BACKGROUND_KEYS = [
  "origin",
  "occupation",
  "faction",
  "trait"
];

const STATS_KEYS = [
  "hp",
  "perception",
  "charisma"
];

const DIALOGUE_KEYS = [
  "intro",
  "gossip"
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

function getNPCSeedKey(seed = {}) {
  return stableStringify(seed);
}

function simpleHash(input) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function buildNPCPrompt(seed = {}) {
  return `
${buildWorldBrainSystemPrompt()}

You are currently generating ONE NPC for the wasteland simulation.
This NPC must look, move, speak, and behave in a way that feels consistent,
immersive, and visually readable to the player.

OUTPUT STRICT JSON ONLY. NO commentary. NO extra keys.

NPCs must follow this schema exactly:

{
  "id": "string",
  "name": "string",
  "gender": "string",
  "appearance": {
    "body_type": "string",
    "hair": "string",
    "face": "string",
    "clothing": "string",
    "notable_feature": "string",
    "color_palette": "string",
    "silhouette": "string"
  },
  "animation_profile": {
    "idle": "string",
    "walk": "string",
    "gesture": "string"
  },
  "interaction_profile": {
    "attitude_toward_player": "string",
    "interaction_style": "string",
    "distance_behavior": "string",
    "eye_contact": "string"
  },
  "background": {
    "origin": "string",
    "occupation": "string",
    "faction": "string",
    "trait": "string"
  },
  "stats": {
    "hp": "integer 20-80",
    "perception": "integer 1-10",
    "charisma": "integer 1-10"
  },
  "dialogue_hooks": {
    "intro": "string",
    "gossip": "string"
  }
}

SEED DATA (player + world context):
${JSON.stringify(seed, null, 2)}

${buildWorldBrainContextBlock(seed)}

Rules:
- Keep strings short and punchy.
- No paragraphs. No long lore dumps.
- No nested objects beyond the schema.
- No extra keys.
- Keep everything optimized for fast rendering and low memory.
- NPC appearance must be visually distinct but simple enough for lightweight graphics.
- Animation profiles must be readable and easy to map to simple animations.
- Interaction profiles must directly affect how the player perceives the NPC.
- NPCs must feel like they belong in a Fallout-style Mojave wasteland.
- NPCs must reflect player style, region, faction influence, cell tuning, and world simulation state.
- If AR context is present, make the NPC readable in 2-3 seconds.
- "id" must be lowercase kebab-case.
- "hp" must be an integer from 20 to 80.
- "perception" and "charisma" must be integers from 1 to 10.
- "intro" and "gossip" must stay under 12 words each.
- Always output valid JSON.
  `.trim();
}

function buildFallbackId(seed = {}) {
  const region = String(seed.region || "wasteland")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "wasteland";

  return `fallback-${region}-${simpleHash(getNPCSeedKey(seed))}`;
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  assertPlainObject(value, label);

  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  if (actualKeys.length !== sortedExpectedKeys.length) {
    throw new Error(`${label} must contain exactly: ${sortedExpectedKeys.join(", ")}.`);
  }

  for (let index = 0; index < sortedExpectedKeys.length; index += 1) {
    if (actualKeys[index] !== sortedExpectedKeys[index]) {
      throw new Error(`${label} contains unsupported keys.`);
    }
  }
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

function normalizeId(value) {
  const id = normalizeString(value, "npc.id", 48);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error("npc.id must be lowercase kebab-case.");
  }

  return id;
}

function normalizeInteger(value, label, min, max) {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }

  if (value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }

  return value;
}

function parseNPC(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("RealAI returned an empty NPC response.");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const extracted = extractJson(raw);

    if (!extracted) {
      throw new Error("RealAI did not return valid NPC JSON.");
    }

    return extracted;
  }
}

function validateNPCShape(npc) {
  assertExactKeys(npc, ROOT_KEYS, "npc");
  assertExactKeys(npc.appearance, APPEARANCE_KEYS, "npc.appearance");
  assertExactKeys(npc.animation_profile, ANIMATION_KEYS, "npc.animation_profile");
  assertExactKeys(npc.interaction_profile, INTERACTION_KEYS, "npc.interaction_profile");
  assertExactKeys(npc.background, BACKGROUND_KEYS, "npc.background");
  assertExactKeys(npc.stats, STATS_KEYS, "npc.stats");
  assertExactKeys(npc.dialogue_hooks, DIALOGUE_KEYS, "npc.dialogue_hooks");

  return {
    id: normalizeId(npc.id),
    name: normalizeString(npc.name, "npc.name", 64),
    gender: normalizeString(npc.gender, "npc.gender", 24),
    appearance: {
      body_type: normalizeString(npc.appearance.body_type, "npc.appearance.body_type", 40),
      hair: normalizeString(npc.appearance.hair, "npc.appearance.hair", 40),
      face: normalizeString(npc.appearance.face, "npc.appearance.face", 72),
      clothing: normalizeString(npc.appearance.clothing, "npc.appearance.clothing", 64),
      notable_feature: normalizeString(npc.appearance.notable_feature, "npc.appearance.notable_feature", 72),
      color_palette: normalizeString(npc.appearance.color_palette, "npc.appearance.color_palette", 48),
      silhouette: normalizeString(npc.appearance.silhouette, "npc.appearance.silhouette", 24)
    },
    animation_profile: {
      idle: normalizeString(npc.animation_profile.idle, "npc.animation_profile.idle", 48),
      walk: normalizeString(npc.animation_profile.walk, "npc.animation_profile.walk", 48),
      gesture: normalizeString(npc.animation_profile.gesture, "npc.animation_profile.gesture", 48)
    },
    interaction_profile: {
      attitude_toward_player: normalizeString(
        npc.interaction_profile.attitude_toward_player,
        "npc.interaction_profile.attitude_toward_player",
        24
      ),
      interaction_style: normalizeString(
        npc.interaction_profile.interaction_style,
        "npc.interaction_profile.interaction_style",
        24
      ),
      distance_behavior: normalizeString(
        npc.interaction_profile.distance_behavior,
        "npc.interaction_profile.distance_behavior",
        32
      ),
      eye_contact: normalizeString(
        npc.interaction_profile.eye_contact,
        "npc.interaction_profile.eye_contact",
        16
      )
    },
    background: {
      origin: normalizeString(npc.background.origin, "npc.background.origin", 64),
      occupation: normalizeString(npc.background.occupation, "npc.background.occupation", 48),
      faction: normalizeString(npc.background.faction, "npc.background.faction", 48),
      trait: normalizeString(npc.background.trait, "npc.background.trait", 48)
    },
    stats: {
      hp: normalizeInteger(npc.stats.hp, "npc.stats.hp", 20, 80),
      perception: normalizeInteger(npc.stats.perception, "npc.stats.perception", 1, 10),
      charisma: normalizeInteger(npc.stats.charisma, "npc.stats.charisma", 1, 10)
    },
    dialogue_hooks: {
      intro: normalizeString(npc.dialogue_hooks.intro, "npc.dialogue_hooks.intro", 80),
      gossip: normalizeString(npc.dialogue_hooks.gossip, "npc.dialogue_hooks.gossip", 80)
    }
  };
}

function validateDialogueWordCount(text, label) {
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount > 12) {
    throw new Error(`${label} must be 12 words or fewer.`);
  }
}

async function generateFreshNPC(seed = {}) {
  const prompt = buildNPCPrompt(seed);
  const raw = await realai(prompt, "gpt-4o-mini");
  const npc = validateNPCShape(parseNPC(raw));

  validateDialogueWordCount(npc.dialogue_hooks.intro, "npc.dialogue_hooks.intro");
  validateDialogueWordCount(npc.dialogue_hooks.gossip, "npc.dialogue_hooks.gossip");

  return npc;
}

export function fallbackNPC(seed = {}) {
  return {
    id: buildFallbackId(seed),
    name: "Wastelander",
    gender: "unknown",
    appearance: {
      body_type: "average",
      hair: "messy",
      face: "rugged",
      clothing: "dusty rags",
      notable_feature: "none",
      color_palette: "dust brown",
      silhouette: "average"
    },
    animation_profile: {
      idle: "relaxed stance",
      walk: "slow shuffle",
      gesture: "points often"
    },
    interaction_profile: {
      attitude_toward_player: "neutral",
      interaction_style: "direct",
      distance_behavior: "keeps distance",
      eye_contact: "casual"
    },
    background: {
      origin: String(seed.region || "unknown").slice(0, 64),
      occupation: "drifter",
      faction: String(seed.faction || "none").slice(0, 48),
      trait: String(seed.tone || "quiet").slice(0, 48)
    },
    stats: {
      hp: 40,
      perception: 5,
      charisma: 5
    },
    dialogue_hooks: {
      intro: "Hey there.",
      gossip: "Dust storms coming."
    }
  };
}

export async function generateNPC(seed = {}) {
  const key = getNPCSeedKey(seed);

  if (npcCache.has(key)) {
    return npcCache.get(key);
  }

  try {
    const npc = await generateFreshNPC(seed);
    npcCache.set(key, npc);
    return npc;
  } catch {
    const npc = fallbackNPC(seed);
    npcCache.set(key, npc);
    return npc;
  }
}

export async function getOrCreateNPC(seed = {}) {
  return generateNPC(seed);
}

export function clearNPCFactoryCache() {
  npcCache.clear();
}

export function getNPCFactoryCacheSize() {
  return npcCache.size;
}

export function getNPCFactorySeedKey(seed = {}) {
  return getNPCSeedKey(seed);
}

export const clearNPCCache = clearNPCFactoryCache;
export const getNPCCacheSize = getNPCFactoryCacheSize;
