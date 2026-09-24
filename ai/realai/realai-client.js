"use strict";

const { loadRealAiModule } = require("./load-module");

async function realai(prompt, model) {
  const mod = await loadRealAiModule("realai-client.js");
  return mod.realai(prompt, model);
}

module.exports = {
  realai
};
