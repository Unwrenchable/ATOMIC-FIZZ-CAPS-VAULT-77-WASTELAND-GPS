// backend/lib/locations.js
const fs = require("fs").promises;
const { dataCandidates } = require("./data-paths");

async function list() {
  let lastErr = null;
  for (const filePath of dataCandidates("locations.json")) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      lastErr = err;
    }
  }
  console.warn(
    "[lib/locations] failed to read static file, returning empty array",
    lastErr && lastErr.message ? lastErr.message : lastErr
  );
  return [];
}

module.exports = { list };
