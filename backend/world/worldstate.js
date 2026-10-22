"use strict";

const { getJSON } = require("../lib/redis");

const REGION_DEFAULTS = {
  "Mojave Outskirts": {
    factions: {
      primary: ["NCR", "Scavengers"],
      influence: "medium"
    },
    weather: "clear",
    caravans: [{ route: "outskirts-south", supply_level: "medium" }],
    raider_activity: "medium",
    dungeon_resets: {
      cycle: "daily",
      pressure: "stable"
    }
  },
  "Vault 77": {
    factions: {
      primary: ["Vault Dwellers"],
      influence: "high"
    },
    weather: "night_chill",
    caravans: [],
    raider_activity: "low",
    dungeon_resets: {
      cycle: "weekly",
      pressure: "low"
    }
  },
  "Ruined Vegas Strip": {
    factions: {
      primary: ["Raiders", "Merchants"],
      influence: "high"
    },
    weather: "dust_storm",
    caravans: [{ route: "strip-neon-run", supply_level: "high" }],
    raider_activity: "high",
    dungeon_resets: {
      cycle: "daily",
      pressure: "volatile"
    }
  }
};

function normalizeRegion(region) {
  if (typeof region !== "string") {
    return "unknown";
  }

  const trimmed = region.trim();
  return trimmed ? trimmed.slice(0, 64) : "unknown";
}

function regionKey(region) {
  return normalizeRegion(region)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mergeFactions(base, live, stored) {
  return {
    ...safeObject(base),
    ...safeObject(live),
    ...safeObject(stored)
  };
}

function mergeCaravans(base, live, stored) {
  const pick = [stored, live, base].find((value) => Array.isArray(value));
  return Array.isArray(pick) ? pick : [];
}

function normalizeWorldState(region, liveState = {}, storedState = {}) {
  const defaults = REGION_DEFAULTS[normalizeRegion(region)] || {
    factions: {
      primary: ["Wanderers"],
      influence: "medium"
    },
    weather: "clear",
    caravans: [],
    raider_activity: "medium",
    dungeon_resets: {
      cycle: "daily",
      pressure: "stable"
    }
  };

  return {
    factions: mergeFactions(defaults.factions, liveState.factions, storedState.factions),
    weather: String(storedState.weather || liveState.weather || defaults.weather),
    caravans: mergeCaravans(defaults.caravans, liveState.caravans, storedState.caravans),
    raider_activity: String(
      storedState.raider_activity || liveState.raider_activity || defaults.raider_activity
    ),
    dungeon_resets: {
      ...safeObject(defaults.dungeon_resets),
      ...safeObject(liveState.dungeon_resets),
      ...safeObject(storedState.dungeon_resets)
    }
  };
}

async function getWorldState(region, app) {
  const currentWorldState = app && typeof app.get === "function" ? safeObject(app.get("worldstate")) : {};
  const storedWorldState = await getJSON(`worldstate:region:${regionKey(region)}`);

  return normalizeWorldState(region, currentWorldState, safeObject(storedWorldState));
}

module.exports = {
  getWorldState
};
