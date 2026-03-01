  // boot.js
  // Afterfall-style FIZZ boot animation + narrative intro (copy-safe)

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
    "HAVENTECH SYSTEMS NOMINAL",
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

    const randBuf = new Uint32Array(1);
    crypto.getRandomValues(randBuf);
    const delay = 40 + (randBuf[0] % 51); // 40–90ms, uniform integer
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
  // CLEAN WRIST UI ACTIVATION
  // -----------------------------
  function activatePipboy() {
    if (!finished) skipToEnd();

    bootScreen.classList.add("hidden");
    pipboyScreen.classList.remove("hidden");

    // Compass hook (after UI becomes visible)
    if (window.Game?.modules?.compass?.onWristReady || window.Game?.modules?.compass?.onPipboyReady) {
      try {
        if (Game.modules.compass.onWristReady) Game.modules.compass.onWristReady();
        else Game.modules.compass.onPipboyReady();
      } catch (err) {
        console.warn("[BOOT] compass ready hook failed:", err);
      }
    }


    // Notify the game (radio + legacy modules listen for these events)
    window.dispatchEvent(new Event("wristReady"));
    // Also dispatch legacy event for compatibility with modules still listening for pipboyReady
    window.dispatchEvent(new Event("pipboyReady"));

    // NOTE: Quest initialization moved to main.js initGame() to ensure proper load order
    // Quest system needs player state to be fully initialized first

    // Trigger the Siren NPC dialogue for first-time players as soon as the game is ready.
    // Siren is the first NPC contact — no wallet connection required.
    // The Courier (Pip) dialogue is chained automatically after Siren closes.
    let gameReady = false;

    function triggerSirenIfReady() {
      if (gameReady) {
        console.log("[BOOT] Game ready, scheduling Siren dialogue");
        // Poll until the narrative module is available (guards against load-order races)
        let attempts = 0;
        const MAX_ATTEMPTS = 20;
        const pollInterval = setInterval(() => {
          attempts++;
          if (window.Game?.modules?.narrative?.openByDialogId) {
            clearInterval(pollInterval);
            triggerSirenDialogue();
          } else if (attempts >= MAX_ATTEMPTS) {
            clearInterval(pollInterval);
            console.warn("[BOOT] Narrative module not ready after polling, skipping Siren dialogue");
          }
        }, 200);
      }
    }

    // Check if game is already initialized (handles race condition)
    if (window._gameInitialized) {
      console.log("[BOOT] Game already initialized");
      gameReady = true;
    }

    window.addEventListener("gameInitialized", () => {
      console.log("[BOOT] Game initialized");
      gameReady = true;
      triggerSirenIfReady();
    }, { once: true });
    
    // Check immediately in case game is already ready
    triggerSirenIfReady();


    // NOTE: worldmap.onOpen() is triggered via the wristReady event listener
    // inside worldmap.js (double-rAF, after the container has dimensions).
    // A direct call here would race against that async path and could fire
    // before the pipboyScreen container has non-zero dimensions.

    // Update stats if available
    if (window.Game?.ui?.updateStatPanel) {
      Game.ui.updateStatPanel();
    }

    window.removeEventListener("keydown", onContinue);
    window.removeEventListener("click", onContinue);
    window.removeEventListener("touchstart", onContinue);
  }

  // -----------------------------
  // SIREN NPC DIALOGUE TRIGGER (First contact — no wallet required)
  // -----------------------------
  function triggerSirenDialogue() {
    // Check if we've already seen the Siren intro
    const sirenKey = "afc_siren_intro_seen";
    if (localStorage.getItem(sirenKey)) {
      console.log("[BOOT] Siren intro already seen, skipping");
      // For returning players: still try to trigger the courier if they haven't seen it
      triggerCourierDialogue();
      return;
    }

    // Open the Siren NPC dialogue
    if (window.Game?.modules?.narrative?.openByDialogId) {
      try {
        Game.modules.narrative.openByDialogId("dialog_siren");
        console.log("[BOOT] Siren dialogue opened");
        
        // Mark as seen
        localStorage.setItem(sirenKey, "true");
        
        // Also mark the flag in GAME_STATE for the narrative system
        if (window.GAME_STATE && window.GAME_STATE.flags) {
          window.GAME_STATE.flags.siren_intro_seen = true;
        }
        // Note: Courier dialogue will be triggered by narrative.js when Siren's dialog closes
      } catch (err) {
        console.warn("[BOOT] Failed to open Siren dialogue:", err);
        // Fallback: try courier directly
        triggerCourierDialogue();
      }
    } else {
      console.warn("[BOOT] narrative module not available for Siren dialogue");
      // Fallback: try courier directly
      triggerCourierDialogue();
    }
  }

  // -----------------------------
  // COURIER NPC DIALOGUE TRIGGER (chained after Siren, or standalone for returning players)
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

  // Expose triggerCourierDialogue so narrative.js can chain it after Siren closes
  window._bootTriggerCourierDialogue = triggerCourierDialogue;


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
    const stepRoll = new Uint32Array(1);
    crypto.getRandomValues(stepRoll);
    percent += (stepRoll[0] % 15) + 5; // 5–19% per step
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
