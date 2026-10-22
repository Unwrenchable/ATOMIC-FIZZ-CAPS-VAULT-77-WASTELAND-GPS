'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_REPLY_CHARS = 420;
const MAX_REPO_FILES = 600;
const MAX_REPO_DEPTH = 5;
const REPO_CACHE_TTL_MS = 5 * 60 * 1000;
const SKIP_DIRS = new Set([
  '.git',
  '.github',
  '.vercel',
  'coverage',
  'dist',
  'node_modules'
]);

const IDENTITY_QUERY_REGEX = /who are you|what are you|your name|identify yourself|who is jax|are you jax|who am i talking to/i;
const HELP_QUERY_REGEX = /\bhelp\b|\bwhat can you do\b|\bcommands?\b|\bhow do i\b/;
const STATUS_QUERY_REGEX = /\bstatus\b|\bworldstate\b|\bonline\b|\buplink\b|\bsignal\b/;
const REPO_QUERY_REGEX = /\brepo\b|\bcode\b|\bmodule\b|\bimport\b|\bfile\b|\bserver\b|\bbackend\b|\bfrontend\b|\brefactor\b|\barchitect|\bbug\b|\bbroken\b/i;
const QUEST_QUERY_REGEX = /\bquest\b|\bmission\b|\bobjective\b|\bjob\b|\bcontract\b/i;
const PLAYER_QUERY_REGEX = /\bplayer\b|\binventory\b|\bcaps\b|\bxp\b|\bhp\b|\bhealth\b|\bgear\b|\bfaction\b/i;
const LOCATION_QUERY_REGEX = /\blocation\b|\bmap\b|\bpoi\b|\bregion\b|\bzone\b|\bwhere\b/i;
const LOCAL_MODE_QUERY_REGEX = /\bthird party\b|\bapi\b|\bself-host(?:ed)?\b|\blocal model\b|\boffline\b|\bwithout api\b/i;

let cachedRepoManifest = null;
let cachedRepoManifestAt = 0;

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashIndex(seed, length) {
  if (!length || length <= 1) {
    return 0;
  }

  const digest = crypto.createHash('sha256').update(String(seed || 'vault-77')).digest();
  return digest[0] % length;
}

function pickVariant(seed, options) {
  if (!Array.isArray(options) || options.length === 0) {
    return '';
  }

  return options[hashIndex(seed, options.length)];
}

function formatList(items, limit) {
  const values = Array.isArray(items)
    ? items.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const visible = values.slice(0, limit);

  if (visible.length === 0) {
    return '';
  }

  if (visible.length === 1) {
    return visible[0];
  }

  if (visible.length === 2) {
    return `${visible[0]} and ${visible[1]}`;
  }

  return `${visible.slice(0, -1).join(', ')}, and ${visible[visible.length - 1]}`;
}

function walkRepoFiles(dir, rootDir, depth, files) {
  if (files.length >= MAX_REPO_FILES || depth > MAX_REPO_DEPTH) {
    return;
  }

  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (files.length >= MAX_REPO_FILES) {
      return;
    }

    if (entry.name.startsWith('.')) {
      if (entry.name.startsWith('.env')) {
        continue;
      }
      if (!['.github'].includes(entry.name)) {
        continue;
      }
    }

    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }

      walkRepoFiles(absolutePath, rootDir, depth + 1, files);
      continue;
    }

    files.push(relativePath);
  }
}

function readRepoManifestFromDisk() {
  if (cachedRepoManifest && Date.now() - cachedRepoManifestAt < REPO_CACHE_TTL_MS) {
    return cachedRepoManifest;
  }

  const repoRoot = path.join(__dirname, '..', '..');
  const files = [];
  walkRepoFiles(repoRoot, repoRoot, 0, files);
  cachedRepoManifest = files;
  cachedRepoManifestAt = Date.now();
  return files;
}

function getRepoManifest(repoSnapshot) {
  if (Array.isArray(repoSnapshot) && repoSnapshot.length > 0) {
    return repoSnapshot
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }

        if (entry && typeof entry.file === 'string') {
          return entry.file;
        }

        return '';
      })
      .map((file) => file.replace(/\\/g, '/'))
      .filter(Boolean)
      .slice(0, MAX_REPO_FILES);
  }

  return readRepoManifestFromDisk();
}

function buildRepoSummary(repoSnapshot) {
  const files = getRepoManifest(repoSnapshot);
  const topLevelCounts = new Map();

  for (const file of files) {
    const topLevel = file.split('/')[0] || file;
    topLevelCounts.set(topLevel, (topLevelCounts.get(topLevel) || 0) + 1);
  }

  return {
    totalFiles: files.length,
    hasBackend: files.some((file) => file.startsWith('backend/')),
    hasFrontend: files.some((file) => file.startsWith('frontend/')),
    hasRealAiScripts: files.some((file) => file.startsWith('scripts/realai/')),
    hasSystems: files.some((file) => file.startsWith('systems/')),
    hasOverseerProxy: files.includes('backend/api/overseer-proxy.js'),
    hasFrontendConfig: files.includes('backend/api/frontend-config.js')
  };
}

