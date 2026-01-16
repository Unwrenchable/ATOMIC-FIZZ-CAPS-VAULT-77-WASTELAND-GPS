// boot.js
// Fallout-style FIZZ boot animation + narrative intro

(function () {
  const bootScreen = document.getElementById("bootScreen");
  const pipboyScreen = document.getElementById("pipboyScreen");
  const bootTextEl = document.getElementById("bootText");

  if (!bootScreen || !pipboyScreen || !bootTextEl) return;

  // -----------------------------
  // 1. FIZZ BOOT FRAMES (UNCHANGED)
  // -----------------------------
  const fizzFrames = [
    "F",
    "FI",
    "FIZ",
    "FIZZ",
    "",
    "███████╗ ██╗ ███████╗ ███████╗",
    "██╔════╝ ██║     ██╔╝     ██╔╝",
    "█████╗   ██║    ██╔╝     ██╔╝ ",
    "██╔══╝   ██║  ██╔╝     ██╔╝   ",
    "██║      ██║ ███████╗ ███████║",
    "╚═╝      ╚═╝ ╚══════╝ ╚══════╝",
    "",
    "[BOOTING FIZZ CORE]",
    "[█▒▒▒▒▒▒▒▒▒] 10%",
    "[███▒▒▒▒▒▒▒] 30%",
    "[██████▒▒▒▒] 60%",
    "[██████████] 100%",
    "",
    "FIZZ CORE ONLINE",
    "VAULT-TEC SYSTEMS NOMINAL",
    ""
  ];

  // -----------------------------
  // 2. NARRATIVE INTRO (UNCHANGED)
  // -----------------------------
  const introFrames = [
    ">> INITIALIZING TIMELINE ANCHOR...",
    ">> WARNING: MULTIPLE FALLOUT ERAS DETECTED",
    "",
    ">> SCANNING GEOGRAPHIC COORDINATES...",
    ">> REGION DETECTED: UNKNOWN WASTELAND",
    "",
    ">> LOADING LOCAL WASTELAND PROFILE...",
    "",
    "[INCOMING RADIO SIGNAL...]",
    "\"If you can hear this... get to Vegas.\"",
    "\"The timelines are collapsing.\"",
    "",
    ">> QUEST ADDED: WAKE UP",
    "",
    "Press any key to continue..."
  ];

  let index = 0;
  let phase = 0; // 0 = fizz, 1 = intro
  let finished = false;

  function typeNext() {
    const frames = phase === 0 ? fizzFrames : introFrames;

    if (index >= frames.length) {
      if (phase === 0) {
        phase = 1;
        index = 0;
        setTimeout(typeNext, 400);
        return;
      }
      finished = true;
      return;
    }

    bootTextEl.textContent += frames[index] + "\n";
    index++;

    const delay = 40 + Math.random() * 50;
    setTimeout(typeNext, delay);
  }

  function skipToEnd() {
    if (!finished) {
      bootTextEl.textContent =
        fizzFrames.join("\n") +
        "\n\n" +
        introFrames.join("\n") +
        "\n";
      finished = true;
    }
  }

  // -----------------------------
  // CLEAN PIP-BOY ACTIVATION
  // -----------------------------
  function activatePipboy() {
    if (!finished) skipToEnd();

    bootScreen.classList.add("hidden");
    pipboyScreen.classList.remove("hidden");

    // Notify the game
    window.dispatchEvent(new Event("pipboyReady"));

    // New ESRI worldmap hook
    if (window.Game?.modules?.worldmap?.onOpen) {
      try {
        Game.modules.worldmap.onOpen();
      } catch (err) {
        console.warn("[BOOT] worldmap.onOpen failed:", err);
      }
    }

    // Update stats if available
    if (window.Game?.ui?.updateStatPanel) {
      Game.ui.updateStatPanel();
    }

    window.removeEventListener("keydown", onContinue);
    window.removeEventListener("click", onContinue);
    window.removeEventListener("touchstart", onContinue);
  }

  function onContinue() {
    activatePipboy();
  }

  // -----------------------------
  // STARTUP
  // -----------------------------
  typeNext();

  window.addEventListener("keydown", onContinue);
  window.addEventListener("click", onContinue);
  window.addEventListener("touchstart", onContinue);

  // Auto-skip failsafe
  setTimeout(skipToEnd, 12000);
})();
