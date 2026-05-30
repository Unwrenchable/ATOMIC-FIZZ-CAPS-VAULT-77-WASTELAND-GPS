const fs = require('fs');
const path = require('path');

const { createNpcEnrichmentManifest } = require('../realai/npc-repo-enricher');

const repoRoot = path.resolve(__dirname, '..', '..');
const npcDir = path.join(repoRoot, 'public', 'data', 'npc');
const indexPath = path.join(npcDir, 'index.json');
const outputPath = path.join(npcDir, 'enrichment.generated.json');

function parseArgs(argv) {
  const options = {
    write: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') {
      options.write = true;
      continue;
    }
    if (arg === '--seed-prompt') {
      options.seedPrompt = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--base-character') {
      options.baseCharacter = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--player-name') {
      options.playerName = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--playstyle') {
      options.playstyle = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--current-goal') {
      options.currentGoal = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg === '--default-faction') {
      options.defaultFaction = argv[index + 1] || '';
      index += 1;
      continue;
    }
  }

  return options;
}

function loadNpcList() {
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  return index
    .filter((fileName) => fileName && fileName !== 'index.json' && fileName !== 'enrichment.generated.json')
    .map((fileName) => {
      const filePath = path.join(npcDir, fileName);
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    });
}

function summarizeManifest(manifest) {
  const npcEntries = Object.values(manifest.npcs || {});
  const summary = {
    total: manifest.total || 0,
    withDescription: 0,
    withPersonality: 0,
    withDialog: 0,
    withParts: 0
  };

  for (const entry of npcEntries) {
    if (entry.description) {
      summary.withDescription += 1;
    }
    if (entry.personality) {
      summary.withPersonality += 1;
    }
    if (entry.dialog) {
      summary.withDialog += 1;
    }
    if (entry.parts) {
      summary.withParts += 1;
    }
  }

  return summary;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const npcs = loadNpcList();
  const manifest = createNpcEnrichmentManifest(npcs, options);
  const output = JSON.stringify(manifest);
  const summary = summarizeManifest(manifest);

  if (options.write) {
    fs.writeFileSync(outputPath, output);
    console.log(
      JSON.stringify(
        {
          ok: true,
          wrote: path.relative(repoRoot, outputPath),
          summary
        },
        null,
        2
      )
    );
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        output: path.relative(repoRoot, outputPath),
        summary
      },
      null,
      2
    )
  );
}

main();