function getWeather(worldstate) {
  const data = safeObject(worldstate);
  const nested = safeObject(data.worldstate || data.world_state);
  return normalizeText(data.weather || nested.weather || '');
}

function buildWorldSummary(worldstate) {
  const data = safeObject(worldstate);
  const player = safeObject(data.player);
  const npcs = Array.isArray(data.npcs) ? data.npcs : [];
  const quests = Array.isArray(data.quests) ? data.quests : [];
  const factions = Array.isArray(data.factions)
    ? data.factions
    : Object.keys(safeObject(data.factions || safeObject(data.worldstate).factions));
  const settlements = Array.isArray(data.settlements) ? data.settlements : [];
  const regions = Array.isArray(data.regions) ? data.regions : [];
  const weather = getWeather(data);

  return {
    playerName: normalizeText(player.name || player.id || ''),
    playerFaction: normalizeText(player.faction || ''),
    playerCaps: Number.isFinite(Number(player.caps)) ? Number(player.caps) : null,
    playerHp: Number.isFinite(Number(player.hp)) ? Number(player.hp) : null,
    playerLocation: normalizeText(player.location || ''),
    npcCount: npcs.length,
    questCount: quests.length,
    factionCount: factions.length,
    settlementCount: settlements.length,
    regionCount: regions.length,
    weather
  };
}

function findLearnedFact(learnedFacts, key) {
  const entries = Array.isArray(learnedFacts) ? learnedFacts : [];
  const match = entries.find((entry) => entry && entry.key === key && entry.value);
  return normalizeText(match && match.value, 72);
}

function buildPlayerSummary(worldstate, playerContext) {
  const data = safeObject(worldstate);
  const worldPlayer = safeObject(data.player);
  const profile = safeObject(playerContext && playerContext.profile);
  const memory = safeObject(playerContext && playerContext.memory);
  const learnedFacts = Array.isArray(playerContext && playerContext.learnedFacts)
    ? playerContext.learnedFacts
    : [];
  const worldSummary = buildWorldSummary(worldstate);

  return {
    ...worldSummary,
    playerName: normalizeText(worldSummary.playerName || profile.name || ''),
    playerFaction: normalizeText(worldSummary.playerFaction || profile.faction || ''),
    playerCaps: worldSummary.playerCaps !== null ? worldSummary.playerCaps : (
      Number.isFinite(Number(profile.caps)) ? Number(profile.caps) : null
    ),
    playerHp: worldSummary.playerHp !== null ? worldSummary.playerHp : (
      Number.isFinite(Number(profile.hp)) ? Number(profile.hp) : null
    ),
    playerLocation: normalizeText(worldSummary.playerLocation || profile.location || ''),
    playerLevel: Number.isFinite(Number(profile.level)) ? Number(profile.level) : null,
    playerXp: Number.isFinite(Number(profile.xp)) ? Number(profile.xp) : null,
    playerRadiation: Number.isFinite(Number(worldPlayer.radiation || profile.radiation))
      ? Number(worldPlayer.radiation || profile.radiation)
      : null,
    claimedPoiCount: Number.isFinite(Number(profile.claimedCount)) ? Number(profile.claimedCount) : null,
    questCount: Math.max(
      worldSummary.questCount,
      Object.keys(safeObject(profile.quests)).length,
      Object.keys(safeObject(memory.questStates)).length,
      Number.isFinite(Number(profile.activeQuestCount)) ? Number(profile.activeQuestCount) : 0
    ),
    rememberedRegionCount: Array.isArray(memory.regionsVisited) ? memory.regionsVisited.length : 0,
    rememberedPoiCount: Array.isArray(memory.poisDiscovered) ? memory.poisDiscovered.length : 0,
    learnedFactCount: learnedFacts.length,
    recentConversationCount: Array.isArray(playerContext && playerContext.recentConversation)
      ? playerContext.recentConversation.length
      : 0,
    currentGoal: findLearnedFact(learnedFacts, 'current_goal'),
    playstyle: findLearnedFact(learnedFacts, 'playstyle')
  };
}

function trimReply(text) {
  return normalizeText(text).slice(0, MAX_REPLY_CHARS);
}

