/**
 * Atomic Fizz Caps – Global Wasteland World Generator (Enhanced)
 * --------------------------------------------------------------
 * Generates:
 *   - 1000 original POIs
 *   - Real-world coordinates
 *   - Mixed naming style
 *   - Player-focused global density
 *   - Biomes
 *   - Factions
 *   - Types (normal, vault, megastructure, boss)
 *   - Lore snippets
 *
 * Output:
 *   public/data/world_locations.json
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------
// CONFIG
// ---------------------------------------------
const TOTAL_POIS = 1000;

const CONTINENTS = {
  north_america: 0.32,
  europe: 0.22,
  asia: 0.22,
  south_america: 0.10,
  africa: 0.08,
  australia: 0.04,
  antarctica: 0.02
};

// ---------------------------------------------
// NAME GENERATORS
// ---------------------------------------------
const gritty = [
  "Exclusion Zone", "Crater District", "Ashen Quarter", "Collapsed Sector",
  "Irradiated Belt", "Dead Horizon", "Broken Ridge", "Shattered Metro",
  "Blackwater Zone", "Glassfall Ruins"
];

const retro = [
  "FizzCo Relay", "Atomic Works", "Continental Hub", "Neutron Tower",
  "RetroCore Facility", "Sunset Fusion Plant", "Echelon Node",
  "Quantum Depot", "Radion Research Wing", "Helios Array"
];

const eerie = [
  "Whispering Coast", "Hollowing Fields", "Silent Meridian",
  "Blackglass Peninsula", "Cobalt Mire", "The Dimming Expanse",
  "Screaming Savannah", "Pale Wastes", "Nightfall Basin", "Echoing Steppe"
];

const militaryNames = [
  "Defense Vault", "Listening Post", "Strike Bunker", "Command Node",
  "Forward Operating Dome", "Silo Complex", "Deepwatch Station",
  "Recon Outpost", "Perimeter Bastion", "Omega Redoubt"
];

const wild = [
  "Mutant Nest", "Overgrowth Zone", "Toxic Fen", "Radbeast Territory",
  "Feral Expanse", "Blightlands", "Crimson Thicket", "Wastestalker Grounds",
  "Gamma Marsh", "Verdigris Hollow"
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function slug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function generateBaseName() {
  const style = Math.random();
  if (style < 0.25) return `${pick(gritty)}`;
  if (style < 0.50) return `${pick(retro)}`;
  if (style < 0.70) return `${pick(eerie)}`;
  if (style < 0.85) return `${pick(militaryNames)}`;
  return `${pick(wild)}`;
}

// ---------------------------------------------
// COORDINATE GENERATION BY CONTINENT
// ---------------------------------------------
function randomCoordFor(continent) {
  switch (continent) {
    case "north_america":
      return [rand(15, 70), rand(-170, -50)];
    case "south_america":
      return [rand(-55, 15), rand(-80, -35)];
    case "europe":
      return [rand(35, 70), rand(-10, 40)];
    case "africa":
      return [rand(-35, 35), rand(-20, 50)];
    case "asia":
      return [rand(5, 70), rand(40, 150)];
    case "australia":
      return [rand(-45, -10), rand(110, 155)];
    case "antarctica":
      return [rand(-90, -60), rand(-180, 180)];
  }
}

function rand(min, max) {
  return +(Math.random() * (max - min) + min).toFixed(6);
}

// ---------------------------------------------
// LEVEL + RARITY
// ---------------------------------------------
function randomLevel() {
  return Math.floor(Math.random() * 99) + 1;
}

function rarityForLevel(lvl) {
  if (lvl >= 80) return "legendary";
  if (lvl >= 50) return "epic";
  if (lvl >= 25) return "rare";
  return "common";
}

// ---------------------------------------------
// BIOMES
// ---------------------------------------------
function biomeFor(continent, lat, lng) {
  // Rough, stylized mapping that feels right, not realistic-simulation.
  const absLat = Math.abs(lat);

  if (continent === "antarctica") return "arctic";

  if (continent === "north_america") {
    if (absLat > 60) return "tundra";
    if (lat < 30) return "desert";
    if (Math.random() < 0.4) return "urban_ruins";
    return "temperate_forest";
  }

  if (continent === "south_america") {
    if (lat > -10 && Math.random() < 0.6) return "jungle";
    if (lat < -30) return "mountain";
    return Math.random() < 0.3 ? "urban_ruins" : "temperate_forest";
  }

  if (continent === "europe") {
    if (absLat > 60) return "tundra";
    if (Math.random() < 0.5) return "urban_ruins";
    return "temperate_forest";
  }

  if (continent === "africa") {
    if (lat < 0 && Math.random() < 0.4) return "jungle";
    if (Math.random() < 0.6) return "desert";
    return "temperate_forest";
  }

  if (continent === "asia") {
    if (absLat > 60) return "tundra";
    if (lat < 25 && Math.random() < 0.5) return "desert";
    if (lat > 10 && Math.random() < 0.3) return "mountain";
    if (Math.random() < 0.4) return "urban_ruins";
    return "temperate_forest";
  }

  if (continent === "australia") {
    if (Math.random() < 0.7) return "desert";
    return "temperate_forest";
  }

  return "temperate_forest";
}

// ---------------------------------------------
// FACTIONS
// ---------------------------------------------
const FACTIONS = [
  "fizzco_remnants",
  "iron_wastes_militia",
  "radborne_tribes",
  "crater_syndicate",
  "hollow_choir",
  "the_circuit",
  "dustwalkers",
  "deepwatch",
  "free_scavs",
  "feral_broods"
];

function factionFor(biome, rarity, continent) {
  const roll = Math.random();

  if (biome === "urban_ruins" || biome === "industrial_zone") {
    if (roll < 0.25) return "fizzco_remnants";
    if (roll < 0.45) return "crater_syndicate";
    if (roll < 0.65) return "dustwalkers";
    return "free_scavs";
  }

  if (biome === "desert") {
    if (roll < 0.4) return "dustwalkers";
    if (roll < 0.6) return "radborne_tribes";
    return "free_scavs";
  }

  if (biome === "jungle") {
    if (roll < 0.4) return "radborne_tribes";
    if (roll < 0.6) return "feral_broods";
    return "free_scavs";
  }

  if (biome === "tundra" || biome === "arctic") {
    if (roll < 0.5) return "deepwatch";
    if (roll < 0.7) return "iron_wastes_militia";
    return "free_scavs";
  }

  if (biome === "mountain") {
    if (roll < 0.4) return "iron_wastes_militia";
    if (roll < 0.6) return "hollow_choir";
    return "free_scavs";
  }

  if (biome === "crater") {
    if (roll < 0.3) return "crater_syndicate";
    if (roll < 0.5) return "feral_broods";
    if (roll < 0.7) return "the_circuit";
    return "free_scavs";
  }

  // temperate_forest, oceanic, default
  if (roll < 0.2) return "fizzco_remnants";
  if (roll < 0.4) return "iron_wastes_militia";
  if (roll < 0.6) return "radborne_tribes";
  if (roll < 0.8) return "free_scavs";
  return "hollow_choir";
}

// ---------------------------------------------
// SPECIAL TYPES (vault, megastructure, boss)
// ---------------------------------------------
function assignType(lvl, rarity) {
  const roll = Math.random();

  // order of increasing special-ness
  if (roll < 0.90) return "normal";
  if (roll < 0.96) return "vault";
  if (roll < 0.99) return "megastructure";
  return "boss";
}

// ---------------------------------------------
// LORE GENERATION
// ---------------------------------------------
function generateLore(name, continent, biome, faction, type) {
  const basis = name.replace(/_/g, " ");

  const factionFlavor = {
    fizzco_remnants: "FizzCo ran clandestine experiments here long after the first sirens. Some of their tech still hums beneath the dust.",
    iron_wastes_militia: "A disciplined remnant force claims this site, enforcing order with pre-war doctrine and salvaged firepower.",
    radborne_tribes: "Radborne wanderers etched their history into the walls here, their skin glowing faintly in the dark.",
    crater_syndicate: "The Syndicate carved a black market out of this ruin, trading in relics too dangerous for most to touch.",
    hollow_choir: "Followers of the Hollow Choir gather here, listening for whispers in the static of the old world.",
    the_circuit: "Machines once slaved to human will now share this place, quietly rewriting their own directives.",
    dustwalkers: "Raiders on jury-rigged vehicles sweep in and out, leaving scorched tracks and hurried graves.",
    deepwatch: "Deepwatch scouts use this as a last warm light against the endless cold and the things that prowl in it.",
    free_scavs: "Independent scavvers drift through in loose bands, trading rumors for cartridges and stories for scraps.",
    feral_broods: "Feral broods nest here, drawn to something in the soil that twists bone and thought alike."
  }[faction] || "Something ugly clings to this place, older than the bombs but sharpened by them.";

  const biomeFlavor = {
    arctic: "The ice groans underfoot, swallowing older footprints and the wreckage they once marked.",
    tundra: "Wind claws through broken structures, carrying the taste of metal and distant storms.",
    desert: "Endless grit has sanded down steel and stone alike, leaving only the stubborn and the desperate.",
    temperate_forest: "Green has grown over the old scars, but the roots remember where the fire fell.",
    jungle: "The growth here is too fast, too hungry, feeding on more than just water and sun.",
    mountain: "Thin air makes every step a wager; echoes carry further than they should.",
    crater: "Glass and ash crunch underfoot, and the air hums with a low, electric dread.",
    industrial_zone: "Pipes still creak and occasional valves hiss, as if the complex hasn’t realized the world has ended.",
    urban_ruins: "Tower skeletons lean against each other, windows blown out like empty eye sockets.",
    oceanic: "Salt eats what the blast spared, and the tide hides more than it reveals."
  }[biome] || "The land here feels wrong, like it’s still trying to remember what it was before the flash.";

  const typeFlavor = {
    normal: "",
    vault: " Rumors say a sealed vault lies beneath, its experiment long since slipped the controls.",
    megastructure: " The structure dominates the horizon, a monument to pre-war ambition and post-war regret.",
    boss: " Few walk away from this place; those who do return with tales that don’t quite make sense."
  }[type] || "";

  return `${basis}. ${factionFlavor} ${biomeFlavor}${typeFlavor}`.trim();
}

// ---------------------------------------------
// GENERATION
// ---------------------------------------------
const all = [];
const byContinent = {
  north_america: [],
  south_america: [],
  europe: [],
  africa: [],
  asia: [],
  australia: [],
  antarctica: []
};

for (const [continent, weight] of Object.entries(CONTINENTS)) {
  const count = Math.floor(TOTAL_POIS * weight);

  for (let i = 0; i < count; i++) {
    const baseName = generateBaseName();
    const [lat, lng] = randomCoordFor(continent);
    const biome = biomeFor(continent, lat, lng);

    const lvl = randomLevel();
    const rarity = rarityForLevel(lvl);
    const type = assignType(lvl, rarity);
    const faction = factionFor(biome, rarity, continent);

    const name = baseName;
    const id = slug(name + "_" + continent + "_" + i);

    const lore = generateLore(name, continent, biome, faction, type);

    const poi = {
      id,
      name,
      lat,
      lng,
      lvl,
      rarity,
      biome,
      faction,
      type,
      lore
    };

    all.push(poi);
    byContinent[continent].push(poi);
  }
}

// ensure exactly TOTAL_POIS (due to flooring)
if (all.length > TOTAL_POIS) {
  all.length = TOTAL_POIS;
}
Object.keys(byContinent).forEach(cont => {
  if (byContinent[cont].length > 0) {
    byContinent[cont] = byContinent[cont].slice(0, byContinent[cont].length);
  }
});

// ---------------------------------------------
// OUTPUT
// ---------------------------------------------
const output = {
  all,
  by_continent: byContinent
};

const OUT_PATH = path.join(__dirname, "public/data/world_locations.json");
fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

console.log(`✔ Generated ${all.length} POIs with biomes, factions, types, and lore into world_locations.json`);
