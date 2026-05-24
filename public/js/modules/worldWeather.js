<<<<<<< HEAD
// worldWeather.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Real-Time Weather + Radiation Storms + Time System
// ------------------------------------------------------------
// Responsibilities:
//   - Global weather state
//   - Biome-specific weather patterns
//   - Radiation storms that sweep across regions
//   - Weather effects that modify encounters
//   - Game time system: 24 minutes real time = 24 hours game day
//   - Day/night cycle affecting gameplay
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
    "rain",
    "fog",
    "radiation storm"
  ];

  // Biome-local weather
  const BIOME_WEATHER = {
    desert: ["clear", "clear", "rain", "rain"],
    jungle: ["rain", "rain", "fog"],
    temperate_forest: ["clear", "rain", "fog"],
    tundra: ["clear", "fog", "radiation storm"],
    arctic: ["fog", "fog", "radiation storm"],
    mountain: ["clear", "fog", "radiation storm"],
    crater: ["radiation storm", "radiation storm", "radiation storm"],
    industrial_zone: ["fog", "fog", "rain"],
    urban_ruins: ["clear", "fog", "radiation storm"],
    oceanic: ["clear", "rain", "fog"]
  };

  // Time system constants
  const REAL_MINUTES_PER_GAME_DAY = 24; // 24 minutes real time = 24 hours game time
  const GAME_HOURS_PER_REAL_MINUTE = 1; // 1 real minute = 1 game hour
  const GAME_MINUTES_PER_REAL_SECOND = 1; // 1 real second = 1 game minute (for smooth updates)

  // Initialize weather and time state
  function ensureWeather(worldState) {
    if (!worldState.weather) {
      worldState.weather = {
        global: "clear",
        biomeOverrides: {},
        radStormFront: null, // sweeping storm
        lastUpdate: Date.now()
      };
    }
    if (!worldState.time) {
      worldState.time = {
        gameStartTime: Date.now(), // real time when game started
        totalGameHours: 0, // total hours elapsed in game time
        lastUpdate: Date.now()
      };
    }
    return worldState.weather;
  }

  // Cryptographically-secure random float in [0, 1)
  // BUG FIX: replaces Math.random() with crypto.getRandomValues() per project policy
  function secureRandom() {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / 0x100000000;
  }

  // Update global weather (called every tick or every few seconds)
  function updateGlobalWeather(worldState) {
    const weather = ensureWeather(worldState);

    const roll = secureRandom();

    // Chance to shift global weather
    if (roll < 0.02) {
      weather.global = GLOBAL_WEATHER[Math.floor(secureRandom() * GLOBAL_WEATHER.length)];
    }

    // Radiation storm front logic
    if (!weather.radStormFront && secureRandom() < 0.005) {
      // Start a rad storm sweeping across the world
      weather.radStormFront = {
        continent: pickRandomContinent(),
        intensity: 1,
        startedAt: Date.now()
      };
    } else if (weather.radStormFront) {
      // Storm intensifies or dissipates (mutually exclusive)
      const stormRoll = secureRandom();
      if (stormRoll < 0.1) {
        weather.radStormFront.intensity++;
      } else if (stormRoll < 0.15) {
        weather.radStormFront.intensity--;
      }

      // End storm
      if (weather.radStormFront.intensity <= 0) {
        weather.radStormFront = null;
      }
    }

    weather.lastUpdate = Date.now();
    return weather;
  }

  // Update game time
  function updateGameTime(worldState) {
    if (!worldState.time) {
      worldState.time = {
        gameStartTime: Date.now(),
        totalGameHours: 0,
        lastUpdate: Date.now()
      };
    }

    const now = Date.now();
    const timeSinceLastUpdate = (now - worldState.time.lastUpdate) / 1000; // seconds

    // 1 real second = 1 game minute
    // 60 real seconds = 60 game minutes = 1 game hour
    const gameHoursToAdd = timeSinceLastUpdate / 60;

    worldState.time.totalGameHours += gameHoursToAdd;
    worldState.time.lastUpdate = now;

    return worldState.time;
  }

  // Get current game time info
  function getCurrentGameTime(worldState) {
    if (!worldState.time) updateGameTime(worldState);

    const totalHours = worldState.time.totalGameHours;
    const currentHour = totalHours % 24; // 0-23
    const currentMinute = (currentHour % 1) * 60; // fractional hour to minutes
    const isDay = currentHour >= 6 && currentHour < 18; // 6 AM to 6 PM
    const isNight = !isDay;

    return {
      totalHours,
      currentHour: Math.floor(currentHour),
      currentMinute: Math.floor(currentMinute),
      isDay,
      isNight,
      timeString: formatGameTime(currentHour, currentMinute)
    };
  }

  // Format time as HH:MM
  function formatGameTime(hour, minute) {
    const h = Math.floor(hour).toString().padStart(2, '0');
    const m = Math.floor(minute).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  // Advance time for fast travel (hours to add)
  function advanceGameTime(worldState, hours) {
    if (!worldState.time) updateGameTime(worldState);
    worldState.time.totalGameHours += hours;
    worldState.time.lastUpdate = Date.now();
    return worldState.time;
  }

  // Biome weather roll
  function getBiomeWeather(biome) {
    // Handle "auto" by defaulting to temperate_forest
    if (!biome || biome === "auto") {
      biome = "temperate_forest";
    }
    
    const pool = BIOME_WEATHER[biome] || ["clear"];
    return pool[Math.floor(secureRandom() * pool.length)];
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
        type: "radiation storm",
        intensity: weather.radStormFront.intensity
      };
    }

    // Otherwise combine global + biome
    const biomeWeather = getBiomeWeather(location.biome);

    // If global weather is extreme, override
    if (weather.global === "radiation storm") {
      return { type: "radiation storm", intensity: 1 };
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
    return continents[Math.floor(secureRandom() * continents.length)];
  }

  // Store interval ID for cleanup
  let updateIntervalId = null;
  const WEATHER_UPDATE_INTERVAL_MS = 5000; // matches weatherOverlay interval

  // Auto-update loop
  function startUpdateLoop(worldState, intervalMs = WEATHER_UPDATE_INTERVAL_MS) {
    // Prevent multiple intervals
    if (updateIntervalId !== null) {
      console.warn("[worldWeather] Update loop already running");
      return;
    }
    
    updateIntervalId = setInterval(() => {
      updateGlobalWeather(worldState);
      updateGameTime(worldState);
    }, intervalMs);
    
    console.log(`[worldWeather] Auto-update started (every ${intervalMs}ms)`);
  }
  
  // Stop the update loop
  function stopUpdateLoop() {
    if (updateIntervalId !== null) {
      clearInterval(updateIntervalId);
      updateIntervalId = null;
      console.log("[worldWeather] Auto-update stopped");
    }
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
    
    // Time system methods
    updateTime(worldState) {
      return updateGameTime(worldState);
    },

    getCurrentTime(worldState) {
      return getCurrentGameTime(worldState);
    },

    advanceTime(worldState, hours) {
      return advanceGameTime(worldState, hours);
    },

    // Start automatic weather updates (prevents duplicate intervals)
    startAutoUpdate(worldState, intervalMs) {
      startUpdateLoop(worldState, intervalMs);
    },
    
    // Stop automatic weather updates
    stopAutoUpdate() {
      stopUpdateLoop();
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
        
        // Initialize weather and time
        ensureWeather(worldState);
        
        // Start automatic updates (matches weatherOverlay interval)
        startUpdateLoop(worldState, WEATHER_UPDATE_INTERVAL_MS);
        
        console.log("[worldWeather] Weather and time engine initialized and auto-update started");
      }
    } catch (e) {
      console.warn("[worldWeather] Failed to initialize:", e.message);
    }
  });

  // Page Visibility API — pause weather updates while the page is hidden so
  // the CPU is not kept busy by timer callbacks the player cannot see.
  if (!window._weatherVisibilityBound) {
    window._weatherVisibilityBound = true;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        weatherEngine.stopAutoUpdate();
      } else {
        // Re-attach worldState reference from wherever it was stored
        try {
          const worldmap = Game.modules.worldmap;
          if (worldmap && worldmap.gs) {
            const worldState = worldmap.gs.worldState || worldmap.gs;
            weatherEngine.startAutoUpdate(worldState, WEATHER_UPDATE_INTERVAL_MS);
          }
        } catch (e) {
          console.warn("[worldWeather] Failed to restart on visibility restore:", e.message);
        }
      }
    });
  }

  console.log("[worldWeather] Weather engine module loaded");
})();
=======
// worldWeather.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Real-Time Weather + Radiation Storms + Time System
// ------------------------------------------------------------
// Responsibilities:
//   - Global weather state
//   - Biome-specific weather patterns
//   - Radiation storms that sweep across regions
//   - Weather effects that modify encounters
//   - Game time system: 24 minutes real time = 24 hours game day
//   - Day/night cycle affecting gameplay
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
    "rain",
    "fog",
    "radiation storm"
  ];

  // Biome-local weather
  const BIOME_WEATHER = {
    desert: ["clear", "clear", "rain", "rain"],
    jungle: ["rain", "rain", "fog"],
    temperate_forest: ["clear", "rain", "fog"],
    tundra: ["clear", "fog", "radiation storm"],
    arctic: ["fog", "fog", "radiation storm"],
    mountain: ["clear", "fog", "radiation storm"],
    crater: ["radiation storm", "radiation storm", "radiation storm"],
    industrial_zone: ["fog", "fog", "rain"],
    urban_ruins: ["clear", "fog", "radiation storm"],
    oceanic: ["clear", "rain", "fog"]
  };

  // Time system constants
  const _REAL_MINUTES_PER_GAME_DAY = 24; // 24 minutes real time = 24 hours game time
  const _GAME_HOURS_PER_REAL_MINUTE = 1; // 1 real minute = 1 game hour
  const _GAME_MINUTES_PER_REAL_SECOND = 1; // 1 real second = 1 game minute (for smooth updates)

  // Initialize weather and time state
  function ensureWeather(worldState) {
    if (!worldState.weather) {
      worldState.weather = {
        global: "clear",
        biomeOverrides: {},
        radStormFront: null, // sweeping storm
        lastUpdate: Date.now()
      };
    }
    if (!worldState.time) {
      worldState.time = {
        gameStartTime: Date.now(), // real time when game started
        totalGameHours: 0, // total hours elapsed in game time
        lastUpdate: Date.now()
      };
    }
    return worldState.weather;
  }

  // Cryptographically-secure random float in [0, 1)
  // BUG FIX: replaces Math.random() with crypto.getRandomValues() per project policy
  function secureRandom() {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / 0x100000000;
  }

  // Update global weather (called every tick or every few seconds)
  function updateGlobalWeather(worldState) {
    const weather = ensureWeather(worldState);

    const roll = secureRandom();

    // Chance to shift global weather
    if (roll < 0.02) {
      weather.global = GLOBAL_WEATHER[Math.floor(secureRandom() * GLOBAL_WEATHER.length)];
    }

    // Radiation storm front logic
    if (!weather.radStormFront && secureRandom() < 0.005) {
      // Start a rad storm sweeping across the world
      weather.radStormFront = {
        continent: pickRandomContinent(),
        intensity: 1,
        startedAt: Date.now()
      };
    } else if (weather.radStormFront) {
      // Storm intensifies or dissipates (mutually exclusive)
      const stormRoll = secureRandom();
      if (stormRoll < 0.1) {
        weather.radStormFront.intensity++;
      } else if (stormRoll < 0.15) {
        weather.radStormFront.intensity--;
      }

      // End storm
      if (weather.radStormFront.intensity <= 0) {
        weather.radStormFront = null;
      }
    }

    weather.lastUpdate = Date.now();
    return weather;
  }

  // Update game time
  function updateGameTime(worldState) {
    if (!worldState.time) {
      worldState.time = {
        gameStartTime: Date.now(),
        totalGameHours: 0,
        lastUpdate: Date.now()
      };
    }

    const now = Date.now();
    const timeSinceLastUpdate = (now - worldState.time.lastUpdate) / 1000; // seconds

    // 1 real second = 1 game minute
    // 60 real seconds = 60 game minutes = 1 game hour
    const gameHoursToAdd = timeSinceLastUpdate / 60;

    worldState.time.totalGameHours += gameHoursToAdd;
    worldState.time.lastUpdate = now;

    return worldState.time;
  }

  // Get current game time info
  function getCurrentGameTime(worldState) {
    if (!worldState.time) updateGameTime(worldState);

    const totalHours = worldState.time.totalGameHours;
    const currentHour = totalHours % 24; // 0-23
    const currentMinute = (currentHour % 1) * 60; // fractional hour to minutes
    const isDay = currentHour >= 6 && currentHour < 18; // 6 AM to 6 PM
    const isNight = !isDay;

    return {
      totalHours,
      currentHour: Math.floor(currentHour),
      currentMinute: Math.floor(currentMinute),
      isDay,
      isNight,
      timeString: formatGameTime(currentHour, currentMinute)
    };
  }

  // Format time as HH:MM
  function formatGameTime(hour, minute) {
    const h = Math.floor(hour).toString().padStart(2, '0');
    const m = Math.floor(minute).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  // Advance time for fast travel (hours to add)
  function advanceGameTime(worldState, hours) {
    if (!worldState.time) updateGameTime(worldState);
    worldState.time.totalGameHours += hours;
    worldState.time.lastUpdate = Date.now();
    return worldState.time;
  }

  // Biome weather roll
  function getBiomeWeather(biome) {
    // Handle "auto" by defaulting to temperate_forest
    if (!biome || biome === "auto") {
      biome = "temperate_forest";
    }
    
    const pool = BIOME_WEATHER[biome] || ["clear"];
    return pool[Math.floor(secureRandom() * pool.length)];
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
        type: "radiation storm",
        intensity: weather.radStormFront.intensity
      };
    }

    // Otherwise combine global + biome
    const biomeWeather = getBiomeWeather(location.biome);

    // If global weather is extreme, override
    if (weather.global === "radiation storm") {
      return { type: "radiation storm", intensity: 1 };
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
    return continents[Math.floor(secureRandom() * continents.length)];
  }

  // Store interval ID for cleanup
  let updateIntervalId = null;
  const WEATHER_UPDATE_INTERVAL_MS = 5000; // matches weatherOverlay interval

  // Auto-update loop
  function startUpdateLoop(worldState, intervalMs = WEATHER_UPDATE_INTERVAL_MS) {
    // Prevent multiple intervals
    if (updateIntervalId !== null) {
      console.warn("[worldWeather] Update loop already running");
      return;
    }
    
    updateIntervalId = setInterval(() => {
      updateGlobalWeather(worldState);
      updateGameTime(worldState);
    }, intervalMs);
    
    console.log(`[worldWeather] Auto-update started (every ${intervalMs}ms)`);
  }
  
  // Stop the update loop
  function stopUpdateLoop() {
    if (updateIntervalId !== null) {
      clearInterval(updateIntervalId);
      updateIntervalId = null;
      console.log("[worldWeather] Auto-update stopped");
    }
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
    
    // Time system methods
    updateTime(worldState) {
      return updateGameTime(worldState);
    },

    getCurrentTime(worldState) {
      return getCurrentGameTime(worldState);
    },

    advanceTime(worldState, hours) {
      return advanceGameTime(worldState, hours);
    },

    // Start automatic weather updates (prevents duplicate intervals)
    startAutoUpdate(worldState, intervalMs) {
      startUpdateLoop(worldState, intervalMs);
    },
    
    // Stop automatic weather updates
    stopAutoUpdate() {
      stopUpdateLoop();
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
        
        // Initialize weather and time
        ensureWeather(worldState);
        
        // Start automatic updates (matches weatherOverlay interval)
        startUpdateLoop(worldState, WEATHER_UPDATE_INTERVAL_MS);
        
        console.log("[worldWeather] Weather and time engine initialized and auto-update started");
      }
    } catch (e) {
      console.warn("[worldWeather] Failed to initialize:", e.message);
    }
  });

  // Page Visibility API — pause weather updates while the page is hidden so
  // the CPU is not kept busy by timer callbacks the player cannot see.
  if (!window._weatherVisibilityBound) {
    window._weatherVisibilityBound = true;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        weatherEngine.stopAutoUpdate();
      } else {
        // Re-attach worldState reference from wherever it was stored
        try {
          const worldmap = Game.modules.worldmap;
          if (worldmap && worldmap.gs) {
            const worldState = worldmap.gs.worldState || worldmap.gs;
            weatherEngine.startAutoUpdate(worldState, WEATHER_UPDATE_INTERVAL_MS);
          }
        } catch (e) {
          console.warn("[worldWeather] Failed to restart on visibility restore:", e.message);
        }
      }
    });
  }

  console.log("[worldWeather] Weather engine module loaded");
})();
>>>>>>> sync/main-reconcile-20260524-081701
