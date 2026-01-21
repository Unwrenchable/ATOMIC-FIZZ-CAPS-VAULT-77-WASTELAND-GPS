// backend/lib/locations.js
const fs = require("fs").promises;
const path = require("path");

async function list() {
  const filePath = path.join(__dirname, "..", "public", "data", "locations.json");
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[lib/locations] failed to read static file, returning empty array", err && err.message ? err.message : err);
    return [];
  }
}

module.exports = { list };
