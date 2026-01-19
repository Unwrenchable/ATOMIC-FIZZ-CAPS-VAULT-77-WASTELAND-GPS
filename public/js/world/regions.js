// regions.js (v2)
// ------------------------------------------------------------
// Region Behaviors Engine
// Defines: regions, personalities, encounter weights, threat,
// quest chance, anomaly level, faction control hooks.
// ------------------------------------------------------------

(function () {
  "use strict";

  const WorldState = window.overseerWorldState;
  const Factions = window.overseerFaction;

  // ------------------------------------------------------------
  // Region registry
  // ------------------------------------------------------------
  const REGIONS = {
    mojave_core: {
      id: "mojave_core",
      name: "Mojave Core",
      personality: "dusty",
      threat: 0.4,
      anomalyLevel: 0.1,
      quantityMultiplier: 1,
      rarityMultiplier: 1,
      questChance: 0.12,
      encounters: {
        raiders: 0.4,
        wildlife: 0.3,
        scavengers: 0.15,
        travelers: 0.1,
        merchant: 0.05
      }
    },

    fizzco_basin: {
      id: "fizzco_basin",
      name: "Fizzco Basin",
      personality: "unstable",
      threat: 0.6,
      anomalyLevel: 0.4,
      quantityMultiplier: 1.2,
      rarityMultiplier: 1.3,
      questChance: 0.15,
      encounters: {
        mutants: 0.3,
        raiders: 0.2,
        anomaly: 0.25,
        scavengers: 0.1,
        event: 0.15
      }
    },

    circuit_sprawl: {
      id: "circuit_sprawl",
      name: "Circuit Sprawl",
      personality: "mysterious",
      threat: 0.5,
      anomalyLevel: 0.3,
      quantityMultiplier: 1,
      rarityMultiplier: 1.4,
      questChance: 0.14,
      encounters: {
        scavengers: 0.2,
        mutants: 0.2,
        anomaly: 0.2,
        travelers: 0.2,
        event: 0.2
      }
    },

    dustwalker_range: {
      id: "dustwalker_range",
      name: "Dustwalker Range",
      personality: "dusty",
      threat: 0.7,
      anomalyLevel: 0.2,
      quantityMultiplier: 1.3,
      rarityMultiplier: 1,
      questChance: 0.1,
      encounters: {
        raiders: 0.5,
        wildlife: 0.2,
        scavengers: 0.15,
        travelers: 0.1,
        merchant: 0.05
      }
    },

    deepwatch_frontier: {
      id: "deepwatch_frontier",
      name: "Deepwatch Frontier",
      personality: "harsh",
      threat: 0.6,
      anomalyLevel: 0.25,
      quantityMultiplier: 1.1,
      rarityMultiplier: 1.2,
      questChance: 0.16,
      encounters: {
        mutants: 0.3,
        wildlife: 0.25,
        raiders: 0.15,
        travelers: 0.15,
        event: 0.15
      }
    },

    hollow_choir_rift: {
      id: "hollow_choir_rift",
      name: "Hollow Choir Rift",
      personality: "mysterious",
      threat: 0.5,
      anomalyLevel: 0.5,
      quantityMultiplier: 1,
      rarityMultiplier: 1.5,
      questChance: 0.18,
      encounters: {
        anomaly: 0.4,
        mutants: 0.2,
        event: 0.2,
        scavengers: 0.1,
        travelers: 0.1
      }
    },

    brood_nest: {
      id: "brood_nest",
      name: "Brood Nest",
      personality: "unstable",
      threat: 0.8,
      anomalyLevel: 0.6,
      quantityMultiplier: 1.4,
      rarityMultiplier: 1.3,
      questChance: 0.08,
      encounters: {
        mutants: 0.5,
        anomaly: 0.25,
        wildlife: 0.15,
        event: 0.1
      }
    },

    scav_market_belt: {
      id: "scav_market_belt",
      name: "Scav Market Belt",
      personality: "bustling",
      threat: 0.3,
      anomalyLevel: 0.1,
      quantityMultiplier: 1.2,
      rarityMultiplier: 1,
      questChance: 0.2,
      encounters: {
        scavengers: 0.4,
        travelers: 0.25,
        merchant: 0.2,
        raiders: 0.1,
        event: 0.05
      }
    }
  };

  // ------------------------------------------------------------
  // Region helpers
  // ------------------------------------------------------------
  function get(id) {
    return REGIONS[id] || null;
  }

  function list() {
    return Object.values(REGIONS);
  }

  // Enemy selection stub (hooked by encounters.js)
  function pickEnemies(regionId, type) {
    const region = get(regionId);
    const baseLvl = Math.floor((region.threat || 0.5) * 10);

    switch (type) {
      case "raiders":
        return [
          { id: "raider_gunman", lvl: baseLvl },
          { id: "raider_bruiser", lvl: baseLvl + 1 }
        ];
      case "mutants":
        return [
          { id: "mutant_brute", lvl: baseLvl + 1 },
          { id: "mutant_howler", lvl: baseLvl + 2 }
        ];
      case "scavengers":
        return [
          { id: "scav_looter", lvl: baseLvl },
          { id: "scav_guard", lvl: baseLvl + 1 }
        ];
      case "wildlife":
        return [
          { id: "rad_wolf", lvl: baseLvl },
          { id: "rad_stag", lvl: baseLvl + 1 }
        ];
      default:
        return [
          { id: "wastelander", lvl: baseLvl }
        ];
    }
  }

  function pickTraveler(regionId) {
    const region = get(regionId);
    return {
      id: "traveler_generic",
      name: "Weary Traveler",
      lvl: Math.floor((region.threat || 0.5) * 8)
    };
  }

  function pickMerchant(regionId) {
    const factionId = Factions.getControl(regionId);
    return {
      id: "merchant_generic",
      faction: factionId,
      inventorySeed: Date.now()
    };
  }

  function pickEvent(regionId) {
    const region = get(regionId);
    return {
      id: "regional_event",
      description: `Something unusual is happening in ${region.name}.`
    };
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  window.overseerRegions = {
    get,
    list,
    pickEnemies,
    pickTraveler,
    pickMerchant,
    pickEvent
  };
})();
