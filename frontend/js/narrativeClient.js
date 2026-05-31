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
  "REPCONN HQ": "REPCONN HQ",
  "REPCONN": "REPCONN Test Site",
  "Ultra-Luxe": "Ultra-Luxe Casino",
  "Gomorrah": "Gomorrah Casino",
  "The Tops": "The Tops",
  "Freeside": "Freeside",
  "Hidden Valley": "Hidden Valley Bunker",
  "Nipton": "Nipton",
  "Searchlight": "Searchlight Church",
  "Jean Sky Diving": "Jean Sky Diving",
  "Sloan": "Sloan",
  "Westside": "Westside Co-op",
  "Atomic Wrangler": "Atomic Wrangler",
  "Camp McCarran": "McCarran Airport",
  "Sunset HQ": "Lucky 38",
  "The Thorn": "The Thorn",
  "Crimson Caravan": "Crimson Caravan",
  "Boulder City": "Boulder City Hotel",
  "Goodsprings": "Goodsprings Saloon",
  "Primm": "Primm Rollercoaster",
  "Novac": "Novac Motel",
  "Mojave Outpost": "Mojave Outpost",
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
  "Vault 3": "Vault 3",
  "Vault 19": "Vault 19",
  "Vault 22": "Vault 22",
  "Vault 21": "Vault 21",
  "Vault 34": "Vault 34",
  "Vault 87": "Vault 87",
  "Vault 101": "Vault 101",
  "Vault 111": "Vault 111",
  "Vault 13": "Vault 13",
  "Vault 95": "Vault 95",
  "Vault 81": "Vault 81",
  "Vault 76": "Vault 76",
  "Goodsprings Cemetery": "Goodsprings Saloon",
  "King's School": "King's School of Impersonation",
  "King's School of Impersonation": "King's School of Impersonation",
  "New Vegas Medical Clinic": "Freeside Market",
  "Cassidy Caravan wreckage": "Nipton Road Pit Stop",
  "Crimson": "Crimson Caravan",
  "Sunset Sarsaparilla HQ": "Lucky 38",
  "Various locations": "New Vegas Strip",
  "Various burrows": "Red Rock Canyon",
  "Red Rock Drug Lab": "Red Rock Canyon",
  "Hidden Valley Bunker": "Hidden Valley Bunker",
  "Fort": "Fortification Hill",
  "Nelson crucifixion": "Nelson",
  "Lake Mead": "Lake Mead Cave",
  "Lake Mead Cave": "Lake Mead Cave",
  "Crashed B-29": "Crashed B-29",
  "Big MT": "Big MT",
  "Sierra Madre": "Sierra Madre",
  "Zion": "Zion Canyon",
  "The Divide": "The Divide",
  "Point Lookout": "Point Lookout Lighthouse",
  "The Pitt": "The Pitt",
  "Paradise Falls": "Paradise Falls",
  "Big Town": "Big Town",
  "GNR": "GNR Plaza",
  "Jefferson Memorial": "Jefferson Memorial",
  "Citadel": "The Citadel",
  "Rivet City": "Rivet City",
  "Tenpenny": "Tenpenny Tower",
  "Little Lamplight": "Little Lamplight",
  "Arefu": "Arefu",
  "Canterbury Commons": "Canterbury Commons",
  "Diamond City": "Diamond City",
  "Goodneighbor": "Goodneighbor",
  "Bunker Hill": "Bunker Hill",
  "The Castle": "The Castle",
  "Fort Hagen": "Fort Hagen",
  "Concord": "Concord",
  "Lexington": "Lexington",
  "Quincy": "Quincy",
  "Salem": "Salem",
  "Prydwen": "Prydwen",
  "Nuka-World": "Nuka-World",
  "Far Harbor": "Far Harbor",
  "Shady Sands": "Shady Sands",
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
  "Mothership Zeta": "Mothership Zeta"
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
