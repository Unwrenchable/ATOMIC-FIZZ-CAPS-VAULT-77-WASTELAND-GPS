// merchants.js
// ------------------------------------------------------------
// Traveling Merchants + Base Merchant Generator
// ------------------------------------------------------------

const { getReputation } = require("./reputation");

function pickMerchantFor(faction, biome) {
  return {
    id: `merchant_${faction}_${biome}_${Date.now()}`,
    faction,
    biome
  };
}

function merchantGreeting(faction) {
  const lines = {
    fizzco_remnants: "FizzCo welcomes your continued patronage, survivor.",
    iron_wastes_militia: "Keep your weapon clean and your credits ready.",
    radborne_tribes: "The glow guides us both today.",
    crater_syndicate: "Looking to trade? No questions asked.",
    hollow_choir: "The Choir whispers of bargains.",
    the_circuit: "Unit ready for transactional exchange.",
    dustwalkers: "Got scrap? Got caps? Let’s deal.",
    deepwatch: "Cold winds bite. My prices don’t.",
    free_scavs: "Scavver to scavver, let’s trade fair.",
    feral_broods: "Hiss… trade… hiss…"
  };
  return lines[faction] || "Let's trade while the world still spins.";
}

function rollMerchantEncounter(worldState, location, weather) {
  const rep = getReputation(worldState, location.faction);
  const biome = location.biome;
  const faction = location.faction;

  let chance = 0.05;

  if (rep >= 50) chance += 0.15;
  if (rep >= 100) chance += 0.25;
  if (rep <= -50) chance -= 0.04;

  if (biome === "urban_ruins" || biome === "industrial_zone") chance += 0.1;
  if (biome === "desert") chance -= 0.02;
  if (biome === "arctic" || biome === "tundra") chance -= 0.03;

  if (weather?.type === "storm") chance -= 0.1;
  if (weather?.type === "rad_storm") chance = 0;

  if (Math.random() < chance) {
    return {
      type: "merchant",
      merchant: {
        id: `merchant_${faction}_${biome}_${Date.now()}`,
        faction,
        biome,
        inventorySeed: `${faction}_${biome}_${Date.now()}`,
        greeting: merchantGreeting(faction)
      }
    };
  }

  return null;
}

module.exports = {
  pickMerchantFor,
  rollMerchantEncounter,
  merchantGreeting
};
