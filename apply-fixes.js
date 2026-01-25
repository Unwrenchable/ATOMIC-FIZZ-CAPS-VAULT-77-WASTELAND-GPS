// scripts/apply-fixes.js
// Idempotent script used by the GitHub Action to inject the frontend-config mount.
// - Backs up original backend/server.js under .github/auto-fix-backups
// - Injects the safeMount line only if not already present

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

function backupFile(filePath) {
  try {
    const abs = path.join(repoRoot, filePath);
    if (!fs.existsSync(abs)) return;
    const backupsDir = path.join(repoRoot, '.github', 'auto-fix-backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const bakName = `${filePath.replace(/[\/\\]/g, '_')}.${Date.now()}.bak`;
    fs.copyFileSync(abs, path.join(backupsDir, bakName));
    console.log(`Backed up ${filePath} -> .github/auto-fix-backups/${bakName}`);
  } catch (err) {
    console.error('Backup failed for', filePath, err && err.message);
  }
}

function writeFile(filePath, content) {
  const abs = path.join(repoRoot, filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  console.log(`Wrote ${filePath}`);
}

function injectFrontendConfigMount() {
  const serverPath = path.join('backend', 'server.js');
  const absServerPath = path.join(repoRoot, serverPath);

  if (!fs.existsSync(absServerPath)) {
    console.warn('backend/server.js not found — skipping injection');
    return false;
  }

  const raw = fs.readFileSync(absServerPath, 'utf8');

  // If the mount is already present, nothing to do
  if (/\/api\/config\/frontend|frontend-config/.test(raw)) {
    console.log('frontend-config route already present in backend/server.js — no change needed');
    return false;
  }

  // Preferred insertion point: after safeMount("/api/locations", api("locations"));
  const insertAfter = 'safeMount("/api/locations", api("locations"));';
  let newRaw = raw;

  const mountLine = '\n// Expose frontend configuration for client-side personality\nsafeMount("/api/config/frontend", api("frontend-config"));\n';

  if (raw.includes(insertAfter)) {
    newRaw = raw.replace(insertAfter, insertAfter + '\n' + mountLine);
    console.log('Injecting mount after /api/locations safeMount');
  } else {
    // Next best: find last occurrence of 'safeMount(' and insert after it
    const lastSafeMountIndex = raw.lastIndexOf('safeMount(');
    if (lastSafeMountIndex !== -1) {
      // find end of line after that index
      const afterIdx = raw.indexOf('\n', lastSafeMountIndex);
      if (afterIdx !== -1) {
        const before = raw.slice(0, afterIdx + 1);
        const after = raw.slice(afterIdx + 1);
        newRaw = before + mountLine + after;
        console.log('Injecting mount after last safeMount occurrence');
      } else {
        // fallback: append before app.listen or at end
        const listenIdx = raw.indexOf('app.listen(');
        if (listenIdx !== -1) {
          const before = raw.slice(0, listenIdx);
          const after = raw.slice(listenIdx);
          newRaw = before + mountLine + after;
          console.log('Appending mount before app.listen');
        } else {
          newRaw = raw + '\n' + mountLine;
          console.log('Appending mount at end of file');
        }
      }
    } else {
      // No safeMount found, append at end
      newRaw = raw + '\n' + mountLine;
      console.log('No safeMount found; appending mount at end');
    }
  }

  // Backup and write only if changed
  if (newRaw === raw) {
    console.log('No textual change detected after injection logic — skipping write');
    return false;
  }

  backupFile(serverPath);
  writeFile(serverPath, newRaw);
  console.log('Injected frontend-config mount into backend/server.js');
  return true;
}

// Execute
try {
  const changed = injectFrontendConfigMount();
  if (!changed) {
    console.log('No changes applied by apply-fixes.js');
    process.exit(0);
  }
  // Changes were made; exit 0 (workflow will create PR from workspace changes)
  process.exit(0);
} catch (err) {
  console.error('apply-fixes script failed:', err && err.message);
  process.exit(2);
}
