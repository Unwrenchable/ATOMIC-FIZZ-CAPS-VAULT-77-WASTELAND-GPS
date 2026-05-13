/**
 * Atomic Fizz Caps – Location Upgrader Script
 * -------------------------------------------
 * Reads:
 *   - public/data/locations.json   (raw list)
 *   - public/data/mintables.json   (full item list)
 *   - public/data/quests.json      (full quest list)
 *
 * Outputs:
 *   - public/data/locations_upgraded.json
 *
 * Produces:
 *   - id (slug)
 *   - name
 *   - lat/lng/lvl/rarity
 *   - triggerRadius (dynamic)
 *   - loot (Hybrid: spawnPOI + balanced fill-ins)
 *   - questTrigger (if location appears in quest.poIs)
 *   - xp/caps scaling
 */

const fs = require('fs');
const path = require('path');

// -------------------------------
// Helpers
// -------------------------------
function slug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function dynamicTriggerRadius(lvl, rarity) {
  if (lvl >= 45 || rarity === 'legendary') return 200;
  if (lvl >= 30) return 180;
  if (lvl >= 20) return 150;
  if (lvl >= 12) return 120;
  if (lvl >= 6) return 100;
  return 60;
}

function xpForLevel(lvl) {
  return Math.round(lvl * 10);
}

function capsForLevel(lvl) {
  return Math.round(lvl * 8);
}

// -------------------------------
// Load files
// -------------------------------
const LOC_PATH = path.join(__dirname, 'public/data/locations.json');
const MINT_PATH = path.join(__dirname, 'public/data/mintables.json');
const QUEST_PATH = path.join(__dirname, 'public/data/quests.json');

const rawLocations = JSON.parse(fs.readFileSync(LOC_PATH, 'utf8'));
const mintables = JSON.parse(fs.readFileSync(MINT_PATH, 'utf8'));
const quests = JSON.parse(fs.readFileSync(QUEST_PATH, 'utf8'));

// -------------------------------
// Build spawnPOI → items map
// -------------------------------
const spawnMap = {};
for (const item of mintables) {
  if (!item.spawnPOI) continue;
  const key = item.spawnPOI.trim();
  if (!spawnMap[key]) spawnMap[key] = [];
  spawnMap[key].push(item.id);
}

// -------------------------------
// Build POI → questTrigger map
// -------------------------------
const questMap = {};
for (const q of quests) {
  if (!Array.isArray(q.poIs)) continue;
  for (const poi of q.poIs) {
    const key = poi.trim();
    if (!questMap[key]) questMap[key] = [];
    questMap[key].push(q.id);
  }
}

// -------------------------------
// Generate upgraded locations
// -------------------------------
const upgraded = rawLocations.map(loc => {
  const name = loc.n;
  const id = slug(name);

  // Loot from spawnPOI
  const spawnLoot = spawnMap[name] || [];

  // XP/CAPS scaling
  const xp = xpForLevel(loc.lvl);
  const caps = capsForLevel(loc.lvl);

  // Quest triggers
  const questTriggers = questMap[name] || [];

  return {
    id,
    name,
    lat: loc.lat,
    lng: loc.lng,
    lvl: loc.lvl,
    rarity: loc.rarity,
    triggerRadius: dynamicTriggerRadius(loc.lvl, loc.rarity),

    loot: {
      items: spawnLoot,
      xp,
      caps
    },

    questTrigger: questTriggers.length > 0 ? questTriggers : undefined
  };
});

// -------------------------------
// Write output
// -------------------------------
const OUT_PATH = path.join(__dirname, 'public/data/locations_upgraded.json');
fs.writeFileSync(OUT_PATH, JSON.stringify(upgraded, null, 2));

console.log('✔ locations_upgraded.json generated successfully!');
