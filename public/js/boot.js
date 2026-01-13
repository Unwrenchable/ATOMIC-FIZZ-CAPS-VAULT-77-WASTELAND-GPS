// boot.js
// Fallout-style FIZZ boot animation + narrative intro

(function () {
  const bootScreen = document.getElementById("bootScreen");
  const pipboyScreen = document.getElementById("pipboyScreen");
  const bootTextEl = document.getElementById("bootText");

  if (!bootScreen || !pipboyScreen || !bootTextEl) return;

  // -----------------------------
  // 1. FIZZ BOOT FRAMES
  // -----------------------------
  const fizzFrames = [
    "F",
    "FI",
    "FIZ",
    "FIZZ",
    "",
    "███████╗ ██╗ ███████╗ ███████╗",
    "██╔════╝ ██║     ██╔╝     ██╔╝",
    "█████╗   ██║    ██╗      ██╗  ", 
    "██╔══╝   ██║  ██╔═╝    ██║    ",
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
  // 2. NEW NARRATIVE INTRO FRAMES
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
        // Move to intro sequence
        phase = 1;
        index = 0;
        setTimeout(typeNext, 400);
        return;
      }

      // Fully finished
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
      bootTextEl.textContent = fizzFrames.join("\n") + "\n\n" + introFrames.join("\n") + "\n";
      finished = true;
    }
  }

  function activatePipboy() {
    if (!finished) {
      skipToEnd();
      return;
    }

    bootScreen.classList.add("hidden");
    pipboyScreen.classList.remove("hidden");

    window.dispatchEvent(new Event("pipboyReady"));

    if (window.Game && typeof Game.onPipboyReady === "function") {
      Game.onPipboyReady();
    }

    if (typeof initWastelandMap === "function") {
      initWastelandMap();
    }

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

  typeNext();

  window.addEventListener("keydown", onContinue);
  window.addEventListener("click", onContinue);
  window.addEventListener("touchstart", onContinue);

  setTimeout(skipToEnd, 12000);
})();

