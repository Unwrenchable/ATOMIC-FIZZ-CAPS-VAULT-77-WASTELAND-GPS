// boot.js – terminal boot animation, then emit event for game init
(function () {
  const lines = [
    "VAULT-77 PERSONAL TERMINAL • ATOMIC FIZZ CAPS",
    "---------------------------------------------",
    "",
    "                ########################",
    "                #                      #",
    "                #   ATOMIC FIZZ CAPS   #",
    "                #                      #",
    "                ########################",
    "",
    "Initializing FIZZ CAPS LEDGER.................. OK",
    "Linking SOLANA RELAY........................... OK",
    "Calibrating GEIGER COUNTERS.................... OK",
    "Synchronizing VAULT 77 COORDINATES............. OK",
    "Bootstrapping WASTELAND GPS SUBSYSTEM.......... OK",
    "",
    "*POP* *FIZZ* *CRACKLE*",
    "High-gain tone achieved!",
    "",
    "SYSTEM STATUS: ONLINE",
    ""
  ];

  // Inject Fallout-flavored random boot SFX (no warhead references)
  (function injectRandomBootSfx() {
    const sfxVariants = [
      "*TICK* *TICK* *GEIGER*  •  VAULT-Tec SYNC COMPLETE • PIP-BOY STANDBY",
      "*WHIRR* *HUM* *CLICK*   •  POWER CELLS NOMINAL • CAPS LEDGER ONLINE",
      "*POP* *HISS* *TICK*     •  SUBSYSTEMS GREEN • RADIO AMBIENCE",
      "*FIZZ* *CHIME* *TICK*   •  VAULT-77 DIAGNOSTICS • WASTELAND READY",
      "*CLICK* *TICK* *WHIRR*  •  PIP-BOY CALIBRATED • GEIGER STABLE",
      "*SOFT HUM* *TICK* *POP*  •  VAULT CIRCUITS SYNCED • HUD ONLINE",
      "*TICK* *WHIRR* *CHIME*  •  RELAY IDLE • ENVIRONMENTAL OK",
      "*FIZZ* *POP* *TICK*     •  FILTERS ENGAGED • GEIGER: LOW TICK RATE"
    ];

    const idx = lines.findIndex(l => /POP|FIZZ|CRACKLE|GEIGER|PIP-BOY/i.test(l));
    const pick = sfxVariants[Math.floor(Math.random() * sfxVariants.length)];
    if (idx !== -1) {
      lines[idx] = pick;
    } else {
      const insertAt = Math.min(6, Math.max(0, Math.floor(lines.length / 2)));
      lines.splice(insertAt, 0, pick);
    }
  })();

  const bootScreen = document.getElementById("bootScreen");
  const bootTextEl = document.getElementById("bootText");
  const bootPrompt = document.getElementById("bootPrompt");
  const pipboyScreen = document.getElementById("pipboyScreen");

  let lineIndex = 0;
  let charIndex = 0;
  let currentLine = "";
  let finished = false;
  let activated = false;
  let safetyTimer = null;

  function typeNextChar() {
    if (lineIndex >= lines.length) {
      finished = true;
      if (bootPrompt) bootPrompt.classList.remove("hidden");
      return;
    }

    const line = lines[lineIndex];

    if (charIndex < line.length) {
      currentLine += line.charAt(charIndex);
      charIndex++;
    } else {
      currentLine += "\n";
      lineIndex++;
      charIndex = 0;
    }

    if (bootTextEl) bootTextEl.textContent = currentLine;
    // schedule next char only if not activated (prevents runaway after activation)
    if (!activated) setTimeout(typeNextChar, 25);
  }

  function completeBoot() {
    if (!finished) {
      if (bootTextEl) bootTextEl.textContent = lines.join("\n") + "\n";
      finished = true;
      if (bootPrompt) bootPrompt.classList.remove("hidden");
    }
  }

  function activatePipboy() {
    if (activated) return;

    // If typing not finished, fast-forward first (user tapped to skip)
    if (!finished) {
      completeBoot();
      return;
    }

    activated = true;

    // Hide boot, show pipboy
    if (bootScreen) bootScreen.classList.add("hidden");
    if (pipboyScreen) pipboyScreen.classList.remove("hidden");

    // Dispatch event so main.js can start game
    window.dispatchEvent(new Event("pipboyReady"));

    // Remove listeners to avoid double triggers and clear safety timer
    removeListeners();
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
  }

  function onKeyDown(e) {
    // Accept any key as activation (mirrors "press any key")
    activatePipboy();
  }

  function onClick(e) {
    // Only respond to clicks/taps on the boot screen to avoid accidental triggers
    if (!bootScreen) return;
    if (bootScreen.contains(e.target)) {
      e.preventDefault();
      activatePipboy();
    }
  }

  function onTouch(e) {
    // Touch on the boot screen should activate
    if (!bootScreen) return;
    if (bootScreen.contains(e.target)) {
      e.preventDefault();
      activatePipboy();
    }
  }

  function addListeners() {
    // Touch first to avoid 300ms delay on some browsers
    if (bootScreen) bootScreen.addEventListener("touchstart", onTouch, { passive: false });
    if (bootScreen) bootScreen.addEventListener("click", onClick, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    // Accessibility: allow Enter/Space when focused
    if (bootScreen) {
      bootScreen.setAttribute("tabindex", "0");
      bootScreen.addEventListener("keyup", onKeyUpHandler);
    }
  }

  function onKeyUpHandler(e) {
    if (e.key === "Enter" || e.key === " ") activatePipboy();
  }

  function removeListeners() {
    if (bootScreen) bootScreen.removeEventListener("touchstart", onTouch);
    if (bootScreen) bootScreen.removeEventListener("click", onClick);
    window.removeEventListener("keydown", onKeyDown);
    if (bootScreen) bootScreen.removeEventListener("keyup", onKeyUpHandler);

    // Safe cleanup: replace bootScreen node with a clone to remove any remaining inline listeners
    if (bootScreen && bootScreen.parentNode) {
      try {
        const clone = bootScreen.cloneNode(true);
        bootScreen.parentNode.replaceChild(clone, bootScreen);
      } catch (e) {
        // ignore clone errors
      }
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Start typing animation
    typeNextChar();

    // Attach activation listeners
    addListeners();

    // Safety timeout (if something goes weird) — fast-forward typing after 8s
    safetyTimer = setTimeout(() => {
      completeBoot();
      safetyTimer = null;
    }, 8000);
  });
})();
