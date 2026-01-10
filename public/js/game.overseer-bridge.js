// game.overseer-bridge.js
// Bridges the Overseer Terminal to the main game engine.
// Listens for overseer:command and emits game:event back.

(function () {
  "use strict";

  // Ensure a global game namespace exists
  window.game = window.game || {};
  const game = window.game;

  // ========= BASIC PLAYER / WORLDSTATE STUBS =========
  // Replace these with your real implementations.

  game.player = game.player || {
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

  game.inventory = game.inventory || [
    // "10mm Pistol",
    // "Vault 77 Jumpsuit",
    // "Stimpak"
  ];

  game.quests = game.quests || {
    active: [
      // { id: "vault77_main_01", title: "AWAKENING", state: "active", step: "Leave the Vault." }
    ]
  };

  game.getNearbyPOIs = game.getNearbyPOIs || function () {
    // You can wire this to your map engine using player.location and fallout_pois.json
    // Return objects shaped like: { id, name, distance }
    return [];
  };

  game.vbotHandle = game.vbotHandle || function (text) {
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

  game.sendStatusToTerminal = function () {
    sendGameEvent("status", {
      hp: game.player.hp,
      rads: game.player.rads,
      caps: game.player.caps,
      faction: game.player.faction
    });
  };

  game.sendInventoryToTerminal = function () {
    sendGameEvent("inventory", {
      items: game.inventory.slice()
    });
  };

  game.sendMapInfoToTerminal = function () {
    const nearby = game.getNearbyPOIs() || [];
    sendGameEvent("map_scan", { nearby });
  };

  game.sendQuestLogToTerminal = function () {
    const active = Array.isArray(game.quests.active)
      ? game.quests.active
      : [];
    sendGameEvent("quest_log", { quests: active });
  };

  game.sendLocationToTerminal = function () {
    sendGameEvent("location", game.player.location || {});
  };

  game.sendCapsToTerminal = function () {
    sendGameEvent("caps", { caps: game.player.caps });
  };

  game.sendVbotToTerminal = function (message) {
    sendGameEvent("vbot", { message });
  };

  game.sendAlertToTerminal = function (message) {
    sendGameEvent("alert", { message });
  };

  game.setRedMenaceMode = function (active) {
    sendGameEvent("rm_state", { active: !!active });
  };

  game.configureMobileControls = function (config) {
    sendGameEvent("mobile_controls", config || {});
  };

  // ========= CORE HANDLETERMINALCOMMAND =========

  game.handleTerminalCommand = function (type, payload) {
    switch (type) {
      case "terminal_ready":
        // Terminal booted; you can push initial state here if you want.
        game.sendStatusToTerminal();
        break;

      case "status":
        game.sendStatusToTerminal();
        break;

      case "inventory":
        game.sendInventoryToTerminal();
        break;

      case "map_scan":
        game.sendMapInfoToTerminal();
        break;

      case "quest_log":
        game.sendQuestLogToTerminal();
        break;

      case "location":
        game.sendLocationToTerminal();
        break;

      case "caps":
        game.sendCapsToTerminal();
        break;

      case "vbot": {
        const text = (payload && payload.text) || "";
        const reply = game.vbotHandle(text);
        game.sendVbotToTerminal(reply);
        break;
      }

      case "rm_mode":
        game.setRedMenaceMode(payload && payload.active);
        break;

      case "rm_input":
        // payload: { action: "left" | "right" | "fire" }
        // Route to your Red Menace mini-game if/when you wire it.
        // Example:
        // game.redMenace && game.redMenace.handleInput(payload.action);
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
    if (typeof game.handleTerminalCommand === "function") {
      game.handleTerminalCommand(type, payload);
    }
  });

})();
