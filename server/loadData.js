// server/loadData.js
const fs = require('fs');
const path = require('path');

function safeJsonRead(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('JSON load error:', filePath, e);
    return [];
  }
}

function loadAllGameData() {
  const DATA_DIR = path.join(__dirname, '..', 'data');

  const locations = safeJsonRead(path.join(DATA_DIR, 'locations.json'));
  const quests = safeJsonRead(path.join(DATA_DIR, 'quests.json'));
  const mintables = safeJsonRead(path.join(DATA_DIR, 'mintables.json'));
  const events = safeJsonRead(path.join(DATA_DIR, 'events.json'));
  const eventLootTables = safeJsonRead(path.join(DATA_DIR, 'eventLootTables.json'));
  const recipes = safeJsonRead(path.join(DATA_DIR, 'recipes.json')); // NEW

  return {
    locations: locations,
    quests: quests,
    mintables: mintables,
    events: events,
    eventLootTables: eventLootTables,
    recipes: recipes // NEW
  };
}

module.exports = { loadAllGameData };