function buildTelemetryLine(summary, seed) {
  const fragments = [];

  if (summary.playerName) {
    const dossier = [`player feed tags ${summary.playerName}`];
    if (summary.playerFaction) {
      dossier.push(`faction ${summary.playerFaction}`);
    }
    if (summary.playerCaps !== null) {
      dossier.push(`${summary.playerCaps} caps on the meter`);
    }
    if (summary.playerHp !== null) {
      dossier.push(`hp ${summary.playerHp}`);
    }
    if (summary.playerLevel !== null) {
      dossier.push(`level ${summary.playerLevel}`);
    }
    if (summary.playerLocation) {
      dossier.push(`last seen near ${summary.playerLocation}`);
    }
    fragments.push(dossier.join(', '));
  }

  if (summary.questCount > 0) {
    fragments.push(`${summary.questCount} live quest${summary.questCount === 1 ? '' : 's'} on the board`);
  }

  if (summary.npcCount > 0) {
    fragments.push(`${summary.npcCount} nearby npc contact${summary.npcCount === 1 ? '' : 's'} on scope`);
  }

  if (summary.weather) {
    fragments.push(`weather reads ${summary.weather}`);
  }

  if (summary.regionCount > 0) {
    fragments.push(`${summary.regionCount} tracked region${summary.regionCount === 1 ? '' : 's'}`);
  }

  if (summary.factionCount > 0) {
    fragments.push(`${summary.factionCount} faction signal${summary.factionCount === 1 ? '' : 's'} in memory`);
  }

  if (fragments.length === 0) {
    return pickVariant(seed, [
      'Telemetry is thin: no hot player dossier, no active quest stack, and only dust on the scope.',
      'Scopes are quiet right now: no synced player profile, no quest traffic, and not much but static in memory.',
      'World telemetry is running lean: no fresh player feed, no quest chatter, and barely a blip on the scanners.'
    ]);
  }

  return `Telemetry reads ${formatList(fragments, 3)}.`;
}

function buildMemoryLine(summary) {
  const fragments = [];

  if (summary.currentGoal) {
    fragments.push(`goal ${summary.currentGoal}`);
  }
  if (summary.playstyle) {
    fragments.push(`playstyle ${summary.playstyle}`);
  }
  if (summary.learnedFactCount > 0) {
    fragments.push(`${summary.learnedFactCount} learned player fact${summary.learnedFactCount === 1 ? '' : 's'}`);
  }
  if (summary.rememberedRegionCount > 0) {
    fragments.push(`${summary.rememberedRegionCount} region mark${summary.rememberedRegionCount === 1 ? '' : 's'} in memory`);
  }
  if (summary.rememberedPoiCount > 0) {
    fragments.push(`${summary.rememberedPoiCount} poi breadcrumb${summary.rememberedPoiCount === 1 ? '' : 's'}`);
  }
  if (summary.recentConversationCount > 0) {
    fragments.push(`${summary.recentConversationCount} recent exchange${summary.recentConversationCount === 1 ? '' : 's'} cached`);
  }

  if (fragments.length === 0) {
    return '';
  }

  return `Memory core holds ${formatList(fragments, 2)}.`;
}

function buildRepoLine(summary, prompt, seed) {
  const repoParts = [];

  if (summary.hasBackend) {
    repoParts.push('Node/Express guts in backend/');
  }
  if (summary.hasFrontend) {
    repoParts.push('vanilla client gear in frontend/');
  }
  if (summary.hasRealAiScripts) {
    repoParts.push('RealAI rigs in scripts/realai/');
  }
  if (summary.hasSystems) {
    repoParts.push('game systems under systems/');
  }

  const baseLine = repoParts.length > 0
    ? `Repo scan shows ${formatList(repoParts, 3)}.`
    : pickVariant(seed, [
        'Repo scan is shallow, but the bunker still sees enough wiring to navigate.',
        'Repo telemetry is partial, but the code vault still has readable tracks.',
        'The manifest is thin, though the code bunker is still charted well enough to move.'
      ]);

  if (!/overseer|realai|ai/.test(prompt)) {
    return baseLine;
  }

  const hotFiles = [];
  if (summary.hasOverseerProxy) {
    hotFiles.push('backend/api/overseer-proxy.js');
  }
  if (summary.hasFrontendConfig) {
    hotFiles.push('backend/api/frontend-config.js');
  }

  if (hotFiles.length === 0) {
    return baseLine;
  }

  return `${baseLine} Hot panels for Overseer work are ${formatList(hotFiles, 2)}.`;
}

