// worldWeather.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Real-Time Weather + Radiation Storms
// ------------------------------------------------------------
// Responsibilities:
//   - Global weather state
//   - Biome-specific weather patterns
//   - Radiation storms that sweep across regions
//   - Weather effects that modify encounters
//   - Simple update loop for your game tick
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};
  if (!Game.modules.world) Game.modules.world = {};

  // Weather types
  const GLOBAL_WEATHER = [
    "clear",
    "fog",
    "storm",
    "radstorm",
    "dust",
    "rain",
    "gamma_lightning"
  ];

  // Biome-local weather
  const BIOME_WEATHER = {
    desert: ["clear", "clear", "dust", "dust"],
    jungle: ["rain", "rain", "storm"],
    temperate_forest: ["clear", "rain", "storm"],
    tundra: ["clear", "fog", "storm"],
    arctic: ["fog", "fog", "storm"],
    mountain: ["clear", "fog", "storm"],
    crater: ["radstorm", "radstorm", "radstorm"],
    industrial_zone: ["fog", "fog", "rain"],
    urban_ruins: ["clear", "fog", "storm"],
    oceanic: ["clear", "rain", "storm"]
  };

  // Initialize weather state
  function ensureWeather(worldState) {
    if (!worldState.weather) {
      worldState.weather = {
        global: "clear",
        biomeOverrides: {},
        radStormFront: null, // sweeping storm
        lastUpdate: Date.now()
      };
    }
    return worldState.weather;
  }

  // Update global weather (called every tick or every few seconds)
  function updateGlobalWeather(worldState) {
    const weather = ensureWeather(worldState);

    const roll = Math.random();

    // Chance to shift global weather
    if (roll < 0.02) {
      weather.global = GLOBAL_WEATHER[Math.floor(Math.random() * GLOBAL_WEATHER.length)];
    }

    // Radiation storm front logic
    if (!weather.radStormFront && Math.random() < 0.005) {
      // Start a rad storm sweeping across the world
      weather.radStormFront = {
        continent: pickRandomContinent(),
        intensity: 1,
        startedAt: Date.now()
      };
    } else if (weather.radStormFront) {
      // Storm intensifies or dissipates
      if (Math.random() < 0.1) weather.radStormFront.intensity++;
      if (Math.random() < 0.05) weather.radStormFront.intensity--;

      // End storm
      if (weather.radStormFront.intensity <= 0) {
        weather.radStormFront = null;
      }
    }

    weather.lastUpdate = Date.now();
    return weather;
  }

  // Biome weather roll
  function getBiomeWeather(biome) {
    const pool = BIOME_WEATHER[biome] || ["clear"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Determine weather at a specific location
  function getWeatherAtLocation(worldState, location) {
    const weather = ensureWeather(worldState);

    // If a rad storm front is sweeping this continent
    if (
      weather.radStormFront &&
      weather.radStormFront.continent === location.continent
    ) {
      return {
        type: "radstorm",
        intensity: weather.radStormFront.intensity
      };
    }

    // Otherwise combine global + biome
    const biomeWeather = getBiomeWeather(location.biome);

    // If global weather is extreme, override
    if (weather.global === "radstorm") {
      return { type: "radstorm", intensity: 1 };
    }
    if (weather.global === "storm") {
      return { type: "storm" };
    }
    if (weather.global === "gamma_lightning") {
      return { type: "gamma_lightning" };
    }

    return { type: biomeWeather };
  }

  // Helper
  function pickRandomContinent() {
    const continents = [
      "north_america",
      "south_america",
      "europe",
      "africa",
      "asia",
      "australia",
      "antarctica"
    ];
    return continents[Math.floor(Math.random() * continents.length)];
  }

  // Auto-update loop
  function startUpdateLoop(worldState, intervalMs = 10000) {
    setInterval(() => {
      updateGlobalWeather(worldState);
    }, intervalMs);
  }

  // Public API
  const weatherEngine = {
    // Main method that weatherOverlay.js expects
    at(worldState, location) {
      return getWeatherAtLocation(worldState, location);
    },

    // Additional methods for game systems
    update(worldState) {
      return updateGlobalWeather(worldState);
    },

    ensureWeather,
    
    // Start automatic weather updates
    startAutoUpdate(worldState, intervalMs) {
      startUpdateLoop(worldState, intervalMs);
    }
  };

  // Expose as Game.modules.world.weather
  Game.modules.world.weather = weatherEngine;

  // Initialize weather state when worldmap is ready
  window.addEventListener("map-ready", () => {
    try {
      // Get or create world state
      const worldmap = Game.modules.worldmap;
      if (worldmap && worldmap.gs) {
        const worldState = worldmap.gs.worldState || worldmap.gs;
        
        // Initialize weather
        ensureWeather(worldState);
        
        // Start automatic updates every 10 seconds
        startUpdateLoop(worldState, 10000);
        
        console.log("[worldWeather] Weather engine initialized and auto-update started");
      }
    } catch (e) {
      console.warn("[worldWeather] Failed to initialize:", e.message);
    }
  });

  console.log("[worldWeather] Weather engine module loaded");
})();
