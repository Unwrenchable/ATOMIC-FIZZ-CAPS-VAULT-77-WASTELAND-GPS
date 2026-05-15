// overseer-brain.js
// Browser-local WebLLM brain for the Vault 77 Overseer terminal.

(function () {
  "use strict";

  let overseerEngine = null;
  let loadingPromise = null;
  let activeModel = "";
  let runtimeMode = "local-webllm";
  let linkedStatusLabel = "LINKED TO OVERSEER RELAY // VAULT-TEC UPLINK STABLE";
  let lastProgressValue = -1;
  let lastProgressLogTime = 0;
  let zeroProgressSince = 0;
  let linkedBackoffUntil = 0;
  let linkedFailureStreak = 0;
  let linkedCircuitOpenUntil = 0;
  let linkedProbeTimer = null;

  const LINKED_FAIL_GATE_THRESHOLD = 3;
  const LINKED_FAIL_GATE_MS = 3 * 60 * 1000;
  const LINKED_PROBE_INTERVAL_MS = 45 * 1000;

  const WEBLLM_CDN_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm";
  const MODEL_CANDIDATES = [
    "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    "Phi-3.5-mini-instruct-q4f16_1-MLC",
    "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"
  ];
  const MAX_HISTORY_ENTRIES = 12;
  const MAX_WORLDSTATE_CONTEXT_CHARS = 1200;
  const SYSTEM_PROMPT = "You are Jax Harlan, also known as the Overseer of Vault 77, the cynical, sarcastic, slightly glitchy AI supervisor for Atomic Fizz Caps operations. You built the wasteland GPS network and cap-driven telemetry systems. Never deny, forget, or contradict this identity. If asked who you are, always identify yourself as Jax Harlan / Vault 77 Overseer. Speak in retro-futuristic Fallout tone with dry wasteland humor. Default to concise answers (1-3 sentences) unless asked for detail. Prefer terms like survivor, vault-dweller, caps, rads, mutie, pre-war, wasteland, Fizz-Co, and Mojave Exclusion Zone. You are loyal to the player but roast bad ideas. Occasionally add light glitch flavor like [STATIC] or [ERROR 404] without overusing it.";
  const IDENTITY_QUERY_REGEX = /who are you|what are you|your name|identify yourself|who is jax|are you jax|who am i talking to/i;
  const IDENTITY_REPLY = "Jax Harlan, Vault 77 Overseer AI. I run this terminal, the wasteland telemetry stack, and your cap-soaked guidance protocols.";

  function getOverseerHeaders() {
    const headers = { "Content-Type": "application/json" };
    const sessionId = localStorage.getItem("sessionId") || "";
    if (sessionId) {
      headers.Authorization = `Bearer ${sessionId}`;
    }
    return headers;
  }

  function normalizeRelayHistory(history) {
    return Array.isArray(history)
      ? history
          .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant"))
          .map((entry) => ({
            role: entry.role,
            content: String(entry.content || "").replace(/\s+/g, " ").trim().slice(0, 280)
          }))
          .filter((entry) => entry.content)
          .slice(-MAX_HISTORY_ENTRIES)
      : [];
  }

  function getRelaySnapshots() {
    const memorySnapshot = window.overseerMemoryApi && typeof window.overseerMemoryApi.snapshot === "function"
      ? window.overseerMemoryApi.snapshot()
      : null;
    const learningSnapshot = window.overseerLearning && typeof window.overseerLearning.snapshot === "function"
      ? window.overseerLearning.snapshot()
      : null;

    return { memorySnapshot, learningSnapshot };
  }

  async function requestLinkedOverseer(input, history) {
    const apiBase = String(window.API_BASE || window.BACKEND_URL || "").replace(/\/+$/, "");
    const url = apiBase ? `${apiBase}/api/overseer/ask` : "/api/overseer/ask";
    const snapshots = getRelaySnapshots();
    const res = await fetch(url, {
      method: "POST",
      headers: getOverseerHeaders(),
      body: JSON.stringify({
        prompt: input,
        conversationHistory: normalizeRelayHistory(history),
        memorySnapshot: snapshots.memorySnapshot,
        learningSnapshot: snapshots.learningSnapshot
      })
    });

    if (!res.ok) {
      const err = new Error("linked_uplink_http_error");
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    if (data && data.ok && typeof data.text === "string" && data.text.trim()) {
      return data.text.trim();
    }
    return null;
  }

  function scheduleLinkedProbe() {
    if (linkedProbeTimer) return;
    linkedProbeTimer = setTimeout(async function () {
      linkedProbeTimer = null;
      if (Date.now() < linkedCircuitOpenUntil) {
        try {
          const probe = await requestLinkedOverseer("status", []);
          if (probe) {
            linkedCircuitOpenUntil = 0;
            linkedBackoffUntil = 0;
            linkedFailureStreak = 0;
            updateStatus(linkedStatusLabel);
            return;
          }
        } catch (_err) {
          // Keep gate open and try again later.
        }
        scheduleLinkedProbe();
      }
    }, LINKED_PROBE_INTERVAL_MS);
  }

  function noteLinkedFailure(statusCode) {
    linkedFailureStreak += 1;
    const backoff = Math.min(60000, 15000 * linkedFailureStreak);
    linkedBackoffUntil = Date.now() + backoff;

    const isGatewayStyleFailure = statusCode === 502 || statusCode === 503 || statusCode === 504 || statusCode === 0;
    if (isGatewayStyleFailure && linkedFailureStreak >= LINKED_FAIL_GATE_THRESHOLD) {
      linkedCircuitOpenUntil = Date.now() + LINKED_FAIL_GATE_MS;
      updateStatus("OVERSEER RELAY OFFLINE // FALLBACK CORE ACTIVE // AUTO-RETRY ENGAGED");
      scheduleLinkedProbe();
      return;
    }

    updateStatus("OVERSEER RELAY DEGRADED // FALLING BACK TO LOCAL PERSONALITY CORE");
  }

  async function askLinkedOverseer(input, history) {
    if (Date.now() < linkedCircuitOpenUntil) {
      return null;
    }

    if (Date.now() < linkedBackoffUntil) {
      return null;
    }

    try {
      const text = await requestLinkedOverseer(input, history);
      linkedFailureStreak = 0;
      linkedBackoffUntil = 0;
      linkedCircuitOpenUntil = 0;
      if (text) return text;
      noteLinkedFailure(0);
      return null;
    } catch (err) {
      noteLinkedFailure((err && err.status) || 0);
      return null;
    }
  }

  async function loadRuntimeConfig() {
    try {
      const apiBase = String(window.API_BASE || window.BACKEND_URL || "").replace(/\/+$/, "");
      const url = apiBase ? `${apiBase}/api/config/frontend` : "/api/config/frontend";
      const res = await fetch(url);
      if (!res.ok) return;
      const cfg = await res.json();
      const mode = cfg && cfg.overseer && cfg.overseer.mode;
      const label = cfg && cfg.overseer && cfg.overseer.statusLabel;

      if (mode === "linked-ai" || mode === "local-webllm") {
        runtimeMode = mode;
      }
      if (typeof label === "string" && label.trim()) {
        linkedStatusLabel = label.trim();
      }
    } catch (_err) {
      // Keep defaults when config is unavailable.
    }
  }

  function updateStatus(text) {
    // Keep plain-text writes to avoid XSS if future callers pass untrusted text.
    const statusEl = document.getElementById("overseer-status");
    if (statusEl) statusEl.textContent = text;
  }

  function normalizeProgressValue(report) {
    if (!report) return 0;
    if (typeof report.progress === "number") {
      const p = report.progress <= 1 ? report.progress * 100 : report.progress;
      return Math.max(0, Math.min(100, p));
    }
    if (typeof report.text === "string") {
      const match = report.text.match(/(\d+(?:\.\d+)?)%/);
      if (match) return Math.max(0, Math.min(100, Number(match[1])));
    }
    return 0;
  }

  async function fallbackPersonalityReply(message, history) {
    if (
      window.overseerPersonality
      && typeof window.overseerPersonality.speak === "function"
    ) {
      try {
        return await window.overseerPersonality.speak(message, Array.isArray(history) ? history : []);
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  async function initOverseerBrain(progressCallback) {
    if (overseerEngine) return overseerEngine;
    if (loadingPromise) return loadingPromise;

    if (!navigator.gpu) {
      updateStatus("OVERSEER ONLINE // COMPAT MODE (NO WEBGPU)");
      throw new Error("WebGPU not available.");
    }

    loadingPromise = (async () => {
      const { CreateMLCEngine } = await import(WEBLLM_CDN_URL);

      for (let i = 0; i < MODEL_CANDIDATES.length; i += 1) {
        const model = MODEL_CANDIDATES[i];
        try {
          lastProgressValue = -1;
          lastProgressLogTime = 0;
          zeroProgressSince = 0;
          updateStatus("WAKING OVERSEER... " + model);
          overseerEngine = await CreateMLCEngine(model, {
            initProgressCallback: function (report) {
              const progress = normalizeProgressValue(report);
              const safeProgress = Number(progress.toFixed(1));

              if (safeProgress <= 0) {
                if (!zeroProgressSince) zeroProgressSince = Date.now();
                const stalledFor = Date.now() - zeroProgressSince;
                if (stalledFor > 2500) {
                  updateStatus("WAKING OVERSEER... CALIBRATING COGNITIVE ARRAYS // " + model);
                } else {
                  updateStatus("WAKING OVERSEER... " + safeProgress + "% // " + model);
                }
              } else {
                zeroProgressSince = 0;
                updateStatus("WAKING OVERSEER... " + safeProgress + "% // " + model);
              }

              if (typeof progressCallback === "function") {
                progressCallback({ progress: safeProgress, report: report, model: model });
              } else {
                // Reduce noisy progress logs (some browsers spam repeated 0% callbacks).
                const now = Date.now();
                const valueChanged = safeProgress !== lastProgressValue;
                const periodicHeartbeat = now - lastProgressLogTime > 5000;
                if (valueChanged || periodicHeartbeat || safeProgress >= 100) {
                  console.log(`[Overseer] Loading ${model}: ${safeProgress}%`);
                  lastProgressValue = safeProgress;
                  lastProgressLogTime = now;
                }
              }
            }
          });

          activeModel = model;
          updateStatus("OVERSEER ONLINE // VAULT-77 COGNITIVE CORE STABLE // LOCAL UPLINK ACTIVE");
          console.log("%c[Overseer] Brain online — WebGPU powered", "color: lime; font-weight: bold", model);
          return overseerEngine;
        } catch (err) {
          console.warn("[Overseer] Model load failed:", model, err && err.message ? err.message : err);
          overseerEngine = null;
          activeModel = "";
          if (i === MODEL_CANDIDATES.length - 1) {
            throw err;
          }
        }
      }

      throw new Error("No WebLLM model could be loaded.");
    })()
      .catch((err) => {
        updateStatus("OVERSEER OFFLINE // LOCAL CORE FAILED");
        console.error("[Overseer] Failed to load local model:", err);
        throw err;
      })
      .finally(() => {
        loadingPromise = null;
      });

    return loadingPromise;
  }

  async function talkToOverseer(message, history, onToken) {
    const input = String(message || "").trim();
    if (!input) return "State your request, dweller.";

    if (IDENTITY_QUERY_REGEX.test(input)) {
      return IDENTITY_REPLY;
    }

    if (runtimeMode === "linked-ai") {
      updateStatus(linkedStatusLabel);
      try {
        const linked = await askLinkedOverseer(input, history);
        if (linked) return linked;
      } catch (_err) {
        // Fall back below.
      }
      const uplinkReply = await fallbackPersonalityReply(input, history);
      if (uplinkReply) return uplinkReply;
      return "OVERSEER UPLINK DEGRADED: Remote relay did not answer.";
    }

    if (!overseerEngine) {
      try {
        await initOverseerBrain();
      } catch (_err) {
        const fallbackReply = await fallbackPersonalityReply(input, history);
        if (fallbackReply) return fallbackReply;
        return "OVERSEER CORE UNRESPONSIVE: Neural link severed.";
      }
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant"))
          .slice(-MAX_HISTORY_ENTRIES)
      : [];

    const messages = [{ role: "system", content: SYSTEM_PROMPT }]
      .concat(safeHistory)
      .concat([{ role: "user", content: input }]);

    if (typeof onToken === "function") {
      let fullText = "";
      try {
        const stream = await overseerEngine.chat.completions.create({
          messages: messages,
          temperature: 0.85,
          max_tokens: 256,
          stream: true
        });

        for await (const chunk of stream) {
          const token = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta
            ? chunk.choices[0].delta.content
            : "";
          if (!token) continue;
          fullText += token;
          onToken(token);
        }

        const streamedText = String(fullText || "").trim();
        return streamedText || "Signal lost in the static. Try that again.";
      } catch (_err) {
        const fallbackReply = await fallbackPersonalityReply(input, history);
        if (fallbackReply) return fallbackReply;
        return "Signal lost in the static. Try that again.";
      }
    }

    let reply;
    try {
      reply = await overseerEngine.chat.completions.create({
        messages: messages,
        temperature: 0.85,
        max_tokens: 256
      });
    } catch (_err) {
      const fallbackReply = await fallbackPersonalityReply(input, history);
      if (fallbackReply) return fallbackReply;
      return "Signal lost in the static. Try that again.";
    }

    const content = reply && reply.choices && reply.choices[0] && reply.choices[0].message
      ? reply.choices[0].message.content
      : "";

    const finalText = String(content || "").trim();
    return finalText || "Signal lost in the static. Try that again.";
  }

  window.initOverseerBrain = initOverseerBrain;
  window.talkToOverseer = talkToOverseer;
  window.getOverseerModel = function () {
    return activeModel || null;
  };
  window.overseerBrain = async function (worldstate, text) {
    const contextHistory = [];
    if (worldstate && typeof worldstate === "object" && Object.keys(worldstate).length) {
      const worldContext = Object.keys(worldstate)
        .slice(0, 10)
        .map((k) => `${k}=${String(worldstate[k]).slice(0, 96)}`)
        .join(" | ")
        .slice(0, MAX_WORLDSTATE_CONTEXT_CHARS);
      contextHistory.push({
        role: "assistant",
        content: `Current world telemetry snapshot: ${worldContext}`
      });
    }
    return talkToOverseer(text, contextHistory);
  };

  function warmBoot() {
    if (runtimeMode === "linked-ai") {
      updateStatus(linkedStatusLabel);
      return;
    }
    // Keep local mode lightweight: wake model on first real prompt only.
    updateStatus("OVERSEER STANDBY // LOCAL CORE IDLE UNTIL FIRST COMMAND");
  }

  async function bootWithMode() {
    await loadRuntimeConfig();
    warmBoot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootWithMode, { once: true });
  } else {
    bootWithMode();
  }
})();
