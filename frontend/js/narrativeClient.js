// ===============================
// Narrative API Client
// ===============================
const NarrativeAPI = (() => {
  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Narrative API error: ${res.status}`);
    return res.json();
  }

  return {
    getMain: () => getJson('/api/narrative/main'),
    getDialogList: () => getJson('/api/narrative/dialog'),
    getDialog: (npcKey) => getJson(`/api/narrative/dialog/${npcKey}`),
    getTerminals: () => getJson('/api/narrative/terminals'),
    getEncounters: () => getJson('/api/narrative/encounters'),
    getCollectibles: () => getJson('/api/narrative/collectibles')
  };
})();


// ===============================
// POI Normalization Map
// ===============================
const POI_NORMALIZATION = {
  "HELIOS One": "Helios One",
  "SkyRocket Co. HQ": "SkyRocket Co. HQ",
  "SkyRocket Co.": "SkyRocket Co. Test Site",
  "Velvet Luxe": "Velvet Luxe Casino",
  "Sodom Lounge": "Sodom Lounge Casino",
  "The Tops": "The Tops",
  "Outskirt Row": "Outskirt Row",
  "Hidden Valley": "Hidden Valley Bunker",
  "Nipton": "Nipton",
  "Searchlight": "Searchlight Church",
  "Jean Sky Diving": "Jean Sky Diving",
  "Sloan": "Sloan",
  "Westside": "Westside Co-op",
  "Rad Rustler": "Rad Rustler",
  "Camp Halloran": "Halloran Airport",
  "Sunset HQ": "The Spire",
  "The Thorn": "The Thorn",
  "Scarlet Caravan": "Scarlet Caravan",
  "Boulder City": "Boulder City Hotel",
  "Dustwell": "Dustwell Saloon",
  "Primm": "Primm Rollercoaster",
  "Saurville": "Saurville Motel",
  "Cinder Basin Outpost": "Cinder Basin Outpost",
  "Nelson": "Nelson",
  "Fortification Hill": "Fortification Hill",
  "Old Mormon Fort": "Old Mormon Fort",
  "Aerotech": "Aerotech Office Park",
  "Westside Co-op": "Westside Co-op",
  "Camp Forlorn Hope": "Camp Forlorn Hope",
  "Bitter Springs": "Bitter Springs",
  "Cottonwood Cove": "Cottonwood Cove",
  "Camp Searchlight": "Camp Searchlight",
  "Ranger Station Foxtrot": "Ranger Station Foxtrot",
  "Camp Golf": "Camp Golf",
  "Vault 9": "Vault 9",
  "Vault 29": "Vault 29",
  "Vault 82": "Vault 82",
  "Vault 12": "Vault 12",
  "Vault 43": "Vault 43",
  "Vault 78": "Vault 78",
  "Vault 77": "Vault 77",
  "Vault 47": "Vault 47",
  "Vault 31": "Vault 31",
  "Vault 59": "Vault 59",
  "Vault 18-B": "Vault 18-B",
  "Vault 67": "Vault 67",
  "Dustwell Cemetery": "Dustwell Saloon",
  "King's School": "King's School of Impersonation",
  "King's School of Impersonation": "King's School of Impersonation",
  "Neon Reach Medical Clinic": "Outskirt Row Market",
  "Cassidy Caravan wreckage": "Nipton Road Pit Stop",
  "Crimson": "Scarlet Caravan",
  "Dustpop HQ": "The Spire",
  "Various locations": "Neon Reach Strip",
  "Various burrows": "Red Rock Canyon",
  "Red Rock Drug Lab": "Red Rock Canyon",
  "Hidden Valley Bunker": "Hidden Valley Bunker",
  "Fort": "Fortification Hill",
  "Nelson crucifixion": "Nelson",
  "Lake Mead": "Lake Mead Cave",
  "Lake Mead Cave": "Lake Mead Cave",
  "Crashed B-29": "Crashed B-29",
  "Big Crater": "Big Crater",
  "Sierra Madre": "Sierra Madre",
  "Zion": "Zion Canyon",
  "The Divide": "The Divide",
  "Point Lookout": "Point Lookout Lighthouse",
  "The Scrapforge": "The Scrapforge",
  "Paradise Falls": "Paradise Falls",
  "Big Town": "Big Town",
  "GNR": "GNR Plaza",
  "Jefferson Memorial": "Jefferson Memorial",
  "Citadel": "The Citadel",
  "Bolt Harbor": "Bolt Harbor",
  "Tenpenny": "Tenpenny Tower",
  "Little Lamplight": "Little Lamplight",
  "Arefu": "Arefu",
  "Canterbury Commons": "Canterbury Commons",
  "Stadium Hollow": "Stadium Hollow",
  "Kindly Row": "Kindly Row",
  "Bunker Hill": "Bunker Hill",
  "The Castle": "The Castle",
  "Fort Hagen": "Fort Hagen",
  "Concord": "Concord",
  "Lexington": "Lexington",
  "Quincy": "Quincy",
  "Salem": "Salem",
  "Prydwen": "Prydwen",
  "Fizz Fair": "Fizz Fair",
  "Fogmoor": "Fogmoor",
  "Dustwater": "Dustwater",
  "The Hub": "The Hub",
  "Gecko": "Gecko Reactor",
  "New Reno": "New Reno",
  "Glow": "Glow",
  "Mariposa": "Mariposa Base",
  "Arroyo": "Arroyo",
  "Klamath": "Klamath",
  "The Den": "The Den",
  "Broken Hills": "Broken Hills",
  "Navarro": "Navarro",
  "San Francisco": "San Francisco",
  "Modoc": "Modoc",
  "Redding": "Redding",
  "Sierra Army Depot": "Sierra Army Depot",
  "Flatwoods": "Flatwoods",
  "Morgantown": "Morgantown",
  "Charleston": "Charleston",
  "The Whitespring": "The Whitespring",
  "Watoga": "Watoga",
  "Harper's Ferry": "Harper's Ferry",
  "Camden Park": "Camden Park",
  "Grafton": "Grafton",
  "Sutton": "Sutton",
  "Lewisburg": "Lewisburg",
  "Starship Omega": "Starship Omega"
};


// ===============================
// POI Normalization Helper
// ===============================
function normalizePOI(name) {
  return POI_NORMALIZATION[name] || name;
}


// ===============================
// Export for global use
// ===============================
window.NarrativeAPI = NarrativeAPI;
window.normalizePOI = normalizePOI;
window.POI_NORMALIZATION = POI_NORMALIZATION;
