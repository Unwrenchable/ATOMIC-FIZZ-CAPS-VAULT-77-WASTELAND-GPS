// OVERSEER V-BOT THREAT SCANNER
// Enemy detection, danger analysis, and threat commentary.
// ---------------------------------------------------------------------------

(function () {
  if (!window.overseerThreat) window.overseerThreat = {};

  const personality = window.overseerPersonality;
  const memory = window.overseerMemoryApi;

  // -------------------------------------------------------------------------
  // THREAT LEVEL DEFINITIONS
  // -------------------------------------------------------------------------

  const THREAT_LEVELS = [
    {
      id: "none",
      label: "No Threat",
      description: "No hostiles detected within sensor range.",
      color: "green",
    },
    {
      id: "low",
      label: "Low Threat",
      description: "Minor hostiles detected. Likely manageable.",
      color: "yellow",
    },
    {
      id: "medium",
      label: "Moderate Threat",
      description: "Hostiles detected with potential for harm.",
      color: "orange",
    },
    {
      id: "high",
      label: "High Threat",
      description: "Multiple or dangerous hostiles detected.",
      color: "red",
    },
    {
      id: "extreme",
      label: "Extreme Threat",
      description: "Catastrophic danger. Recommend immediate evacuation.",
      color: "purple",
    },
  ];

  // -------------------------------------------------------------------------
  // THREAT SCANNER ENGINE
  // -------------------------------------------------------------------------

  const threatApi = {
    analyze(encounter) {
      if (!encounter) {
        return THREAT_LEVELS[0]; // none
      }

      const danger = encounter.danger || 0;

      if (danger <= 1) return THREAT_LEVELS[1];
      if (danger <= 3) return THREAT_LEVELS[2];
      if (danger <= 5) return THREAT_LEVELS[3];
      return THREAT_LEVELS[4];
    },

    scan() {
      const encounters = window.encounters;
      if (!encounters || !encounters.getNearbyEncounter) {
        overseerSay("Threat scanner offline. Encounter subsystem not linked.");
        return null;
      }

      const encounter = encounters.getNearbyEncounter();
      const level = this.analyze(encounter);

      overseerSay(`Threat Level: ${level.label}`);
      overseerSay(level.description);

      if (encounter) {
        overseerSay(`Detected: ${encounter.name}`);
        overseerSay(`Danger Rating: ${encounter.danger}`);
      }

      overseerSay(personality.speak());
      return level.id;
    },

    randomThreat() {
      const fake = {
        name: "Unknown Hostile",
        danger: Math.floor(Math.random() * 7),
      };
      return this.analyze(fake);
    },
  };

  window.overseerThreat = threatApi;

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: threat
  // -------------------------------------------------------------------------

  if (!window.overseerHandlers) window.overseerHandlers = {};
  const handlers = window.overseerHandlers;

  handlers.threat = function (args) {
    const sub = (args[0] || "").toLowerCase();

    if (!sub) {
      overseerSay("Threat subsystem online. Use:");
      overseerSay("  threat scan");
      overseerSay("  threat random");
      overseerSay("  threat explain");
      return;
    }

    if (sub === "scan") {
      threatApi.scan();
      return;
    }

    if (sub === "random") {
      const level = threatApi.randomThreat();
      overseerSay(`Simulated Threat Level: ${level.label}`);
      overseerSay(level.description);
      overseerSay(personality.speak());
      return;
    }

    if (sub === "explain") {
      overseerSay("Threat Levels:");
      THREAT_LEVELS.forEach((lvl) => {
        overseerSay(`  - ${lvl.label}: ${lvl.description}`);
      });
      return;
    }

    overseerSay("Unknown threat subcommand.");
  };

})();
// ---------------------------------------------------------------------------
// OVERSEER V-BOT WEATHER ENGINE
