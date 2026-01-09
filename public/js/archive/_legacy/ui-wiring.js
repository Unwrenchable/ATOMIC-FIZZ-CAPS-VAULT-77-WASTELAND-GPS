// public/js/ui-wiring.js
// Unified UI wiring on top of Game engine + Pip-Boy shell

document.addEventListener("DOMContentLoaded", () => {
  console.log("[UI] Wiring initializing…");

  //
  // 0. BOOT GAME ENGINE (if present)
  //
  if (window.Game) {
    try {
      Game.init();
      Game.onPipboyReady();
    } catch (e) {
      console.warn("[UI] Game.init/onPipboyReady failed:", e);
    }

    // Subscribe to engine hooks
    Game.hooks.onPlayerUpdated = (player) => {
      updateHUDFromPlayer(player);
      updateStatPanelFromPlayer(player);
    };

    Game.hooks.onInventoryUpdated = (inv) => {
      // You can expand this later to re-render ITEMS panel lists.
      // For now we just log.
      console.log("[UI] Inventory updated:", inv);
    };

    Game.hooks.onQuestsUpdated = (quests) => {
      // You can expand this later to re-render QUESTS panel lists.
      console.log("[UI] Quests updated:", quests);
    };

    Game.hooks.onClaimResult = (result) => {
      console.log("[UI] Claim result:", result);
      // Here is where you'd show a modal, play SFX, etc.
      // For now, just a simple alert for visibility.
      if (result.ok) {
        const locName = result.location?.n || result.location?.id || "UNKNOWN";
        alert(`Claim successful at ${locName}! Check CAPS, XP, and gear.`);
      } else {
        alert(`Claim failed: ${result.error || "Unknown error"}`);
      }
    };

    Game.hooks.onError = (err) => {
      console.warn("[UI] Engine error:", err);
    };
  }

  //
  // 1. TAB SWITCHING (PANELS + VIEWS)
  //
  const tabButtons = document.querySelectorAll(".pipboy-tab");
  const panels = document.querySelectorAll(".pipboy-panel");
  const views = document.querySelectorAll(".pipboy-view");
  const body = document.body;

  function activateTab(tab) {
    if (!tab) return;

    // Tabs
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    // Left panels
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === tab);
    });

    // Right views
    views.forEach((view) => {
      view.classList.toggle("active", view.dataset.view === tab);
    });

    // Exchange mode frame
    if (tab === "exchange") {
      body.classList.add("exchange-mode");
    } else {
      body.classList.remove("exchange-mode");
    }

    // MAP tab: ensure map is initialized and resized
    if (tab === "map") {
      if (typeof initWastelandMap === "function") {
        initWastelandMap();
      }
      if (window.Game && typeof Game.onMapReady === "function") {
        Game.onMapReady();
      }
      setTimeout(() => {
        if (window.wastelandMap?.invalidateSize) {
          window.wastelandMap.invalidateSize();
        }
      }, 200);
    }
  }

  // Attach tab listeners
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activateTab(btn.dataset.tab);
    });
  });

  // Initial tab
  activateTab("map");

  //
  // 2. EXCHANGE TERMINAL CATEGORY SWITCHING
  //
  const exchangeMenuItems = document.querySelectorAll(".exchange-menu-item");
  const exchangeContent = document.getElementById("exchange-content");

  function renderExchangeView(mode) {
    if (!exchangeContent) return;

    switch (mode) {
      case "marketplace": {
        const trades = (window.getActiveTrades && window.getActiveTrades()) || [];
        if (!trades.length) {
          exchangeContent.innerHTML = `
            <div class="exchange-placeholder">
              <h2>MARKETPLACE</h2>
              <p>No active trades detected. Vault-77 exchange queue is empty.</p>
            </div>
          `;
          return;
        }

        const cards = trades
          .map((t) => {
            const when = t.posted ? new Date(t.posted) : null;
            const ts = when
              ? when.toISOString().slice(0, 16).replace("T", " ")
              : "--";
            return `
              <div class="exchange-card">
                <div class="exchange-card-header">
                  <span class="exchange-seller">${t.seller}</span>
                  <span class="exchange-wallet">${t.wallet}</span>
                </div>
                <div class="exchange-card-body">
                  <div class="exchange-row">
                    <span class="label">OFFER:</span>
                    <span class="value">${t.offer}</span>
                  </div>
                  <div class="exchange-row">
                    <span class="label">WANT:</span>
                    <span class="value">${t.want}</span>
                  </div>
                  <div class="exchange-row">
                    <span class="label">POSTED:</span>
                    <span class="value">${ts} ZULU</span>
                  </div>
                  <div class="exchange-desc">
                    ${t.description || ""}
                  </div>
                </div>
                <div class="exchange-card-footer">
                  <button class="pipboy-button exchange-buy-btn" disabled>
                    BUY (COMING SOON)
                  </button>
                </div>
              </div>
            `;
          })
          .join("");

        exchangeContent.innerHTML = `
          <div class="exchange-section">
            <h2>MARKETPLACE</h2>
            <p class="small">Browse active Wasteland trades. Execution flow will be wired to backend APIs.</p>
            <div class="exchange-list">
              ${cards}
            </div>
          </div>
        `;
        break;
      }

      case "listings":
        exchangeContent.innerHTML = `
          <div class="exchange-placeholder">
            <h2>MY LISTINGS</h2>
            <p>Listings tied to your wallet will appear here once backend integration is complete.</p>
          </div>
        `;
        break;

      case "wallet":
        exchangeContent.innerHTML = `
          <div class="exchange-placeholder">
            <h2>WALLET ITEMS</h2>
            <p>Detected NFTs, gear, and items in your connected wallet will be listed here.</p>
          </div>
        `;
        break;

      case "vouchers":
        exchangeContent.innerHTML = `
          <div class="exchange-section">
            <h2>REDEEM VOUCHERS</h2>
            <p class="small">Enter a voucher code to claim a Scavenger Pack. Backend endpoint to be wired.</p>
            <div class="exchange-row">
              <span class="label">VOUCHER CODE:</span>
            </div>
            <input
              id="voucherInput"
              class="exchange-input"
              placeholder="XXXX-XXXX-XXXX"
            />
            <button class="pipboy-button" id="redeemVoucherBtn">
              REDEEM
            </button>
          </div>
        `;
        break;

      case "logs":
        exchangeContent.innerHTML = `
          <div class="exchange-placeholder">
            <h2>SYSTEM LOGS</h2>
            <p>Recent Exchange, Nuke, and Bridge activity will appear here once log streaming is wired.</p>
          </div>
        `;
        break;

      case "nuke":
        exchangeContent.innerHTML = `
          <div class="exchange-section">
            <h2>NUKE GEAR</h2>
            <p class="small">
              Permanently destroy eligible gear or NFTs in exchange for CAPS.
              This panel will call the /nuke-gear endpoint and update your CAPS balance.
            </p>
            <div id="gearList" class="exchange-list">
              <div class="exchange-placeholder">
                <p>Gear from your wallet will be shown here once player data is loaded.</p>
              </div>
            </div>
          </div>
        `;
        break;

      case "bridge":
        exchangeContent.innerHTML = `
          <div class="exchange-section">
            <h2>BRIDGE</h2>
            <p class="small">
              Cross-chain portal between Solana and EVM networks.
              This panel will wire into your existing bridge backend.
            </p>
            <div class="exchange-row">
              <span class="label">SOLANA WALLET:</span>
              <span class="value" id="bridgeSolAddr">NOT CONNECTED</span>
            </div>
            <div class="exchange-row">
              <span class="label">EVM WALLET:</span>
              <span class="value" id="bridgeEvmAddr">NOT CONNECTED</span>
            </div>
            <div class="panel-divider"></div>
            <p class="small">
              When ready, this will show balances, MINT → BRIDGE → RECEIVE flows, and status logs.
            </p>
          </div>
        `;
        break;

      default:
        exchangeContent.innerHTML = `
          <div class="exchange-placeholder">
            <h2>SCAVENGER EXCHANGE TERMINAL</h2>
            <p>Select a category from the left menu.</p>
          </div>
        `;
        break;
    }
  }

  if (exchangeMenuItems.length && exchangeContent) {
    exchangeMenuItems.forEach((item) => {
      item.addEventListener("click", () => {
        exchangeMenuItems.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
        const mode = item.dataset.exchange;
        renderExchangeView(mode);
      });
    });

    // Default Exchange view
    renderExchangeView("marketplace");
  }

  //
  // 3. WALLET CONNECT BUTTON (via Game engine if available)
  //
  const walletBtn = document.getElementById("connectWallet");

  async function handleWalletConnect() {
    if (window.Game && typeof Game.connectWallet === "function") {
      try {
        console.log("[UI] Connecting wallet via Game engine…");
        const addr = await Game.connectWallet();
        if (walletBtn && addr) {
          walletBtn.textContent = `${addr.slice(0, 4)}…${addr.slice(-4)}`;
          walletBtn.classList.add("connected");
        }
        // Mirror into any secondary label if present
        const statBtn = document.getElementById("connectWalletStat");
        if (statBtn && addr) {
          statBtn.textContent = `${addr.slice(0, 4)}…${addr.slice(-4)}`;
          statBtn.classList.add("connected");
        }
      } catch (err) {
        console.warn("[UI] Wallet connect failed:", err);
        alert("Wallet connect failed or rejected.");
      }
    } else {
      // Fallback to old direct Phantom wiring if Game isn't loaded
      try {
        const provider = window.solana || window.phantom?.solana;
        if (!provider?.isPhantom) {
          alert("Phantom wallet not found.");
          return;
        }
        const res = await provider.connect();
        const addr = res.publicKey.toString();
        if (walletBtn) {
          walletBtn.textContent = `${addr.slice(0, 4)}…${addr.slice(-4)}`;
          walletBtn.classList.add("connected");
        }
      } catch (err) {
        console.error("Wallet connect (fallback) failed:", err);
        alert("Wallet connect failed.");
      }
    }
  }

  if (walletBtn) {
    walletBtn.addEventListener("click", handleWalletConnect);
  }

  //
  // 4. GPS REQUEST BUTTON → Game.startGPS (if available)
  //
  const gpsBtn = document.getElementById("request-gps");
  if (gpsBtn) {
    gpsBtn.addEventListener("click", () => {
      console.log("[UI] GPS request triggered");
      if (window.Game && typeof Game.startGPS === "function") {
        Game.startGPS();
      }
    });
  }

  //
  // 5. MAP RESIZE ON WINDOW RESIZE
  //
  window.addEventListener("resize", () => {
    if (window.wastelandMap?.invalidateSize) {
      window.wastelandMap.invalidateSize();
    }
  });

  //
  // 6. GLOBAL CLAIM SHIM (for map-core.js compatibility)
  //
  // map-core.js currently calls `attemptClaim(loc)` on marker click.
  // We route that into Game.claimLocation(loc) safely here.
  //
  window.attemptClaim = async function (loc) {
    console.log("[UI] attemptClaim shim invoked", loc);
    if (window.Game && typeof Game.claimLocation === "function") {
      return Game.claimLocation(loc);
    } else {
      console.warn("[UI] Game engine not available; cannot claim.");
      alert("Claim system offline.");
      return { ok: false, error: "Engine offline" };
    }
  };

  console.log("[UI] Wiring complete");
});

