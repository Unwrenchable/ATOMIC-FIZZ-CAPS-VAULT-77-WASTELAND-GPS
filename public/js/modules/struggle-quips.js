// Struggle Quips System - DJ and Companion remarks during tough times
// Implements humorous, condescending hints when players struggle
(function() {
  'use strict';

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // ============================================================
  // STRUGGLE QUIPS MODULE
  // ============================================================

  const struggleQuips = {
    quipsData: null,
    lastQuipTime: 0,
    quipCooldown: 60000, // 1 minute between quips
    hackFailCount: 0,
    battleStartTime: null,
    areaEntryTime: null,
    currentArea: null,

    // ============================================================
    // INITIALIZATION
    // ============================================================
    async init() {
      try {
        const res = await fetch('/data/narrative/dj_struggle_quips.json');
        if (res.ok) {
          this.quipsData = await res.json();
          console.log('[struggle-quips] Loaded DJ struggle quips');
        }
      } catch (err) {
        console.warn('[struggle-quips] Failed to load quips data:', err);
      }

      this.setupEventListeners();
    },

    setupEventListeners() {
      // Listen for various struggle events
      window.addEventListener('terminalHackFailed', (e) => this.onHackFailed(e));
      window.addEventListener('playerHealthLow', (e) => this.onHealthLow(e));
      window.addEventListener('playerDied', (e) => this.onPlayerDied(e));
      window.addEventListener('battleStarted', (e) => this.onBattleStarted(e));
      window.addEventListener('battleEnded', (e) => this.onBattleEnded(e));
      window.addEventListener('areaChanged', (e) => this.onAreaChanged(e));

      // Periodic check for long battles and stuck players
      setInterval(() => this.checkBattleDuration(), 30000);
      setInterval(() => this.checkAreaTime(), 300000); // Check every 5 minutes
    },

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    onHackFailed(event) {
      this.hackFailCount++;
      
      if (!this.quipsData || !this.canShowQuip()) return;

      const quips = this.quipsData.terminal_hack_fails;
      const eligibleQuips = quips.filter(q => this.hackFailCount >= q.triggers_after);
      
      if (eligibleQuips.length > 0) {
        const quip = this.pickRandom(eligibleQuips);
        this.showDJQuip(quip.quip);
      }
    },

    onHealthLow(event) {
      if (!this.quipsData || !this.canShowQuip()) return;

      const hpPercent = event.detail?.hpPercent || 100;
      const quips = this.quipsData.low_health_quips;
      
      // Find the most appropriate quip based on HP threshold
      let selectedQuip = null;
      for (const quip of quips) {
        const match = quip.condition.match(/\d+/);
        if (!match) continue;
        const threshold = parseInt(match[0], 10);
        if (hpPercent <= threshold) {
          selectedQuip = quip;
          break;
        }
      }

      if (selectedQuip) {
        this.showDJQuip(selectedQuip.quip);
      }
    },

    onPlayerDied(event) {
      if (!this.quipsData) return;

      const quips = this.quipsData.death_respawn_quips;
      const quip = this.pickRandom(quips);
      
      // Death quips ignore cooldown - player deserves the mockery
      if (quip) {
        setTimeout(() => this.showDJQuip(quip.quip), 2000);
      }
    },

    onBattleStarted(event) {
      this.battleStartTime = Date.now();
    },

    onBattleEnded(event) {
      this.battleStartTime = null;
    },

    checkBattleDuration() {
      if (!this.battleStartTime || !this.quipsData || !this.canShowQuip()) return;

      const duration = Date.now() - this.battleStartTime;
      const seconds = duration / 1000;
      
      const quips = this.quipsData.battle_struggle_quips;
      const eligibleQuips = quips.filter(q => {
        // Parse threshold - handles "60 seconds" or just "60"
        const match = String(q.triggers_after).match(/\d+/);
        if (!match) return false;
        const threshold = parseInt(match[0], 10);
        return seconds >= threshold;
      });

      if (eligibleQuips.length > 0) {
        // Pick the highest threshold quip that qualifies
        const quip = eligibleQuips[eligibleQuips.length - 1];
        this.showDJQuip(quip.quip);
      }
    },

    onAreaChanged(event) {
      const newArea = event.detail?.areaId;
      if (newArea !== this.currentArea) {
        this.currentArea = newArea;
        this.areaEntryTime = Date.now();
      }
    },

    checkAreaTime() {
      if (!this.areaEntryTime || !this.quipsData || !this.canShowQuip()) return;

      const duration = Date.now() - this.areaEntryTime;
      const minutes = duration / 60000;

      const quips = this.quipsData.quest_stuck_quips;
      const eligibleQuips = quips.filter(q => {
        // Parse threshold - handles "30 minutes same area" or just "30"
        const match = String(q.triggers_after).match(/\d+/);
        if (!match) return false;
        const threshold = parseInt(match[0], 10);
        return minutes >= threshold;
      });

      if (eligibleQuips.length > 0) {
        const quip = eligibleQuips[eligibleQuips.length - 1];
        this.showDJQuip(quip.quip);
      }
    },

    // ============================================================
    // COMPANION REMARKS
    // ============================================================

    getCompanionRemark(companionId, situation) {
      if (!this.quipsData?.companion_struggle_remarks) return null;

      const companionQuips = this.quipsData.companion_struggle_remarks[companionId];
      if (!companionQuips) return null;

      // Find a quip matching the situation
      const matchingQuips = companionQuips.filter(q => {
        if (situation === 'hack_fail' && q.condition.includes('failed_hack')) return true;
        if (situation === 'low_health' && q.condition.includes('low_health')) return true;
        if (situation === 'stuck' && q.condition.includes('stuck')) return true;
        if (situation === 'failed' && q.condition.includes('failed')) return true;
        return false;
      });

      return matchingQuips.length > 0 ? this.pickRandom(matchingQuips) : null;
    },

    showCompanionRemark(companionId, companionName, situation) {
      const remark = this.getCompanionRemark(companionId, situation);
      if (!remark || !this.canShowQuip()) return;

      this.showCompanionDialog(companionName, remark.dialog);
    },

    // ============================================================
    // DISPLAY FUNCTIONS
    // ============================================================

    showDJQuip(text) {
      this.lastQuipTime = Date.now();

      // Try to use the radio player if available
      if (Game.modules?.radioPlayer?.showDJMessage) {
        Game.modules.radioPlayer.showDJMessage(text);
        return;
      }

      // Fallback: dispatch event for other UI to handle
      window.dispatchEvent(new CustomEvent('djQuip', {
        detail: {
          speaker: 'Fizzmaster Rex',
          message: text,
          timestamp: Date.now()
        }
      }));

      // Also show in encounter feed if available
      this.showInEncounterFeed('📻 ' + text, 'dj-quip');
    },

    showCompanionDialog(companionName, text) {
      this.lastQuipTime = Date.now();

      window.dispatchEvent(new CustomEvent('companionDialog', {
        detail: {
          speaker: companionName,
          message: text,
          timestamp: Date.now()
        }
      }));

      this.showInEncounterFeed(`💬 ${companionName}: "${text}"`, 'companion-dialog');
    },

    showInEncounterFeed(message, className) {
      const feed = document.getElementById('encounterFeed');
      if (!feed) return;

      const div = document.createElement('div');
      div.className = `feed-item ${className}`;
      div.innerHTML = message;
      div.style.cssText = 'color: #ffcc00; padding: 8px; margin: 4px 0; border-left: 3px solid #ffcc00; background: rgba(255,204,0,0.1);';
      
      feed.insertBefore(div, feed.firstChild);

      // Auto-remove after 30 seconds
      setTimeout(() => {
        if (div.parentNode) {
          div.style.opacity = '0';
          div.style.transition = 'opacity 1s';
          setTimeout(() => div.remove(), 1000);
        }
      }, 30000);
    },

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    canShowQuip() {
      return Date.now() - this.lastQuipTime >= this.quipCooldown;
    },

    pickRandom(arr) {
      if (!arr || arr.length === 0) return null;
      return arr[Math.floor(Math.random() * arr.length)];
    },

    // Reset hack fail counter (call when player succeeds)
    resetHackCounter() {
      this.hackFailCount = 0;
    },

    // Manual trigger for testing
    triggerQuip(type) {
      if (type === 'hack') this.onHackFailed({});
      if (type === 'death') this.onPlayerDied({});
      if (type === 'health') this.onHealthLow({ detail: { hpPercent: 10 } });
    }
  };

  // ============================================================
  // INITIALIZATION
  // ============================================================

  Game.modules.struggleQuips = struggleQuips;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => struggleQuips.init());
  } else {
    struggleQuips.init();
  }

  // Also init on pipboyReady event
  window.addEventListener('pipboyReady', () => {
    if (!struggleQuips.quipsData) {
      struggleQuips.init();
    }
  });

})();
