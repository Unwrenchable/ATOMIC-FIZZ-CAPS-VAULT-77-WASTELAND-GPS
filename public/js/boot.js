// boot.js – terminal boot animation, then emit event for game init

(function () {
  const lines = [
  "VAULT-77 PERSONAL TERMINAL • ATOMIC FIZZ CAPS",
  "---------------------------------------------",
  "",
  "  +--------------------------+",
  "  |    ATOMIC FIZZ CAPS      |",
  "  +--------------------------+",
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

  function typeNextChar() {
    if (lineIndex >= lines.length) {
      finished = true;
      bootPrompt.classList.remove("hidden");
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

    bootTextEl.textContent = currentLine;
    setTimeout(typeNextChar, 25);
  }

  function completeBoot() {
    if (!finished) {
      // Fast-forward
      bootTextEl.textContent = lines.join("\n") + "\n";
      finished = true;
      bootPrompt.classList.remove("hidden");
    }
  }

  function activatePipboy() {
    if (!finished) {
      completeBoot();
      return;
    }

    // Hide boot, show pipboy
    bootScreen.classList.add("hidden");
    pipboyScreen.classList.remove("hidden");

    // Dispatch event so main.js can start game
    window.dispatchEvent(new Event("pipboyReady"));

    // Remove listeners to avoid double triggers
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("click", onClick);
  }

  function onKeyDown() {
    activatePipboy();
  }

  function onClick() {
    activatePipboy();
  }

  document.addEventListener("DOMContentLoaded", () => {
    typeNextChar();

    // Allow skipping with any key / click
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("click", onClick);

    // Safety timeout (if something goes weird)
    setTimeout(completeBoot, 8000);
  });
})();
