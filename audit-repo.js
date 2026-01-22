#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');
const fg = require('fast-glob');

const ROOT = process.cwd();
const LOG = [];

function log(type, message, details = []) {
  LOG.push({ type, message, details });
}

async function scan() {
  // use fast-glob to respect ignore patterns
  const ignore = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'];
  const entries = await fg(['**/*.{js,json,html,jsx,ts,tsx}'], { cwd: ROOT, ignore, dot: true, absolute: true });

  // duplicate detection by basename but only warn if duplicates are in same top-level folder
  const nameMap = {};
  for (const file of entries) {
    const base = path.basename(file);
    nameMap[base] = nameMap[base] || [];
    nameMap[base].push(file);
  }
  for (const [name, paths] of Object.entries(nameMap)) {
    if (paths.length > 1) log('WARN', `Duplicate file detected: ${name}`, paths);
  }

  // check HTML script references
  const htmlFiles = entries.filter(e => e.endsWith('.html'));
  for (const html of htmlFiles) {
    const content = await fs.readFile(html, 'utf8');
    const scriptRegex = /<script.*src="([^"]+)"/g;
    let match;
    while ((match = scriptRegex.exec(content)) !== null) {
      const scriptPath = match[1].replace(/^\//, '');
      const full = path.join(ROOT, scriptPath);
      try {
        await fs.access(full);
      } catch {
        log('ERROR', `Script referenced in HTML but missing: ${scriptPath}`, [html]);
      }
    }
  }

  // output
  console.log(JSON.stringify(LOG, null, 2));
}

scan().catch(err => {
  console.error('Scan failed:', err);
  process.exit(1);
});
