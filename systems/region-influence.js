const REGIONS = {
  "Mojave Outskirts": {
    palette: "dust brown",
    factions: ["NCR", "Scavengers"],
    vibe: "dry, tense"
  },
  "Vault 77": {
    palette: "sterile blue",
    factions: ["Vault Dwellers"],
    vibe: "claustrophobic"
  },
  "Ruined Vegas Strip": {
    palette: "neon ruins",
    factions: ["Raiders", "Merchants"],
    vibe: "chaotic"
  }
};

export function buildRegionInfluence(regionName) {
  return REGIONS[regionName] || {
    palette: "dust brown",
    factions: ["Wanderers"],
    vibe: "neutral"
  };
}

export function regionDialogueFlavor(regionName) {
  const flavors = {
    "Mojave Outskirts": "dust storms, NCR patrols, thirsty travelers",
    "Vault 77": "vault politics, recycled air, claustrophobic tension",
    "Ruined Vegas Strip": "raiders, neon ruins, broken dreams"
  };

  return flavors[regionName] || "wasteland survival";
}

export function regionQuestFlavor(regionName) {
  const flavors = {
    "Mojave Outskirts": "dust storms, raiders, NCR patrols, thirsty travelers",
    "Vault 77": "vault politics, malfunctioning systems, missing dwellers",
    "Ruined Vegas Strip": "gang fights, neon ruins, broken tech"
  };

  return flavors[regionName] || "general wasteland trouble";
}
