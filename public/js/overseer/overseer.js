// overseer.js
// Unified Overseer Brain – connects terminal + personality + faction + game events

(function () {
  "use strict";

  // Ensure terminal exists
  if (!window.overseer) {
    console.warn("[Overseer] Terminal not loaded yet.");
    return;
  }

  const Terminal = window.overseer;
  const Personality = window.overseerPersonality || null;
  const Faction = window.overseerFaction || null;

  const Brain = {
    initialized: false,

    init() {
      if (this.initialized) return;
      this.initialized = true;

      // Attach personality
      this.attachPersonality();

      // Attach faction intelligence
      this.attachFaction();

      // Extend command handling
      this.extendCommands();

      // Extend game event reactions
      this.extendGameEvents();

      console.log("[Overseer] Brain online.");
    },

    // -----------------------------
    // PERSONALITY INTEGRATION
    // -----------------------------
    attachPersonality() {
      if (!Personality) {
        Terminal.say = () => Terminal.print("...");
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
    // FACTION INTEGRATION
    // -----------------------------
    attachFaction() {
      if (!Faction) return;

      Terminal.faction = Faction;

      // Add faction-based chatter
      Terminal.factionComment = function (factionId) {
        const rep = Faction.getReputation(factionId);
        const label = Faction.reputationLabel(rep);

        if (label === "ALLY") {
          Terminal.print("Faction Status: They consider you an ally.");
        } else if (label === "FRIENDLY") {
          Terminal.print("Faction Status: Relations are positive.");
        } else if (label === "NEUTRAL") {
          Terminal.print("Faction Status: No strong feelings either way.");
        } else if (label === "UNFRIENDLY") {
          Terminal.print("Faction Status: Caution advised.");
        } else if (label === "HOSTILE") {
          Terminal.print("Faction Status: Hostile territory detected.");
        }
      };
    },

    // -----------------------------
    // COMMAND EXTENSIONS
    // -----------------------------
    extendCommands() {
      const originalHandle = Terminal.handleInput.bind(Terminal);

      Terminal.handleInput = function (raw) {
        const line = raw.trim().toLowerCase();
        const parts = line.split(" ");
        const cmd = parts[0];
        const args = parts.slice(1);

        // Faction command
        if (cmd === "faction" && window.overseerHandlers?.faction) {
          window.overseerHandlers.faction(args);
          return;
        }

        // Personality test
        if (cmd === "speak" || cmd === "talk") {
          Terminal.say();
          return;
        }

        originalHandle(raw);
      };
    },

    // -----------------------------
    // GAME EVENT REACTIONS
    // -----------------------------
    extendGameEvents() {
      const originalHandler = Terminal.handleGameEvent.bind(Terminal);

      Terminal.handleGameEvent = function (data) {
        const type = data.type;

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

        // Faction reactions
        if (type === "location" && data.payload?.regionId && Faction) {
          const factionId = Faction.scanTerritory?.();
          if (factionId) {
            Terminal.factionComment(factionId);
          }
        }

        originalHandler(data);
      };
    }
  };

  // Attach brain globally
  window.OverseerBrain = Brain;

  // Auto-init when terminal is ready
  window.addEventListener("overseer:ready", () => Brain.init());

  // If terminal already loaded, init immediately
  if (Terminal.initialized) {
    Brain.init();
  }
})();
