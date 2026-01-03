// public/js/boot.js – Fallout-style interactive terminal boot (2026 edition)
// Fixed: Reliable mouse/touch + keyboard, debug logs, no blocking
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
  let finished = false;

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
    ">> PRESS ANY KEY / CLICK / TAP TO CONTINUE <<"
  ];

  // === ANIMATION SETTINGS ===
  const typeSpeedMin = 20;
  const typeSpeedMax = 60;
  const lineDelay = 800;
  let currentLine = 0;
  let charIndex = 0;
  let output = '';

  // === SOUND EFFECTS (browser-safe) ===
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

  // === TYPEWRITER EFFECT ===
  function typeNextChar() {
    if (currentLine >= bootLines.length) {
      finished = true;
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
      playBeep(800 + Math.random() * 400, 20);
      setTimeout(typeNextChar, typeSpeedMin + Math.random() * (typeSpeedMax - typeSpeedMin));
    } else {
      output += '\n';
      currentLine++;
      charIndex = 0;
      setTimeout(typeNextChar, lineDelay);
    }
  }

  // === SKIP TO END ===
  function completeBoot() {
    if (!finished) {
      output = bootLines.join('\n') + '\n';
      bootText.textContent = output;
      currentLine = bootLines.length;
      finished = true;
      bootPrompt.classList.remove('hidden');
      playSuccess();
    }
  }

  // === ACTIVATE FULL PIP-BOY INTERFACE ===
  function activatePipboy() {
    if (activated) return;
    activated = true;

    console.log('activatePipboy called');

    // Hide boot
    bootScreen.style.display = 'none';
    bootScreen.setAttribute('aria-hidden', 'true');

    // Show Pip-Boy (force visibility)
    pipboyScreen.classList.remove('hidden');
    pipboyScreen.setAttribute('aria-hidden', 'false');
    pipboyScreen.style.display = 'block';
    pipboyScreen.style.visibility = 'visible';
    pipboyScreen.style.opacity = '1';

    playSuccess();

    // Force map resize
    setTimeout(() => {
      if (window._map && typeof window._map.invalidateSize === 'function') {
        window._map.invalidateSize();
        console.log('Map resized');
      }
    }, 300);

    window.dispatchEvent(new Event('pipboyReady'));
    console.log('Pip-Boy interface activated!');
  }

  // === INPUT HANDLER (keyboard, click, touch) ===
  function setupListeners() {
    const onInput = (e) => {
      // Log every input for debug
      console.log(`Input detected: ${e.type}`);

      // Don't prevent default on keyboard (Enter/Space works naturally)
      if (e.type !== 'keydown') {
        e.preventDefault();
      }

      if (!activated) {
        if (!finished) {
          completeBoot(); // First input: skip typing
        } else {
          activatePipboy(); // Second input: activate UI
        }
      }
    };

    // Keyboard (simple)
    window.addEventListener('keydown', onInput);

    // Mouse click - capture phase to catch early
    bootScreen.addEventListener('click', onInput, { capture: true });

    // Touch - passive false + capture
    bootScreen.addEventListener('touchstart', onInput, { passive: false, capture: true });

    // Extra safety: any document click after prompt
    document.addEventListener('click', (e) => {
      if (finished && !activated) {
        console.log('Document click detected → forcing activation');
        activatePipboy();
      }
    }, { once: true });
  }

  // === START BOOT ===
  function startBoot() {
    setupListeners();
    typeNextChar();
  }

  // Run when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBoot);
  } else {
    startBoot();
  }
})();
