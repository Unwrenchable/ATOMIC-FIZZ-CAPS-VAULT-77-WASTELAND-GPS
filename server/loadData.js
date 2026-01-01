import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "public/data");

function loadJson(fileName) {
  const fullPath = path.join(DATA_DIR, fileName);
  try {
    const raw = fs.readFileSync(fullPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Failed to load ${fileName}:`, err);
    return null;
  }
}

export function loadAllGameData() {
  const mintables = loadJson("mintables.json") || [];
  const events = loadJson("events.json") || [];
  const eventLootTables = loadJson("eventLootTables.json") || [];
  const quests = loadJson("quests.json") || [];
  const locations = loadJson("locations.json") || [];

  // Fast lookup maps
  const mintablesById = new Map(mintables.map(i => [i.id, i]));
  const eventsById = new Map(events.map(e => [e.id, e]));
  const lootTablesById = new Map(eventLootTables.map(t => [t.id, t]));
  const questsById = new Map(quests.map(q => [q.id, q]));
  const locationsById = new Map(locations.map(l => [l.id, l]));

  return {
    mintables,
    events,
    eventLootTables,
    quests,
    locations,

    mintablesById,
    eventsById,
    lootTablesById,
    questsById,
    locationsById
  };
}
