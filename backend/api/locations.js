const express = require("express");
const fs = require("fs");
const router = express.Router();
const { resolveDataFile } = require("../lib/data-paths");

// ------------------------------------------------------------
// Resolve locations.json across known layout variants.
// Canonical live data lives in frontend/data/ (static root).
// Legacy public/data/ is kept as a fallback for older deploys.
// ------------------------------------------------------------
const LOCATIONS_FILE = resolveDataFile("locations.json");

let allLocations = [];
try {
  // Prefer JSON.parse over require() so deploy refreshes don't need process restart tricks
  // for cached CommonJS modules when the file changes on disk.
  const raw = fs.readFileSync(LOCATIONS_FILE, "utf8");
  const parsed = JSON.parse(raw);
  allLocations = Array.isArray(parsed) ? parsed : [];
  console.log(
    `[api/locations] loaded ${allLocations.length} locations from ${LOCATIONS_FILE}`
  );
} catch (err) {
  console.error(
    "[api/locations] failed to load locations.json at startup:",
    err && err.message
  );
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filterLocations(query = {}) {
  let rows = allLocations;
  const type = typeof query.type === "string" ? query.type.trim().toLowerCase() : "";
  if (type) {
    rows = rows.filter((loc) => String(loc.type || "").toLowerCase() === type);
  }
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = rows.length;
  if (limit > 500) limit = 500;
  return rows.slice(0, limit);
}

// ------------------------------------------------------------
// GET /api/locations
// Supports ?limit=&type= for MCP / clients. Falls back to full file.
// ------------------------------------------------------------
router.get("/", (req, res) => {
  if (!allLocations.length) {
    // Attempt a late reload in case the file appeared after boot
    try {
      const file = resolveDataFile("locations.json");
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      allLocations = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      /* keep empty */
    }
  }

  if (!allLocations.length) {
    return res.status(500).json({ ok: false, error: "Locations not available" });
  }

  const wantsFilter =
    Object.prototype.hasOwnProperty.call(req.query, "limit") ||
    Object.prototype.hasOwnProperty.call(req.query, "type");

  if (wantsFilter) {
    return res.json(filterLocations(req.query));
  }

  // Legacy full dump — prefer in-memory payload to avoid path drift
  return res.json(allLocations);
});

// ------------------------------------------------------------
// GET /api/locations/nearby?lat=X&lng=Y&radiusKm=N
// ------------------------------------------------------------
router.get("/nearby", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  let radiusKm = parseFloat(req.query.radiusKm) || 50;

  if (
    !isFinite(lat) ||
    !isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return res.status(400).json({ ok: false, error: "Invalid lat/lng" });
  }

  if (radiusKm > 200) radiusKm = 200;

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1e-6);

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  const nearby = allLocations.filter((loc) => {
    if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return false;
    if (loc.lat < minLat || loc.lat > maxLat || loc.lng < minLng || loc.lng > maxLng)
      return false;
    return distanceKm(lat, lng, loc.lat, loc.lng) <= radiusKm;
  });

  return res.json(nearby);
});

module.exports = router;
