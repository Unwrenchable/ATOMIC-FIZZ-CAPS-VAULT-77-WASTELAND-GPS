const fs = require('fs');
const poi = JSON.parse(fs.readFileSync('public/data/poi.json', 'utf8'));

// Check some key FNV locations
const keyLocations = [
  'lucky_38_fnv', 'gomorrah_fnv', 'ultra_luxe_fnv', 'the_tops_fnv', 'vault_21_hotel_fnv'
];

console.log('Key Fallout: New Vegas Strip Locations:');
keyLocations.forEach(id => {
  let found = null;
  Object.keys(poi).forEach(region => {
    if (Array.isArray(poi[region]) && !found) {
      found = poi[region].find(loc => loc.id === id);
    }
  });
  if (found) {
    console.log(`${found.name}: ${found.lat}, ${found.lng}`);
  } else {
    console.log(`${id}: NOT FOUND`);
  }
});

// Check pool hall distribution
console.log('\nPool Hall Distribution Analysis:');
const poolHalls = poi.vegas_pool_halls || [];
const regions = {};

poolHalls.forEach(hall => {
  const region = hall.region || 'unknown';
  if (!regions[region]) regions[region] = [];
  regions[region].push(hall);
});

Object.keys(regions).forEach(region => {
  console.log(`${region}: ${regions[region].length} pool halls`);
});