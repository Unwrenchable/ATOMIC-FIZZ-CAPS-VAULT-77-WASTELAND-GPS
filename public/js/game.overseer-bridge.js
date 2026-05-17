// _Game.overseer-bridge.js
// Bridges the Overseer Terminal to the main game engine.
// Listens for overseer:command and emits game:event back.

(function () {
  "use strict";

  // Ensure a global game namespace exists
window.Game = window.Game || {};
const _Game = window.Game;
  // ========= WORLD INTERFACE =========
  // Provides window.world using real world simulation systems when available,
  // with safe fallbacks for missing implementations.
  // Fallback order:
  // 1. Real world state (overseerWorldState + overseerRegions)
  // 2. Player location data (_Game.player.location)
  // 3. Default "mojave_core" region
  window.world = window.world || {
    getCurrentRegion: function () {
      // Priority 1: Use real world state if available
      if (window.overseerWorldState && typeof window.overseerWorldState.getRegion === "function") {
        const regionId = window.overseerWorldState.getRegion();
        if (regionId && window.overseerRegions && typeof window.overseerRegions.get === "function") {
          return window.overseerRegions.get(regionId) || { id: regionId, name: regionId };
        }
        return { id: regionId || "mojave_core", name: "Unknown Region" };
      }
      // Priority 2: Fallback to player location
      const playerLoc = _Game.player?.location;
      if (playerLoc && playerLoc.regionId) {
        return { id: playerLoc.regionId, name: playerLoc.name || "Unknown" };
      }
      // Priority 3: Default fallback region
      return { id: "mojave_core", name: "Mojave Core" };
    },

    getNearbyPOIs: function (radius) {
      // Try to use _Game.getNearbyPOIs if available
      if (typeof _Game.getNearbyPOIs === "function") {
        return _Game.getNearbyPOIs(radius);
      }
      // Try worldmap module
      if (window.Game?.modules?.worldmap?.getNearbyPOIs) {
        return window.Game.modules.worldmap.getNearbyPOIs(radius);
      }
      // Return empty array as safe fallback
      return [];
    },

    getPlayerLocation: function () {
      return _Game.player?.location || { id: "unknown", name: "Unknown", lat: null, lng: null };
    },

    // Expose world simulation subsystems for advanced usage
    get state() { return window.overseerWorldState; },
    get regions() { return window.overseerRegions; },
    get factions() { return window.overseerFaction; },
    get encounters() { return window.overseerEncounters; },
    get weather() { return window.overseerWeather; },
    get timeline() { return window.overseerTimeline; },
    get anomalies() { return window.overseerAnomalies; },
    get loot() { return window.overseerLoot; },
    get microquests() { return window.overseerMicroquests; },
    get npcTraits() { return window.overseerNpcTraits; }
  };

  // ========= BASIC PLAYER / WORLDSTATE STUBS =========
  // Replace these with your real implementations.

  _Game.player = _Game.player || {
    hp: 100,
    rads: 0,
    caps: 0,
    faction: "UNALIGNED",
    location: {
      id: "unknown",
      name: "Unknown Location",
      lat: null,
      lng: null
    }
  };

  _Game.inventory = _Game.inventory || [
    // "10mm Pistol",
    // "Vault 77 Jumpsuit",
    // "Stimpak"
  ];

  _Game.quests = _Game.quests || {
    active: [
      // { id: "vault77_main_01", title: "AWAKENING", state: "active", step: "Leave the Vault." }
    ]
  };

  _Game.getNearbyPOIs = _Game.getNearbyPOIs || function () {
    // You can wire this to your map engine using player.location and fallout_pois.json
    // Return objects shaped like: { id, name, distance }
    return [];
  };

  _Game.vbotHandle = _Game.vbotHandle || function (text) {
    // Simple placeholder V-BOT response:
    return text
      ? "ACKNOWLEDGED: " + text
      : "ONLINE. AWAITING DIRECTIVES.";
  };

  // ========= EMIT HELPERS: GAME → TERMINAL =========

  function sendGameEvent(type, payload) {
    window.dispatchEvent(
      new CustomEvent("game:event", {
        detail: { type, payload }
      })
    );
  }

  _Game.sendStatusToTerminal = function () {
    sendGameEvent("status", {
      hp: _Game.player.hp,
      rads: _Game.player.rads,
      caps: _Game.player.caps,
      faction: _Game.player.faction
    });
  };

  _Game.sendInventoryToTerminal = function () {
    sendGameEvent("inventory", {
      items: _Game.inventory.slice()
    });
  };

  _Game.sendMapInfoToTerminal = function () {
    const nearby = _Game.getNearbyPOIs() || [];
    sendGameEvent("map_scan", { nearby });
  };

  _Game.sendQuestLogToTerminal = function () {
    const active = Array.isArray(_Game.quests.active)
      ? _Game.quests.active
      : [];
    sendGameEvent("quest_log", { quests: active });
  };

  _Game.sendLocationToTerminal = function () {
    sendGameEvent("location", _Game.player.location || {});
  };

  _Game.sendCapsToTerminal = function () {
    sendGameEvent("caps", { caps: _Game.player.caps });
  };

  _Game.sendVbotToTerminal = function (message) {
    sendGameEvent("vbot", { message });
  };

  _Game.sendAlertToTerminal = function (message) {
    sendGameEvent("alert", { message });
  };

  _Game.setRedMenaceMode = function (active) {
    sendGameEvent("rm_state", { active: !!active });
  };

  _Game.configureMobileControls = function (config) {
    sendGameEvent("mobile_controls", config || {});
  };

  // ========= CORE HANDLETERMINALCOMMAND =========

  _Game.handleTerminalCommand = function (type, payload) {
    switch (type) {
      case "terminal_ready":
        // Terminal booted; you can push initial state here if you want.
        _Game.sendStatusToTerminal();
        break;

      case "status":
        _Game.sendStatusToTerminal();
        break;

      case "inventory":
        _Game.sendInventoryToTerminal();
        break;

      case "map_scan":
        _Game.sendMapInfoToTerminal();
        break;

      case "quest_log":
        _Game.sendQuestLogToTerminal();
        break;

      case "location":
        _Game.sendLocationToTerminal();
        break;

      case "caps":
        _Game.sendCapsToTerminal();
        break;

      case "vbot": {
        const text = (payload && payload.text) || "";
        const reply = _Game.vbotHandle(text);
        _Game.sendVbotToTerminal(reply);
        break;
      }

      case "rm_mode":
        _Game.setRedMenaceMode(payload && payload.active);
        break;

      case "rm_input":
        // payload: { action: "left" | "right" | "fire" }
        if (window.redMenace && payload && payload.action) {
          window.redMenace.handleInput(payload.action);
        }
        break;

      case "mobile_button":
        // payload: { label }
        // Optional: route to whatever mobile-only action you want.
        break;

      case "mobile_dpad":
        // payload: { dir: "north" | "south" | "east" | "west" }
        // Optional: route dpad input into game movement or minigame logic.
        break;

      case "mobile_numpad":
        // payload: { value }
        // Optional: route to door codes, safes, etc.
        break;

      case "unknown":
        // payload: { raw, cmd, args }
        // Terminal already prints UNKNOWN COMMAND; game can log or use this for secrets.
        break;

      default:
        // Unknown command type; ignore or log.
        break;
    }
  };

  // ========= WIRE LISTENER: TERMINAL → GAME =========

  window.addEventListener("overseer:command", function (e) {
    const detail = e.detail || {};
    const type = detail.type;
    const payload = detail.payload || {};
    if (!type) return;
    if (typeof _Game.handleTerminalCommand === "function") {
      _Game.handleTerminalCommand(type, payload);
    }
  });

})();
