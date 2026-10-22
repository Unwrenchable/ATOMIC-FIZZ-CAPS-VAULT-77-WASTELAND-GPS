'use strict';

const { redis, getJSON, setJSON } = require('../lib/redis');
const { getSession } = require('../lib/auth');

const OVERSEER_MEMORY_TTL_SECONDS = 21 * 24 * 60 * 60;
const MAX_HISTORY_ENTRIES = 12;
const MAX_HISTORY_CHARS = 280;
const MAX_LIST_ENTRIES = 24;
const MAX_LEARNED_FACTS = 40;
const MAX_LEARNED_VALUE_CHARS = 160;
const MAX_QUEST_STATES = 20;

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeText(value, maxLength = MAX_HISTORY_CHARS) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeRole(value) {
  return value === 'assistant' ? 'assistant' : 'user';
}

function uniqueStrings(values, limit, maxLength = 72) {
  const seen = new Set();
  const output = [];

  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeText(value, maxLength);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function normalizeRecentConversation(entries) {
  const normalized = [];

  for (const entry of Array.isArray(entries) ? entries : []) {
    const content = normalizeText(entry && entry.content, MAX_HISTORY_CHARS);
    if (!content) {
      continue;
    }
    normalized.push({
      role: normalizeRole(entry && entry.role),
      content
    });
  }

  return normalized.slice(-MAX_HISTORY_ENTRIES);
}

function sameConversationEntry(left, right) {
  return !!left && !!right && left.role === right.role && left.content === right.content;
}

function mergeRecentConversation(storedEntries, incomingEntries) {
  const stored = normalizeRecentConversation(storedEntries);
  const incoming = normalizeRecentConversation(incomingEntries);
  let overlap = 0;

  for (let size = Math.min(stored.length, incoming.length); size > 0; size -= 1) {
    let matches = true;
    for (let index = 0; index < size; index += 1) {
      if (!sameConversationEntry(stored[stored.length - size + index], incoming[index])) {
        matches = false;
        break;
      }
    }
    if (matches) {
      overlap = size;
      break;
    }
  }

  const merged = [];

  for (const entry of [...stored, ...incoming.slice(overlap)]) {
    const previous = merged[merged.length - 1];
    if (sameConversationEntry(previous, entry)) {
      continue;
    }
    merged.push(entry);
  }

  return merged.slice(-MAX_HISTORY_ENTRIES);
}

function normalizeQuestStates(value) {
  const entries = Object.entries(safeObject(value)).slice(-MAX_QUEST_STATES);
  const normalized = {};

  for (const [questId, state] of entries) {
    const safeQuestId = normalizeText(questId, 72);
    const safeState = normalizeText(state, 72);
    if (!safeQuestId || !safeState) {
      continue;
    }
    normalized[safeQuestId] = safeState;
  }

  return normalized;
}

function normalizeCounter(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function normalizeMemorySnapshot(snapshot) {
  const data = safeObject(snapshot);
  return {
    regionsVisited: uniqueStrings(data.regionsVisited, MAX_LIST_ENTRIES),
    poisDiscovered: uniqueStrings(data.poisDiscovered, MAX_LIST_ENTRIES),
    questStates: normalizeQuestStates(data.questStates),
    encountersSurvived: normalizeCounter(data.encountersSurvived),
    radEvents: normalizeCounter(data.radEvents)
  };
}

function normalizeLearnedFacts(snapshot) {
  const facts = [];

  if (Array.isArray(snapshot)) {
    for (const entry of snapshot) {
      const key = normalizeText(entry && entry.key, 64);
      const value = normalizeText(entry && entry.value, MAX_LEARNED_VALUE_CHARS);
      if (!key || !value) {
        continue;
      }
      facts.push({
        key,
        category: normalizeText(entry && entry.category, 32).toLowerCase() || 'general',
        value,
        ts: normalizeCounter(entry && entry.ts) || Date.now()
      });
    }
  } else {
    for (const [key, entry] of Object.entries(safeObject(snapshot))) {
      const safeKey = normalizeText(key, 64);
      const safeValue = normalizeText(entry && entry.value, MAX_LEARNED_VALUE_CHARS);
      if (!safeKey || !safeValue) {
        continue;
      }
      facts.push({
        key: safeKey,
        category: normalizeText(entry && entry.category, 32).toLowerCase() || 'general',
        value: safeValue,
        ts: normalizeCounter(entry && entry.ts) || Date.now()
      });
    }
  }

  facts.sort((left, right) => left.ts - right.ts);
  return facts.slice(-MAX_LEARNED_FACTS);
}

function mergeUniqueStrings(storedValues, incomingValues, limit) {
  return uniqueStrings([...(storedValues || []), ...(incomingValues || [])], limit);
}

function mergeMemorySnapshot(storedSnapshot, incomingSnapshot) {
  const stored = normalizeMemorySnapshot(storedSnapshot);
  const incoming = normalizeMemorySnapshot(incomingSnapshot);

  return {
    regionsVisited: mergeUniqueStrings(stored.regionsVisited, incoming.regionsVisited, MAX_LIST_ENTRIES),
    poisDiscovered: mergeUniqueStrings(stored.poisDiscovered, incoming.poisDiscovered, MAX_LIST_ENTRIES),
    questStates: {
      ...stored.questStates,
      ...incoming.questStates
    },
    encountersSurvived: Math.max(stored.encountersSurvived, incoming.encountersSurvived),
    radEvents: Math.max(stored.radEvents, incoming.radEvents)
  };
}

function mergeLearnedFacts(storedFacts, incomingFacts) {
  const merged = new Map();

  for (const fact of [...normalizeLearnedFacts(storedFacts), ...normalizeLearnedFacts(incomingFacts)]) {
    const existing = merged.get(fact.key);
    if (!existing || fact.ts >= existing.ts) {
      merged.set(fact.key, fact);
    }
  }

  return Array.from(merged.values())
    .sort((left, right) => left.ts - right.ts)
    .slice(-MAX_LEARNED_FACTS);
}

function extractSessionId(req) {
  const header = (req && req.headers && (req.headers.authorization || req.headers['x-session-id'])) || '';
  if (typeof header !== 'string') {
    return '';
  }
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return header.trim();
}

function countActiveQuests(value) {
  return Object.keys(safeObject(value)).length;
}

async function loadPlayerProfile(wallet) {
  try {
    const raw = await redis.hGet(`player:${wallet}`, 'profile');
    if (!raw) {
      return null;
    }

    const profile = JSON.parse(raw);
    const survival = safeObject(profile.survival);

    return {
      name: normalizeText(profile.name, 48),
      faction: normalizeText(profile.faction, 48),
      location: normalizeText(profile.location, 72),
      level: normalizeCounter(profile.level),
      xp: normalizeCounter(profile.xp),
      caps: normalizeCounter(profile.caps),
      hp: normalizeCounter(profile.hp),
      radiation: normalizeCounter(survival.radiation || profile.radiation),
      claimedCount: Array.isArray(profile.claimed) ? profile.claimed.length : 0,
      activeQuestCount: countActiveQuests(profile.quests),
      quests: normalizeQuestStates(profile.quests),
      traits: uniqueStrings(profile.traits, 6, 32)
    };
  } catch (error) {
    console.error('[overseer-context] failed to load player profile', error);
    return null;
  }
}

async function resolveOverseerContext(req, body) {
  const recentConversation = normalizeRecentConversation(body && body.conversationHistory);
  const memory = normalizeMemorySnapshot(body && body.memorySnapshot);
  const learnedFacts = normalizeLearnedFacts(body && body.learningSnapshot);
  const sessionId = extractSessionId(req);

  if (!sessionId) {
    return {
      wallet: null,
      profile: null,
      recentConversation,
      memory,
      learnedFacts
    };
  }

  const session = await getSession(sessionId);
  if (!session || !session.wallet) {
    return {
      wallet: null,
      profile: null,
      recentConversation,
      memory,
      learnedFacts
    };
  }

  const storedState = safeObject(await getJSON(`overseer:memory:${session.wallet}`));
  const mergedConversation = mergeRecentConversation(storedState.recentConversation, recentConversation);
  const mergedMemory = mergeMemorySnapshot(storedState.memory, memory);
  const mergedLearnedFacts = mergeLearnedFacts(storedState.learnedFacts, learnedFacts);
  const profile = await loadPlayerProfile(session.wallet);

  return {
    wallet: session.wallet,
    profile,
    recentConversation: mergedConversation,
    memory: mergedMemory,
    learnedFacts: mergedLearnedFacts
  };
}

async function saveOverseerContext(context, assistantReply) {
  if (!context || !context.wallet) {
    return;
  }

  const recentConversation = mergeRecentConversation(context.recentConversation, [
    { role: 'assistant', content: assistantReply }
  ]);

  await setJSON(
    `overseer:memory:${context.wallet}`,
    {
      recentConversation,
      memory: normalizeMemorySnapshot(context.memory),
      learnedFacts: normalizeLearnedFacts(context.learnedFacts),
      updatedAt: Date.now()
    },
    { EX: OVERSEER_MEMORY_TTL_SECONDS }
  );
}

module.exports = {
  resolveOverseerContext,
  saveOverseerContext
};
