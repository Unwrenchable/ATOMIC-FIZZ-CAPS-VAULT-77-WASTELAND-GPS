// worldstate-poll.js
// Keeps Overseer world telemetry updated without inline script handlers.

(function () {
  "use strict";

  const ACTIVE_POLL_MS = 5000;
  const HIDDEN_POLL_MS = 20000;
  const FAILURE_BACKOFF_MS = 30000;
  let pollTimer = null;
  let consecutiveFailures = 0;
  let lastErrorLogAt = 0;

  function wireCloseButton() {
    const closeButton = document.getElementById("close-terminal");
    if (!closeButton) return;
    closeButton.addEventListener("click", function () {
      window.close();
    });
  }

  async function pollWorldstate() {
    try {
      const apiBase = (window.API_BASE || "https://api.atomicfizzcaps.xyz").replace(/\/+$/, "");
      const res = await fetch(`${apiBase}/api/worldstate`);
      const data = await res.json();
      if (data && data.ok && window.overseer && typeof window.overseer.updateWorldstate === "function") {
        window.overseer.updateWorldstate(data.worldstate);
      }
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures += 1;
      const now = Date.now();
      if (now - lastErrorLogAt > 15000) {
        console.error("[worldstate poll]", err);
        lastErrorLogAt = now;
      }
    }
  }

  function nextDelayMs() {
    if (consecutiveFailures > 0) return FAILURE_BACKOFF_MS;
    return document.hidden ? HIDDEN_POLL_MS : ACTIVE_POLL_MS;
  }

  function queueNextPoll() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(async function () {
      await pollWorldstate();
      queueNextPoll();
    }, nextDelayMs());
  }

  function startWorldstatePolling() {
    wireCloseButton();
    pollWorldstate().finally(queueNextPoll);
    document.addEventListener("visibilitychange", queueNextPoll);
    window.addEventListener("beforeunload", function () {
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWorldstatePolling, { once: true });
  } else {
    startWorldstatePolling();
  }
})();
