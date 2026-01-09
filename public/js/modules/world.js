// public/js/modules/world.js
// ------------------------------------------------------------
// Unified World Simulation Module
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const world = {
    state: null,

    init(worldState) {
      this.state = worldState || {};
      this.ensureAll();
    },

    ensureAll() {
      if (window.ReputationModule) {
        this.reputation.ensure(this.state);
      }

      if (typeof ensureWeather === "function") {
        this.weather.ensure(this.state);
      }

      if (typeof ensureBossState === "function") {
        this.bosses.ensure(this.state);
      }

      if (Game.modules.merchants) {
        Game.modules.merchants.init(this.state);
      }
    },

    // --------------------------------------------------------
    // REPUTATION
    // --------------------------------------------------------
    reputation: {
      ensure: (state) => window.ReputationModule?.init(state),
      adjust: (state, faction, delta) =>
        window.ReputationModule?.adjust(state, faction, delta),
      get: (state, faction) =>
        window.ReputationModule?.get(state, faction),
      status: (state, faction) =>
        window.ReputationModule?.status(state, faction)
    },

    // --------------------------------------------------------
    // WEATHER
    // --------------------------------------------------------
    weather: {
      ensure: (state) => ensureWeather(state),
      update: (state) => updateGlobalWeather(state),
      at: (state, location) => getWeatherAtLocation(state, location)
    },

    // --------------------------------------------------------
    // MERCHANTS (mature module)
    // --------------------------------------------------------
    merchants: {
      create: (encounter, options) =>
        Game.modules.merchants.createEncounterMerchant(encounter, options),

      definition: (id) =>
        Game.modules.merchants.getMerchantDefinition(id),

      stock: (merchant) =>
        Game.modules.merchants.generateStock(merchant),

      greeting: (merchant) =>
        merchant?.flavor?.greeting || "Let's trade."
    },

    // --------------------------------------------------------
    // EVENTS
    // --------------------------------------------------------
    events: {
  pick: (state, location) =>
    Game.modules.events.pick(state, location)
},


    // --------------------------------------------------------
    // BOSSES
    // --------------------------------------------------------
    bosses: {
  ensure: (state) => Game.modules.bosses.ensure(state),
  status: (state, location) => Game.modules.bosses.status(state, location),
  defeat: (state, location) => Game.modules.bosses.defeat(state, location),
  roll: (state, location, weather) =>
    Game.modules.bosses.roll(state, location, weather)
},


    // --------------------------------------------------------
    // ENEMIES
    // --------------------------------------------------------
    enemies: {
  pick: (state, location) =>
    Game.modules.enemies.pick(location.biome, location.level, location.faction),

  scale: (baseEnemies, location, weather, repStatus) =>
    Game.modules.enemyScaling.scale(
      baseEnemies,
      location.level,
      weather,
      repStatus,
      location.biome
    )
},


    // --------------------------------------------------------
    // ENCOUNTERS
    // --------------------------------------------------------
    encounters: {
      roll(state, location) {
        const weather = getWeatherAtLocation(state, location);
        return rollEncounter(state, location, weather);
      }
    }
  };

  Game.modules.world = world;
})();
