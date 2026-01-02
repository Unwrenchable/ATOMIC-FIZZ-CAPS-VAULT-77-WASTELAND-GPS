// scripts/addCraftables.js
const fs = require('fs');
const path = require('path');

const DEFAULT_CRAFT_DIR = path.join(__dirname, '..', 'public', 'data', 'craftables');
const DEFAULT_OUT_FILE = path.join(__dirname, '..', 'public', 'data', 'craftables.json');

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function validateCraftable(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.id || typeof obj.id !== 'string') return false;
  if (!obj.name || typeof obj.name !== 'string') return false;
  if (!Array.isArray(obj.ingredients)) return false;
  return true;
}

function loadExisting(outFile) {
  try {
    if (!fs.existsSync(outFile)) return {};
    const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.warn('Existing craftables invalid, starting fresh:', e.message);
    return {};
  }
}

function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    craftDir: (() => {
      const i = args.indexOf('--craft-dir');
      return i >= 0 && args[i+1] ? args[i+1] : DEFAULT_CRAFT_DIR;
    })(),
    outFile: (() => {
      const i = args.indexOf('--out');
      return i >= 0 && args[i+1] ? args[i+1] : DEFAULT_OUT_FILE;
    })()
  };
}

function main() {
  const opts = parseArgs();
  const craftDir = opts.craftDir;
  const outFile = opts.outFile;

  if (opts.verbose) console.log('Options:', { craftDir, outFile, force: opts.force, dryRun: opts.dryRun });

  const files = listJsonFiles(craftDir);
  if (opts.verbose) console.log(`Found ${files.length} craftable files in ${craftDir}`);

  const existing = loadExisting(outFile);
  let changed = false;

  for (const f of files) {
    const full = path.join(craftDir, f);
    const obj = readJsonSafe(full);
    if (!obj) {
      console.warn(`Skipping invalid JSON: ${full}`);
      continue;
    }
    if (!validateCraftable(obj)) {
      console.warn(`Skipping invalid craftable shape: ${full}`);
      continue;
    }
    if (!existing[obj.id] || opts.force) {
      existing[obj.id] = obj;
      changed = true;
      if (opts.verbose) console.log(`Added/updated craftable: ${obj.id}`);
      else console.log(`Added/updated: ${obj.id}`);
    } else {
      if (opts.verbose) console.log(`Skipped existing craftable: ${obj.id}`);
    }
  }

  if (!changed) {
    console.log('No changes to craftables.');
    return 0;
  }

  if (opts.dryRun) {
    console.log('Dry run enabled. The following would be written:');
    console.log(JSON.stringify(existing, null, 2));
    return 0;
  }

  try {
    atomicWrite(outFile, existing);
    console.log(`Wrote ${outFile}`);
    return 0;
  } catch (e) {
    console.error('Failed to write craftables:', e.message);
    return 1;
  }
}

if (require.main === module) {
  const code = main();
  process.exit(code);
}

module.exports = {
  readJsonSafe,
  validateCraftable,
  loadExisting,
  atomicWrite,
  listJsonFiles
};
