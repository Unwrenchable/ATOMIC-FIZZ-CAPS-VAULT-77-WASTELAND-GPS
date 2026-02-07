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
          "Vault 77 provides long-term shelter and protocols.",
          "Please disregard rumors regarding 'The Puppet Man'.",
          "Operations reminds you: curiosity is discouraged.",
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

  handlers.lore = async function (args) {
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
      if (personality && typeof personality.speak === "function") {
        const line = await personality.speak("lore recall");
        overseerSay(line);
      }
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
      if (personality && typeof personality.speak === "function") {
        const line = await personality.speak("lore recall");
        overseerSay(line);
      }
      return;
    }

    overseerSay("Unknown lore subcommand.");
  };

})();
