// overseer.js
// Unified Overseer Brain – connects terminal UI to all AI engines.

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // GLOBAL OUTPUT FUNCTIONS (required by lore, memory, threat, etc.)
  // ---------------------------------------------------------------------------
  window.overseerSay = function (text) {
    if (window.overseer && typeof window.overseer.print === "function") {
      window.overseer.print(text);
    } else {
      console.log("[OVERSEER]", text);
    }
  };

  // Print multiple lines at once
  window.overseerSayBlock = function (lines) {
    if (!Array.isArray(lines)) return;
    lines.forEach(line => window.overseerSay(line));
  };

  // Print an error message with visual distinction
  window.overseerError = function (text) {
    window.overseerSay("ERROR: " + text);
  };

  // ---------------------------------------------------------------------------
  // SAFE ENGINE GETTERS
  // ---------------------------------------------------------------------------
  function getEngines() {
    return {
      Personality: window.overseerPersonality || null,
      Memory: window.overseerMemoryApi || null,
      Lore: window.overseerLore || null,
      Faction: window.overseerFaction || null,
      Threat: window.overseerThreat || null,
      Weather: window.overseerWeather || null,
      WorldState: window.overseerWorldState || null,
      CommandExt: window.overseerCommandExt || null
    };
  }

  // ---------------------------------------------------------------------------
  // MAIN BRAIN OBJECT
  // ---------------------------------------------------------------------------
  const Brain = {
    initialized: false,

    init() {
      if (this.initialized) return;
      this.initialized = true;

      const Terminal = window.overseer;
      const Engines = getEngines();

      // Attach engines
      this.attachPersonality(Terminal, Engines.Personality);
      this.attachMemory(Terminal, Engines.Memory);
      this.attachLore(Terminal, Engines.Lore);
      this.attachFaction(Terminal, Engines.Faction);
      this.attachThreat(Terminal, Engines.Threat);
      this.attachWeather(Terminal, Engines.Weather);

      // Patch commands + events
      this.extendCommands(Terminal);
      this.extendGameEvents(Terminal, Engines);

      console.log("[Overseer] Brain online.");
      overseerSay("Overseer AI online.");
    },

    // -------------------------------------------------------------------------
    // PERSONALITY (AI‑ENABLED)
    // -------------------------------------------------------------------------
    attachPersonality(Terminal, Personality) {
      if (!Personality) {
        Terminal.say = async () => overseerSay("...");
        Terminal.react = async (ctx = "") =>
          overseerSay("..." + (ctx ? " // " + ctx : ""));
        return;
      }

      // AI‑powered speak()
      Terminal.say = async () => {
        const line = await Personality.speak();
        overseerSay(line);
      };

      Terminal.react = async (ctx = "") => {
        const line = await Personality.speak(ctx);
        overseerSay(line);
      };
    },

    // -------------------------------------------------------------------------
    // MEMORY
    // -------------------------------------------------------------------------
    attachMemory(Terminal, Memory) {
      if (!Memory) return;
      Terminal.memory = Memory;

      Terminal.memorySummary = function () {
        const snap = Memory.snapshot();
        overseerSay("OVERSEER MEMORY SUMMARY");
        overseerSay("  Regions visited: " + snap.regionsVisited.length);
        overseerSay("  POIs discovered: " + snap.poisDiscovered.length);
        overseerSay("  Quests tracked: " + Object.keys(snap.questStates).length);
        overseerSay("  Encounters survived: " + snap.encountersSurvived);
        overseerSay("  Radiation events: " + snap.radEvents);
      };
    },

    // -------------------------------------------------------------------------
    // LORE
    // -------------------------------------------------------------------------
    attachLore(Terminal, Lore) {
      if (!Lore) return;
      Terminal.lore = Lore;

      Terminal.loreComment = async function (category) {
        const entry = Lore.getRandomLore(category);
        if (!entry) return;
        overseerSay("=== " + entry.title + " ===");
        entry.body.forEach((line) => overseerSay(line));
        await Terminal.react("lore recall");
      };
    },

    // -------------------------------------------------------------------------
    // FACTION
    // -------------------------------------------------------------------------
    attachFaction(Terminal, Faction) {
      if (!Faction) return;
      Terminal.faction = Faction;

      Terminal.factionComment = function (factionId) {
        const rep = Faction.getReputation(factionId);
        const label = Faction.reputationLabel(rep);

        const map = {
          ALLY: "They consider you an ally.",
          FRIENDLY: "Relations are positive.",
          NEUTRAL: "No strong feelings either way.",
          UNFRIENDLY: "Caution advised.",
          HOSTILE: "Hostile territory detected."
        };

        overseerSay("Faction Status: " + (map[label] || "Unknown"));
      };
    },

    // -------------------------------------------------------------------------
    // THREAT
    // -------------------------------------------------------------------------
    attachThreat(Terminal, Threat) {
      if (!Threat) return;
      Terminal.threat = Threat;

      Terminal.threatComment = function (payload) {
        const level = Threat.analyze(payload);
        overseerSay("Threat Level: " + level.label);
        overseerSay(level.description);
      };
    },

    // -------------------------------------------------------------------------
    // WEATHER
    // -------------------------------------------------------------------------
    attachWeather(Terminal, Weather) {
      if (!Weather) return;
      Terminal.weather = Weather;

      Terminal.weatherComment = async function (id) {
        const w = Weather.getWeatherById(id);
        if (!w) return;
        overseerSay("Weather: " + w.name);
        overseerSay(w.description);
        await Terminal.react("weather update");
      };
    },

    // -------------------------------------------------------------------------
    // COMMAND EXTENSIONS
    // -------------------------------------------------------------------------
    extendCommands(Terminal) {
      const original = Terminal.handleInput.bind(Terminal);

      Terminal.handleInput = async function (raw) {
        const line = raw.trim().toLowerCase();
        const parts = line.split(" ");
        const cmd = parts[0];
        const args = parts.slice(1);

        const handlers = window.overseerHandlers || {};

        if (handlers[cmd]) {
          handlers[cmd](args);
          return;
        }

        if (cmd === "speak" || cmd === "talk") {
          await Terminal.say();
          return;
        }

        await original(raw);
      };
    },

    // -------------------------------------------------------------------------
    // GAME EVENT REACTIONS
    // -------------------------------------------------------------------------
    extendGameEvents(Terminal, Engines) {
      const original = Terminal.handleGameEvent.bind(Terminal);

      Terminal.handleGameEvent = async function (data) {
        const type = data.type || "";
        const payload = data.payload || {};

        // Personality reactions
        if (type === "status") await Terminal.react("status update");
        if (type === "quest_update") await Terminal.react("quest progression");
        if (type === "caps") await Terminal.react("financial update");
        if (type === "inventory") await Terminal.react("inventory change");

        // Memory
        if (Engines.Memory) {
          if (type === "location" && payload.regionId)
            Engines.Memory.markRegionVisited(payload.regionId);
          if (type === "map_scan" && Array.isArray(payload.nearby)) {
            payload.nearby.forEach(
              (poi) => poi.id && Engines.Memory.markPoiDiscovered(poi.id)
            );
          }
          if (type === "quest_update" && payload.id && payload.step) {
            Engines.Memory.noteQuestState(payload.id, payload.step);
          }
          if (type === "enemy_detected") Engines.Memory.noteEncounterSurvived();
        }

        // Faction
        if (type === "location" && Engines.Faction) {
          const factionId = Engines.Faction.scanTerritory?.();
          if (factionId) Terminal.factionComment(factionId);
        }

        // Threat
        if (type === "enemy_detected" && Engines.Threat) {
          Terminal.threatComment(payload);
          await Terminal.react("hostile presence");
        }

        // Weather
        if (type === "weather_change" && Engines.Weather) {
          await Terminal.weatherComment(payload.id);
        }

        // Lore (contextual)
        if (type === "location" && Engines.Lore && payload.regionId) {
          const region = String(payload.regionId).toLowerCase();
          if (region.includes("vault")) await Terminal.loreComment("vault_logs");
          if (region.includes("fizz")) await Terminal.loreComment("fizzco_ads");
          if (region.includes("basin")) await Terminal.loreComment("survivor_notes");
        }

        await original(data);
      };
    }
  };

  // ---------------------------------------------------------------------------
  // WAIT FOR TERMINAL BEFORE INITIALIZING
  // ---------------------------------------------------------------------------
  function waitForTerminal() {
    if (window.overseer && typeof window.overseer.print === "function") {
      Brain.init();
      return;
    }
    setTimeout(waitForTerminal, 50);
  }

  waitForTerminal();
})();
