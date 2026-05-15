// worldstate-poll.js
// Keeps Overseer world telemetry updated without inline script handlers.

(function () {
  "use strict";

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
    } catch (err) {
      console.error("[worldstate poll]", err);
    }
  }

  function startWorldstatePolling() {
    wireCloseButton();
    setInterval(pollWorldstate, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWorldstatePolling, { once: true });
  } else {
    startWorldstatePolling();
  }
})();
