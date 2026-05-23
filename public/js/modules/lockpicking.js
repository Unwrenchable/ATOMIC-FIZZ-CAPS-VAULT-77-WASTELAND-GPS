// lockpicking.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Advanced Lockpicking Minigame
// Fallout-style lockpicking with tension meter and pick angle
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

  // Cryptographically secure random functions
  function cryptoRandFloat() {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xFFFFFFFF + 1);
  }

  function cryptoRandInt(min, max) {
    return Math.floor(cryptoRandFloat() * (max - min + 1)) + min;
  }

  const lockpickingModule = {
    // Current lock state
    currentLock: null,
    pins: [],
    sweetSpot: 0,
    tension: 0,
    maxTension: 100,
    pickAngle: 0,

    // Difficulty settings
    difficulties: {
      easy: { pins: 3, tolerance: 15, tensionIncrease: 5 },
      average: { pins: 4, tolerance: 10, tensionIncrease: 8 },
      hard: { pins: 5, tolerance: 8, tensionIncrease: 12 },
      master: { pins: 6, tolerance: 5, tensionIncrease: 15 }
    },

    init() {
      this.setupEventListeners();
      this.updateInventoryDisplay();
    },

    setupEventListeners() {
      const overlay = document.getElementById('lockpickingOverlay');
      if (!overlay) return;

      // Angle slider
      const slider = document.getElementById('pickAngleSlider');
      if (slider) {
        slider.addEventListener('input', (e) => {
          this.pickAngle = parseInt(e.target.value);
          this.updateAngleDisplay();
        });
      }

      // Attempt pick button
      const pickBtn = document.getElementById('attemptPickBtn');
      if (pickBtn) {
        pickBtn.addEventListener('click', () => this.attemptPick());
      }

      // Cancel button
      const cancelBtn = document.getElementById('cancelLockpickingBtn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.cancelLockpicking());
      }
    },

    // Start lockpicking session
    startLockpicking(lockData) {
      this.currentLock = lockData;
      this.tension = 0;
      this.pickAngle = 0;

      // Determine difficulty
      const difficulty = this.getLockDifficulty(lockData.level || 1);
      const config = this.difficulties[difficulty];

      // Generate pins
      this.pins = [];
      for (let i = 0; i < config.pins; i++) {
        this.pins.push({
          position: cryptoRandInt(0, 360),
          set: false
        });
      }

      // Set sweet spot (average of all pin positions)
      const total = this.pins.reduce((sum, pin) => sum + pin.position, 0);
      this.sweetSpot = Math.round(total / this.pins.length);

      this.renderLock();
      this.updateUI();
      this.showOverlay();

      console.log(`[Lockpicking] Started ${difficulty} lock with ${config.pins} pins, sweet spot at ${this.sweetSpot}°`);
    },

    getLockDifficulty(level) {
      if (level <= 10) return 'easy';
      if (level <= 25) return 'average';
      if (level <= 50) return 'hard';
      return 'master';
    },

    renderLock() {
      const pinsContainer = document.getElementById('cylinderPins');
      const core = document.getElementById('cylinderCore');

      if (!pinsContainer || !core) return;

      // Clear existing pins
      pinsContainer.innerHTML = '';

      // Render pins
      this.pins.forEach((pin, index) => {
        const pinEl = document.createElement('div');
        pinEl.className = `pin ${pin.set ? 'set' : ''}`;
        pinEl.style.transform = `rotate(${pin.position}deg)`;
        pinsContainer.appendChild(pinEl);
      });

      // Update core
      core.className = 'cylinder-core';
      if (this.isLockUnlocked()) {
        core.classList.add('unlocked');
      }
    },

    updateUI() {
      // Update tension
      const tensionFill = document.getElementById('tensionFill');
      const tensionValue = document.getElementById('tensionValue');
      if (tensionFill) tensionFill.style.width = `${(this.tension / this.maxTension) * 100}%`;
      if (tensionValue) tensionValue.textContent = `${this.tension}/${this.maxTension}`;

      // Update angle display
      this.updateAngleDisplay();

      // Update difficulty
      const difficulty = this.getLockDifficulty(this.currentLock?.level || 1);
      const difficultyText = document.getElementById('difficultyText');
      const lockDifficulty = document.getElementById('lockDifficulty');
      if (difficultyText) difficultyText.textContent = difficulty.toUpperCase();
      if (lockDifficulty) lockDifficulty.textContent = `${difficulty.toUpperCase()} LOCK`;

      // Update inventory
      this.updateInventoryDisplay();

      // Update button state
      const pickBtn = document.getElementById('attemptPickBtn');
      if (pickBtn) {
        const hasTools = this.hasRequiredTools();
        pickBtn.disabled = !hasTools;
        pickBtn.textContent = hasTools ? 'INSERT PICK' : 'NO TOOLS';
      }
    },

    updateAngleDisplay() {
      const display = document.getElementById('angleDisplay');
      if (display) display.textContent = `${this.pickAngle}°`;
    },

    updateInventoryDisplay() {
      const bobbyCount = document.getElementById('bobbyPinCount');
      const screwdriverCount = document.getElementById('screwdriverCount');

      if (bobbyCount) {
        const count = this.getItemCount('bobby_pin');
        bobbyCount.textContent = count;
        bobbyCount.style.color = count > 0 ? '#00ff41' : '#ff4444';
      }

      if (screwdriverCount) {
        const count = this.getItemCount('screwdriver');
        screwdriverCount.textContent = count;
        screwdriverCount.style.color = count > 0 ? '#00ff41' : '#ff4444';
      }
    },

    getItemCount(itemId) {
      if (!window.Game?.player?.hasItem) return 0;
      const item = window.Game.player.inventory.find(i => i.id === itemId);
      return item ? (item.quantity || 1) : 0;
    },

    hasRequiredTools() {
      return this.getItemCount('bobby_pin') > 0;
    },

    attemptPick() {
      if (!this.hasRequiredTools()) {
        this.showResult('NO BOBBY PINS AVAILABLE', 'failure');
        return;
      }

      const difficulty = this.getLockDifficulty(this.currentLock?.level || 1);
      const config = this.difficulties[difficulty];

      // Check if pick angle is within sweet spot tolerance
      const angleDiff = Math.abs(this.pickAngle - this.sweetSpot);
      const inSweetSpot = angleDiff <= config.tolerance;

      if (inSweetSpot) {
        // Try to set a pin
        const unsetPins = this.pins.filter(pin => !pin.set);
        if (unsetPins.length > 0) {
          // Set the closest unset pin
          let closestPin = null;
          let closestDist = 360;
          unsetPins.forEach(pin => {
            const dist = Math.abs(pin.position - this.pickAngle);
            if (dist < closestDist) {
              closestDist = dist;
              closestPin = pin;
            }
          });

          if (closestPin && closestDist <= config.tolerance) {
            closestPin.set = true;
            this.showResult('PIN SET!', 'success');
            this.renderLock();

            if (this.isLockUnlocked()) {
              this.unlockSuccess();
              return;
            }
          } else {
            this.showResult('PIN NOT FOUND', 'warning');
          }
        } else {
          this.showResult('ALL PINS ALREADY SET', 'warning');
        }
      } else {
        // Wrong angle - increase tension
        this.tension += config.tensionIncrease;
        if (this.tension >= this.maxTension) {
          this.breakageFailure();
          return;
        }
        this.showResult('WRONG ANGLE - TENSION INCREASED', 'warning');
      }

      // 10% chance to break bobby pin
      if (cryptoRandFloat() < 0.1) {
        this.consumeBobbyPin();
        this.showResult('BOBBY PIN BROKE!', 'failure');
      }

      this.updateUI();
    },

    isLockUnlocked() {
      return this.pins.every(pin => pin.set);
    },

    unlockSuccess() {
      this.showResult('LOCK UNLOCKED!', 'success');

      // Consume bobby pin
      this.consumeBobbyPin();

      // Trigger success callback
      setTimeout(() => {
        this.hideOverlay();
        if (this.currentLock?.onSuccess) {
          this.currentLock.onSuccess();
        }
        this.currentLock = null;
      }, 2000);
    },

    breakageFailure() {
      this.showResult('LOCK BROKEN - CANNOT OPEN', 'failure');

      // Consume bobby pin
      this.consumeBobbyPin();

      // Trigger failure callback
      setTimeout(() => {
        this.hideOverlay();
        if (this.currentLock?.onFailure) {
          this.currentLock.onFailure('broken');
        }
        this.currentLock = null;
      }, 2000);
    },

    cancelLockpicking() {
      this.hideOverlay();
      if (this.currentLock?.onCancel) {
        this.currentLock.onCancel();
      }
      this.currentLock = null;
    },

    consumeBobbyPin() {
      if (window.Game?.player?.removeItem) {
        window.Game.player.removeItem('bobby_pin', 1);
        this.updateInventoryDisplay();
      }
    },

    showResult(message, type) {
      const resultEl = document.getElementById('lockpickingResult');
      if (resultEl) {
        resultEl.textContent = message;
        resultEl.className = `lockpicking-result ${type}`;
      }
    },

    showOverlay() {
      const overlay = document.getElementById('lockpickingOverlay');
      if (overlay) {
        overlay.classList.remove('hidden');
      }
    },

    hideOverlay() {
      const overlay = document.getElementById('lockpickingOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
      }
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => lockpickingModule.init());
  } else {
    lockpickingModule.init();
  }

  // Export to Game.modules
  Game.modules.lockpicking = lockpickingModule;

})();