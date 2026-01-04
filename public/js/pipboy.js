// pipboy.js
// Tabs, panel switching, basic routing for buttons

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

  function triggerClaim() {
    if (typeof window.claimMintables === "function") {
      window.claimMintables();
    }
  }

  [claimSidebar, claimMain, claimStat].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", triggerClaim);
  });

  const connectWalletBtn = document.getElementById("connectWallet");
  const connectWalletStat = document.getElementById("connectWalletStat");

  function triggerConnectWallet() {
    if (typeof window.connectWallet === "function") {
      window.connectWallet();
    }
  }

  [connectWalletBtn, connectWalletStat].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", triggerConnectWallet);
  });
})();
