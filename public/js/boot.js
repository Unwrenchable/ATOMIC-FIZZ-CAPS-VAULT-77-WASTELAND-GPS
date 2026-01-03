// boot.js – Fixed terminal boot animation
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

  const bootScreen = document.getElementById("bootScreen");
  const bootTextEl = document.getElementById("bootText");
  const bootPrompt = document.getElementById("bootPrompt");
  const pipboyScreen = document.getElementById("pipboyScreen");

  let lineIndex = 0;
  let charIndex = 0;
  let currentLine = "";
  let finished = false;
  let activated = false;

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
    if (!activated) setTimeout(typeNextChar, 20);
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

    if (!finished) {
      completeBoot();
      return;
    }

    activated = true;

    // Hide boot, show pipboy
    if (bootScreen) {
      bootScreen.style.display = "none";
      bootScreen.setAttribute("aria-hidden", "true");
    }
    
    if (pipboyScreen) {
      pipboyScreen.classList.remove("hidden");
      pipboyScreen.setAttribute("aria-hidden", "false");
      pipboyScreen.style.display = "";
    }

    // Dispatch event
    try {
      window.dispatchEvent(new Event("pipboyReady"));
      window._pipboyReadyFired = true;
    } catch (e) {
      console.error("Failed to dispatch pipboyReady:", e);
    }

    removeListeners();
  }

  function onKeyDown(e) {
    e.preventDefault();
    activatePipboy();
  }

  function onClick(e) {
    if (!bootScreen) return;
    if (bootScreen.contains(e.target)) {
      e.preventDefault();
      activatePipboy();
    }
  }

  function onTouch(e) {
    if (!bootScreen) return;
    if (bootScreen.contains(e.target)) {
      e.preventDefault();
      activatePipboy();
    }
  }

  function addListeners() {
    if (bootScreen) {
      bootScreen.addEventListener("touchstart", onTouch, { passive: false });
      bootScreen.addEventListener("click", onClick, { passive: false });
    }
    window.addEventListener("keydown", onKeyDown);
  }

  function removeListeners() {
    if (bootScreen) {
      bootScreen.removeEventListener("touchstart", onTouch);
      bootScreen.removeEventListener("click", onClick);
    }
    window.removeEventListener("keydown", onKeyDown);
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      typeNextChar();
      addListeners();
    });
  } else {
    typeNextChar();
    addListeners();
  }
})();
