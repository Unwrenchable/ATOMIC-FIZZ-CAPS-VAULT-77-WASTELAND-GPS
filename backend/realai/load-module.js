"use strict";

const path = require("path");
const { pathToFileURL } = require("url");

const moduleCache = new Map();

/**
 * Loads a RealAI module from backend/realai/<fileName>
 */
async function loadRealAiModule(fileName) {
  if (!fileName || typeof fileName !== "string") {
    throw new Error("RealAI module filename is required.");
  }

  // Correct path: backend/realai/<fileName>
  const absolutePath = path.join(__dirname, fileName);
  const moduleUrl = pathToFileURL(absolutePath).href;

  if (!moduleCache.has(moduleUrl)) {
    moduleCache.set(moduleUrl, import(moduleUrl));
  }

  return moduleCache.get(moduleUrl);
}

module.exports = {
  loadRealAiModule
};
