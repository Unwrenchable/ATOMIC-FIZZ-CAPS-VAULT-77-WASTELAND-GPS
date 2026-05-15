'use strict';

const fs = require('fs');
const path = require('path');
const { createNpcEnrichmentManifest } = require('../realai/npc-repo-enricher');

const ROOT = path.resolve(__dirname, '../..');
const NPC_DIR = path.join(ROOT, 'public', 'data', 'npc');
const NPC_INDEX_FILE = path.join(NPC_DIR, 'index.json');
const ENRICHMENT_FILE = path.join(NPC_DIR, 'enrichment.generated.json');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token || !token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];

    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function hasDialog(npc) {
  if (!npc || typeof npc !== 'object') return false;
  if (Array.isArray(npc.dialogPool) && npc.dialogPool.some(hasText)) return true;
  if (Array.isArray(npc.dialog) && npc.dialog.some(hasText)) return true;
  if (isObject(npc.dialog)) {
    return Object.values(npc.dialog).some((entry) => {
      if (Array.isArray(entry)) return entry.some(hasText);
      return hasText(entry);
    });
  }
  return false;
}

function deepMerge(base, overlay) {
  if (Array.isArray(overlay)) {
    return overlay.slice();
  }

  if (!isObject(overlay)) {
    return overlay;
  }

  const output = isObject(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(overlay)) {
    output[key] = deepMerge(output[key], value);
  }
  return output;
}

function loadNpcList() {
  const index = JSON.parse(fs.readFileSync(NPC_INDEX_FILE, 'utf8'));
  if (!Array.isArray(index)) {
    throw new Error('NPC index is not an array');
  }

  const npcs = [];
  for (const entry of index) {
    if (!hasText(entry)) continue;
    const npcPath = path.join(NPC_DIR, entry);
    if (!fs.existsSync(npcPath)) continue;

    try {
      const npc = JSON.parse(fs.readFileSync(npcPath, 'utf8'));
      if (npc && typeof npc === 'object') {
        npcs.push(npc);
      }
    } catch (error) {
      console.warn('[generate-npc-enrichment] Skipping invalid JSON:', entry, error.message);
    }
  }

  return npcs;
}

function summarizeManifest(manifest, npcs) {
  const summary = {
    total: Array.isArray(npcs) ? npcs.length : 0,
    withDescription: 0,
    withPersonality: 0,
    withDialog: 0,
    withParts: 0
  };

  for (const npc of npcs) {
    if (!npc || !npc.id) continue;
    const overlay = isObject(manifest && manifest.npcs && manifest.npcs[npc.id]) ? manifest.npcs[npc.id] : {};
    const merged = deepMerge(npc, overlay);

    if (hasText(merged.description)) summary.withDescription += 1;
    if (hasText(merged.personality)) summary.withPersonality += 1;
    if (hasDialog(merged)) summary.withDialog += 1;
    if (isObject(merged.parts) && Object.keys(merged.parts).length > 0) summary.withParts += 1;
  }

  return summary;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const npcs = loadNpcList();
  const manifest = createNpcEnrichmentManifest(npcs, {
    seedPrompt: hasText(args['seed-prompt']) ? args['seed-prompt'] : '',
    baseCharacter: hasText(args['base-character']) ? args['base-character'] : '',
    playerName: hasText(args['player-name']) ? args['player-name'] : 'Wanderer',
    playstyle: hasText(args.playstyle) ? args.playstyle : '',
    currentGoal: hasText(args['current-goal']) ? args['current-goal'] : '',
    defaultFaction: hasText(args['default-faction']) ? args['default-faction'] : 'Independent'
  });

  const summary = summarizeManifest(manifest, npcs);
  console.log('[generate-npc-enrichment] Summary:', summary);

  if (args.write) {
    fs.writeFileSync(ENRICHMENT_FILE, JSON.stringify(manifest), 'utf8');
    console.log('[generate-npc-enrichment] Wrote', ENRICHMENT_FILE);
  } else {
    console.log('[generate-npc-enrichment] Dry run complete. Use --write to save file.');
  }
}

if (require.main === module) {
  main();
}
