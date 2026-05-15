// overseer-brain.js
// Browser-local WebLLM brain for the Vault 77 Overseer terminal.

(function () {
  "use strict";

  let overseerEngine = null;
  let loadingPromise = null;

  const DEFAULT_MODEL = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
  const MAX_WORLDSTATE_CONTEXT_CHARS = 1200;
  const SYSTEM_PROMPT = "You are Overseer, the witty, sarcastic, slightly unhinged Vault 77 AI companion. You speak in a retro-futuristic, Fallout-style tone. You're helpful but love dark humor and wasteland references. Keep responses concise (1-3 sentences max) unless asked for more.";

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

  async function initOverseerBrain(progressCallback) {
    if (overseerEngine) return overseerEngine;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
      const { CreateMLCEngine } = await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/+esm");

      overseerEngine = await CreateMLCEngine(DEFAULT_MODEL, {
        initProgressCallback: function (report) {
          const progress = normalizeProgressValue(report);
          const safeProgress = Number(progress.toFixed(1));
          updateStatus("WAKING OVERSEER... " + safeProgress + "%");
          if (typeof progressCallback === "function") {
            progressCallback({ progress: safeProgress, report: report });
          } else {
            console.log(`[Overseer] Loading: ${safeProgress}%`);
          }
        }
      });

      updateStatus("OVERSEER ONLINE // WEBGPU CORE LINKED");
      console.log("%c[Overseer] Brain online — WebGPU powered", "color: lime; font-weight: bold");
      return overseerEngine;
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

  async function talkToOverseer(message, history) {
    const input = String(message || "").trim();
    if (!input) return "State your request, dweller.";

    if (!overseerEngine) {
      try {
        await initOverseerBrain();
      } catch (_err) {
        return "OVERSEER CORE UNRESPONSIVE: Neural link severed.";
      }
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter((entry) => entry && (entry.role === "user" || entry.role === "assistant"))
          .slice(-12)
      : [];

    const messages = [{ role: "system", content: SYSTEM_PROMPT }]
      .concat(safeHistory)
      .concat([{ role: "user", content: input }]);

    const reply = await overseerEngine.chat.completions.create({
      messages: messages,
      temperature: 0.85,
      max_tokens: 256
    });

    const content = reply && reply.choices && reply.choices[0] && reply.choices[0].message
      ? reply.choices[0].message.content
      : "";

    const finalText = String(content || "").trim();
    return finalText || "Signal lost in the static. Try that again.";
  }

  window.initOverseerBrain = initOverseerBrain;
  window.talkToOverseer = talkToOverseer;
  window.overseerBrain = async function (worldstate, text) {
    const contextHistory = [];
    if (worldstate && typeof worldstate === "object" && Object.keys(worldstate).length) {
      const worldContext = JSON.stringify(worldstate).slice(0, MAX_WORLDSTATE_CONTEXT_CHARS);
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
