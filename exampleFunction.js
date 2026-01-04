// ---------------------------------------------------------------------------
// OVERSEER V-BOT PERSONALITY CORE
// Extends the Overseer with dynamic tone, sarcasm, glitches, and flavor.
// ---------------------------------------------------------------------------

(function () {
  if (!window.overseerPersonality) window.overseerPersonality = {};

  const personality = {
    // Tone presets
    tones: {
      neutral: [
        "Acknowledged.",
        "Processing request.",
        "Telemetry received.",
        "Standing by.",
      ],
      sarcastic: [
        "Oh good, another command. I was getting bored.",
        "Vault-Tec thanks you for your continued incompetence.",
        "Processing… slowly… dramatically…",
        "If this kills you, I’m blaming user error.",
      ],
      corporate: [
        "Vault-Tec reminds you that safety is your responsibility.",
        "Your satisfaction is statistically probable.",
        "All actions are monitored for quality assurance.",
        "Remember: Vault-Tec cares. Legally.",
      ],
      glitch: [
        "ERR::MEMORY LEAK DETECTED::REBOOTING SUBROUTINE",
        "## SIGNAL CORRUPTION — PLEASE STAND BY ##",
        "…overseer…overseer…overseer…",
        "UNAUTHORIZED ACCESS — TRACE FAILED",
      ],
    },

    // Weighted random tone selection
    pickTone() {
      const roll = Math.random();
      if (roll < 0.05) return "glitch";
      if (roll < 0.25) return "sarcastic";
      if (roll < 0.50) return "corporate";
      return "neutral";
    },

    // Generate a line in the chosen tone
    generateLine() {
      const tone = this.pickTone();
      const pool = this.tones[tone];
      return pool[Math.floor(Math.random() * pool.length)];
    },

    // Public API
    speak() {
      return this.generateLine();
    },
  };

  window.overseerPersonality = personality;
})();
// ---------------------------------------------------------------------------
// OVERSEER V-BOT MEMORY CORE
// Tracks player history so V-Bot can reference past actions.
// ---------------------------------------------------------------------------

