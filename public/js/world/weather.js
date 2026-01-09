// weather.js
// ------------------------------------------------------------
// Real-Time Weather System + Radiation Storms
// ------------------------------------------------------------

const GLOBAL_WEATHER = [
  "clear",
  "cloudy",
  "storm",
  "rad_storm",
  "heatwave",
  "cold_snap"
];

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

function ensureWeather(worldState) {
  if (!worldState.weather) {
    worldState.weather = {
      global: "clear",
      biomeOverrides: {},
      radStormFront: null,
      lastUpdate: Date.now()
    };
  }
  return worldState.weather;
}

function updateGlobalWeather(worldState) {
  const weather = ensureWeather(worldState);
  const roll = Math.random();

  // Small chance to shift global weather
  if (roll < 0.02) {
    weather.global = GLOBAL_WEATHER[Math.floor(Math.random() * GLOBAL_WEATHER.length)];
  }

  // Radiation storm front logic
  if (!weather.radStormFront && Math.random() < 0.005) {
    weather.radStormFront = {
      continent: pickRandomContinent(),
      intensity: 1,
      startedAt: Date.now()
    };
  } else if (weather.radStormFront) {
    if (Math.random() < 0.1) weather.radStormFront.intensity++;
    if (Math.random() < 0.05) weather.radStormFront.intensity--;
    if (weather.radStormFront.intensity <= 0) weather.radStormFront = null;
  }

  weather.lastUpdate = Date.now();
  return weather;
}

function getBiomeWeather(biome) {
  const pool = BIOME_WEATHER[biome] || ["clear"];
  return pool[Math.floor(Math.random() * pool.length)];
}

function getWeatherAtLocation(worldState, location) {
  const weather = ensureWeather(worldState);

  // Radiation storm sweeping continent
  if (
    weather.radStormFront &&
    weather.radStormFront.continent === location.continent
  ) {
    return {
      type: "rad_storm",
      intensity: weather.radStormFront.intensity
    };
  }

  // Global overrides
  if (weather.global === "rad_storm") return { type: "rad_storm", intensity: 1 };
  if (weather.global === "storm") return { type: "storm" };

  // Biome weather
  return { type: getBiomeWeather(location.biome) };
}

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