//
// HUD helpers: these stay very small and only touch DOM,
// never core game logic.
//
function updateHUDFromPlayer(player) {
  if (!player) return;

  const lvlEl = document.getElementById("lvl");
  const capsEl = document.getElementById("caps");
  const xpText = document.getElementById("xpText");
  const xpFill = document.getElementById("xpFill");

  if (lvlEl) lvlEl.textContent = player.level;
  if (capsEl) capsEl.textContent = player.caps;

  const needed = player.xpToNext || player.level * 100;
  if (xpText) xpText.textContent = `${player.xp} / ${needed}`;
  if (xpFill) {
    const pct = needed > 0 ? Math.min(100, (player.xp / needed) * 100) : 0;
    xpFill.style.width = `${pct}%`;
  }
}

function updateStatPanelFromPlayer(player) {
  if (!player) return;
  const statLevel = document.getElementById("statLevel");
  const statXP = document.getElementById("statXP");
  const statCaps = document.getElementById("statCaps");
  const statHP = document.getElementById("statHP");
  const statRads = document.getElementById("statRads");

  if (statLevel) statLevel.textContent = player.level;
  if (statCaps) statCaps.textContent = player.caps;
  const needed = player.xpToNext || player.level * 100;
  if (statXP) statXP.textContent = `${player.xp} / ${needed}`;
  if (statHP) statHP.textContent = `${Math.floor(player.hp)} / ${player.maxHp}`;
  if (statRads) statRads.textContent = `${player.rads}`;
}
