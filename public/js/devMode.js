// devMode.js — Hidden Developer Mode toolbar for Atomic Fizz Caps
// Activate via: Shift+D+E+V key sequence, OR click footer "WASTELAND GPS" text 5 times.
// Provides dev controls: XP, CAPS, HP, Radiation, inventory, and UI toggles.

(function () {
  "use strict";

  // XSS helper
  function _escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

  // ----------------------------------------------------------------
  // DEV STATE
  // ----------------------------------------------------------------
  window._devMode = false;
  let _devToolbarEl = null;
  let _devBadgeEl = null;

  // Key sequence tracker: Shift+D, E, V
  const TARGET_SEQ = ["D", "E", "V"];
  let _keyBuffer = [];
  let _footerClicks = 0;
  let _footerTimer = null;

  // ----------------------------------------------------------------
  // HELPERS — proxy into the game's player state safely
  // ----------------------------------------------------------------

  function getPlayerState() {
    // Try unified player state (player-state.js)
    if (window.Game && window.Game.player) return window.Game.player;
    // Fallback to PLAYER from main.js
    if (window.PLAYER) return window.PLAYER;
    return null;
  }

  function saveState() {
    // Trigger save on unified player-state module first
    if (window.Game && window.Game.player && typeof window.Game.player.save === "function") {
      window.Game.player.save();
      return;
    }
    // Fallback: fire a storage event to let listeners react, or call main.js save
    try {
      const ps = getPlayerState();
      if (!ps) return;
      const key = "afc_player_state_v1";
      const payload = {
        inventory: ps.inventory || [],
        questsActive: ps.questsActive || [],
        questsDone: ps.questsDone || [],
        visitedLocations: ps.visitedLocations || [],
        xp: ps.xp || 0,
        caps: ps.caps || 0,
        level: ps.level || 1
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (e) {
      console.warn("[DevMode] saveState failed:", e);
    }
  }

  function addXP(amount) {
    const ps = getPlayerState();
    if (!ps) { logDev("No player state available"); return; }
    if (typeof ps.addXP === "function") {
      ps.addXP(amount);
    } else {
      ps.xp = Math.max(0, (ps.xp || 0) + amount);
      // Check level up
      const needed = (ps.level || 1) * 100;
      if (ps.xp >= needed) {
        ps.xp -= needed;
        ps.level = (ps.level || 1) + 1;
        logDev(`⬆ LEVEL UP! Now Level ${ps.level}`);
      }
      saveState();
    }
    // Trigger HUD update
    if (window.Game && typeof window.Game.ui?.updateStatPanel === "function") {
      window.Game.ui.updateStatPanel();
    }
    logDev(`+${amount} XP granted`);
  }

  function addCaps(amount) {
    const ps = getPlayerState();
    if (!ps) { logDev("No player state available"); return; }
    if (typeof ps.addCaps === "function") {
      ps.addCaps(amount);
    } else {
      ps.caps = Math.max(0, (ps.caps || 0) + amount);
      saveState();
    }
    if (window.Game && typeof window.Game.ui?.updateStatPanel === "function") {
      window.Game.ui.updateStatPanel();
    }
    logDev(`+${amount} CAPS granted`);
  }

  function healFull() {
    const ps = getPlayerState();
    if (!ps) return;
    const maxHp = ps.maxHp || ps.baseHp || 100;
    if (typeof ps.setHp === "function") {
      ps.setHp(maxHp);
    } else {
      ps.hp = maxHp;
    }
    // Update HP bar if present
    const hpBar = document.getElementById("stat-hp-bar");
    const hpLabel = document.getElementById("stat-hp-label");
    if (hpBar) hpBar.style.width = "100%";
    if (hpLabel) hpLabel.textContent = `${maxHp} / ${maxHp}`;
    saveState();
    logDev("HP restored to full");
  }

  function radiatePlayer(pct) {
    const ps = getPlayerState();
    if (!ps) return;
    const cur = typeof ps.radiation === "number" ? ps.radiation : 0;
    ps.radiation = Math.min(100, Math.max(0, cur + pct));
    // Update rad bar
    const radBar = document.getElementById("stat-rad-bar");
    const radLabel = document.getElementById("stat-rad-label");
    if (radBar) radBar.style.width = `${ps.radiation}%`;
    if (radLabel) radLabel.textContent = `${Math.round(ps.radiation)}%`;
    saveState();
    logDev(`Radiation set to ${Math.round(ps.radiation)}%`);
  }

  function flushRad() {
    const ps = getPlayerState();
    if (!ps) return;
    ps.radiation = 0;
    const radBar = document.getElementById("stat-rad-bar");
    const radLabel = document.getElementById("stat-rad-label");
    if (radBar) radBar.style.width = "0%";
    if (radLabel) radLabel.textContent = "0%";
    saveState();
    logDev("Radiation flushed");
  }

  function giveStimpak() {
    const item = {
      id: "stimpak",
      name: "Stimpak",
      type: "aid",
      effect: "heal",
      healAmt: 25,
      rarity: "common",
      quantity: 1,
      weight: 0.5,
      description: "A pre-war medical injector. [DEV]"
    };
    const ps = getPlayerState();
    if (!ps) return;
    // Try unified addItem first
    if (typeof ps.addItem === "function") {
      ps.addItem(item);
    } else if (Array.isArray(ps.inventory)) {
      ps.inventory.push(item.id || item.name);
      saveState();
    }
    // Refresh inventory panel if available
    if (window.Game && typeof window.Game.ui?.renderInventory === "function") {
      window.Game.ui.renderInventory();
    }
    logDev("Stimpak added to inventory");
  }

  function resetProgress() {
    if (!confirm("[DEV] RESET ALL PROGRESS? This cannot be undone!")) return;
    // Clear all AFC-related localStorage keys
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("afc")) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
    logDev("Progress reset — reloading...");
    setTimeout(() => window.location.reload(), 800);
  }

  function toggleGlitch() {
    const crt = document.querySelector(".pipboy-crt");
    if (!crt) return;
    const isGlitching = crt.classList.toggle("pipboy-glitch");
    logDev(`Glitch effect ${isGlitching ? "ENABLED" : "DISABLED"}`);
  }

  // ----------------------------------------------------------------
  // DEV LOG — writes to mapLog or dev console area
  // ----------------------------------------------------------------
  function logDev(msg) {
    console.log("[DevMode]", msg);
    const logEl = document.getElementById("devModeLog");
    if (logEl) {
      const line = document.createElement("div");
      line.style.cssText = "color:#00ff41;font-size:11px;border-bottom:1px solid rgba(0,255,65,0.15);padding:2px 0;";
      line.textContent = `> ${msg}`;
      logEl.insertBefore(line, logEl.firstChild);
      // Keep max 8 lines
      while (logEl.children.length > 8) {
        logEl.removeChild(logEl.lastChild);
      }
    }
    // Also show in mapLog briefly
    const mapLog = document.getElementById("mapLog");
    if (mapLog) {
      const entry = document.createElement("div");
      entry.style.cssText = "color:#ffaa00;font-size:11px;";
      entry.textContent = `[DEV] ${msg}`;
      mapLog.prepend(entry);
      setTimeout(() => entry.remove(), 5000);
    }
  }

  // ----------------------------------------------------------------
  // TOOLBAR HTML
  // ----------------------------------------------------------------
  function createToolbar() {
    if (_devToolbarEl) return;

    const toolbar = document.createElement("div");
    toolbar.id = "devModeToolbar";
    toolbar.style.cssText = [
      "position:fixed",
      "bottom:16px",
      "right:16px",
      "width:240px",
      "background:rgba(0,10,0,0.97)",
      "border:2px solid #00ff41",
      "box-shadow:0 0 20px rgba(0,255,65,0.4)",
      "font-family:Consolas,Courier New,monospace",
      "font-size:12px",
      "color:#00ff41",
      "z-index:999999",
      "padding:10px",
      "border-radius:4px"
    ].join(";");

    toolbar.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid rgba(0,255,65,0.4);padding-bottom:6px;">
        <span style="font-size:13px;letter-spacing:0.12em;">⚙ DEV TERMINAL</span>
        <button id="devModeClose" style="background:none;border:1px solid #00ff41;color:#00ff41;cursor:pointer;padding:2px 6px;font-family:inherit;">✕</button>
      </div>
      <div id="devModeLog" style="min-height:40px;max-height:80px;overflow:hidden;margin-bottom:8px;border:1px solid rgba(0,255,65,0.2);padding:4px;background:rgba(0,20,0,0.5);"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
        <button class="dev-btn" data-action="xp100">+100 XP</button>
        <button class="dev-btn" data-action="caps100">+100 CAPS</button>
        <button class="dev-btn" data-action="caps1000">+1000 CAPS</button>
        <button class="dev-btn" data-action="healFull">Heal Full</button>
        <button class="dev-btn" data-action="radiate">Radiate +50%</button>
        <button class="dev-btn" data-action="flushRad">Flush Rad</button>
        <button class="dev-btn" data-action="stimpak">Give Stimpak</button>
        <button class="dev-btn" data-action="glitch">Toggle Glitch</button>
        <button class="dev-btn" data-action="reset" style="grid-column:1/-1;color:#ff4444;border-color:#ff4444;">⚠ Reset Progress</button>
      </div>
    `;

    // Style all dev buttons
    const style = document.createElement("style");
    style.id = "devModeStyle";
    style.textContent = `
      .dev-btn {
        background: rgba(0,255,65,0.08);
        border: 1px solid rgba(0,255,65,0.5);
        color: #00ff41;
        font-family: Consolas, 'Courier New', monospace;
        font-size: 11px;
        padding: 5px 4px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        transition: background 0.15s;
      }
      .dev-btn:hover {
        background: rgba(0,255,65,0.2);
        box-shadow: 0 0 6px rgba(0,255,65,0.4);
      }
      .dev-btn:active {
        background: rgba(0,255,65,0.35);
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toolbar);
    _devToolbarEl = toolbar;

    // Wire buttons
    toolbar.querySelectorAll(".dev-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const action = this.getAttribute("data-action");
        switch (action) {
          case "xp100":    addXP(100); break;
          case "caps100":  addCaps(100); break;
          case "caps1000": addCaps(1000); break;
          case "healFull": healFull(); break;
          case "radiate":  radiatePlayer(50); break;
          case "flushRad": flushRad(); break;
          case "stimpak":  giveStimpak(); break;
          case "glitch":   toggleGlitch(); break;
          case "reset":    resetProgress(); break;
        }
      });
    });

    document.getElementById("devModeClose").addEventListener("click", function () {
      deactivateDevMode();
    });

    logDev("Dev mode activated. GLHF, Overseer.");
  }

  // ----------------------------------------------------------------
  // BADGE in header
  // ----------------------------------------------------------------
  function createBadge() {
    if (_devBadgeEl) return;
    const badge = document.createElement("span");
    badge.id = "devModeBadge";
    badge.textContent = "DEV";
    badge.style.cssText = [
      "display:inline-block",
      "background:#00ff41",
      "color:#000",
      "font-size:9px",
      "font-weight:bold",
      "letter-spacing:0.1em",
      "padding:2px 5px",
      "border-radius:2px",
      "margin-left:6px",
      "vertical-align:middle",
      "animation:devBadgePulse 1.2s infinite alternate"
    ].join(";");

    // Add pulse animation if not already in doc
    if (!document.getElementById("devBadgeAnim")) {
      const s = document.createElement("style");
      s.id = "devBadgeAnim";
      s.textContent = "@keyframes devBadgePulse { from { opacity:1; } to { opacity:0.4; } }";
      document.head.appendChild(s);
    }

    // Inject into header
    const header = document.querySelector(".pipboy-title") || document.querySelector(".pipboy-header");
    if (header) header.appendChild(badge);
    else document.body.appendChild(badge);

    _devBadgeEl = badge;
  }

  // ----------------------------------------------------------------
  // ACTIVATE / DEACTIVATE
  // ----------------------------------------------------------------
  function activateDevMode() {
    if (window._devMode) return;
    window._devMode = true;
    createBadge();
    createToolbar();
    console.log("[DevMode] *** DEV MODE ACTIVATED ***");
  }

  function deactivateDevMode() {
    window._devMode = false;
    if (_devToolbarEl) { _devToolbarEl.remove(); _devToolbarEl = null; }
    if (_devBadgeEl) { _devBadgeEl.remove(); _devBadgeEl = null; }
    console.log("[DevMode] Dev mode deactivated");
  }

  // ----------------------------------------------------------------
  // KEY SEQUENCE: Shift+D, E, V
  // ----------------------------------------------------------------
  document.addEventListener("keydown", function (e) {
    if (!e.shiftKey && _keyBuffer.length === 0) return; // must start with Shift
    if (e.shiftKey && e.key.toUpperCase() === TARGET_SEQ[0]) {
      _keyBuffer = [TARGET_SEQ[0]];
      return;
    }
    if (_keyBuffer.length > 0 && e.key.toUpperCase() === TARGET_SEQ[_keyBuffer.length]) {
      _keyBuffer.push(e.key.toUpperCase());
      if (_keyBuffer.length === TARGET_SEQ.length) {
        _keyBuffer = [];
        if (window._devMode) {
          deactivateDevMode();
        } else {
          activateDevMode();
        }
      }
    } else {
      _keyBuffer = [];
    }
  });

  // ----------------------------------------------------------------
  // FOOTER CLICK: click "WASTELAND GPS" 5 times within 4 seconds
  // ----------------------------------------------------------------
  function wireFooterClick() {
    const footerCenter = document.querySelector(".footer-center");
    if (!footerCenter) {
      // Retry after DOM is ready
      setTimeout(wireFooterClick, 500);
      return;
    }

    footerCenter.style.cursor = "pointer";
    footerCenter.title = "Click 5 times to activate dev mode";

    footerCenter.addEventListener("click", function () {
      _footerClicks++;
      if (_footerTimer) clearTimeout(_footerTimer);
      _footerTimer = setTimeout(function () { _footerClicks = 0; }, 4000);

      if (_footerClicks >= 5) {
        _footerClicks = 0;
        clearTimeout(_footerTimer);
        if (window._devMode) {
          deactivateDevMode();
        } else {
          activateDevMode();
        }
      }
    });
  }

  // Wire footer after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireFooterClick);
  } else {
    wireFooterClick();
  }

  // Expose globally for debugging
  window._devModeActivate = activateDevMode;
  window._devModeDeactivate = deactivateDevMode;

})();
