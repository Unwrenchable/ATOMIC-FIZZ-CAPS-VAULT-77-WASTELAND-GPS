#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const LOG = [];

function log(type, message, details = []) {
  LOG.push({ type, message, details });
}

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, fileList);
    } else {
      fileList.push(full);
    }
  }
  return fileList;
}

function scanRepo() {
  const files = walk(ROOT);

  const jsFiles = files.filter(f => f.endsWith('.js'));
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  const htmlFiles = files.filter(f => f.endsWith('.html'));

  // Detect duplicate filenames
  const nameMap = {};
  for (const file of [...jsFiles, ...jsonFiles]) {
    const base = path.basename(file);
    if (!nameMap[base]) nameMap[base] = [];
    nameMap[base].push(file);
  }

  for (const [name, paths] of Object.entries(nameMap)) {
    if (paths.length > 1) {
      log('WARN', `Duplicate file detected: ${name}`, paths);
    }
  }

  // Detect legacy folders
  const legacyFolders = ['_legacy', 'experimental', 'backup', 'old', 'archive'];
  for (const folder of legacyFolders) {
    const full = path.join(ROOT, folder);
    if (fs.existsSync(full)) {
      log('INFO', `Legacy folder detected: ${folder}`);
    }
  }

  // Detect missing scripts referenced in HTML
  for (const html of htmlFiles) {
    const content = fs.readFileSync(html, 'utf8');
    const scriptRegex = /<script.*src="([^"]+)"/g;
    let match;
    while ((match = scriptRegex.exec(content)) !== null) {
      const scriptPath = match[1].replace(/^\//, '');
      const full = path.join(ROOT, scriptPath);
      if (!fs.existsSync(full)) {
        log('ERROR', `Script referenced in HTML but missing: ${scriptPath}`);
      }
    }
  }

  // Detect unused JS files (no imports, not referenced in HTML)
  const used = new Set();
  for (const html of htmlFiles) {
    const content = fs.readFileSync(html, 'utf8');
    const scriptRegex = /<script.*src="([^"]+)"/g;
    let match;
    while ((match = scriptRegex.exec(content)) !== null) {
      used.add(path.basename(match[1]));
    }
  }

  for (const js of jsFiles) {
    const base = path.basename(js);
    if (!used.has(base)) {
      log('INFO', `Unused JS file: ${js}`);
    }
  }

  // Output results
  console.log('\n=== REPO AUDIT REPORT ===\n');
  for (const entry of LOG) {
    console.log(`[${entry.type}] ${entry.message}`);
    if (entry.details.length) {
      entry.details.forEach(d => console.log(`       - ${d}`));
    }
  }
  console.log('\n=== END OF REPORT ===\n');
}

scanRepo();
