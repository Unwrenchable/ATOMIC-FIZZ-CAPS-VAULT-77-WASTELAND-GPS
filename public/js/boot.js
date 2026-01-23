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
    "[█         ] 10%",
    "[███       ] 30%",
    "[██████    ] 60%",
    "[██████████] 100%",
    "",
    "FIZZ CORE ONLINE",
    "VAULT-TEC SYSTEMS NOMINAL",
    ""
  ];
  const introFrames = [
  ">> INITIALIZING TIMELINE ANCHOR...",
  ">> WARNING: TEMPORAL OVERLAP DETECTED",
  "",
  ">> SCANNING GEOGRAPHIC COORDINATES...",
  ">> REGION: UNREGISTERED WASTELAND",
  "",
  ">> LOADING LOCAL PROFILE...",
  "",
  "[INCOMING SIGNAL...]",
  "\"If you can hear this... you’re drifting.\"",
  "\"The timelines are folding in on themselves.\"",
  "",
  "[SIGNAL DISTORTION...]",
  "\"Wake up.\"",
  "\"This world isn’t what you think it is.\"",
  "",
  ">> QUEST ADDED: WAKE UP",
  "",
  "Press any key to continue..."
];


  let index = 0;
  let phase = 0;
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

    // Compass hook (after UI becomes visible)
    if (window.Game?.modules?.compass?.onPipboyReady) {
      try {
        Game.modules.compass.onPipboyReady();
      } catch (err) {
        console.warn("[BOOT] compass onPipboyReady failed:", err);
      }
    }

    // Notify the game (radio engine listens for this)
    window.dispatchEvent(new Event("pipboyReady"));

    // Initialize quests module if needed
    if (window.Game?.modules?.quests?.init) {
      try {
        Game.modules.quests.init();
        console.log("[BOOT] quests module initialized");
      } catch (err) {
        console.warn("[BOOT] Failed to init quests module:", err);
      }
    }

    // Trigger the courier NPC dialogue for first-time players
    // This shows the Fallout-style NPC dialogue with the first quest
    setTimeout(() => {
      triggerCourierDialogue();
    }, 500);

    // Worldmap hook
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

  // -----------------------------
  // COURIER NPC DIALOGUE TRIGGER
  // -----------------------------
  function triggerCourierDialogue() {
    // Check if we've already seen the courier intro
    const courierKey = "afc_courier_intro_seen";
    if (localStorage.getItem(courierKey)) {
      console.log("[BOOT] Courier intro already seen, skipping");
      return;
    }

    // Open the courier NPC dialogue
    if (window.Game?.modules?.narrative?.openByDialogId) {
      try {
        Game.modules.narrative.openByDialogId("dialog_courier");
        console.log("[BOOT] Courier dialogue opened");
        
        // Mark as seen
        localStorage.setItem(courierKey, "true");
        
        // Also mark the flag in GAME_STATE for the narrative system
        if (window.GAME_STATE && window.GAME_STATE.flags) {
          window.GAME_STATE.flags.courier_intro_seen = true;
        }
      } catch (err) {
        console.warn("[BOOT] Failed to open courier dialogue:", err);
      }
    } else {
      console.warn("[BOOT] narrative module not available for courier dialogue");
    }
  }


  function onContinue() {
  // Start a short loading sequence before activating the Pip‑Boy
  startLoadingSequence();
}

// -----------------------------
// LOADING SEQUENCE BEFORE PIP‑BOY
// -----------------------------
function startLoadingSequence() {
  // Prevent double‑trigger
  window.removeEventListener("keydown", onContinue);
  window.removeEventListener("click", onContinue);
  window.removeEventListener("touchstart", onContinue);

  // Create loading bar container
  const barContainer = document.createElement("div");
  barContainer.style.width = "80%";
  barContainer.style.height = "8px";
  barContainer.style.margin = "20px auto";
  barContainer.style.border = "1px solid rgba(0,255,0,0.4)";
  barContainer.style.background = "rgba(0,255,0,0.15)";

  const bar = document.createElement("div");
  bar.style.width = "0%";
  bar.style.height = "100%";
  bar.style.background = "rgba(0,255,0,0.8)";
  bar.style.transition = "width 0.15s linear";

  barContainer.appendChild(bar);
  bootTextEl.appendChild(barContainer);

  let percent = 0;

  function step() {
    percent += Math.floor(Math.random() * 15) + 5;
    if (percent > 100) percent = 100;

    bar.style.width = percent + "%";

    if (percent < 100) {
      setTimeout(step, 120);
    } else {
      setTimeout(() => activatePipboy(), 300);
    }
  }

  step();
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
