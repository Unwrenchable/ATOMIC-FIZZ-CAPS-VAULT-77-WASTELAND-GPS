"use strict";

const path = require("path");
const { pathToFileURL } = require("url");

const moduleCache = new Map();

async function loadRealAiModule(fileName) {
  if (!fileName || typeof fileName !== "string") {
    throw new Error("RealAI module filename is required.");
  }

  const absolutePath = path.join(__dirname, "..", "..", "scripts", "realai", fileName);
  const moduleUrl = pathToFileURL(absolutePath).href;

  if (!moduleCache.has(moduleUrl)) {
    moduleCache.set(moduleUrl, import(moduleUrl));
  }

  return moduleCache.get(moduleUrl);
}

module.exports = {
  loadRealAiModule
};
