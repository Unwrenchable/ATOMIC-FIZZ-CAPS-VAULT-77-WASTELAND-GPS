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

// Weather types
const GLOBAL_WEATHER = [
  "clear",
  "cloudy",
  "storm",
  "rad_storm",
  "heatwave",
  "cold_snap"
];

// Biome-local weather
const BIOME_WEATHER = {
  desert: ["clear", "clear", "heatwave", "sandstorm"],
  jungle: ["humid", "rain", "storm"],
  temperate_forest: ["clear", "rain", "storm"],
  tundra: ["clear", "snow", "blizzard"],
  arctic: ["snow", "blizzard", "whiteout"],
  mountain: ["clear", "fog", "storm"],
  crater: ["clear", "rad_storm", "rad_storm"],
  industrial_zone: ["smog", "acid_rain", "storm"],
  urban_ruins: ["clear", "smog", "storm"],
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
      type: "rad_storm",
      intensity: weather.radStormFront.intensity
    };
  }

  // Otherwise combine global + biome
  const biomeWeather = getBiomeWeather(location.biome);

  // If global weather is extreme, override
  if (weather.global === "rad_storm") {
    return { type: "rad_storm", intensity: 1 };
  }
  if (weather.global === "storm") {
    return { type: "storm" };
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

module.exports = {
  ensureWeather,
  updateGlobalWeather,
  getWeatherAtLocation
};
