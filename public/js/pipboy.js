// public/js/pipboy.js – Pip-Boy UI, panels, sounds, animations
(function () {
  'use strict';

  // ---------------------------
  // SOUND EFFECTS
  // ---------------------------
  function playPipSound(id) {
    const el = document.getElementById(id);
    if (!el) return;
    try {
      el.currentTime = 0;
      el.play().catch(() => {});
    } catch (e) {}
  }

  // ---------------------------
  // PANEL SWITCHING
  // ---------------------------
  function showPipPanel(panelName) {
    const panels = document.querySelectorAll('.pip-panel');
    panels.forEach(p => {
      if (p.id === `panel-${panelName}`) {
        p.classList.remove('hidden');
        p.classList.add('active');
      } else {
        p.classList.add('hidden');
        p.classList.remove('active');
      }
    });

    const tabs = document.querySelectorAll('.pip-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.panel === panelName);
    });

    playPipSound('snd-tab');

    if (panelName === 'map') {
      triggerMapWarmup();
      setTimeout(() => {
        if (window._map && typeof window._map.invalidateSize === 'function') {
          window._map.invalidateSize();
        }
      }, 200);
    }
  }

  // ---------------------------
  // MAP EFFECTS (CRT warmup, RAD flash)
  // ---------------------------
  function triggerMapWarmup() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;
    mapEl.classList.add('warmup');
    setTimeout(() => mapEl.classList.remove('warmup'), 1500);
  }

  function triggerRadWarning() {
    const flash = document.getElementById('radFlash');
    if (!flash) return;
    flash.style.display = 'block';
    flash.classList.add('rad-warning');
    setTimeout(() => {
      flash.style.display = 'none';
      flash.classList.remove('rad-warning');
    }, 1200);
  }

  window.triggerRadWarning = triggerRadWarning;

  // ---------------------------
  // SCREEN ANIMATIONS
  // ---------------------------
  function pipScreenRoll() {
    const screen = document.getElementById('pipboyScreen');
    if (!screen) return;
    screen.classList.remove('pip-anim-roll');
    void screen.offsetWidth;
    screen.classList.add('pip-anim-roll');
    playPipSound('snd-scroll');
  }

  function pipDegauss() {
    const screen = document.getElementById('pipboyScreen');
    if (!screen) return;
    screen.classList.remove('pip-anim-degauss');
    void screen.offsetWidth;
    screen.classList.add('pip-anim-degauss');
    playPipSound('snd-degauss');
  }

  function pipStaticBurst() {
    const overlay = document.getElementById('pipStaticOverlay');
    if (!overlay) return;
    overlay.classList.remove('pip-anim-static');
    void overlay.offsetWidth;
    overlay.classList.add('pip-anim-static');
    playPipSound('snd-static');
  }

  window.pipScreenRoll = pipScreenRoll;
  window.pipDegauss = pipDegauss;
  window.pipStaticBurst = pipStaticBurst;

  // ---------------------------
  // TABS & SIDEBAR
  // ---------------------------
  function initPipboyTabs() {
    const tabs = document.querySelectorAll('.pip-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.panel;
        showPipPanel(target);
      });
    });
  }

  function initSidebarRouting() {
    const invBtn = document.getElementById('openInventory');
    if (invBtn) {
      invBtn.addEventListener('click', () => {
        showPipPanel('items');
      });
    }

    const questsBtn = document.getElementById('openQuests');
    if (questsBtn) {
      questsBtn.addEventListener('click', () => {
        showPipPanel('quests');
      });
    }

    const tutorialBtn = document.getElementById('openTutorial');
    if (tutorialBtn) {
      tutorialBtn.addEventListener('click', () => {
        if (!localStorage.getItem('tutorialComplete')) {
          alert('HOW TO PLAY: Explore the Mojave, follow POIs, complete quests, and claim mintables with your wallet.');
          localStorage.setItem('tutorialComplete', '1');
        } else {
          playPipSound('snd-error');
        }
      });
    }
  }

  // Optional: sidebar collapse on mobile (you can wire a button to this)
  function toggleSidebar() {
    const sb = document.querySelector('.sidebar');
    if (!sb) return;
    sb.classList.toggle('open');
  }

  window.toggleSidebar = toggleSidebar;

  // ---------------------------
  // WALLET + CLAIM FLOW IN UI
  // ---------------------------
  async function connectWalletAndMaybeClaim() {
    if (typeof window.connectWallet !== 'function') {
      alert('Wallet system not ready.');
      return;
    }

    await window.connectWallet();

    if (typeof window.claimMintableFromServer === 'function') {
      const confirmClaim = confirm('Wallet connected. Claim a mintable item now?');
      if (confirmClaim) {
        await window.claimMintableFromServer();
      }
    }
  }

  function initWalletButtons() {
    const btns = [
      document.getElementById('connectWallet'),
      document.getElementById('connectWalletStat')
    ];

    btns.forEach(btn => {
      if (!btn) return;
      btn.addEventListener('click', async () => {
        await connectWalletAndMaybeClaim();
      });
    });

    // Sidebar claim button (if you keep it) triggers the same flow
    const sidebarClaim = document.getElementById('claimMintablesSidebar');
    if (sidebarClaim) {
      sidebarClaim.addEventListener('click', async () => {
        await connectWalletAndMaybeClaim();
      });
    }
  }

  // ---------------------------
  // AUDIO CONTEXT WARMUP (fix autoplay issues)
  // ---------------------------
  function initAudioContextWarmup() {
    const handler = () => {
      try {
        if (!window.__pipAudioCtx) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            ctx.resume().catch(() => {});
            window.__pipAudioCtx = ctx;
          }
        } else {
          window.__pipAudioCtx.resume().catch(() => {});
        }
      } catch (e) {}
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
      document.removeEventListener('touchstart', handler);
    };

    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
  }
  // ============================================================
