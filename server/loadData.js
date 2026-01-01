const fs = require("fs");
const path = require("path");

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error("JSON load error:", filePath, e);
    return [];
  }
}

function loadAllGameData() {
  const dataDir = path.join(__dirname, "../public/data");

  const mintables = loadJson(path.join(dataDir, "mintables.json"));
  const events = loadJson(path.join(dataDir, "events.json"));
  const eventLootTables = loadJson(path.join(dataDir, "eventLootTables.json"));
  const quests = loadJson(path.join(dataDir, "quests.json"));
  const locations = loadJson(path.join(dataDir, "locations.json"));

  return {
    mintables,
    events,
    eventLootTables,
    quests,
    locations,

    mintablesById: new Map(mintables.map(i => [i.id, i])),
    eventsById: new Map(events.map(e => [e.id, e])),
    lootTablesById: new Map(eventLootTables.map(t => [t.id, t])),
    questsById: new Map(quests.map(q => [q.id, q])),
    locationsById: new Map(locations.map(l => [l.id, l])),
  };
}

module.exports = { loadAllGameData };
