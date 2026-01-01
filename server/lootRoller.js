// server/lootRoller.js

function rollRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedChoice(entries) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (const e of entries) {
    acc += e.weight;
    if (r <= acc) return e;
  }
  return entries[entries.length - 1];
}

export function rollEventLoot(gameData, lootTableId) {
  const lootTable = gameData.lootTablesById.get(lootTableId);
  if (!lootTable) return [];

  const rolls = rollRandomInt(lootTable.rollsMin, lootTable.rollsMax);
  const results = [];

  for (let i = 0; i < rolls; i++) {
    const entry = weightedChoice(lootTable.possibleItems);
    const item = gameData.mintablesById.get(entry.itemId);
    if (item) results.push(item);
  }

  return results;
}

export { rollRandomInt };
