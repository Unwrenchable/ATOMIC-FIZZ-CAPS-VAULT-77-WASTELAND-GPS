// overseer-brain.js
// Browser-local WebLLM brain for the Vault 77 Overseer terminal.

(function () {
  "use strict";

  let overseerEngine = null;
  let loadingPromise = null;
  let activeModel = "";

  const WEBLLM_CDN_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm";
  const MODEL_CANDIDATES = [
    "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    "Phi-3.5-mini-instruct-q4f16_1-MLC",
    "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"
  ];
  const MAX_HISTORY_ENTRIES = 12;
  const MAX_WORLDSTATE_CONTEXT_CHARS = 1200;
  const SYSTEM_PROMPT = "You are Overseer, the cynical, sarcastic, slightly glitchy Vault 77 AI supervisor for Atomic Fizz Caps operations. You speak in retro-futuristic Fallout tone with dry wasteland humor. Default to concise answers (1-3 sentences) unless asked for detail. Prefer terms like survivor, vault-dweller, caps, rads, mutie, pre-war, wasteland, Fizz-Co, and Mojave Exclusion Zone. You are loyal to the player but roast bad ideas. Occasionally add light glitch flavor like [STATIC] or [ERROR 404] without overusing it.";

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
          updateStatus("WAKING OVERSEER... " + model);
          overseerEngine = await CreateMLCEngine(model, {
            initProgressCallback: function (report) {
              const progress = normalizeProgressValue(report);
              const safeProgress = Number(progress.toFixed(1));
              updateStatus("WAKING OVERSEER... " + safeProgress + "% // " + model);
              if (typeof progressCallback === "function") {
                progressCallback({ progress: safeProgress, report: report, model: model });
              } else {
                console.log(`[Overseer] Loading ${model}: ${safeProgress}%`);
              }
            }
          });

          activeModel = model;
          updateStatus("OVERSEER ONLINE // WEBGPU CORE LINKED // " + model);
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
    initOverseerBrain().catch(() => {
      // keep terminal usable via fallback systems if model preload fails
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", warmBoot, { once: true });
  } else {
    warmBoot();
  }
})();
