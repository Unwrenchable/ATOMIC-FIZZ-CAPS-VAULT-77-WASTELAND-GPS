// public/js/boot.js – Fallout-style interactive terminal boot (2026 edition)
(function () {
  'use strict';

  const bootScreen = document.getElementById('bootScreen');
  const bootText = document.getElementById('bootText');
  const bootPrompt = document.getElementById('bootPrompt');
  const pipboyScreen = document.getElementById('pipboyScreen');

  if (!bootScreen || !bootText || !bootPrompt || !pipboyScreen) {
    console.error('Boot elements missing!');
    return;
  }

  let activated = false;

  // === TERMINAL LINES – Fallout-style boot sequence ===
  const bootLines = [
    "VAULT-77 PERSONAL TERMINAL v13.7 • ATOMIC FIZZ CAPS",
    "-----------------------------------------------",
    "BIOS Date: 01/03/2026   Ver: 77.13",
    "Processor: Intel 8086 @ 4.77 MHz",
    "Memory Test: 640K OK",
    "",
    "Initializing FIZZ CAPS LEDGER................. [OK]",
    "Linking SOLANA RELAY.......................... [OK]",
    "Calibrating GEIGER COUNTERS................... [OK]",
    "Synchronizing WASTELAND GPS SUBSYSTEM......... [OK]",
    "Loading VAULT-TEC PIP-BOY 3000 MK IV.......... [OK]",
    "",
    "SYSTEM CHECK:",
    "  - Radiation Levels: Nominal",
    "  - Fusion Core: 87% Capacity",
    "  - Neural Interface: ONLINE",
    "",
    "*BZZZT* *CRACKLE*",
    "High-gain audio tone achieved!",
    "",
    ">> PRESS ANY KEY TO CONTINUE <<"
  ];

  // === ANIMATION SETTINGS ===
  const typeSpeedMin = 20;   // ms per char
  const typeSpeedMax = 60;
  const lineDelay = 800;     // pause between lines
  let currentLine = 0;
  let charIndex = 0;
  let output = '';

  // Optional: Sound effects (browser-safe)
  function playBeep(frequency = 800, duration = 80) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
      oscillator.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration / 1000);
    } catch (e) {}
  }

  function playSuccess() {
    playBeep(1200, 100);
    setTimeout(() => playBeep(1500, 80), 80);
  }

  function playError() {
    playBeep(200, 150);
  }

  // Typewriter effect
  function typeNextChar() {
    if (currentLine >= bootLines.length) {
      bootPrompt.classList.remove('hidden');
      bootPrompt.classList.add('blink');
      playSuccess();
      return;
    }

    const line = bootLines[currentLine];

    if (charIndex < line.length) {
      output += line.charAt(charIndex);
      charIndex++;
      bootText.textContent = output;
      playBeep(800 + Math.random() * 400, 20); // random beep per char
      setTimeout(typeNextChar, typeSpeedMin + Math.random() * (typeSpeedMax - typeSpeedMin));
    } else {
      output += '\n';
      currentLine++;
      charIndex = 0;
      setTimeout(typeNextChar, lineDelay);
    }
  }

  // Skip to end (for impatient users)
  function completeBoot() {
    output = bootLines.join('\n') + '\n';
    bootText.textContent = output;
    currentLine = bootLines.length;
    bootPrompt.classList.remove('hidden');
    playSuccess();
  }

  // Activate full Pip-Boy interface
  function activatePipboy() {
    if (activated) return;
    activated = true;

    // Hide boot
    bootScreen.style.display = 'none';
    bootScreen.setAttribute('aria-hidden', 'true');

    // Show Pip-Boy
    pipboyScreen.classList.remove('hidden');
    pipboyScreen.setAttribute('aria-hidden', 'false');
    pipboyScreen.style.display = 'block';

    // Play final success tone
    playSuccess();

    // Force map resize
    setTimeout(() => {
      if (window._map && typeof window._map.invalidateSize === 'function') {
        window._map.invalidateSize();
      }
    }, 300);

    // Tell other scripts "Pip-Boy is ready!"
    window.dispatchEvent(new Event('pipboyReady'));
    console.log('Pip-Boy interface activated!');
  }

  // Event listeners (once only)
  function setupListeners() {
    const onInput = (e) => {
      e.preventDefault();
      if (!activated) {
        if (currentLine < bootLines.length) {
          completeBoot(); // Skip typing
        } else {
          activatePipboy();
        }
      }
    };

    window.addEventListener('keydown', onInput, { once: true });
    bootScreen.addEventListener('click', onInput, { once: true });
    bootScreen.addEventListener('touchstart', onInput, { passive: false, once: true });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBoot);
  } else {
    startBoot();
  }

  function startBoot() {
    setupListeners();
    typeNextChar();
  }

})();
