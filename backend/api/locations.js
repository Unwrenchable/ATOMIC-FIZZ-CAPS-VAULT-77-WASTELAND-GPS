const express = require("express");
const path = require("path");
const router = express.Router();

// ------------------------------------------------------------
// Startup-time spatial index
// locations.json (~1 MB, 1 000+ records) is loaded once into
// memory so the /nearby endpoint never hits the filesystem on
// a request.  The array is shared across all requests (read-only).
// ------------------------------------------------------------
const LOCATIONS_FILE = path.join(__dirname, "..", "..", "public", "data", "locations.json");

let allLocations = [];
try {
  allLocations = require(LOCATIONS_FILE);
  if (!Array.isArray(allLocations)) allLocations = [];
  console.log(`[api/locations] loaded ${allLocations.length} locations into spatial index`);
} catch (err) {
  console.error("[api/locations] failed to load locations.json at startup:", err && err.message);
}

// Fast haversine distance in kilometres (used only for the radius check;
// bounding-box pre-filter eliminates most records before this runs).
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ------------------------------------------------------------
// GET /api/locations
// Returns the full locations array (legacy behaviour, unchanged).
// ------------------------------------------------------------
router.get("/", (req, res) => {
  const file = path.join(__dirname, "..", "..", "public", "data", "locations.json");
  res.sendFile(file, (err) => {
    if (err) {
      console.error("[api/locations] sendFile error:", err);
      res.status(500).json({ error: "Locations not available" });
    }
  });
});

// ------------------------------------------------------------
// GET /api/locations/nearby?lat=X&lng=Y&radiusKm=N
// Returns only locations within radiusKm of the given coordinate.
// Defaults: radiusKm = 50. Max: 200.
// The bounding-box pre-filter keeps this O(n) but fast in practice
// because most records are eliminated without a trig call.
// ------------------------------------------------------------
router.get("/nearby", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  let radiusKm = parseFloat(req.query.radiusKm) || 50;

  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ ok: false, error: "Invalid lat/lng" });
  }

  // Cap radius to prevent accidentally returning everything
  if (radiusKm > 200) radiusKm = 200;

  // Degrees per km varies by latitude; 1 degree latitude ≈ 111 km.
  // For longitude, multiply by cos(lat) to account for convergence.
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  const nearby = allLocations.filter(loc => {
    // Skip entries with missing or non-numeric coordinates
    if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return false;
    // Fast bounding-box pre-filter (no trig)
    if (loc.lat < minLat || loc.lat > maxLat || loc.lng < minLng || loc.lng > maxLng) return false;
    // Precise haversine check
    return distanceKm(lat, lng, loc.lat, loc.lng) <= radiusKm;
  });

  return res.json(nearby);
});

module.exports = router;
