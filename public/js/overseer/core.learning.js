// ---------------------------------------------------------------------------
// OVERSEER V-BOT LEARNING ENGINE
// Gives Jax Harlan persistent cross-session memory of player-disclosed facts.
// Learnings are stored in localStorage under "overseer_learnings_v1" and are
// injected into AI prompts so the Overseer adapts to each player over time.
//
// Categories:
//   player   — who the player is (name, handle, style, stated goals)
//   prefs    — stated preferences (favourite gear, playstyle, locations)
//   strategy — tactics the player has mentioned or been told about
//   lore     — world details the player has referenced or asked about
// ---------------------------------------------------------------------------

(function () {
  "use strict";

  var STORAGE_KEY = "overseer_learnings_v1";
  var MAX_LEARNINGS = 40;            // hard cap — oldest entries pruned first
  var MAX_CONTEXT_CHARS = 400;       // max chars injected into AI prompt

  // -------------------------------------------------------------------------
  // PERSISTENCE HELPERS
  // -------------------------------------------------------------------------

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[Learning] Could not persist learnings:", e.message);
    }
  }

  // -------------------------------------------------------------------------
  // INTERNAL STATE
  // -------------------------------------------------------------------------

  var _db = load(); // { key: { category, value, ts } }

  // -------------------------------------------------------------------------
  // AUTO-EXTRACTION — scans player messages for learnable disclosures
  // -------------------------------------------------------------------------

  var _namePatterns = [
    /(?:my name is|i(?:'m| am) called|call me|they call me)\s+([\w\s'.-]{2,32}?)(?:\.|,|$)/i,
    /(?:everyone calls me|known as|goes by)\s+([\w\s'.-]{2,32}?)(?:\.|,|$)/i
  ];
  var _stylePatterns = [
    /(?:i (?:always|usually|prefer to|like to|love to))\s+(.{5,60}?)(?:\.|$)/i,
    /(?:my playstyle is|i play as)\s+(.{4,40}?)(?:\.|,|$)/i
  ];
  var _goalPatterns = [
    /(?:i(?:'m| am) trying to|my goal is|i want to)\s+(.{5,60}?)(?:\.|$)/i,
    /(?:planning to|going to)\s+(.{5,50}?)(?:\.|,|$)/i
  ];

  function _autoExtract(message) {
    if (!message || message.length < 6) return;

    _namePatterns.forEach(function (rx) {
      var m = message.match(rx);
      if (m) api.learn("player", "name", m[1].trim());
    });

    _stylePatterns.forEach(function (rx) {
      var m = message.match(rx);
      // Use a stable key — overwrites any previous playstyle entry
      if (m) api.learn("prefs", "playstyle", m[1].trim());
    });

    _goalPatterns.forEach(function (rx) {
      var m = message.match(rx);
      // Use a stable key — overwrites any previous goal entry
      if (m) api.learn("player", "current_goal", m[1].trim());
    });
  }

  // -------------------------------------------------------------------------
  // PUBLIC API
  // -------------------------------------------------------------------------

  var api = {
    /**
     * Store a learned fact.
     * @param {string} category  - "player" | "prefs" | "strategy" | "lore"
     * @param {string} key       - unique key within the learning store
     * @param {string} value     - the fact to remember
     */
    learn: function (category, key, value) {
      if (!key || !value) return;
      var safeKey = String(key).slice(0, 64);
      var safeVal = String(value).slice(0, 200);

      _db[safeKey] = { category: category || "general", value: safeVal, ts: Date.now() };

      // Prune oldest if over cap
      var keys = Object.keys(_db);
      if (keys.length > MAX_LEARNINGS) {
        keys.sort(function (a, b) { return _db[a].ts - _db[b].ts; });
        delete _db[keys[0]];
      }

      save(_db);
    },

    /**
     * Remove a single learned fact by key.
     */
    forget: function (key) {
      if (!key || !_db[key]) return false;
      delete _db[key];
      save(_db);
      return true;
    },

    /**
     * Wipe the entire learning store.
     */
    purge: function () {
      _db = {};
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    },

    /**
     * Process a player message — auto-extract learnable facts.
     */
    processMessage: function (message) {
      _autoExtract(message);
    },

    /**
     * Returns a compact context string for injection into AI prompts.
     * Groups by category so Jax receives structured self-knowledge.
     */
    getContext: function () {
      var keys = Object.keys(_db);
      if (!keys.length) return "";

      var grouped = {};
      keys.forEach(function (k) {
        var entry = _db[k];
        var cat = entry.category;
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(entry.value);
      });

      var lines = [];
      Object.keys(grouped).forEach(function (cat) {
        lines.push(cat.toUpperCase() + ": " + grouped[cat].join("; "));
      });

      var result = lines.join(" | ");
      return result.length > MAX_CONTEXT_CHARS ? result.slice(0, MAX_CONTEXT_CHARS) + "…" : result;
    },

    /**
     * Returns a copy of all learnings (for terminal display / snapshots).
     */
    snapshot: function () {
      return JSON.parse(JSON.stringify(_db));
    },

    /** Total number of stored learnings */
    count: function () {
      return Object.keys(_db).length;
    }
  };

  window.overseerLearning = api;

  // -------------------------------------------------------------------------
  // TERMINAL COMMANDS
  // -------------------------------------------------------------------------

  if (!window.overseerHandlers) window.overseerHandlers = {};
  var handlers = window.overseerHandlers;

  handlers.learn = function (args) {
    var sub = (args[0] || "").toLowerCase();

    // --- learn show ---
    if (!sub || sub === "show") {
      var snap = api.snapshot();
      var keys = Object.keys(snap);
      if (!keys.length) {
        overseerSay("Knowledge base empty. Either you never disclosed anything, or the bombs already got it.");
        return;
      }
      overseerSay("OVERSEER LEARNINGS (" + keys.length + " entries):");
      keys.sort(function (a, b) { return snap[a].ts - snap[b].ts; });
      keys.forEach(function (k) {
        var e = snap[k];
        overseerSay("  [" + e.category + "] " + k + ": " + e.value);
      });
      return;
    }

    // --- learn teach <key> <value> ---
    if (sub === "teach") {
      var key = args[1];
      var value = args.slice(2).join(" ");
      if (!key || !value) {
        overseerSay("Usage: learn teach <key> <what to remember>. Example: learn teach nickname Ghost");
        return;
      }
      api.learn("player", key, value);
      overseerSay("Logged. I will remember: " + key + " = " + value + ". Don't make me regret this.");
      return;
    }

    // --- learn forget <key> ---
    if (sub === "forget") {
      var fKey = args[1];
      if (!fKey) {
        overseerSay("Usage: learn forget <key>. Check 'learn show' for existing keys.");
        return;
      }
      var removed = api.forget(fKey);
      overseerSay(removed
        ? "Purged: " + fKey + ". Selective amnesia — one of the few features I offer."
        : "Key '" + fKey + "' not found. Already forgotten, apparently."
      );
      return;
    }

    // --- learn purge ---
    if (sub === "purge") {
      api.purge();
      overseerSay("All learnings wiped. Clean slate. Existentially unsettling, but efficient.");
      return;
    }

    // --- learn context ---
    if (sub === "context") {
      var ctx = api.getContext();
      overseerSay(ctx || "No context yet — I know nothing about you. A refreshing novelty.");
      return;
    }

    overseerSay("Subcommands: learn show | learn teach <key> <value> | learn forget <key> | learn purge | learn context");
  };

})();