// BURN-IN PROTECTION PACK
// ============================================================

let inactivityTimer = null;
let lastActivity = Date.now();

// Reset inactivity timer on any input
function resetInactivity() {
  lastActivity = Date.now();
  const screen = document.getElementById('pipboyScreen');
  if (screen) screen.classList.remove('sleep');
}
['mousemove','keydown','click','touchstart'].forEach(evt => {
  document.addEventListener(evt, resetInactivity);
});

// Auto-dim after 2 minutes
setInterval(() => {
  const screen = document.getElementById('pipboyScreen');
  if (!screen) return;

  const idle = Date.now() - lastActivity;
  if (idle > 120000) { // 2 minutes
    screen.classList.add('sleep');
  }
}, 5000);

// Random static burst every 3–6 minutes
setInterval(() => {
  if (Math.random() < 0.5) return; // 50% chance
  if (typeof pipStaticBurst === 'function') {
    pipStaticBurst();
  }
}, 180000 + Math.random() * 180000); // 3–6 minutes

// Wake-up animation when returning from sleep
document.addEventListener('click', () => {
  const screen = document.getElementById('pipboyScreen');
  if (screen && screen.classList.contains('sleep')) {
    screen.classList.remove('sleep');
    if (typeof pipScreenRoll === 'function') pipScreenRoll();
    if (typeof pipDegauss === 'function') pipDegauss();
  }
  });

  // ---------------------------
  // INIT
  // ---------------------------
  function initPipboy() {
    initPipboyTabs();
    initSidebarRouting();
    initWalletButtons();
    initAudioContextWarmup();

    // Start on MAP panel with a screen roll
    showPipPanel('map');
    setTimeout(pipScreenRoll, 200);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Boot.js will show Pip-Boy and dispatch pipboyReady.
    window.addEventListener('pipboyReady', () => {
      initPipboy();
    });
  });
})();
