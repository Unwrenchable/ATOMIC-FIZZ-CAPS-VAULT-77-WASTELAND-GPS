"use strict";

const { loadRealAiModule } = require("./load-module");

async function generateQuest(npc = {}, player = {}, region = {}) {
  const mod = await loadRealAiModule("quest-generator.js");
  return mod.generateQuest(npc, player, region);
}

module.exports = {
  generateQuest
};
