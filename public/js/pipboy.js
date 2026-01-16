// pipboy.js
// Pip‑Boy shell: tabs, panel switching, swipe navigation, routing

(function () {
  const tabs = Array.from(document.querySelectorAll(".pip-tab"));
  const panels = {
    map: document.getElementById("panel-map"),
    stat: document.getElementById("panel-stat"),
    items: document.getElementById("panel-items"),
    quests: document.getElementById("panel-quests"),
    exchange: document.getElementById("panel-exchange"),
  };

  // ------------------------------------------------------------
  // CORE PANEL SWITCHER
  // ------------------------------------------------------------
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

    // MAP PANEL ACTIVATION
    if (panelKey === "map") {
      // Initialize map module if needed
      if (window.Game && Game.modules?.worldmap) {
        try {
          Game.modules.worldmap.onOpen();
        } catch (e) {
          console.warn("[PipBoy] worldmap.onOpen failed:", e);
        }
      }

      // Resize Leaflet after panel animation
      setTimeout(() => {
        if (window.map && typeof window.map.invalidateSize === "function") {
          window.map.invalidateSize();
        }
      }, 200);
    }
  }

  // ------------------------------------------------------------
  // CLICK‑TO‑SWITCH TABS
  // ------------------------------------------------------------
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.getAttribute("data-panel");
      if (key) setActivePanel(key);
    });
  });

  // ------------------------------------------------------------
  // SWIPE‑TO‑SWITCH TABS (mobile + trackpads)
  // ------------------------------------------------------------
  (function enableSwipeTabs() {
    let startX = 0;
    let endX = 0;
    const threshold = 50;

    function activateTabByIndex(i) {
      const tab = tabs[i];
      if (!tab) return;
      const key = tab.getAttribute("data-panel");
      if (key) setActivePanel(key);
    }

    document.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
    });

    document.addEventListener("touchend", (e) => {
      endX = e.changedTouches[0].clientX;
      const diff = endX - startX;

      const activeIndex = tabs.findIndex((t) =>
        t.classList.contains("active")
      );

      if (diff > threshold && activeIndex > 0) {
        activateTabByIndex(activeIndex - 1); // swipe right
      } else if (diff < -threshold && activeIndex < tabs.length - 1) {
        activateTabByIndex(activeIndex + 1); // swipe left
      }
    });
  })();

  // ------------------------------------------------------------
  // BOOT DIRECTLY INTO MAP PANEL
  // ------------------------------------------------------------
  setActivePanel("map");

  // ------------------------------------------------------------
  // SIDEBAR QUICK ACTION BUTTONS
  // ------------------------------------------------------------
  const openInventoryBtn = document.getElementById("openInventory");
  const openQuestsBtn = document.getElementById("openQuests");
  const openTutorialBtn = document.getElementById("openTutorial");

  if (openInventoryBtn) openInventoryBtn.addEventListener("click", () => setActivePanel("items"));
  if (openQuestsBtn) openQuestsBtn.addEventListener("click", () => setActivePanel("quests"));
  if (openTutorialBtn) openTutorialBtn.addEventListener("click", () => setActivePanel("stat"));

  // ------------------------------------------------------------
  // CLAIM BUTTONS
  // ------------------------------------------------------------
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
    if (btn) btn.addEventListener("click", triggerClaimMintables);
  });

  // ------------------------------------------------------------
  // WALLET CONNECT
  // ------------------------------------------------------------
  const connectWalletBtn = document.getElementById("connectWallet");
  const connectWalletStat = document.getElementById("connectWalletStat");

  async function triggerConnectWallet() {
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

    if (typeof window.connectWallet === "function") {
      window.connectWallet();
    } else {
      console.warn("[PipBoy] No wallet connect function available.");
      alert("Wallet system offline.");
    }
  }

  [connectWalletBtn, connectWalletStat].forEach((btn) => {
    if (btn) btn.addEventListener("click", triggerConnectWallet);
  });
})();
