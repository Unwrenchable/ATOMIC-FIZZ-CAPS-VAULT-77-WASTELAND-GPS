// merge-fallout-pois.js
const fs = require("fs");

// Read in your master file
const poisByRegion = JSON.parse(fs.readFileSync("fallout_pois.json", "utf-8"));

// Flatten all the location arrays
const merged = Object.values(poisByRegion).flat();

// Write to new flat file
fs.writeFileSync("locations.json", JSON.stringify(merged, null, 2));

console.log("Merged all POIs to locations.json. Total POIs:", merged.length);
