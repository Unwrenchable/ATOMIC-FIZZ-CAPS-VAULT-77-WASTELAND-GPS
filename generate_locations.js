/**
 * Atomic Fizz Caps – Global Wasteland World Generator
 * ---------------------------------------------------
 * Generates:
 *   - 1000 original POIs
 *   - Real-world coordinates (WGS84)
 *   - Mixed naming style
 *   - Player-focused global density
 *   - Hybrid structure (flat + grouped)
 *
 * Output:
 *   public/data/world_locations.json
 *
 * IMPORTANT:
 *   - These are NOT canon Fallout locations.
 *   - All entries are tagged source: "generated_world"
 *   - Keep your canon Fallout POIs in a separate file.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------
// CONFIG
// ---------------------------------------------
const TOTAL_POIS = 1000;

const CONTINENTS = {
  north_america: 0.32, // heavy density
  europe: 0.22,        // heavy density
  asia: 0.22,          // heavy density
  south_america: 0.10, // medium
  africa: 0.08,        // medium
  australia: 0.04,     // light
  antarctica: 0.02     // sparse
};

const BIOMES = [
  "desert",
  "tundra",
  "temperate_forest",
  "urban_ruins",
  "marsh",
  "mountain",
  "coastal",
  "wasteland"
];

const FACTIONS = [
  "deepwatch",
  "dustwalkers",
  "free_scavs",
  "fizzco_remnants",
  "radborne_tribes",
  "vaultborn_nomads"
];

const TYPES = [
  "normal",
  "vault",
  "facility",
  "ruins",
  "stronghold"
];

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

const military = [
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

function generateName() {
  const style = Math.random();
  if (style < 0.25) return pick(gritty);
  if (style < 0.50) return pick(retro);
  if (style < 0.70) return pick(eerie);
  if (style < 0.85) return pick(military);
  return pick(wild);
}

function slug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ---------------------------------------------
// COORDINATE GENERATION BY CONTINENT
// (All WGS84, but ranges biased to mostly land)
// ---------------------------------------------
function rand(min, max) {
  return +(Math.random() * (max - min) + min).toFixed(6);
}

function randomCoordFor(continent) {
  switch (continent) {
    case "north_america":
      // USA + Canada-ish, avoid deep ocean
      return [rand(15, 70), rand(-165, -50)];
    case "south_america":
      return [rand(-55, 15), rand(-80, -35)];
    case "europe":
      return [rand(35, 70), rand(-10, 40)];
    case "africa":
      return [rand(-35, 35), rand(-20, 50)];
    case "asia":
      return [rand(5, 70), rand(40, 140)];
    case "australia":
      return [rand(-45, -10), rand(110, 155)];
    case "antarctica":
      return [rand(-85, -60), rand(-180, 180)];
    default:
      return [0, 0];
  }
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

function triggerRadiusForRarity(rarity) {
  switch (rarity) {
    case "legendary": return 220;
    case "epic":      return 190;
    case "rare":      return 150;
    case "common":
    default:          return 90;
  }
}

// ---------------------------------------------
// LORE GENERATOR
// ---------------------------------------------
function generateLore(name, biome, faction) {
  const base = `${name}.`;

  const biomeFlavor = {
    desert: "Endless grit has sanded down steel and bone alike. Only the stubborn still cross this place willingly.",
    tundra: "Wind claws through broken structures, carrying the taste of metal and distant storms.",
    temperate_forest: "Green has grown over the old scars, but the roots remember where the fire fell.",
    urban_ruins: "Tower skeletons lean against each other, windows blown out like empty eye sockets.",
    marsh: "Every stagnant pool hides something that adapted a little too well to the end of the world.",
    mountain: "The high air is thin and sharp, and the view stretches across a world that never quite recovered.",
    coastal: "Rusting hulls and scavenged piers mark where the sea swallowed whole cities and spat out wreckage.",
    wasteland: "The horizon is a dull, broken line where sky and dust bleed into each other."
  };

  const factionFlavor = {
    deepwatch: "Deepwatch scouts mark these routes in quiet ink, keeping the last, fragile lights connected.",
    dustwalkers: "Dustwalkers roll through in jury-rigged columns, trading fuel, rumors, and live ammunition.",
    free_scavs: "Independent scavvers drift in, their routes crossing like scars that never quite heal.",
    fizzco_remnants: "FizzCo tech still hums beneath the ruin, long after the last official shutdown order.",
    radborne_tribes: "Radborne wanderers etched their history onto any surface that survived the blast.",
    vaultborn_nomads: "Vaultborn caravans pass through, their gear pristine, their eyes older than the sky."
  };

  const biomeText = biomeFlavor[biome] || "The land here never really decided what it wanted to become after the bombs.";
  const factionText = factionFlavor[faction] || "Nobody holds this place for long, but everyone leaves a mark.";

  return `${base} ${biomeText} ${factionText}`;
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

// Precompute how many POIs per continent
const continentCounts = {};
let allocated = 0;
const continentKeys = Object.keys(CONTINENTS);

continentKeys.forEach((key, idx) => {
  if (idx === continentKeys.length - 1) {
    // Last continent gets the remainder to ensure TOTAL_POIS
    continentCounts[key] = TOTAL_POIS - allocated;
  } else {
    const count = Math.round(TOTAL_POIS * CONTINENTS[key]);
    continentCounts[key] = count;
    allocated += count;
  }
});

// Generate per continent
for (const continent of continentKeys) {
  const count = continentCounts[continent];

  for (let i = 0; i < count; i++) {
    const [lat, lng] = randomCoordFor(continent);
    const name = generateName();
    const id = `${slug(name)}_${continent}_${i}`;

    const lvl = randomLevel();
    const rarity = rarityForLevel(lvl);
    const biome = pick(BIOMES);
    const faction = pick(FACTIONS);
    const type = pick(TYPES);
    const triggerRadius = triggerRadiusForRarity(rarity);

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
      continent,
      triggerRadius,
      source: "generated_world",
      lore: generateLore(name, biome, faction),
      loot: {
        items: [],     // you can post-process and fill this later
        xp: lvl * 10,  // simple baseline
        caps: lvl * 8  // simple baseline
      }
    };

    all.push(poi);
    byContinent[continent].push(poi);
  }
}

// ---------------------------------------------
// OUTPUT
// ---------------------------------------------
const outDir = path.join(__dirname, "public", "data");
const outPath = path.join(outDir, "world_locations.json");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outPath, JSON.stringify(all, null, 2), "utf8");

console.log(`[WorldGen] Generated ${all.length} POIs total.`);
for (const c of continentKeys) {
  console.log(`  - ${c}: ${byContinent[c].length}`);
}
console.log(`[WorldGen] Output written to: ${outPath}`);
