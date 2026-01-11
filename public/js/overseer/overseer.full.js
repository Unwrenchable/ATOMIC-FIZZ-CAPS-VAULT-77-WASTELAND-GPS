// overseer.js
// Unified Overseer Brain – terminal + personality + memory + lore + faction + threat + weather + game events

(function () {
  "use strict";

  if (!window.overseer) {
    console.warn("[Overseer] Terminal not loaded yet.");
    return;
  }

  const Terminal = window.overseer;
  const Personality = window.overseerPersonality || null;
  const Memory = window.overseerMemoryApi || null;
  const Lore = window.overseerLore || null;
  const Faction = window.overseerFaction || null;
  const Threat = window.overseerThreat || null;
  const Weather = window.overseerWeather || null;

  const Brain = {
    initialized: false,

    init() {
      if (this.initialized) return;
      this.initialized = true;

      this.attachPersonality();
      this.attachMemory();
      this.attachLore();
      this.attachFaction();
      this.attachThreat();
      this.attachWeather();

      this.extendCommands();
      this.extendGameEvents();

      console.log("[Overseer] Brain online.");
    },

    // -----------------------------
    // PERSONALITY
    // -----------------------------
    attachPersonality() {
      if (!Personality) {
        Terminal.say = () => Terminal.print("...");
        Terminal.react = (context = "") => {
          Terminal.print("...");
          if (context) Terminal.print("// " + context);
        };
        return;
      }

      Terminal.say = () => {
        Terminal.print(Personality.speak());
      };

      Terminal.react = (context = "") => {
        const line = Personality.speak();
        Terminal.print(line + (context ? " // " + context : ""));
      };
    },

    // -----------------------------
    // MEMORY
    // -----------------------------
    attachMemory() {
      if (!Memory) return;

      Terminal.memory = Memory;

      Terminal.memorySummary = function () {
        const snap = Memory.snapshot();
        Terminal.print("OVERSEER MEMORY SUMMARY");
        Terminal.print("  Regions visited: " + snap.regionsVisited.length);
        Terminal.print("  POIs discovered: " + snap.poisDiscovered.length);
        Terminal.print("  Quests tracked: " + Object.keys(snap.questStates).length);
        Terminal.print("  Encounters survived: " + snap.encountersSurvived);
        Terminal.print("  Radiation events: " + snap.radEvents);
      };
    },

    // -----------------------------
    // LORE
    // -----------------------------
    attachLore() {
      if (!Lore) return;

      Terminal.lore = Lore;

      Terminal.loreComment = function (category) {
        const entry = Lore.getRandomLore(category);
        if (!entry) return;
        Terminal.print("=== " + entry.title + " ===");
        entry.body.forEach((line) => Terminal.print(line));
        Terminal.react("lore recall");
      };
    },

    // -----------------------------
    // FACTION
    // -----------------------------
    attachFaction() {
      if (!Faction) return;

      Terminal.faction = Faction;

      Terminal.factionComment = function (factionId) {
        const rep = Faction.getReputation(factionId);
        const label = Faction.reputationLabel(rep);

        if (label === "ALLY") Terminal.print("Faction Status: They consider you an ally.");
        else if (label === "FRIENDLY") Terminal.print("Faction Status: Relations are positive.");
        else if (label === "NEUTRAL") Terminal.print("Faction Status: No strong feelings either way.");
        else if (label === "UNFRIENDLY") Terminal.print("Faction Status: Caution advised.");
        else if (label === "HOSTILE") Terminal.print("Faction Status: Hostile territory detected.");
      };
    },

    // -----------------------------
    // THREAT
    // -----------------------------
    attachThreat() {
      if (!Threat) return;

      Terminal.threat = Threat;

      Terminal.threatComment = function (levelOrPayload) {
        const level = Threat.analyze(
          typeof levelOrPayload === "object" ? levelOrPayload : { danger: levelOrPayload }
        );
        Terminal.print("Threat Assessment: " + level.label);
        Terminal.print(level.description);
      };
    },

    // -----------------------------
    // WEATHER
    // -----------------------------
    attachWeather() {
      if (!Weather) return;

      Terminal.weather = Weather;

      Terminal.weatherComment = function (weatherId) {
        const w = Weather.getWeatherById(weatherId);
        if (!w) return;
        Terminal.print("Weather Status: " + w.name);
        Terminal.print(w.description);
        Terminal.react("weather update");
      };
    },

    // -----------------------------
    // COMMAND EXTENSIONS
    // -----------------------------
    extendCommands() {
      const originalHandle = Terminal.handleInput.bind(Terminal);

      Terminal.handleInput = function (raw) {
        const trimmed = raw.trim();
        if (!trimmed) return;
        const line = trimmed.toLowerCase();
        const parts = line.split(" ");
        const cmd = parts[0];
        const args = parts.slice(1);
        const handlers = window.overseerHandlers || {};

        // Extended commands routed to cores
        if (cmd === "memory" && handlers.memory) {
          handlers.memory(args);
          return;
        }

        if (cmd === "overseer" && handlers.overseer) {
          handlers.overseer(args);
          return;
        }

        if (cmd === "lore" && handlers.lore) {
          handlers.lore(args);
          return;
        }

        if (cmd === "faction" && handlers.faction) {
          handlers.faction(args);
          return;
        }

        if (cmd === "threat" && handlers.threat) {
          handlers.threat(args);
          return;
        }

        if (cmd === "weather" && handlers.weather) {
          handlers.weather(args);
          return;
        }

        // Personality test
        if (cmd === "speak" || cmd === "talk") {
          Terminal.say();
          return;
        }

        // Fallback to built-in commands (status, inventory, map, etc.)
        originalHandle(raw);
      };
    },

    // -----------------------------
    // GAME EVENT REACTIONS
    // -----------------------------
    extendGameEvents() {
      const originalHandler = Terminal.handleGameEvent.bind(Terminal);

      Terminal.handleGameEvent = function (data) {
        const type = data.type || "";
        const payload = data.payload || {};

        // Personality reactions
        switch (type) {
          case "status":
            Terminal.react("status update received");
            break;
          case "quest_update":
            Terminal.react("quest progression detected");
            break;
          case "caps":
            Terminal.react("financial update");
            break;
          case "inventory":
            Terminal.react("inventory change");
            break;
        }

        // Memory hooks
        if (Memory) {
          if (type === "location" && payload.regionId) {
            Memory.markRegionVisited(payload.regionId);
          }

          if (type === "map_scan" && Array.isArray(payload.nearby)) {
            payload.nearby.forEach((poi) => {
              if (poi.id) Memory.markPoiDiscovered(poi.id);
            });
          }

          if (type === "quest_update" && payload.id && payload.step) {
            Memory.noteQuestState(payload.id, payload.step);
          }

          if (type === "enemy_detected") {
            Memory.noteEncounterSurvived();
          }
        }

        // Faction reactions
        if (type === "location" && payload.regionId && Faction) {
          const factionId = Faction.scanTerritory?.();
          if (factionId) Terminal.factionComment(factionId);
        }

        // Threat reactions
        if (type === "enemy_detected" && Threat) {
          const level = Threat.analyze(payload);
          Terminal.print("Threat Level: " + level.label);
          Terminal.print(level.description);
          Terminal.react("hostile presence detected");
        }

        // Weather reactions
        if (type === "weather_change" && Weather && payload.id) {
          Terminal.weatherComment(payload.id);
        }

        // Lore reactions (contextual by region id patterns)
        if (type === "location" && Lore && payload.regionId) {
          const region = String(payload.regionId).toLowerCase();
          if (region.includes("vault")) Terminal.loreComment("vault_logs");
          if (region.includes("fizz")) Terminal.loreComment("fizzco_ads");
          if (region.includes("basin")) Terminal.loreComment("survivor_notes");
        }

        originalHandler(data);
      };
    }
  };

  // Expose brain globally in case you want admin hooks later
  window.OverseerBrain = Brain;

  // In popup mode, just initialize once scripts are loaded.
  // Terminal functions already exist at this point.
  Brain.init();
})();
