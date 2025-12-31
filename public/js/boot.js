document.addEventListener("DOMContentLoaded", () => {
  const bootScreen = document.getElementById("bootScreen");
  const bootTextEl = document.getElementById("bootText");
  const pipboyScreen = document.getElementById("pipboyScreen");

  if (!bootScreen || !bootTextEl || !pipboyScreen) return;

  const bootLines = [
    "VAULT-TEC TERMINAL v77.13",
    "PROPERTY OF ATOMIC FIZZ CAPS CORPORATION",
    "",
    "INITIALIZING WASTELAND GPS SUBSYSTEM...",
    "",
    ">>> INIT FIZZ CAPS LEDGER...........................[ OK ]",
    ">>> LINKING SOLANA RELAY............................[ OK ]",
    ">>> CALIBRATING GEIGER BACKGROUND RADIATION........[ OK ]",
    ">>> LOCATING VAULT 77 COORDINATES..................[ OK ]",
    "",
    "SYSTEM STATUS: ONLINE",
    "",
    "PRESS ANY KEY TO ACTIVATE PIP-BOY INTERFACE ▌"
  ];

  const fullText = bootLines.join("\n");
  let index = 0;

  function typeNext() {
    if (index <= fullText.length) {
      bootTextEl.textContent = fullText.slice(0, index);
      index++;

      const char = fullText[index - 1];
      const delay = char === "\n" ? 40 : 12; // slightly slower on line breaks

      setTimeout(typeNext, delay);
    } else {
      waitForContinue();
    }
  }

  function waitForContinue() {
    const continueBoot = () => {
      // Reveal Pip-Boy UI
      pipboyScreen.classList.remove("hidden");
      // Hide/remove boot overlay
      bootScreen.classList.add("hidden");

      window.removeEventListener("keydown", handleKey);
      bootScreen.removeEventListener("click", continueBoot);
    };

    const handleKey = () => continueBoot();

    window.addEventListener("keydown", handleKey);
    bootScreen.addEventListener("click", continueBoot);
  }

  // Tiny delay before typing for drama
  setTimeout(typeNext, 250);
});
