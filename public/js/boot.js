// boot.js
// Handles boot screen -> Pip-Boy activation

(function () {
  const bootScreen = document.getElementById("bootScreen");
  const pipboyScreen = document.getElementById("pipboyScreen");
  const bootText = document.getElementById("bootText");

  if (bootText) {
    bootText.textContent =
      "Vault-Tec Pip-Boy 3000 Mk.VII\n" +
      "INITIALIZING...\n\n" +
      "> Linking to Atomic Fizz Caps mainframe...\n" +
      "> Establishing Wasteland GPS uplink...\n" +
      "> Loading world map tiles...\n" +
      "> Checking reactor core status...\n";
  }

  function finishBoot() {
    if (!bootScreen || !pipboyScreen) return;
    bootScreen.style.display = "none";
    bootScreen.setAttribute("aria-hidden", "true");

    pipboyScreen.classList.remove("hidden");
    pipboyScreen.setAttribute("aria-hidden", "false");

    if (typeof initWastelandMap === "function") {
      initWastelandMap();
    }
  }

  window.addEventListener("keydown", finishBoot, { once: true });
  window.addEventListener("click", finishBoot, { once: true });
  window.addEventListener("touchstart", finishBoot, { once: true });
})();
