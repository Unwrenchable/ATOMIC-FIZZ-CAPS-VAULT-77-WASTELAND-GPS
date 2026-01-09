// pipboy.js
// Tabs, panel switching, basic routing for buttons (Pip-Boy shell)

(function () {
  const tabs = Array.from(document.querySelectorAll(".pip-tab"));
  const panels = {
    map: document.getElementById("panel-map"),
    stat: document.getElementById("panel-stat"),
    items: document.getElementById("panel-items"),
    quests: document.getElementById("panel-quests"),
    exchange: document.getElementById("panel-exchange"),
  };

  function setActivePanel(panelKey) {
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      const isActive = key === panelKey;
      el.classList.toggle("active", isActive);
      el.classList.toggle("hidden", !isActive);
    });

    tabs.forEach((tab) => {
      const tKey = tab.getAttribute("data-panel");
      tab.classList.toggle("active", tKey === panelKey);
    });

    // MAP: let ui-wiring handle map init / Game.onMapReady
    if (panelKey === "map") {
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

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.getAttribute("data-panel");
      if (!key) return;
      setActivePanel(key);
    });
  });

  setActivePanel("map");

  // Sidebar quick action buttons route to panels
  const openInventoryBtn = document.getElementById("openInventory");
  const openQuestsBtn = document.getElementById("openQuests");
  const openTutorialBtn = document.getElementById("openTutorial");

  if (openInventoryBtn) {
    openInventoryBtn.addEventListener("click", () => setActivePanel("items"));
  }
  if (openQuestsBtn) {
    openQuestsBtn.addEventListener("click", () => setActivePanel("quests"));
  }
  if (openTutorialBtn) {
    openTutorialBtn.addEventListener("click", () => setActivePanel("stat"));
  }

  const claimSidebar = document.getElementById("claimMintablesSidebar");
  const claimMain = document.getElementById("claimMintables");
  const claimStat = document.getElementById("claimMintablesStat");

  function triggerClaimMintables() {
    if (typeof window.claimMintables === "function") {
      window.claimMintables();
    } else {
      console.warn("[PipBoy] claimMintables() not defined yet");
    }
  }

  [claimSidebar, claimMain, claimStat].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", triggerClaimMintables);
  });

  const connectWalletBtn = document.getElementById("connectWallet");
  const connectWalletStat = document.getElementById("connectWalletStat");

  async function triggerConnectWallet() {
    // Prefer Game engine if present
    if (window.Game && typeof Game.connectWallet === "function") {
      try {
        const addr = await Game.connectWallet();
        const label = addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : "CONNECTED";

        if (connectWalletBtn) {
          connectWalletBtn.textContent = label;
          connectWalletBtn.classList.add("connected");
        }
        if (connectWalletStat) {
          connectWalletStat.textContent = label;
          connectWalletStat.classList.add("connected");
        }
      } catch (e) {
        console.warn("[PipBoy] Game.connectWallet failed:", e);
        alert("Wallet connect failed.");
      }
      return;
    }

    // Fallback to older global connectWallet if Game not available
    if (typeof window.connectWallet === "function") {
      window.connectWallet();
    } else {
      console.warn("[PipBoy] No wallet connect function available.");
      alert("Wallet system offline.");
    }
  }

  [connectWalletBtn, connectWalletStat].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", triggerConnectWallet);
  });
})();