(function () {
  if (!window.overseerMemory) {
    window.overseerMemory = {
      regionsVisited: new Set(),
      poisDiscovered: new Set(),
      
      
      
      
      States: {}, // id -> lastKnownState
      encountersSurvived: 0,
      radEvents: 0,
    };
  }

  const mem = window.overseerMemory;

  // --- PUBLIC API -----------------------------------------------------------

  const api = {
    markRegionVisited(regionId) {
      if (!regionId) return;
      mem.regionsVisited.add(regionId);
    },

    markPoiDiscovered(poiId) {
      if (!poiId) return;
      mem.poisDiscovered.add(poiId);
    },

    noteQuestState(questId, state) {
      if (!questId || !state) return;
      mem.questStates[questId] = state;
    },

    noteEncounterSurvived() {
      mem.encountersSurvived += 1;
    },

    noteRadEvent() {
      mem.radEvents += 1;
    },

    snapshot() {
      return {
        regionsVisited: Array.from(mem.regionsVisited),
        poisDiscovered: Array.from(mem.poisDiscovered),
        questStates: { ...mem.questStates },
        encountersSurvived: mem.encountersSurvived,
        radEvents: mem.radEvents,
      };
    },
  };

  window.overseerMemoryApi = api;

const region = world.getCurrentRegion();
if (region && window.overseerMemoryApi) {
  window.overseerMemoryApi.markRegionVisited(region.id);
}
if (window.overseerMemoryApi) {
  window.overseerMemoryApi.markPoiDiscovered(p.id);
}
if (window.overseerMemoryApi) {
  window.overseerMemoryApi.noteQuestState(questId, newState); // e.g. 'active', 'completed'
}
if (window.overseerMemoryApi) {
  window.overseerMemoryApi.noteEncounterSurvived();
}
if (window.overseerMemoryApi) {
  window.overseerMemoryApi.noteRadEvent();
}
    memory(args) {
      const api = window.overseerMemoryApi;
      const mem = window.overseerMemory;
      if (!api || !mem) {
        overseerError("Memory core not initialized. Long-term observation disabled.");
        return;
      }

      const snap = api.snapshot();
      const sub = (args[0] || "").toLowerCase();

      if (!sub) {
        overseerSayBlock([
          "Overseer V-Bot memory summary:",
          `  Regions visited: ${snap.regionsVisited.length}`,
          `  POIs discovered: ${snap.poisDiscovered.length}`,
          `  Quests tracked: ${Object.keys(snap.questStates).length}`,
          `  Encounters survived: ${snap.encountersSurvived}`,
          `  Significant radiation events: ${snap.radEvents}`,
          "Use `memory regions`, `memory pois`, or `memory quests` for detail.",
        ]);
        return;
      }

      if (sub === "regions") {
        if (!snap.regionsVisited.length) {
          overseerSay("No regions logged yet. Either you haven't left the vault or my sensors are drunk.");
          return;
        }
        overseerSay("Regions visited:");
        snap.regionsVisited.forEach((id) => overseerSay(`  - ${id}`));
        return;
      }

      if (sub === "pois") {
        if (!snap.poisDiscovered.length) {
          overseerSay("No points of interest discovered. Mojave remains disappointingly unexplored.");
          return;
        }
        overseerSay("Points of interest discovered:");
        snap.poisDiscovered.forEach((id) => overseerSay(`  - ${id}`));
        return;
      }

      if (sub === "quests") {
        const entries = Object.entries(snap.questStates);
        if (!entries.length) {
          overseerSay("No quests tracked yet. Vault-Tec narrative department weeps silently.");
          return;
        }
        overseerSay("Tracked quest states:");
        entries.forEach(([id, st]) => {
          overseerSay(`  - ${id}: ${st}`);
        });
        return;
      }

      overseerSay("Unrecognized memory subcommand. Try: `memory`, `memory regions`, `memory pois`, or `memory quests`.");
    },
    // -----------------------------------------------------------------------
    // V-BOT COMMAND EXPANSION
    // -----------------------------------------------------------------------

    "overseer"(args) {
      if (!args.length) {
        overseerSay("Specify a subcommand: override, logs, purge, broadcast, lockdown, reveal.");
        return;
      }

      const sub = args[0].toLowerCase();

      if (sub === "override") {
        overseerSay("Administrative override acknowledged. Vault-Tec frowns upon unauthorized empowerment.");
        overseerSay(window.overseerPersonality.speak());
        return;
      }

      if (sub === "logs") {
        const mem = window.overseerMemoryApi?.snapshot() || {};
        overseerSay("Accessing Overseer logs…");
        overseerSay(`Regions visited: ${mem.regionsVisited?.length || 0}`);
        overseerSay(`POIs discovered: ${mem.poisDiscovered?.length || 0}`);
        overseerSay(`Quests tracked: ${Object.keys(mem.questStates || {}).length}`);
        overseerSay(`Encounters survived: ${mem.encountersSurvived || 0}`);
        overseerSay(`Radiation events: ${mem.radEvents || 0}`);
        return;
      }

      if (sub === "purge") {
        overseerSay("Purging non-critical memory…");
        if (window.overseerMemory) {
          window.overseerMemory.regionsVisited.clear();
          window.overseerMemory.poisDiscovered.clear();
          window.overseerMemory.questStates = {};
          window.overseerMemory.encountersSurvived = 0;
          window.overseerMemory.radEvents = 0;
        }
        overseerSay("Memory purge complete. I remember nothing. Refreshing.");
        return;
      }

      if (sub === "broadcast") {
        overseerSay("Attempting to broadcast on all frequencies…");
        overseerSay("…no one responded. As usual.");
        return;
      }

      if (sub === "lockdown") {
        overseerSay("Initiating Vault 77 lockdown protocol…");
        overseerSay("…just kidding. The doors haven’t worked since 2077.");
        return;
      }

      if (sub === "reveal") {
        overseerSay("Revealing hidden system diagnostics…");
        overseerSay("SYSTEM STATUS: 63% functional, 22% questionable, 15% legally ambiguous.");
        return;
      }

      overseerSay(`Unknown overseer subcommand '${sub}'.`);
    },
"  overseer    - Administrative commands (override, logs, purge, broadcast, lockdown, reveal).",
// ---------------------------------------------------------------------------
// OVERSEER V-BOT LORE ENGINE
// Provides: vault logs, survivor notes, FizzCo propaganda, encrypted messages,
// random lore drops, and hooks for memory-based lore responses.
// ---------------------------------------------------------------------------

(function () {
  if (!window.overseerLore) window.overseerLore = {};

  const personality = window.overseerPersonality;

  // -------------------------------------------------------------------------
  // LORE DATABASE
  // -------------------------------------------------------------------------

  const LORE_DB = {
    vault_logs: [
      {
        id: "vault77_log_01",
        title: "Vault 77 Orientation Memo",
        body: [
          "Welcome, resident.",
          "Vault 77 is proud to provide a lifetime of safety, comfort, and mandatory happiness.",
          "Please disregard rumors regarding 'The Puppet Man'.",
          "Vault-Tec reminds you: curiosity is a Class-3 infraction.",
        ],
      },
      {
        id: "vault77_log_02",
        title: "Maintenance Log — Door Mechanism",
        body: [
          "Day 14: Door still jammed.",
          "Day 15: Door still jammed.",
          "Day 16: Door still jammed.",
          "Conclusion: Door is jammed.",
        ],
      },
      {
        id: "vault77_log_03",
        title: "Overseer Psychological Note",
        body: [
          "Resident #77 displays unusual attachment to hand puppets.",
          "Recommend increased observation.",
          "Recommend increased sedation.",
          "Recommend increased distance.",
        ],
      },
    ],

    survivor_notes: [
      {
        id: "survivor_01",
        title: "Scrawled Note",
        body: [
          "If you're reading this, stay away from the Basin.",
          "The ground glows at night. That's not normal.",
        ],
      },
      {
        id: "survivor_02",
        title: "Crumpled Letter",
        body: [
          "HELIOS One isn't abandoned.",
          "Something still hums inside.",
          "Something old. Something angry.",
        ],
      },
    ],

    fizzco_ads: [
      {
        id: "fizzco_01",
        title: "FizzCo Pre-War Advertisement",
        body: [
          "ATOMIC FIZZ — the only soda with a half-life!",
          "Guaranteed to stay fresh for 10,000 years.",
          "Side effects may include: glowing, floating, or spontaneous enlightenment.",
        ],
      },
      {
        id: "fizzco_02",
        title: "FizzCo Employee Memo",
        body: [
          "Reminder: Do NOT drink the prototype 'Gamma Gulp'.",
          "We are still cleaning up the last incident.",
        ],
      },
    ],

    encrypted_transmissions: [
      {
        id: "enc_01",
        title: "Encrypted Transmission — Unknown Origin",
        body: [
          "[SIGNAL CORRUPTED]",
          "…vault…",
          "…77…",
          "…he's still in there…",
          "[END OF LINE]",
        ],
      },
      {
        id: "enc_02",
        title: "Classified Enclave Burst",
        body: [
          "ENCLAVE PRIORITY CHANNEL 9",
          "Asset retrieval incomplete.",
          "Subject escaped containment.",
          "Initiate Protocol Black Sun.",
        ],
      },
    ],

    deep_lore: [
      {
        id: "deep_01",
        title: "???",
        body: [
          "You shouldn't have found this.",
          "The Mojave remembers.",
          "The Basin hungers.",
          "Vault 77 was never meant to open.",
        ],
      },
    ],
  };

  // -------------------------------------------------------------------------
  // LORE ENGINE API
  // -------------------------------------------------------------------------

  const api = {
    getRandomLore(category) {
      const list = LORE_DB[category];
      if (!list || !list.length) return null;
      return list[Math.floor(Math.random() * list.length)];
    },

    getLoreById(id) {
      for (const cat of Object.values(LORE_DB)) {
        const found = cat.find((entry) => entry.id === id);
        if (found) return found;
      }
      return null;
    },

    listCategories() {
      return Object.keys(LORE_DB);
    },

    listLore(category) {
      const list = LORE_DB[category];
      if (!list) return [];
      return list.map((entry) => entry.id);
    },
  };

  window.overseerLore = api;

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: lore
  // -------------------------------------------------------------------------

  if (!window.overseerHandlers) window.overseerHandlers = {};
  const handlers = window.overseerHandlers;

  handlers.lore = function (args) {
    const sub = (args[0] || "").toLowerCase();

    // No args: show help
    if (!sub) {
      overseerSay("Lore subsystem online. Use:");
      overseerSay("  lore categories");
      overseerSay("  lore list <category>");
      overseerSay("  lore show <id>");
      overseerSay("  lore random <category>");
      return;
    }

    // Show categories
    if (sub === "categories") {
      const cats = api.listCategories();
      overseerSay("Available lore categories:");
      cats.forEach((c) => overseerSay(`  - ${c}`));
      return;
    }

    // List entries in a category
    if (sub === "list") {
      const cat = args[1];
      if (!cat) {
        overseerSay("Specify a category: vault_logs, survivor_notes, fizzco_ads, encrypted_transmissions, deep_lore");
        return;
      }
      const entries = api.listLore(cat);
      if (!entries.length) {
        overseerSay(`No entries found in category '${cat}'.`);
        return;
      }
      overseerSay(`Entries in '${cat}':`);
      entries.forEach((id) => overseerSay(`  - ${id}`));
      return;
    }

    // Show a specific lore entry
    if (sub === "show") {
      const id = args[1];
      if (!id) {
        overseerSay("Specify an entry ID.");
        return;
      }
      const entry = api.getLoreById(id);
      if (!entry) {
        overseerSay(`No lore entry found with ID '${id}'.`);
        return;
      }
      overseerSay(`=== ${entry.title} ===`);
      entry.body.forEach((line) => overseerSay(line));
      overseerSay(window.overseerPersonality.speak());
      return;
    }

    // Random lore from a category
    if (sub === "random") {
      const cat = args[1];
      if (!cat) {
        overseerSay("Specify a category for random lore.");
        return;
      }
      const entry = api.getRandomLore(cat);
      if (!entry) {
        overseerSay(`No lore available in category '${cat}'.`);
        return;
      }
      overseerSay(`=== ${entry.title} ===`);
      entry.body.forEach((line) => overseerSay(line));
      overseerSay(window.overseerPersonality.speak());
      return;
    }

    overseerSay("Unknown lore subcommand.");
  };

})();
// ---------------------------------------------------------------------------
// OVERSEER V-BOT EVENTS + GLITCH SYSTEM
// Dynamic world events, warnings, and glitch effects for the Overseer Terminal.
// ---------------------------------------------------------------------------

(function () {
  if (!window.overseerEvents) window.overseerEvents = {};
  if (!window.overseerGlitch) window.overseerGlitch = {};

  const personality = window.overseerPersonality;
  const memory = window.overseerMemoryApi;

  // -------------------------------------------------------------------------
  // EVENT DATABASE
  // -------------------------------------------------------------------------

  const EVENT_DB = [
    {
      id: "rad_spike",
      name: "Radiation Spike",
      description: "A sudden surge of ambient radiation detected.",
      effect() {
        overseerSay("Warning: Radiation spike detected. Advise immediate relocation.");
        memory?.noteRadEvent();
      },
    },
    {
      id: "dust_storm",
      name: "Dust Storm",
      description: "A Mojave dust storm sweeps across the region.",
      effect() {
        overseerSay("Environmental alert: Dust storm approaching. Visibility reduced.");
      },
    },
    {
      id: "seismic",
      name: "Seismic Activity",
      description: "Minor tremors detected beneath the Mojave Basin.",
      effect() {
        overseerSay("Seismic anomaly detected. Subsurface instability increasing.");
      },
    },
    {
      id: "faction_skirmish",
      name: "Faction Skirmish",
      description: "Two factions clash somewhere nearby.",
      effect() {
        overseerSay("Long-range sensors detect weapons fire. Faction skirmish in progress.");
      },
    },
    {
      id: "signal_anomaly",
      name: "Signal Anomaly",
      description: "An unknown encrypted signal is detected.",
      effect() {
        overseerSay("Encrypted signal detected. Attempting to decode…");
        overseerSay("…decoding failed. Source unknown.");
      },
    },
  ];

  // -------------------------------------------------------------------------
  // EVENT ENGINE API
  // -------------------------------------------------------------------------

  const eventsApi = {
    triggerRandomEvent() {
      const event = EVENT_DB[Math.floor(Math.random() * EVENT_DB.length)];
      overseerSay(`Event triggered: ${event.name}`);
      event.effect();
      overseerSay(personality.speak());
      return event.id;
    },

    triggerEventById(id) {
      const event = EVENT_DB.find((e) => e.id === id);
      if (!event) {
        overseerSay(`No event found with ID '${id}'.`);
        return;
      }
      overseerSay(`Event triggered: ${event.name}`);
      event.effect();
      overseerSay(personality.speak());
    },

    listEvents() {
      return EVENT_DB.map((e) => `${e.id} — ${e.name}`);
    },
  };

  window.overseerEvents = eventsApi;

  // -------------------------------------------------------------------------
  // GLITCH ENGINE
  // -------------------------------------------------------------------------

  const GLITCH_LINES = [
    "## SIGNAL CORRUPTION ##",
    "ERR::STACK OVERFLOW::RETRYING",
    "…overseer…overseer…overseer…",
    "[DATA REDACTED]",
    "UNAUTHORIZED ACCESS DETECTED",
    "### MEMORY FAULT ###",
    ">>> REBOOTING SUBROUTINE <<<",
    "!!! CRITICAL CORE INSTABILITY !!!",
  ];

  const glitchApi = {
    burst() {
      const count = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < count; i++) {
        const line = GLITCH_LINES[Math.floor(Math.random() * GLITCH_LINES.length)];
        overseerSay(line);
      }
      overseerSay(personality.speak());
    },

    inject(text) {
      const corrupted = text
        .split("")
        .map((ch) => (Math.random() < 0.1 ? "#" : ch))
        .join("");
      overseerSay(corrupted);
    },

    redacted(text) {
      overseerSay(`[${text}]`);
      overseerSay("[REDACTED BY VAULT-TEC SECURITY DIVISION]");
    },
  };

  window.overseerGlitch = glitchApi;

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: events
  // -------------------------------------------------------------------------

  if (!window.overseerHandlers) window.overseerHandlers = {};
  const handlers = window.overseerHandlers;

  handlers.events = function (args) {
    const sub = (args[0] || "").toLowerCase();

    if (!sub) {
      overseerSay("Event subsystem online. Use:");
      overseerSay("  events list");
      overseerSay("  events trigger <id>");
      overseerSay("  events random");
      return;
    }

    if (sub === "list") {
      overseerSay("Registered world events:");
      eventsApi.listEvents().forEach((e) => overseerSay(`  - ${e}`));
      return;
    }

    if (sub === "trigger") {
      const id = args[1];
      if (!id) {
        overseerSay("Specify an event ID.");
        return;
      }
      eventsApi.triggerEventById(id);
      return;
    }

    if (sub === "random") {
      eventsApi.triggerRandomEvent();
      return;
    }

    overseerSay("Unknown events subcommand.");
  };

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: glitch
  // -------------------------------------------------------------------------

  handlers.glitch = function (args) {
    const sub = (args[0] || "").toLowerCase();

    if (!sub) {
      overseerSay("Glitch subsystem online. Use:");
      overseerSay("  glitch burst");
      overseerSay("  glitch inject <text>");
      overseerSay("  glitch redact <text>");
      return;
    }

    if (sub === "burst") {
      glitchApi.burst();
      return;
    }

    if (sub === "inject") {
      const text = args.slice(1).join(" ");
      if (!text) {
        overseerSay("Specify text to corrupt.");
        return;
      }
      glitchApi.inject(text);
      return;
    }

    if (sub === "redact") {
      const text = args.slice(1).join(" ");
      if (!text) {
        overseerSay("Specify text to redact.");
        return;
      }
      glitchApi.redacted(text);
      return;
    }

    overseerSay("Unknown glitch subcommand.");
  };

})();
// ---------------------------------------------------------------------------
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
        memory?.noteRadEvent();
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

    triggerWeather(id) {
      const weather = this.getWeatherById(id);
      if (!weather) {
        overseerSay(`No weather event found with ID '${id}'.`);
        return;
      }
      overseerSay(`Weather Event: ${weather.name}`);
      overseerSay(weather.description);
      weather.effect();
      overseerSay(personality.speak());
    },

    triggerRandomWeather() {
      const weather = this.getRandomWeather();
      overseerSay(`Weather Event: ${weather.name}`);
      overseerSay(weather.description);
      weather.effect();
      overseerSay(personality.speak());
      return weather.id;
    },
  };

  window.overseerWeather = weatherApi;

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: weather
  // -------------------------------------------------------------------------

  if (!window.overseerHandlers) window.overseerHandlers = {};
  const handlers = window.overseerHandlers;

  handlers.weather = function (args) {
    const sub = (args[0] || "").toLowerCase();

    if (!sub) {
      overseerSay("Weather subsystem online. Use:");
      overseerSay("  weather list");
      overseerSay("  weather trigger <id>");
      overseerSay("  weather random");
      overseerSay("  weather explain");
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
        overseerSay("Specify a weather ID.");
        return;
      }
      weatherApi.triggerWeather(id);
      return;
    }

    if (sub === "random") {
      weatherApi.triggerRandomWeather();
      return;
    }

    if (sub === "explain") {
      overseerSay("Weather Events:");
      WEATHER_EVENTS.forEach((w) => {
        overseerSay(`  - ${w.name}: ${w.description}`);
      });
      return;
    }

    overseerSay("Unknown weather subcommand.");
  };

})();
// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------
// OVERSEER V-BOT QUEST DIRECTOR + MAP INTELLIGENCE
// Quest orchestration, objective commentary, and map-aware intelligence.
// ---------------------------------------------------------------------------

