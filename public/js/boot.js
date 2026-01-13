// boot.js
// Fallout-style FIZZ boot animation for Pip-Boy activation

(function () {
  const bootScreen = document.getElementById("bootScreen");
  const pipboyScreen = document.getElementById("pipboyScreen");
  const bootTextEl = document.getElementById("bootText");

  if (!bootScreen || !pipboyScreen || !bootTextEl) return;

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
    "",
    "Press any key to continue..."
  ];

  let index = 0;
  let finished = false;

  function typeNext() {
    if (index >= fizzFrames.length) {
      finished = true;
      return;
    }

    bootTextEl.textContent += fizzFrames[index] + "\n";
    index++;

    const delay = 50 + Math.random() * 60;
    setTimeout(typeNext, delay);
  }

  function skipToEnd() {
    if (!finished) {
      bootTextEl.textContent = fizzFrames.join("\n") + "\n";
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

    // 🔥 CRITICAL: Wake the Pip-Boy game loop
    window.dispatchEvent(new Event("pipboyReady"));

    // Legacy hooks (safe to keep)
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

  setTimeout(skipToEnd, 9000);
})();
