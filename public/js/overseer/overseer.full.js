// overseer.full.js — Pure AI Overseer Terminal (no minigames, no corruption)

(function () {
  "use strict";

  // ========= OVERSEER OBJECT =========
  var Overseer = window.overseer || {};
  Overseer.history = Overseer.history || [];
  Overseer.historyIndex = 0;
  Overseer.initialized = false;

  // ========= SECURITY: Escape HTML =========
  function _overseerEscapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  Overseer.print = function (text) {
    var chatEl = document.getElementById("chat");
    if (!chatEl) return;
    var div = document.createElement("div");
    div.className = "message overseer";
    div.innerHTML = _overseerEscapeHtml(text);
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
  };

  Overseer.clear = function () {
    var chatEl = document.getElementById("chat");
    if (chatEl) chatEl.innerHTML = "";
  };

  Overseer.focusInput = function () {
    var inputEl = document.getElementById("input");
    if (inputEl) { try { inputEl.focus(); } catch (e) {} }
  };

  window.overseer = Overseer;
  
  if (typeof window.overseerBrain === "undefined") {
    console.warn("[Overseer] overseerBrain missing — wiring minimal fallback.");
    window.overseerBrain = async (_worldstate, text) => {
      if (typeof window.talkToOverseer === "function") {
        return window.talkToOverseer(text || "", []);
      }
      return "AI LINK FAILURE: Overseer cognitive core unavailable.";
    };
  }


  // ========= LIMITS / SAFETY =========
  const MAX_MESSAGES = 80;
  const MAX_CONVERSATION_HISTORY = 20;

  let activeTimeouts = new Set();
  function addTimeout(fn, delay) {
    const id = setTimeout(() => {
      activeTimeouts.delete(id);
      try { fn(); } catch (e) {
        console.error("[Overseer] timeout error:", e);
        addMessage("SYSTEM ERROR: Timeout failed. Continuing…", "overseer");
      }
    }, delay);
    activeTimeouts.add(id);
    return id;
  }

  function cleanup() {
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts.clear();
  }

  function limitMessages() {
    const chat = document.getElementById("chat");
    if (!chat) return;
    const messages = chat.querySelectorAll("div.message");
    if (messages.length > MAX_MESSAGES) {
      for (let i = 0; i < messages.length - MAX_MESSAGES; i++) {
        messages[i].remove();
      }
    }
  }

  // ========= DOM ELEMENTS =========
  var chat = document.getElementById("chat");
  var input = document.getElementById("input");
  var sendBtn = document.getElementById("send");
  if (input) { try { input.focus(); } catch (e) {} }

  function scrollToBottom() {
    if (!chat) return;
    chat.scrollTop = chat.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }

  function addMessage(text, sender) {
    sender = sender || "player";
    if (!chat) return;
    var div = document.createElement("div");
    div.className = "message " + sender;
    div.innerHTML = _overseerEscapeHtml(text);
    chat.appendChild(div);
    scrollToBottom();
    limitMessages();
  }

  function secureJitterMs(base, spread) {
    var arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return base + (arr[0] % spread);
  }

  // ========= Typing Indicator =========
  function showTyping() {
    if (!chat) return null;
    const div = document.createElement("div");
    div.className = "message overseer typing-indicator";
    div.setAttribute("aria-label", "Overseer is responding");
    div.innerHTML = "<span class='typing-dot'>▋</span>";
    chat.appendChild(div);
    scrollToBottom();
    let on = true;
    const tick = setInterval(() => {
      on = !on;
      const dot = div.querySelector(".typing-dot");
      if (dot) dot.style.opacity = on ? "1" : "0";
    }, 420);
    div._tick = tick;
    return div;
  }

  function removeTyping(div) {
    if (!div) return;
    if (div._tick) clearInterval(div._tick);
    if (div.parentNode) div.parentNode.removeChild(div);
  }

  // ========= STATE =========
  var state = {
    greeted: false,
    lastInputTs: 0,
    conversationHistory: [],
    worldstate: {} // updated externally
  };

  function pushHistory(role, content) {
    state.conversationHistory.push({ role, content: String(content) });
    if (state.conversationHistory.length > MAX_CONVERSATION_HISTORY) {
      state.conversationHistory = state.conversationHistory.slice(-MAX_CONVERSATION_HISTORY);
    }
  }

  // ========= Lightweight Command Router =========
  function generateResponse(normalized, raw) {
    if (!state.greeted) {
      state.greeted = true;
      if (normalized.includes("hello") || normalized.includes("hi") || normalized.includes("hey")) {
        return "Hello, Vault dweller.<br><br>Signal lock acquired. You can talk to me, or just type 'help'.";
      }
      return "Signal acquired.<br><br>I'm the Overseer of Vault 77.<br><br>Type 'help' if you want a list of things I can do.";
    }

    if (normalized === "help" || normalized.includes("commands")) {
      return "You can:<br><br>• Ask about your status<br>• Ask about the wasteland<br>• Ask about Vault 77<br>• Just talk like a person<br><br>Anything else, I'll improvise.";
    }

    if (normalized.includes("who are you")) {
      return "I'm the Overseer intelligence bound to Vault 77's systems.<br><br>Part guardian, part archivist, part ghost in the machine.";
    }

    if (normalized.includes("vault 77")) {
      return "Vault 77. Quiet. Forgotten.<br><br>But its systems still hum, and I still watch.";
    }

    // No canned response → AI fallback
    return null;
  }

  // ========= Input Processing =========
  function handleInput() {
    if (!input) return;
    var raw = input.value;
    var text = raw.trim();
    if (!text) return;

    var now = Date.now();
    if (state.lastInputTs && now - state.lastInputTs < 80) return;
    state.lastInputTs = now;

    addMessage(escapeHtml(text), "player");
    pushHistory("user", text);
    input.value = "";

    var normalized = text.toLowerCase();
    var canned = null;

    try {
      canned = generateResponse(normalized, text);
    } catch (e) {
      console.error("[Overseer] generateResponse error:", e);
      canned = "SYSTEM ERROR: Routing failure. Falling back to AI.";
    }

    if (canned && typeof canned === "string" && canned.length > 0) {
      addTimeout(() => {
        addMessage(canned, "overseer");
        pushHistory("assistant", canned);
      }, secureJitterMs(300, 500));
      return;
    }

    // ========= AI FALLBACK =========
    (async () => {
      const typing = showTyping();
      try {
        const reply = await window.overseerBrain(state.worldstate || {}, text);
        removeTyping(typing);
        if (reply) {
          addMessage(reply, "overseer");
          pushHistory("assistant", reply);
        } else {
          addMessage("…no response from the local model.", "overseer");
        }
      } catch (err) {
        console.error("[Overseer AI Error]", err);
        removeTyping(typing);
        addMessage("AI ERROR: Local model failed to respond.", "overseer");
      }
    })();
  }

  // ========= Wire Events =========
  if (sendBtn) {
    sendBtn.addEventListener("click", function () {
      handleInput();
    });
  }

  if (input) {
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleInput();
      }
    });
  }

  // ========= External Hook for Worldstate =========
  Overseer.updateWorldstate = function (payload) {
    state.worldstate = payload || {};
  };

  Overseer.initialized = true;
})();