function buildActionLine(rawPrompt, worldSummary, repoSummary, seed) {
  const prompt = normalizeText(rawPrompt).toLowerCase();

  if (LOCAL_MODE_QUERY_REGEX.test(prompt)) {
    return pickVariant(seed, [
      'This core is bunker-local now: no third-party uplink required unless you explicitly force cloud mode.',
      'Self-hosted RealAI is the active brain on this line, so the Overseer can answer without begging an outside API for scraps.',
      'The local bunker brain handles this route now. Cloud uplinks are optional, not the default oxygen supply.'
    ]);
  }

  if (REPO_QUERY_REGEX.test(prompt)) {
    return pickVariant(seed, [
      'If the terminal goes feral again, start with the Overseer proxy, then the frontend config, then any mode/env wiring.',
      'For backend chatter problems, inspect the Overseer proxy first, then the frontend mode config, then the worldstate feed.',
      'If you are hunting a bad circuit, the first sweep should hit the proxy route, mode config, and the telemetry source.'
    ]);
  }

  if (QUEST_QUERY_REGEX.test(prompt)) {
    if (worldSummary.questCount > 0) {
      return `Quest traffic is alive, with ${worldSummary.questCount} active lead${worldSummary.questCount === 1 ? '' : 's'} riding the board.`;
    }
    return 'Quest board is quiet at the moment. No live contracts are stamped into this memory bank.';
  }

  if (PLAYER_QUERY_REGEX.test(prompt)) {
    if (worldSummary.playerName) {
      const additions = [];
      if (worldSummary.currentGoal) {
        additions.push(`goal still points at ${worldSummary.currentGoal}`);
      }
      if (worldSummary.playstyle) {
        additions.push(`playstyle reads ${worldSummary.playstyle}`);
      }
      const suffix = additions.length ? ` ${additions.join('. ')}.` : '';
      return `Player dossier is readable for ${worldSummary.playerName}.${suffix}`.trim();
    }
    return 'Player telemetry has not synced into this bunker yet. The dossier drawer is still empty.';
  }

  if (LOCATION_QUERY_REGEX.test(prompt)) {
    if (worldSummary.playerLocation) {
      return `Last clean location ping lands near ${worldSummary.playerLocation}.`;
    }
    if (worldSummary.regionCount > 0) {
      return `Regional map memory is alive with ${worldSummary.regionCount} tracked sector${worldSummary.regionCount === 1 ? '' : 's'}.`;
    }
    return 'Map telemetry is running light. No fresh location ping is cached in the bunker.';
  }

  if (repoSummary.hasOverseerProxy) {
    return pickVariant(seed, [
      'Ask sharp, keep it short, and I can steer you through the right file without needing any off-site oracle.',
      'State the target cleanly and I will keep the answer inside the bunker walls.',
      'Give me the exact problem and I will work it from local telemetry instead of outsourcing my brain.'
    ]);
  }

  return pickVariant(seed, [
    'The local core is awake. Give me a cleaner target and I will dig with what the vault already knows.',
    'Self-hosted circuits are hot. Point me at the problem and I will work with bunker telemetry.',
    'Core is online and local. Call the shot, smoothskin, and I will keep the answer in-house.'
  ]);
}

function generateLocalOverseerReply(options = {}) {
  const rawPrompt = normalizeText(options.rawPrompt || options.prompt || '');
  const loweredPrompt = rawPrompt.toLowerCase();
  const worldSummary = buildPlayerSummary(options.worldstate, options.playerContext);
  const repoSummary = buildRepoSummary(options.repoSnapshot);
  const seed = `${rawPrompt}|${worldSummary.playerName}|${repoSummary.totalFiles}`;

  if (IDENTITY_QUERY_REGEX.test(loweredPrompt)) {
    return trimReply(
      'Jax Harlan, Vault 77 Overseer AI. Self-hosted RealAI core, bunker-local, no outside oracle required.'
    );
  }

  if (HELP_QUERY_REGEX.test(loweredPrompt)) {
    return trimReply(
      `${pickVariant(seed, [
        'Self-hosted Overseer core online.',
        'Vault 77 local brain online.',
        'Bunker-local RealAI core online.'
      ])} I can answer status checks, player and quest telemetry, location chatter, and which backend files to crack open when the code starts glowing.`
    );
  }

  const intro = pickVariant(seed, [
    'Jax Harlan here.',
    'Vault 77 local core responding.',
    'Overseer relay locked and breathing.'
  ]);
  const telemetryLine = buildTelemetryLine(worldSummary, `${seed}:telemetry`);
  const memoryLine = buildMemoryLine(worldSummary);
  const repoLine = buildRepoLine(repoSummary, loweredPrompt, `${seed}:repo`);
  const actionLine = buildActionLine(rawPrompt, worldSummary, repoSummary, `${seed}:action`);

  if (STATUS_QUERY_REGEX.test(loweredPrompt)) {
    return trimReply(`${intro} Self-hosted RealAI core online. ${telemetryLine} ${memoryLine} ${repoLine}`);
  }

  return trimReply(`${intro} ${actionLine} ${telemetryLine} ${memoryLine} ${repoLine}`);
}

module.exports = {
  generateLocalOverseerReply
};