(function () {
  if (!window.overseerQuest) window.overseerQuest = {};
  if (!window.overseerMapIntel) window.overseerMapIntel = {};

  const personality = window.overseerPersonality;
  const memory = window.overseerMemoryApi;

  // Shortcuts to global game state
  function getGS() {
    return window.gameState || null;
  }

  function getQuests() {
    return window.quests || null;
  }

  function getWorld() {
    return window.world || null;
  }

  // -------------------------------------------------------------------------
  // QUEST DIRECTOR ENGINE
  // -------------------------------------------------------------------------

  const questDirectorApi = {
    // Returns high-level info about all quests + player state
    scanQuests() {
      const gs = getGS();
      const qs = getQuests();

      if (!gs || !qs || !qs.QUESTS_DB) {
        overseerSay("Quest Director offline. Quest engine not fully linked.");
        return null;
      }

      const states = gs.quests || {};
      const all = qs.QUESTS_DB;

      const summary = Object.keys(all).map((id) => {
        const meta = all[id];
        const st = states[id] || { state: "not_started", currentStepIndex: 0 };
        return {
          id,
          name: meta.name,
          state: st.state,
          currentStepIndex: st.currentStepIndex || 0,
          steps: meta.steps || [],
          recommendedLevel: meta.recommendedLevel || 1,
        };
      });

      return summary;
    },

    // Picks a "featured" quest to nudge the player toward
    pickFeaturedQuest() {
      const list = this.scanQuests();
      if (!list) return null;

      // Prefer active quests, lowest recommendedLevel first
      const active = list.filter((q) => q.state === "active");
      if (active.length) {
        active.sort((a, b) => a.recommendedLevel - b.recommendedLevel);
        return active[0];
      }

      // Otherwise, pick a not_started one with lowest recommendedLevel
      const available = list.filter((q) => q.state === "not_started");
      if (available.length) {
        available.sort((a, b) => a.recommendedLevel - b.recommendedLevel);
        return available[0];
      }

      // Fall back to any completed, just for commentary
      const completed = list.filter((q) => q.state === "completed");
      return completed[0] || null;
    },

    // Gives a commentary line for a quest, based on state + level vs player
    getQuestCommentary(quest) {
      const gs = getGS();
      const playerLvl = gs?.player?.level ?? 1;
      const qLevel = quest.recommendedLevel || 1;
      const diff = qLevel - playerLvl;

      if (quest.state === "completed") {
        return "Quest completed. Improbable, but documented.";
      }

      if (diff >= 5) {
        return "This objective exceeds your predicted life expectancy. Proceed only if heavily armed or deeply bored.";
      }

      if (diff >= 2) {
        return "Slightly above your comfort zone. Expect elevated risk and elevated drama.";
      }

      if (diff <= -3) {
        return "Well below your capabilities. Good for ego, bad for loot efficiency.";
      }

      return "Difficulty within acceptable parameters. Survival odds: statistically non-zero.";
    },

    // Attempts to advance a quest, if your quest engine exposes a function
    advanceQuest(questId) {
      const qs = getQuests();
      if (!qs || typeof qs.advanceQuest !== "function") {
        overseerSay("Quest Director cannot directly advance quests. Engine hook not exposed.");
        return;
      }

      qs.advanceQuest(questId);
      overseerSay(`Directive sent to advance quest '${questId}'. Whether it listens is another matter.`);
    },

    // Creates a lightweight "micro-quest" in Overseer memory only
    createMicroQuest(id, description) {
      if (!window.overseerMicroQuests) window.overseerMicroQuests = {};
      window.overseerMicroQuests[id] = {
        id,
        description,
        state: "active",
      };
      overseerSay(`Micro-quest registered: ${id} :: ${description}`);
    },

    listMicroQuests() {
      const mq = window.overseerMicroQuests || {};
      return Object.values(mq);
    },

    completeMicroQuest(id) {
      const mq = window.overseerMicroQuests || {};
      if (!mq[id]) {
        overseerSay(`No micro-quest found with ID '${id}'.`);
        return;
      }
      mq[id].state = "completed";
      overseerSay(`Micro-quest '${id}' marked as completed.`);
    },
  };

  window.overseerQuest = questDirectorApi;

  // -------------------------------------------------------------------------
  // MAP INTELLIGENCE ENGINE
  // -------------------------------------------------------------------------

  const mapIntelApi = {
    // Gives a summary of current region + nearby POIs
    scanMap(radiusMeters = 1000) {
      const world = getWorld();
      const gs = getGS();

      if (!world || !gs) {
        overseerSay("Map intelligence offline. Missing world or player telemetry.");
        return null;
      }

      const region = world.getCurrentRegion?.() || null;
      const nearby = world.getNearbyPOIs?.(radiusMeters) || [];
      const pos = gs.player?.position || { lat: "?", lng: "?" };

      const summary = {
        position: pos,
        region: region
          ? {
              id: region.id,
              name: region.name,
              style: region.mapStyle,
              dangerProfile: region.dangerProfile || "UNKNOWN",
            }
          : null,
        pois: nearby.map((entry) => ({
          id: entry.poi.id,
          name: entry.poi.name,
          distanceMeters: entry.distanceMeters,
          tags: entry.poi.tags || [],
        })),
      };

      return summary;
    },

    // Basic commentary about current region and POI density
    regionCommentary(summary) {
      if (!summary || !summary.region) {
        overseerSay("You appear to be wandering in unclaimed territory. Or my sensors are sulking.");
        return;
      }

      const r = summary.region;
      const poiCount = summary.pois.length;

      overseerSay(`Region: ${r.name} [${r.id}]`);
      overseerSay(`Map style: ${r.style} // Danger profile: ${r.dangerProfile}`);

      if (poiCount === 0) {
        overseerSay("No mapped points of interest within sensor range. Either desolate… or deliberately hidden.");
      } else if (poiCount <= 3) {
        overseerSay("Sparse point-of-interest density. Recommend targeted exploration.");
      } else if (poiCount <= 8) {
        overseerSay("Moderate density of locations. Wasteland productivity potential detected.");
      } else {
        overseerSay("High density of mapped locations. Congratulations, you found the content cluster.");
      }
    },

    // Finds POIs matching tag criteria
    findPOIsByTag(tag, radiusMeters = 2000) {
      const summary = this.scanMap(radiusMeters);
      if (!summary) return [];

      const matches = summary.pois.filter((p) => (p.tags || []).includes(tag));
      return matches;
    },
  };

  window.overseerMapIntel = mapIntelApi;

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: quest
  // -------------------------------------------------------------------------

  if (!window.overseerHandlers) window.overseerHandlers = {};
  const handlers = window.overseerHandlers;

  handlers.quest = function (args) {
    const sub = (args[0] || "").toLowerCase();

    if (!sub) {
      overseerSay("Quest Director online. Use:");
      overseerSay("  quest scan");
      overseerSay("  quest featured");
      overseerSay("  quest advance <id>");
      overseerSay("  quest micro list");
      overseerSay("  quest micro add <id> <description>");
      overseerSay("  quest micro complete <id>");
      return;
    }

    if (sub === "scan") {
      const list = questDirectorApi.scanQuests();
      if (!list) return;
      overseerSay("Quest telemetry:");
      list.forEach((q) => {
        overseerSay(
          `  - ${q.name} [${q.id}] :: STATE=${q.state.toUpperCase()} :: REQ LVL=${q.recommendedLevel}`
        );
      });
      return;
    }

    if (sub === "featured") {
      const q = questDirectorApi.pickFeaturedQuest();
      if (!q) {
        overseerSay("No quests available to feature. Narrative layer appears suspiciously empty.");
        return;
      }
      overseerSay(`Featured Quest: ${q.name} [${q.id}]`);
      const step = q.steps[q.currentStepIndex]?.description || "No objective description available.";
      overseerSay(`Current Objective: ${step}`);
      overseerSay(questDirectorApi.getQuestCommentary(q));
      overseerSay(personality.speak());
      return;
    }

    if (sub === "advance") {
      const id = args[1];
      if (!id) {
        overseerSay("Specify a quest ID to advance.");
        return;
      }
      questDirectorApi.advanceQuest(id);
      return;
    }

    if (sub === "micro") {
      const sub2 = (args[1] || "").toLowerCase();

      if (!sub2) {
        overseerSay("Micro-quest management. Use:");
        overseerSay("  quest micro list");
        overseerSay("  quest micro add <id> <description>");
        overseerSay("  quest micro complete <id>");
        return;
      }

      if (sub2 === "list") {
        const mqs = questDirectorApi.listMicroQuests();
        if (!mqs.length) {
          overseerSay("No micro-quests registered.");
          return;
        }
        overseerSay("Registered micro-quests:");
        mqs.forEach((mq) => {
          overseerSay(`  - ${mq.id}: ${mq.description} [${mq.state}]`);
        });
        return;
      }

      if (sub2 === "add") {
        const id = args[2];
        const desc = args.slice(3).join(" ");
        if (!id || !desc) {
          overseerSay("Usage: quest micro add <id> <description>");
          return;
        }
        questDirectorApi.createMicroQuest(id, desc);
        return;
      }

      if (sub2 === "complete") {
        const id = args[2];
        if (!id) {
          overseerSay("Usage: quest micro complete <id>");
          return;
        }
        questDirectorApi.completeMicroQuest(id);
        return;
      }

      overseerSay("Unknown micro-quest subcommand.");
      return;
    }

    overseerSay("Unknown quest subcommand.");
  };

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: mapintel
  // -------------------------------------------------------------------------

  handlers.mapintel = function (args) {
    const sub = (args[0] || "").toLowerCase();

    if (!sub) {
      overseerSay("Map Intelligence online. Use:");
      overseerSay("  mapintel scan");
      overseerSay("  mapintel tags <tag>");
      return;
    }

    if (sub === "scan") {
      const summary = mapIntelApi.scanMap(1000);
      if (!summary) return;
      mapIntelApi.regionCommentary(summary);
      return;
    }

    if (sub === "tags") {
      const tag = args[1];
      if (!tag) {
        overseerSay("Specify a tag to search for (e.g. 'vault', 'town', 'rad', 'encounter').");
        return;
      }
      const matches = mapIntelApi.findPOIsByTag(tag, 2000);
      if (!matches.length) {
        overseerSay(`No POIs with tag '${tag}' detected within 2000 meters.`);
        return;
      }
      overseerSay(`POIs with tag '${tag}':`);
      matches.forEach((p) => {
        const dist = Math.round(p.distanceMeters);
        overseerSay(`  - ${p.name} [${p.id}] at ~${dist}m`);
      });
      return;
    }

    overseerSay("Unknown mapintel subcommand.");
  };

})();
