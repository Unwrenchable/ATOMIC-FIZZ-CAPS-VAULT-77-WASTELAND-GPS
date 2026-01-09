// OVERSEER V-BOT FACTION INTELLIGENCE ENGINE
// Tracks faction reputation, territory awareness, and faction-based warnings.
// ---------------------------------------------------------------------------

(function () {
  if (!window.overseerFaction) window.overseerFaction = {};

  const personality = window.overseerPersonality;
  const memory = window.overseerMemoryApi;

  // -------------------------------------------------------------------------
  // FACTION DEFINITIONS
  // -------------------------------------------------------------------------

  const FACTIONS = [
    {
      id: "ncr",
      name: "New California Republic",
      description: "Democratic-ish expansionist force. Bureaucratic but well-armed.",
    },
    {
      id: "legion",
      name: "Caesar's Legion",
      description: "Militaristic slaver empire. Brutal, disciplined, and extremely dangerous.",
    },
    {
      id: "boomers",
      name: "Boomers",
      description: "Artillery-obsessed isolationists. Friendly if you survive the approach.",
    },
    {
      id: "khans",
      name: "Great Khans",
      description: "Chem-dealing raiders with a proud warrior culture.",
    },
    {
      id: "enclave",
      name: "Enclave",
      description: "Remnants of pre-war government. High-tech, high-danger, low-chill.",
    },
    {
      id: "fizzco",
      name: "FizzCo",
      description: "Pre-war megacorp behind Atomic Fizz. Their motives remain… carbonated.",
    },
  ];

  // -------------------------------------------------------------------------
  // REPUTATION SYSTEM
  // -------------------------------------------------------------------------

  const DEFAULT_REP = 0; // neutral

  if (!window.overseerFactionReputation) {
    window.overseerFactionReputation = {};
    FACTIONS.forEach((f) => {
      window.overseerFactionReputation[f.id] = DEFAULT_REP;
    });
  }

  const rep = window.overseerFactionReputation;

  const factionApi = {
    listFactions() {
      return FACTIONS.map((f) => `${f.id} — ${f.name}`);
    },

    getFaction(id) {
      return FACTIONS.find((f) => f.id === id) || null;
    },

    getReputation(id) {
      return rep[id] ?? DEFAULT_REP;
    },

    modifyReputation(id, amount) {
      if (rep[id] === undefined) return;
      rep[id] += amount;
      return rep[id];
    },

    setReputation(id, value) {
      if (rep[id] === undefined) return;
      rep[id] = value;
      return rep[id];
    },

    reputationLabel(value) {
      if (value >= 40) return "ALLY";
      if (value >= 15) return "FRIENDLY";
      if (value >= -14) return "NEUTRAL";
      if (value >= -39) return "UNFRIENDLY";
      return "HOSTILE";
    },

    scanTerritory() {
      const world = window.world;
      const gs = window.gameState;

      if (!world || !gs) {
        overseerSay("Faction scanner offline. Missing world or player telemetry.");
        return null;
      }

      const region = world.getCurrentRegion?.();
      if (!region) {
        overseerSay("No faction territory detected. Possibly unclaimed wasteland.");
        return null;
      }

      // Simple placeholder: assign factions to regions by ID
      const regionFactionMap = {
        mojave: "ncr",
        rad_zone: "legion",
        vault_region: "fizzco",
      };

      const factionId = regionFactionMap[region.id] || null;
      if (!factionId) {
        overseerSay("Region detected, but no faction claims it.");
        return null;
      }

      const faction = this.getFaction(factionId);
      const reputation = this.getReputation(factionId);
      const label = this.reputationLabel(reputation);

      overseerSay(`Territory Scan: ${faction.name}`);
      overseerSay(`Reputation: ${label} (${reputation})`);
      overseerSay(personality.speak());

      return factionId;
    },
  };

  window.overseerFaction = factionApi;

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: faction
  // -------------------------------------------------------------------------

  if (!window.overseerHandlers) window.overseerHandlers = {};
  const handlers = window.overseerHandlers;

  handlers.faction = function (args) {
    const sub = (args[0] || "").toLowerCase();

    if (!sub) {
      overseerSay("Faction subsystem online. Use:");
      overseerSay("  faction list");
      overseerSay("  faction rep <id>");
      overseerSay("  faction set <id> <value>");
      overseerSay("  faction mod <id> <amount>");
      overseerSay("  faction scan");
      return;
    }

    if (sub === "list") {
      overseerSay("Known factions:");
      factionApi.listFactions().forEach((f) => overseerSay(`  - ${f}`));
      return;
    }

    if (sub === "rep") {
      const id = args[1];
      if (!id) {
        overseerSay("Specify a faction ID.");
        return;
      }
      const value = factionApi.getReputation(id);
      const label = factionApi.reputationLabel(value);
      overseerSay(`Reputation with ${id}: ${label} (${value})`);
      return;
    }

    if (sub === "set") {
      const id = args[1];
      const value = parseInt(args[2], 10);
      if (!id || isNaN(value)) {
        overseerSay("Usage: faction set <id> <value>");
        return;
      }
      factionApi.setReputation(id, value);
      overseerSay(`Reputation with ${id} set to ${value}.`);
      return;
    }

    if (sub === "mod") {
      const id = args[1];
      const amount = parseInt(args[2], 10);
      if (!id || isNaN(amount)) {
        overseerSay("Usage: faction mod <id> <amount>");
        return;
      }
      const newRep = factionApi.modifyReputation(id, amount);
      overseerSay(`Reputation with ${id} modified by ${amount}. New value: ${newRep}.`);
      return;
    }

    if (sub === "scan") {
      factionApi.scanTerritory();
      return;
    }

    overseerSay("Unknown faction subcommand.");
  };

})();
