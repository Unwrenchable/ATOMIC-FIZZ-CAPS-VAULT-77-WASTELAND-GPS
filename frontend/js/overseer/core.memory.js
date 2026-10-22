// ---------------------------------------------------------------------------
// OVERSEER V-BOT MEMORY CORE
// Tracks player history so V-Bot can reference past actions.
// ---------------------------------------------------------------------------

(function () {
  if (!window.overseerMemory) {
    window.overseerMemory = {
      regionsVisited: new Set(),
      poisDiscovered: new Set(),
      questStates: {}, // id -> lastKnownState
      encountersSurvived: 0,
      radEvents: 0,
    };
  }

  const mem = window.overseerMemory;

  // -------------------------------------------------------------------------
  // PUBLIC API
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: memory
  // -------------------------------------------------------------------------

  if (!window.overseerHandlers) window.overseerHandlers = {};
  const handlers = window.overseerHandlers;

  handlers.memory = function (args) {
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
      entries.forEach(([id, st]) => overseerSay(`  - ${id}: ${st}`));
      return;
    }

    overseerSay("Unrecognized memory subcommand. Try: `memory`, `memory regions`, `memory pois`, or `memory quests`.");
  };

  // -------------------------------------------------------------------------
  // TERMINAL COMMAND: overseer (admin)
  // -------------------------------------------------------------------------

  handlers.overseer = async function (args) {
    if (!args.length) {
      overseerSay("Specify a subcommand: override, logs, purge, broadcast, lockdown, reveal.");
      return;
    }

    const sub = args[0].toLowerCase();

    if (sub === "override") {
      overseerSay("Administrative override acknowledged. Vault-Tec frowns upon unauthorized empowerment.");
      if (window.overseerPersonality && typeof window.overseerPersonality.speak === "function") {
        const line = await window.overseerPersonality.speak("admin override");
        overseerSay(line);
      }
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
  };

})();
