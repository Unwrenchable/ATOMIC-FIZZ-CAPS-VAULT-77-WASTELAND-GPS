// ---------------------------------------------------------------------------
// OVERSEER V-BOT WEATHER ENGINE
// Environmental hazard detection, warnings, and dynamic weather events.
// ---------------------------------------------------------------------------

(function () {
  if (!window.overseerWeather) window.overseerWeather = {};

  const personality = window.overseerPersonality;
  const memory = window.overseerMemoryApi;

  // -------------------------------------------------------------------------
  // WEATHER EVENT DEFINITIONS
  // -------------------------------------------------------------------------

  const WEATHER_EVENTS = [
    {
      id: "clear",
      name: "Clear Skies",
      description: "No environmental hazards detected.",
      severity: 0,
      effect() {
        overseerSay("Atmospheric conditions nominal. Enjoy the temporary peace.");
      },
    },
    {
      id: "dust_storm",
      name: "Dust Storm",
      description: "High winds and particulate matter detected.",
      severity: 2,
      effect() {
        overseerSay("Warning: Dust storm approaching. Visibility will be reduced.");
      },
    },
    {
      id: "rad_storm",
      name: "Radiation Storm",
      description: "Gamma-charged atmospheric disturbance detected.",
      severity: 4,
      effect() {
        overseerSay("Critical alert: Radiation storm inbound. Seek shelter immediately.");
        memory?.noteRadEvent?.();
      },
    },
    {
      id: "solar_flare",
      name: "Solar Flare",
      description: "High-energy solar activity detected.",
      severity: 3,
      effect() {
        overseerSay("Solar flare detected. Expect sensor interference and possible Pip-Boy glitches.");
      },
    },
    {
      id: "acid_rain",
      name: "Acid Rain",
      description: "Corrosive precipitation detected.",
      severity: 3,
      effect() {
        overseerSay("Environmental alert: Acidic rainfall detected. Avoid exposure.");
      },
    },
  ];

  // -------------------------------------------------------------------------
  // WEATHER ENGINE API
  // -------------------------------------------------------------------------

  const weatherApi = {
    getRandomWeather() {
      return WEATHER_EVENTS[Math.floor(Math.random() * WEATHER_EVENTS.length)];
    },

    getWeatherById(id) {
      return WEATHER_EVENTS.find((w) => w.id === id) || null;
    },

    listWeather() {
      return WEATHER_EVENTS.map((w) => `${w.id} — ${w.name}`);
    },

    async triggerWeather(id) {
      const weather = this.getWeatherById(id);
      if (!weather) {
        overseerSay(`No weather event found with ID '${id}'.`);
        return;
      }
      overseerSay(`Weather Event: ${weather.name}`);
      overseerSay(weather.description);
      weather.effect();
      if (personality && typeof personality.speak === "function") {
        const line = await personality.speak("weather event");
        overseerSay(line);
      }
    },

    async triggerRandomWeather() {
      const weather = this.getRandomWeather();
      overseerSay(`Weather Event: ${weather.name}`);
      overseerSay(weather.description);
      weather.effect();
      if (personality && typeof personality.speak === "function") {
        const line = await personality.speak("weather event");
        overseerSay(line);
      }
      return weather.id;
    },
  };

  window.overseerWeather = weatherApi;

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: weather
  // -------------------------------------------------------------------------

  if (!window.overseerHandlers) window.overseerHandlers = {};
  const handlers = window.overseerHandlers;

  handlers.weather = async function (args) {
    const sub = (args[0] || "").toLowerCase();

    if (!sub) {
      overseerSay("Weather subsystem online. Use:");
      overseerSay("  weather list");
      overseerSay("  weather trigger <id>");
      overseerSay("  weather random");
      return;
    }

    if (sub === "list") {
      overseerSay("Registered weather events:");
      weatherApi.listWeather().forEach((w) => overseerSay(`  - ${w}`));
      return;
    }

    if (sub === "trigger") {
      const id = args[1];
      if (!id) {
        overseerSay("Specify a weather event ID.");
        return;
      }
      await weatherApi.triggerWeather(id);
      return;
    }

    if (sub === "random") {
      await weatherApi.triggerRandomWeather();
      return;
    }

    overseerSay("Unknown weather subcommand.");
  };

})();
