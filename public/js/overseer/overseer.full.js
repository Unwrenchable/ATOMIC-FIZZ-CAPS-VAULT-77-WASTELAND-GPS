// overseer.full.js
// Fresh Overseer Terminal controller wired as a front-end to the main game.
// Assumes presence of overseer.html with #chat, #input, #send, #rmControls, mobile controls, etc.

(function () {
  "use strict";

  const Overseer = {
    initialized: false,
    chatEl: null,
    inputEl: null,
    sendBtn: null,
    rmControlsEl: null,
    rmLeftBtn: null,
    rmFireBtn: null,
    rmRightBtn: null,
    mgcRoot: null,
    mgcHeader: null,
    mgcGeneric: null,
    mgcDpad: null,
    mgcNumpad: null,
    numpadDisplay: null,
    history: [],
    historyIndex: -1
  };

  // ========= DOM UTILITIES =========

  Overseer.print = function (text = "") {
    if (!Overseer.chatEl) return;
    const line = document.createElement("div");
    line.textContent = text;
    Overseer.chatEl.appendChild(line);
    Overseer.chatEl.scrollTop = Overseer.chatEl.scrollHeight;
  };

  Overseer.clear = function () {
    if (!Overseer.chatEl) return;
    Overseer.chatEl.innerHTML = "";
  };

  Overseer.focusInput = function () {
    if (Overseer.inputEl) {
      Overseer.inputEl.focus();
    }
  };

  // ========= EVENT BRIDGE: TERMINAL → GAME =========

  function sendToGame(type, payload = {}) {
    window.dispatchEvent(
      new CustomEvent("overseer:command", {
        detail: { type, payload }
      })
    );
  }

  // ========= EVENT BRIDGE: GAME → TERMINAL =========

  window.addEventListener("game:event", function (e) {
    const data = e.detail || {};
    Overseer.handleGameEvent(data);
  });

  Overseer.handleGameEvent = function (data) {
    const type = data.type;

    switch (type) {
      case "status":
        Overseer.print("STATUS REPORT");
        if (data.payload) {
          const p = data.payload;
          if (typeof p.hp !== "undefined") {
            Overseer.print("  HP: " + p.hp);
          }
          if (typeof p.rads !== "undefined") {
            Overseer.print("  RADS: " + p.rads);
          }
          if (typeof p.caps !== "undefined") {
            Overseer.print("  CAPS: " + p.caps);
          }
          if (p.faction) {
            Overseer.print("  FACTION: " + p.faction);
          }
        }
        break;

      case "inventory":
        Overseer.print("INVENTORY");
        if (data.payload && Array.isArray(data.payload.items)) {
          if (data.payload.items.length === 0) {
            Overseer.print("  (empty)");
          } else {
            data.payload.items.forEach(function (item) {
              Overseer.print("  - " + item);
            });
          }
        }
        break;

      case "map_scan":
        Overseer.print("SCAN COMPLETE");
        if (data.payload && Array.isArray(data.payload.nearby)) {
          if (data.payload.nearby.length === 0) {
            Overseer.print("  No points of interest detected.");
          } else {
            data.payload.nearby.forEach(function (poi) {
              const name = poi.name || "UNKNOWN";
              const dist = typeof poi.distance === "number" ? poi.distance + "m" : "??m";
              Overseer.print("  • " + name + " (" + dist + ")");
            });
          }
        }
        break;

      case "quest_update":
        if (data.payload) {
          const title = data.payload.title || "UNKNOWN QUEST";
          Overseer.print("QUEST UPDATED: " + title);
          if (data.payload.step) {
            Overseer.print("  STEP: " + data.payload.step);
          }
        }
        break;

      case "quest_log":
        Overseer.print("ACTIVE QUESTS");
        if (data.payload && Array.isArray(data.payload.quests)) {
          if (data.payload.quests.length === 0) {
            Overseer.print("  (none)");
          } else {
            data.payload.quests.forEach(function (q) {
              const title = q.title || "UNKNOWN";
              const state = q.state || "active";
              Overseer.print("  - " + title + " [" + state + "]");
            });
          }
        }
        break;

      case "location":
        if (data.payload) {
          const name = data.payload.name || "UNKNOWN LOCATION";
          Overseer.print("CURRENT LOCATION: " + name);
          if (typeof data.payload.lat !== "undefined" && typeof data.payload.lng !== "undefined") {
            Overseer.print("  COORDS: " + data.payload.lat + ", " + data.payload.lng);
          }
        }
        break;

      case "caps":
        if (data.payload && typeof data.payload.caps !== "undefined") {
          Overseer.print("CAPS BALANCE: " + data.payload.caps);
        }
        break;

      case "vbot":
        if (data.payload && data.payload.message) {
          Overseer.print("V-BOT: " + data.payload.message);
        }
        break;

      case "alert":
        if (data.payload && data.payload.message) {
          Overseer.print("ALERT: " + data.payload.message);
        }
        break;

      case "rm_state":
        // Game can control Red Menace UI visibility
        if (typeof data.payload?.active === "boolean") {
          Overseer.setRedMenaceActive(data.payload.active);
        }
        break;

      case "mobile_controls":
        // Game can configure mobile controls header/visibility
        Overseer.configureMobileControls(data.payload || {});
        break;

      default:
        Overseer.print("UNKNOWN GAME EVENT: " + type);
    }
  };

  // ========= COMMAND HANDLING (USER INPUT) =========

Overseer.handleInput = async function (raw) {
  const line = raw.trim();
  if (!line) return;

  Overseer.history.push(line);
  Overseer.historyIndex = Overseer.history.length;

  Overseer.print("> " + line);

  const parts = line.split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  // 1. Known terminal commands (game-side)
  switch (cmd) {
    case "help":
      Overseer.print("AVAILABLE COMMANDS:");
      Overseer.print("  HELP       - Show this help screen");
      Overseer.print("  CLEAR      - Clear terminal buffer");
      Overseer.print("  STATUS     - Request player status");
      Overseer.print("  INVENTORY  - Request inventory list");
      Overseer.print("  MAP        - Request map scan");
      Overseer.print("  SCAN       - Alias for MAP");
      Overseer.print("  QUEST      - Request quest log");
      Overseer.print("  WHEREAMI   - Request current location");
      Overseer.print("  CAPS       - Request CAPS balance");
      Overseer.print("  VBOT ...   - Send message to V-BOT");
      Overseer.print("  RM ON/OFF  - Toggle Red Menace mode (signal only)");
      return;

    case "clear":
      Overseer.clear();
      return;

    case "status":
      sendToGame("status", {});
      return;

    case "inventory":
      sendToGame("inventory", {});
      return;

    case "map":
    case "scan":
      sendToGame("map_scan", {});
      return;

    case "quest":
      sendToGame("quest_log", {});
      return;

    case "whereami":
      sendToGame("location", {});
      return;

    case "caps":
      sendToGame("caps", {});
      return;

    case "vbot":
      sendToGame("vbot", { text: args.join(" ") });
      return;

    case "rm":
      if (args[0] && args[0].toLowerCase() === "on") {
        sendToGame("rm_mode", { active: true });
      } else if (args[0] && args[0].toLowerCase() === "off") {
        sendToGame("rm_mode", { active: false });
      } else {
        Overseer.print("USAGE: RM ON | RM OFF");
      }
      return;
  }

  // 2. Overseer.js command extensions (bridge to handlers.js)
  const handlers = window.overseerHandlers || {};
  if (handlers[cmd]) {
    // Handlers may be async, so await them
    await handlers[cmd](args);
    return;
  }

  // 3. AI fallback — ANY unknown input goes to the Overseer AI
  if (window.overseerPersonality && typeof window.overseerPersonality.speak === "function") {
    try {
      const reply = await window.overseerPersonality.speak(line);
      Overseer.print(reply);
    } catch (err) {
      Overseer.print("AI CORE ERROR: SIGNAL CORRUPTED");
      console.error("Overseer AI error:", err);
    }
    return;
  }

  // 4. Final fallback (should never hit unless AI missing)
  Overseer.print("UNKNOWN COMMAND: " + cmd.toUpperCase());
  Overseer.print("TYPE 'HELP' FOR A LIST OF COMMANDS.");
};


  // ========= RED MENACE CONTROLS =========

  Overseer.setRedMenaceActive = function (active) {
    if (!Overseer.rmControlsEl) return;
    Overseer.rmControlsEl.style.display = active ? "block" : "none";
  };

  function bindRedMenaceControls() {
    if (!Overseer.rmLeftBtn || !Overseer.rmRightBtn || !Overseer.rmFireBtn) return;

    Overseer.rmLeftBtn.addEventListener("click", function () {
      sendToGame("rm_input", { action: "left" });
    });

    Overseer.rmRightBtn.addEventListener("click", function () {
      sendToGame("rm_input", { action: "right" });
    });

    Overseer.rmFireBtn.addEventListener("click", function () {
      sendToGame("rm_input", { action: "fire" });
    });
  }

  // ========= MOBILE CONTROLS =========

  Overseer.configureMobileControls = function (config) {
    // config: { visible, header, genericButtons: [label], dpad: boolean, numpad: boolean }
    if (!Overseer.mgcRoot) return;

    const visible = !!config.visible;
    Overseer.mgcRoot.classList.toggle("hidden", !visible);
    Overseer.mgcRoot.setAttribute("aria-hidden", visible ? "false" : "true");

    if (Overseer.mgcHeader) {
      Overseer.mgcHeader.textContent = config.header || "";
    }

    if (Overseer.mgcGeneric) {
      Overseer.mgcGeneric.innerHTML = "";
      if (Array.isArray(config.genericButtons)) {
        config.genericButtons.forEach(function (label) {
          const btn = document.createElement("button");
          btn.className = "dpad-btn";
          btn.textContent = label;
          btn.addEventListener("click", function () {
            sendToGame("mobile_button", { label: label });
          });
          Overseer.mgcGeneric.appendChild(btn);
        });
      }
    }

    if (Overseer.mgcDpad) {
      Overseer.mgcDpad.style.display = config.dpad === false ? "none" : "flex";
    }

    if (Overseer.mgcNumpad) {
      const showNumpad = !!config.numpad;
      Overseer.mgcNumpad.style.display = showNumpad ? "block" : "none";
      Overseer.mgcNumpad.setAttribute("aria-hidden", showNumpad ? "false" : "true");
    }
  };

  function bindMobileControls() {
    if (Overseer.mgcDpad) {
      const dpadButtons = Overseer.mgcDpad.querySelectorAll(".dpad-btn[data-dir]");
      dpadButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          const dir = btn.getAttribute("data-dir");
          sendToGame("mobile_dpad", { dir: dir });
        });
      });
    }

    if (Overseer.mgcNumpad) {
      const keys = Overseer.mgcNumpad.querySelectorAll(".nkey");
      keys.forEach(function (btn) {
        btn.addEventListener("click", function () {
          const label = btn.textContent;
          handleNumpadKey(label);
        });
      });
    }
  }

  function handleNumpadKey(label) {
    if (!Overseer.numpadDisplay) return;

    let current = Overseer.numpadDisplay.textContent || "";

    if (label === "←") {
      current = current.slice(0, -1);
      Overseer.numpadDisplay.textContent = current;
      return;
    }

    if (label === "OK") {
      sendToGame("mobile_numpad", { value: current });
      Overseer.numpadDisplay.textContent = "";
      return;
    }

    // 0-9
    if (/^[0-9]$/.test(label)) {
      current += label;
      Overseer.numpadDisplay.textContent = current;
    }
  }

  // ========= INIT / BOOT SEQUENCE =========

  function bindInput() {
    if (!Overseer.inputEl || !Overseer.sendBtn) return;

    Overseer.inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        const raw = Overseer.inputEl.value;
        Overseer.inputEl.value = "";
        Overseer.handleInput(raw);
      } else if (e.key === "ArrowUp") {
        if (Overseer.history.length > 0) {
          Overseer.historyIndex = Math.max(0, Overseer.historyIndex - 1);
          Overseer.inputEl.value = Overseer.history[Overseer.historyIndex] || "";
          setTimeout(Overseer.focusInput, 0);
        }
      } else if (e.key === "ArrowDown") {
        if (Overseer.history.length > 0) {
          Overseer.historyIndex = Math.min(Overseer.history.length, Overseer.historyIndex + 1);
          if (Overseer.historyIndex === Overseer.history.length) {
            Overseer.inputEl.value = "";
          } else {
            Overseer.inputEl.value = Overseer.history[Overseer.historyIndex] || "";
          }
          setTimeout(Overseer.focusInput, 0);
        }
      }
    });

    Overseer.sendBtn.addEventListener("click", function () {
      const raw = Overseer.inputEl.value;
      Overseer.inputEl.value = "";
      Overseer.handleInput(raw);
    });
  }

  function bootSequence() {
    Overseer.clear();
    Overseer.print("VAULT 77 // OVERSEER TERMINAL");
    Overseer.print("BUILD: ATOMIC FIZZ CAPS // PROTOTYPE LINK");
    Overseer.print("SIGNAL STRENGTH: WEAK // CLASSIFIED");
    Overseer.print("");
    Overseer.print("TYPE 'HELP' FOR AVAILABLE COMMANDS.");
  }

  function init() {
    if (Overseer.initialized) return;
    Overseer.initialized = true;

    Overseer.chatEl = document.getElementById("chat");
    Overseer.inputEl = document.getElementById("input");
    Overseer.sendBtn = document.getElementById("send");

    Overseer.rmControlsEl = document.getElementById("rmControls");
    Overseer.rmLeftBtn = document.getElementById("rmLeft");
    Overseer.rmFireBtn = document.getElementById("rmFire");
    Overseer.rmRightBtn = document.getElementById("rmRight");

    Overseer.mgcRoot = document.getElementById("mobileGameControls");
    Overseer.mgcHeader = document.getElementById("mgcHeader");
    Overseer.mgcGeneric = document.getElementById("mgcGeneric");
    Overseer.mgcDpad = document.getElementById("mgcDpad");
    Overseer.mgcNumpad = document.getElementById("mgcNumpad");
    Overseer.numpadDisplay = document.getElementById("numpadDisplay");

    bindInput();
    bindRedMenaceControls();
    bindMobileControls();
    bootSequence();
    Overseer.focusInput();

    // Notify game that terminal is ready
    sendToGame("terminal_ready", {});
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(init, 0);
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }

  window.overseer = Overseer;
})();
