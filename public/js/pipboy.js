// ============================================================
// PIP‑BOY UI CONTROLLER
// Handles tab switching, panel visibility, CRT warmup,
// rad flash, and routing UI buttons to existing game logic.
// ============================================================

// Show a panel by name: "map", "stat", "items", "quests", "exchange"
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

  // Update active tab
  const tabs = document.querySelectorAll('.pip-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.panel === panelName);
  });

  // Map warm-up effect
  if (panelName === 'map') {
    triggerMapWarmup();
  }
}

// CRT warm-up animation
function triggerMapWarmup() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  mapEl.classList.add('warmup');
  setTimeout(() => mapEl.classList.remove('warmup'), 1500);
}

// RAD warning flash
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

// Initialize tab click handlers
function initPipboyTabs() {
  const tabs = document.querySelectorAll('.pip-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.panel;
      showPipPanel(target);
    });
  });
}

// Load quests from JSON
async function loadQuestsIntoPipboy() {
  try {
    const res = await fetch('/data/quests.json');
    const quests = await res.json();
    const container = document.getElementById('questList');
    container.innerHTML = quests.map(q => `
      <div class="quest-item">
        <div class="quest-title">${q.title}</div>
        <div class="quest-desc">${q.description}</div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Failed to load quests', e);
  }
}

// Mirror HUD → STAT panel
function syncStatPanel() {
  document.getElementById('statLevel').textContent = document.getElementById('lvl').textContent;
  document.getElementById('statXP').textContent = document.getElementById('xpText').textContent;
  document.getElementById('statCaps').textContent = document.getElementById('caps').textContent;
}

// Init Pip‑Boy UI
function initPipboy() {
  initPipboyTabs();

  // Map init (your existing function)
  if (typeof initWastelandMap === 'function') {
    initWastelandMap();
  }

  // Load quests
  loadQuestsIntoPipboy();

  // Inventory (your existing function)
  if (typeof renderInventory === 'function') {
    renderInventory(document.getElementById('inventoryList'));
  }

  // Exchange (your existing function)
  if (typeof renderExchange === 'function') {
    renderExchange(document.getElementById('exchangeContent'));
  }

  // Wallet buttons
  const walletBtns = [
    document.getElementById('connectWallet'),
    document.getElementById('connectWalletStat')
  ];
  walletBtns.forEach(btn => {
    if (btn && typeof connectWallet === 'function') {
      btn.addEventListener('click', connectWallet);
    }
  });

  // Claim mintables buttons
  const claimBtns = [
    document.getElementById('claimMintables'),
    document.getElementById('claimMintablesStat'),
    document.getElementById('claimMintablesSidebar')
  ];
  claimBtns.forEach(btn => {
    if (btn && typeof claimMintables === 'function') {
      btn.addEventListener('click', claimMintables);
    }
  });

  // Sync STAT panel with HUD
  syncStatPanel();
}

// Boot
document.addEventListener('DOMContentLoaded', initPipboy);
