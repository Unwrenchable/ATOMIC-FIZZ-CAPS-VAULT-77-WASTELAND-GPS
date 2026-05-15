"use strict";

const { loadRealAiModule } = require("./load-module");

async function generateNPC(seed = {}) {
  const mod = await loadRealAiModule("generate-npc.js");
  return mod.generateNPC(seed);
}

module.exports = {
  generateNPC
};
