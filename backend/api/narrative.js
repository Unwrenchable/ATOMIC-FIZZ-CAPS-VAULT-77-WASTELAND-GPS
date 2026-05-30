// backend/api/narrative.js — Narrative content API
// Serves static JSON narrative files from public/data/narrative/ so the
// NarrativeAPI client (public/js/narrativeClient.js) has working endpoints.
//
// Routes:
//   GET /api/narrative/main           → narrative_main.json
//   GET /api/narrative/dialog         → list of all dialog NPC keys
//   GET /api/narrative/dialog/:key    → single dialog file (e.g. dialog_jax)
//   GET /api/narrative/terminals      → terminals.json
//   GET /api/narrative/encounters     → encounters.json
//   GET /api/narrative/collectibles   → collectibles.json
const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate-limit the per-key dialog lookup (filesystem access) to prevent abuse.
const dialogLimiter = rateLimit({ windowMs: 60_000, max: 60 });

const NARRATIVE_DIR = path.join(__dirname, '..', '..', 'public', 'data', 'narrative');

// Safely parse a JSON file; returns null on any error.
function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`[narrative] Failed to load ${filePath}:`, e.message);
    return null;
  }
}

// Pre-load static files at startup for fast serving.
const DATA_DIR = path.join(__dirname, '..', '..', 'public', 'data');
const mainStory = loadJson(path.join(NARRATIVE_DIR, 'narrative_main.json'));
const terminals = loadJson(path.join(NARRATIVE_DIR, 'terminals.json'));
const encounters = loadJson(path.join(NARRATIVE_DIR, 'encounters.json'));
// collectibles.json lives in public/data/ (not the narrative subdirectory)
const collectibles = loadJson(path.join(DATA_DIR, 'collectibles.json'));

// Build an index of available dialog keys at startup.
let dialogKeys = [];
try {
  dialogKeys = fs
    .readdirSync(NARRATIVE_DIR)
    .filter(f => f.startsWith('dialog_') && f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
} catch (e) {
  console.error('[narrative] Could not read narrative directory:', e.message);
}

// ── GET /api/narrative/main ──────────────────────────────────────────────────
router.get('/main', (req, res) => {
  if (!mainStory) {
    return res.status(503).json({ error: 'Narrative data offline. Try again, Vault Dweller.' });
  }
  res.json(mainStory);
});

// ── GET /api/narrative/dialog ────────────────────────────────────────────────
router.get('/dialog', (req, res) => {
  res.json(dialogKeys);
});

// ── GET /api/narrative/dialog/:key ──────────────────────────────────────────
// :key must be a safe alphanumeric/underscore string to prevent path traversal.
router.get('/dialog/:key', dialogLimiter, (req, res) => {
  const { key } = req.params;

  // Validate: only allow alphanumeric and underscores; reject any traversal attempt.
  if (!/^[a-zA-Z0-9_]+$/.test(key)) {
    return res.status(400).json({ error: 'Invalid dialog key.' });
  }

  // Support bare NPC id (e.g. "jax") or full file name (e.g. "dialog_jax")
  const fileName = key.startsWith('dialog_') ? `${key}.json` : `dialog_${key}.json`;
  const filePath = path.resolve(NARRATIVE_DIR, fileName);

  // Confirm the resolved path is still inside the narrative directory.
  // path.resolve() normalises separators, preventing OS-specific bypass vectors.
  if (!filePath.startsWith(path.resolve(NARRATIVE_DIR) + path.sep)) {
    return res.status(400).json({ error: 'Access denied.' });
  }

  // loadJson returns null on ENOENT and all other errors; no separate existsSync needed.
  const dialog = loadJson(filePath);
  if (!dialog) {
    return res.status(404).json({ error: `No signal found for NPC "${key}". Static in the airwaves.` });
  }

  res.json(dialog);
});

// ── GET /api/narrative/terminals ────────────────────────────────────────────
router.get('/terminals', (req, res) => {
  if (!terminals) {
    return res.status(503).json({ error: 'Terminal data offline.' });
  }
  res.json(terminals);
});

// ── GET /api/narrative/encounters ───────────────────────────────────────────
router.get('/encounters', (req, res) => {
  if (!encounters) {
    return res.status(503).json({ error: 'Encounter data offline.' });
  }
  res.json(encounters);
});

// ── GET /api/narrative/collectibles ─────────────────────────────────────────
router.get('/collectibles', (req, res) => {
  if (!collectibles) {
    return res.status(503).json({ error: 'Collectibles data offline.' });
  }
  res.json(collectibles);
});

module.exports = router;
