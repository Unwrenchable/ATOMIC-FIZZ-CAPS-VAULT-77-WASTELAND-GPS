// public/js/modules/hacking.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Terminal Hacking Minigame
// Fallout-style password guessing with likeness hints
//
// Exposes: Game.modules.hacking
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!window.Game.modules) window.Game.modules = {};

  // ----------------------------------------------------------
  // XSS-safe HTML helper
  // ----------------------------------------------------------
  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

  // ----------------------------------------------------------
  // Secure RNG helpers (no Math.random())
  // ----------------------------------------------------------
  function cryptoRandInt(max) {
    // Returns a cryptographically random integer in [0, max)
    if (max <= 0) return 0;
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = cryptoRandInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[cryptoRandInt(arr.length)];
  }

  // ----------------------------------------------------------
  // Hacking word pools (expanded for 10-15 word lists)
  // ----------------------------------------------------------
  const HACK_WORDS = [
    // 4-letter words
    "LOCK", "DATA", "OPEN", "GATE", "CODE", "FILE", "SAFE", "PASS", "DOOR", "CORE",
    "BANK", "VAULT", "KEYS", "LINK", "NODE", "PORT", "WIRE", "CHIP", "BYTE", "CELL",
    "GRID", "ZONE", "AREA", "SITE", "HOST", "USER", "ROOT", "ADMIN", "SYS", "LOG",

    // 5-letter words
    "VAULT", "ENCLAVE", "ROBOT", "LASER", "MELEE", "GUARD", "BUNKER", "POWER", "ARMED", "GUARD",
    "TURRET", "COMBAT", "PLASMA", "SYSTEM", "SECTOR", "BUNKER", "SHIELD", "BREACH", "SENSOR", "LAUNCH",
    "CIPHER", "CRYPT", "ENCRYPT", "DECODE", "ACCESS", "LOGIN", "PASSWORD", "CREDENTIAL", "AUTH", "TOKEN",
    "NETWORK", "SERVER", "CLIENT", "PROTOCOL", "PACKET", "FRAME", "HEADER", "PAYLOAD", "STREAM", "SOCKET",

    // 6-letter words
    "TURRET", "COMBAT", "PLASMA", "SYSTEM", "SECTOR", "BUNKER", "SHIELD", "BREACH", "SENSOR", "LAUNCH",
    "CIPHER", "ENCRYPT", "DECODE", "ACCESS", "LOGIN", "PASSWORD", "CREDENTIAL", "AUTH", "TOKEN", "NETWORK",
    "SERVER", "CLIENT", "PROTOCOL", "PACKET", "FRAME", "HEADER", "PAYLOAD", "STREAM", "SOCKET", "DATABASE",
    "MEMORY", "STORAGE", "BACKUP", "RECOVER", "RESTORE", "ARCHIVE", "COMPRESS", "EXTRACT", "ENCRYPT", "DECRYPT",

    // 7-letter words
    "NETWORK", "PROTOCOL", "PACKET", "FRAME", "HEADER", "PAYLOAD", "STREAM", "SOCKET", "DATABASE", "MEMORY",
    "STORAGE", "BACKUP", "RECOVER", "RESTORE", "ARCHIVE", "COMPRESS", "EXTRACT", "ENCRYPT", "DECRYPT", "CIPHER",
    "ENCRYPT", "DECODE", "ACCESS", "LOGIN", "PASSWORD", "CREDENTIAL", "AUTH", "TOKEN", "SESSION", "COOKIE",

    // 8-letter words
    "DATABASE", "MEMORY", "STORAGE", "BACKUP", "RECOVER", "RESTORE", "ARCHIVE", "COMPRESS", "EXTRACT", "ENCRYPT",
    "DECRYPT", "CIPHER", "ENCRYPT", "DECODE", "ACCESS", "LOGIN", "PASSWORD", "CREDENTIAL", "AUTH", "TOKEN",
    "SESSION", "COOKIE", "FIREWALL", "ROUTER", "SWITCH", "HUB", "BRIDGE", "GATEWAY", "PROXY", "VPN"
  ];

  // ----------------------------------------------------------
  // Terminal hacking flavour text
  // ----------------------------------------------------------
  const HACK_PROMPTS = [
    ">>> RobCo Industries Terminal v2.2.0.3 — WELCOME <<<",
    ">>> ROBCO INDUSTRIES (TM) UNIFIED OPERATING SYSTEM <<<",
    ">>> PASSWORD REQUIRED. PLEASE ENTER PASSWORD. <<<",
    ">>> VAULT-TEC SECURITY PROTOCOL ACTIVE <<<",
    ">>> ENCLAVE DEFENSE NETWORK — ACCESS RESTRICTED <<<",
    ">>> BROTHERHOOD OF STEEL TERMINAL INTERFACE <<<",
    ">>> INSTITUTE MAINFRAME — AUTHORIZATION REQUIRED <<<",
    ">>> NCR COMMAND CONSOLE — CLEARANCE NEEDED <<<",
    ">>> CAESAR'S LEGION DATABASE — PASSWORD PROTECTED <<<",
    ">>> BOS PALADIN TERMINAL — HOLOTAG REQUIRED <<<"
  ];

  // ----------------------------------------------------------
  // Hacking Game Class
  // ----------------------------------------------------------
  class HackingGame {
    constructor(playerIntelligence = 5) {
      this.intel = Math.max(1, Math.min(10, playerIntelligence || 5));
      this.maxAttempts = 4; // Fixed at 4 attempts as requested
      this.remainingAttempts = this.maxAttempts;
      this.wordLen = this.intel >= 7 ? 8 : this.intel >= 5 ? 6 : this.intel >= 3 ? 5 : 4;
      this.words = this._buildWordList();
      this.targetWord = pick(this.words);
      this.guessHistory = [];
      this.solved = false;
      this.failed = false;
    }

    _buildWordList() {
      // Filter words by length
      const candidates = HACK_WORDS.filter(word => word.length === this.wordLen);
      if (candidates.length === 0) {
        // Fallback to any words if no matches
        return shuffleArray(HACK_WORDS).slice(0, Math.min(15, HACK_WORDS.length));
      }

      // Shuffle and take 10-15 words
      const shuffled = shuffleArray(candidates);
      const count = Math.min(15, Math.max(10, shuffled.length));
      return shuffled.slice(0, count);
    }

    guess(word) {
      if (this.solved || this.failed || this.remainingAttempts <= 0) return null;
      this.remainingAttempts--;

      const upper = word.toUpperCase();
      let likeness = 0;
      for (let i = 0; i < Math.min(upper.length, this.targetWord.length); i++) {
        if (upper[i] === this.targetWord[i]) likeness++;
      }

      if (upper === this.targetWord) {
        this.solved = true;
        this.guessHistory.push({ word: upper, likeness: this.targetWord.length, correct: true });
        return { correct: true, likeness: this.targetWord.length, attemptsLeft: this.remainingAttempts };
      }

      this.guessHistory.push({ word: upper, likeness, correct: false });

      if (this.remainingAttempts <= 0) {
        this.failed = true;
      }

      return { correct: false, likeness, attemptsLeft: this.remainingAttempts };
    }

    isSolved() {
      return this.solved;
    }

    isFailed() {
      return this.failed;
    }

    getTargetWord() {
      return this.targetWord;
    }
  }

  // ----------------------------------------------------------
  // UI Management
  // ----------------------------------------------------------
  let activeGame = null;
  let overlayElement = null;

  function init() {
    // Create overlay if it doesn't exist
    if (!overlayElement) {
      overlayElement = document.createElement("div");
      overlayElement.id = "hacking-overlay";
      overlayElement.setAttribute("role", "dialog");
      overlayElement.setAttribute("aria-label", "Terminal Hacking Interface");
      overlayElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: "Consolas", "Courier New", monospace;
      `;
      document.body.appendChild(overlayElement);
    }
  }

  function showHackingInterface(onSuccess, onFailure, playerIntel = 5) {
    if (!overlayElement) init();

    activeGame = new HackingGame(playerIntel);
    const prompt = pick(HACK_PROMPTS);

    const wordButtons = activeGame.words.map(word =>
      `<button class="hacking-word-btn" data-word="${escapeHtml(word)}">${escapeHtml(word)}</button>`
    ).join("");

    overlayElement.innerHTML = `
      <div class="hacking-container">
        <div class="hacking-header">
          <div class="hacking-title">╔══ TERMINAL HACKING ══╗</div>
          <button class="hacking-close-btn" id="hacking-close-btn">✕</button>
        </div>

        <div class="hacking-screen">
          <div class="hacking-prompt">${escapeHtml(prompt)}</div>
          <div class="hacking-info">
            <div>ATTEMPTS REMAINING: <span id="hacking-attempts">${escapeHtml(activeGame.maxAttempts)}</span></div>
            <div>INTELLIGENCE: ${escapeHtml(playerIntel)}</div>
          </div>
          <hr class="hacking-hr"/>
          <div class="hacking-instruction">PASSWORD REQUIRED. SELECT FROM OPTIONS:</div>
          <div id="hacking-word-list" class="hacking-word-list">${wordButtons}</div>
          <div id="hacking-history" class="hacking-history"></div>
          <div id="hacking-result" class="hacking-result"></div>
        </div>
      </div>
    `;

    overlayElement.style.display = "flex";

    // Bind events
    document.getElementById("hacking-close-btn").addEventListener("click", () => hideHackingInterface());

    overlayElement.querySelectorAll(".hacking-word-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const word = btn.dataset.word;
        attemptGuess(word, onSuccess, onFailure);
      });
    });

    // Keyboard navigation
    overlayElement.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideHackingInterface();
    });
  }

  function attemptGuess(word, onSuccess, onFailure) {
    const result = activeGame.guess(word);
    if (!result) return;

    const attemptsEl = document.getElementById("hacking-attempts");
    const historyEl = document.getElementById("hacking-history");
    const resultEl = document.getElementById("hacking-result");

    if (attemptsEl) attemptsEl.textContent = result.attemptsLeft;

    // Disable clicked word
    overlayElement.querySelectorAll(`.hacking-word-btn[data-word="${CSS.escape(word)}"]`)
      .forEach(b => { b.disabled = true; b.classList.add("word-guessed"); });

    // Add to history
    if (historyEl) {
      const entry = document.createElement("div");
      entry.className = "history-entry";
      entry.textContent = `>${escapeHtml(word)}   LIKENESS=${escapeHtml(result.likeness)}/${escapeHtml(activeGame.targetWord.length)}`;
      historyEl.appendChild(entry);
    }

    if (result.correct) {
      resultEl.className = "hacking-result success";
      resultEl.textContent = "ACCESS GRANTED. WELCOME, VAULT OVERSEER.";
      overlayElement.querySelectorAll(".hacking-word-btn").forEach(b => b.disabled = true);

      setTimeout(() => {
        hideHackingInterface();
        if (onSuccess) onSuccess();
      }, 2000);
    } else if (activeGame.isFailed()) {
      resultEl.className = "hacking-result failure";
      resultEl.textContent = "TERMINAL LOCKED. ALARM TRIGGERED.";
      overlayElement.querySelectorAll(".hacking-word-btn").forEach(b => b.disabled = true);

      setTimeout(() => {
        hideHackingInterface();
        if (onFailure) onFailure();
      }, 2000);
    } else {
      resultEl.className = "hacking-result failure";
      resultEl.textContent = `Incorrect. ${escapeHtml(result.attemptsLeft)} attempt(s) remaining.`;
    }
  }

  function hideHackingInterface() {
    if (overlayElement) {
      overlayElement.style.display = "none";
    }
    activeGame = null;
  }

  // ----------------------------------------------------------
  // Module exports
  // ----------------------------------------------------------
  window.Game.modules.hacking = {
    init,
    showHackingInterface,
    hideHackingInterface,
    HackingGame
  };

})();</content>
<parameter name="filePath">/workspaces/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS/public/js/modules/hacking.js