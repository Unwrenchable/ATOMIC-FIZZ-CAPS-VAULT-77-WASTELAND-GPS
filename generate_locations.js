/**
 * Atomic Fizz Caps – Global Wasteland World Generator
 * ---------------------------------------------------
 * Generates:
 *   - 1000 original POIs
 *   - Real-world coordinates
 *   - Mixed naming style
 *   - Player-focused global density
 *   - Hybrid structure (flat + grouped)
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
  north_america: 0.32,   // heavy density
  europe: 0.22,          // heavy density
  asia: 0.22,            // heavy density
  south_america: 0.10,   // medium
  africa: 0.08,          // medium
  australia: 0.04,       // light
  antarctica: 0.02       // sparse
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
  if (style < 0.25) return `${pick(gritty)}`;
  if (style < 0.50) return `${pick(retro)}`;
  if (style < 0.70) return `${pick(eerie)}`;
  if (style < 0.85) return `${pick(military)}`;
  return `${pick(wild)}`;
}

function slug(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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
// GENERATION
// ---------------------------------------------
const all = [];
const byContinent = {
  north_america: [],
  south_america