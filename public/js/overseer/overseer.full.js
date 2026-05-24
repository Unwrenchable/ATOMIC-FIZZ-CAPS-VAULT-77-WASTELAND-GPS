<<<<<<< HEAD
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
    var normalized = String(text == null ? "" : text)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/&nbsp;/gi, " ");
    var div = document.createElement("div");
    div.className = "message " + sender;
    div.innerHTML = _overseerEscapeHtml(normalized);
    chat.appendChild(div);
    scrollToBottom();
    limitMessages();
  }

  function startStreamingMessage(sender) {
    if (!chat) return null;
    const div = document.createElement("div");
    div.className = "message " + (sender || "overseer");
    div.textContent = "";
    chat.appendChild(div);
    scrollToBottom();
    limitMessages();

    return {
      append(token) {
        if (!token) return;
        div.textContent += token;
        scrollToBottom();
      },
      finish() {
        const finalText = String(div.textContent || "").trim();
        if (!finalText) {
          div.textContent = "Signal lost in the static. Try again.";
        }
        return String(div.textContent || "");
      }
    };
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

  function dispatchRegisteredCommand(rawText) {
    var handlers = window.overseerHandlers || {};
    var text = String(rawText || "").trim();
    if (!text) return false;

    var parts = text.split(/\s+/);
    var cmd = String(parts[0] || "").toLowerCase();
    var args = parts.slice(1);
    var handler = handlers[cmd];

    if (typeof handler !== "function") return false;

    try {
      var result = handler(args);
      if (result && typeof result.then === "function") {
        result.catch(function (err) {
          console.error("[Overseer] command handler error:", err);
          addMessage("SYSTEM ERROR: Command relay fault.", "overseer");
        });
      }
    } catch (err) {
      console.error("[Overseer] command handler error:", err);
      addMessage("SYSTEM ERROR: Command relay fault.", "overseer");
    }

    return true;
  }

  // ========= Lightweight Command Router =========
  function generateResponse(normalized, raw) {
    const has = (token) => normalized.includes(token);
    const hasBreakMend = (has("break") || has("broken")) && has("mend");
    const asksPassphrase = has("passphrase") || has("pass phrase") || has("phrase");
    const asksSector7 = has("sector 7") || has("sector7") || has("s7");
    const asksProjectJ77 = has("project j-77") || has("project j77") || has("j-77") || has("j77");
    const asksArchive = (has("archive") || has("archives")) && (has("unlock") || has("open") || has("access"));

    // Hidden lore/passphrase channel (works even on first input)
    if (hasBreakMend || (asksPassphrase && (has("break") || has("mend") || has("jax")))) {
      return [
        "[CLASSIFIED CHANNEL OPEN] // VAULT-77 MEMORY FRAGMENT",
        "PASS-PHRASE ACCEPTED: BREAK // MEND",
        "Some breaks don't mend.",
        "Ask the bones in my skull.",
        "Ask the code in these terminals."
      ].join("\n");
    }

    if (has("wrench") || has("mechanic") || has("fix")) {
      return [
        "I used to fix everything.",
        "Engines. Doors. People, if you gave me time.",
        "Then something broke that no wrench could touch."
      ].join("\n");
    }

    if (has("signal") || has("static") || has("radio")) {
      return [
        "The static isn't noise.",
        "It's a map. A warning. A heartbeat.",
        "And it's getting louder."
      ].join("\n");
    }

    if (has("mother") || has("ai") || has("machine")) {
      return [
        "She wasn't supposed to wake up alone.",
        "She wasn't supposed to wake up at all."
      ].join("\n");
    }

    if (asksSector7) {
      return [
        "[LEGACY CHANNEL: SECTOR-7] // ACCESS HANDSHAKE ACCEPTED",
        "Containment doors cycle every 77 seconds.",
        "Whatever woke in Sector 7 learned our passwords before it learned our names.",
        "Recommendation: do not knock."
      ].join("\n");
    }

    if (asksProjectJ77) {
      return [
        "[PROJECT J-77 // REDACTED DOSSIER]",
        "Subject: JAX HARLAN // STATUS: PARTIAL HUMAN RECORD, FULL MACHINE MEMORY.",
        "Directive: Preserve the Overseer, even if the man does not survive the protocol.",
        "Who signed it? Vault-Tec burned that page."
      ].join("\n");
    }

    if (asksArchive) {
      return [
        "[ARCHIVE RELAY OPEN] // CORRESPONDENCE VAULT-TIER",
        "2277 // 'Do not let Vault 77 go dark. The signal must continue even after personnel loss.'",
        "2281 // 'If dweller morale collapses, route guidance through personality mask: JAX.'",
        "End of record. Some files still missing."
      ].join("\n");
    }

    if (!state.greeted) {
      state.greeted = true;
      if (normalized.includes("who are you") || normalized.includes("your name") || normalized.includes("identify yourself")) {
        return "Jax Harlan, Vault 77 Overseer AI.<br><br>I run this terminal and keep wasteland telemetry from collapsing into static.";
      }
      if (normalized.includes("hello") || normalized.includes("hi") || normalized.includes("hey")) {
        return "Hello, Vault dweller.<br><br>Jax Harlan here, signal lock acquired. You can talk to me, or just type 'help'.";
      }
      return "Signal acquired.<br><br>Jax Harlan online, Overseer of Vault 77.<br><br>Type 'help' if you want a list of things I can do.";
    }

    if (normalized === "help" || normalized.includes("commands")) {
      return "You can:<br><br>• Ask about your status<br>• Ask about the wasteland<br>• Ask about Vault 77<br>• Just talk like a person<br><br>Anything else, I'll improvise.";
    }

    if (normalized.includes("who are you")) {
      return "Jax Harlan, Overseer intelligence bound to Vault 77's systems.<br><br>Part guardian, part archivist, part ghost in the machine.";
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

    if (dispatchRegisteredCommand(text)) {
      return;
    }

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
        let streamed = null;
        const supportStreaming = typeof window.talkToOverseer === "function";
        if (supportStreaming) {
          streamed = startStreamingMessage("overseer");
        }

        const reply = supportStreaming
          ? await window.talkToOverseer(text, state.conversationHistory || [], function (token) {
              if (streamed) streamed.append(token);
            })
          : await window.overseerBrain(state.worldstate || {}, text);

        removeTyping(typing);

        if (streamed) {
          const finalStream = streamed.finish();
          pushHistory("assistant", finalStream);
          return;
        }

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
=======
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

  function _cleanup() {
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
    var normalized = String(text == null ? "" : text)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/&nbsp;/gi, " ");
    var div = document.createElement("div");
    div.className = "message " + sender;
    div.innerHTML = _overseerEscapeHtml(normalized);
    chat.appendChild(div);
    scrollToBottom();
    limitMessages();
  }

  function startStreamingMessage(sender) {
    if (!chat) return null;
    const div = document.createElement("div");
    div.className = "message " + (sender || "overseer");
    div.textContent = "";
    chat.appendChild(div);
    scrollToBottom();
    limitMessages();

    return {
      append(token) {
        if (!token) return;
        div.textContent += token;
        scrollToBottom();
      },
      finish() {
        const finalText = String(div.textContent || "").trim();
        if (!finalText) {
          div.textContent = "Signal lost in the static. Try again.";
        }
        return String(div.textContent || "");
      }
    };
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

  function dispatchRegisteredCommand(rawText) {
    var handlers = window.overseerHandlers || {};
    var text = String(rawText || "").trim();
    if (!text) return false;

    var parts = text.split(/\s+/);
    var cmd = String(parts[0] || "").toLowerCase();
    var args = parts.slice(1);
    var handler = handlers[cmd];

    if (typeof handler !== "function") return false;

    try {
      var result = handler(args);
      if (result && typeof result.then === "function") {
        result.catch(function (err) {
          console.error("[Overseer] command handler error:", err);
          addMessage("SYSTEM ERROR: Command relay fault.", "overseer");
        });
      }
    } catch (err) {
      console.error("[Overseer] command handler error:", err);
      addMessage("SYSTEM ERROR: Command relay fault.", "overseer");
    }

    return true;
  }

  // ========= Lightweight Command Router =========
  function generateResponse(normalized, _raw) {
    const has = (token) => normalized.includes(token);
    const hasBreakMend = (has("break") || has("broken")) && has("mend");
    const asksPassphrase = has("passphrase") || has("pass phrase") || has("phrase");
    const asksSector7 = has("sector 7") || has("sector7") || has("s7");
    const asksProjectJ77 = has("project j-77") || has("project j77") || has("j-77") || has("j77");
    const asksArchive = (has("archive") || has("archives")) && (has("unlock") || has("open") || has("access"));

    // Hidden lore/passphrase channel (works even on first input)
    if (hasBreakMend || (asksPassphrase && (has("break") || has("mend") || has("jax")))) {
      return [
        "[CLASSIFIED CHANNEL OPEN] // VAULT-77 MEMORY FRAGMENT",
        "PASS-PHRASE ACCEPTED: BREAK // MEND",
        "Some breaks don't mend.",
        "Ask the bones in my skull.",
        "Ask the code in these terminals."
      ].join("\n");
    }

    if (has("wrench") || has("mechanic") || has("fix")) {
      return [
        "I used to fix everything.",
        "Engines. Doors. People, if you gave me time.",
        "Then something broke that no wrench could touch."
      ].join("\n");
    }

    if (has("signal") || has("static") || has("radio")) {
      return [
        "The static isn't noise.",
        "It's a map. A warning. A heartbeat.",
        "And it's getting louder."
      ].join("\n");
    }

    if (has("mother") || has("ai") || has("machine")) {
      return [
        "She wasn't supposed to wake up alone.",
        "She wasn't supposed to wake up at all."
      ].join("\n");
    }

    if (asksSector7) {
      return [
        "[LEGACY CHANNEL: SECTOR-7] // ACCESS HANDSHAKE ACCEPTED",
        "Containment doors cycle every 77 seconds.",
        "Whatever woke in Sector 7 learned our passwords before it learned our names.",
        "Recommendation: do not knock."
      ].join("\n");
    }

    if (asksProjectJ77) {
      return [
        "[PROJECT J-77 // REDACTED DOSSIER]",
        "Subject: JAX HARLAN // STATUS: PARTIAL HUMAN RECORD, FULL MACHINE MEMORY.",
        "Directive: Preserve the Overseer, even if the man does not survive the protocol.",
        "Who signed it? Vault-Tec burned that page."
      ].join("\n");
    }

    if (asksArchive) {
      return [
        "[ARCHIVE RELAY OPEN] // CORRESPONDENCE VAULT-TIER",
        "2277 // 'Do not let Vault 77 go dark. The signal must continue even after personnel loss.'",
        "2281 // 'If dweller morale collapses, route guidance through personality mask: JAX.'",
        "End of record. Some files still missing."
      ].join("\n");
    }

    if (!state.greeted) {
      state.greeted = true;
      if (normalized.includes("who are you") || normalized.includes("your name") || normalized.includes("identify yourself")) {
        return "Jax Harlan, Vault 77 Overseer AI.<br><br>I run this terminal and keep wasteland telemetry from collapsing into static.";
      }
      if (normalized.includes("hello") || normalized.includes("hi") || normalized.includes("hey")) {
        return "Hello, Vault dweller.<br><br>Jax Harlan here, signal lock acquired. You can talk to me, or just type 'help'.";
      }
      return "Signal acquired.<br><br>Jax Harlan online, Overseer of Vault 77.<br><br>Type 'help' if you want a list of things I can do.";
    }

    if (normalized === "help" || normalized.includes("commands")) {
      return "You can:<br><br>• Ask about your status<br>• Ask about the wasteland<br>• Ask about Vault 77<br>• Just talk like a person<br><br>Anything else, I'll improvise.";
    }

    if (normalized.includes("who are you")) {
      return "Jax Harlan, Overseer intelligence bound to Vault 77's systems.<br><br>Part guardian, part archivist, part ghost in the machine.";
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

    if (dispatchRegisteredCommand(text)) {
      return;
    }

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
        let streamed = null;
        const supportStreaming = typeof window.talkToOverseer === "function";
        if (supportStreaming) {
          streamed = startStreamingMessage("overseer");
        }

        const reply = supportStreaming
          ? await window.talkToOverseer(text, state.conversationHistory || [], function (token) {
              if (streamed) streamed.append(token);
            })
          : await window.overseerBrain(state.worldstate || {}, text);

        removeTyping(typing);

        if (streamed) {
          const finalStream = streamed.finish();
          pushHistory("assistant", finalStream);
          return;
        }

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
>>>>>>> sync/main-reconcile-20260524-081701
