"use strict";

const { loadRealAiModule } = require("./load-module");

async function generateDungeon(seed = {}) {
  const mod = await loadRealAiModule("dungeon-generator.js");
  return mod.generateDungeon(seed);
}

module.exports = {
  generateDungeon
};
