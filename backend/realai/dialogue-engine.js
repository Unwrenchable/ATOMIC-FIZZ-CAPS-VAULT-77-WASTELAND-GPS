"use strict";

const { loadRealAiModule } = require("./load-module");

async function generateDialogue(npc = {}, player = {}, context = "") {
  const mod = await loadRealAiModule("dialogue-engine.js");
  return mod.generateDialogue(npc, player, context);
}

module.exports = {
  generateDialogue
};
