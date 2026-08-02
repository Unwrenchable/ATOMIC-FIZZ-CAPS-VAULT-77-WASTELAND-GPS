// pipboy.js
// Pocket-Boy shell: tabs, panel switching, swipe navigation, routing

(function () {
  // Correct selector + correct attribute
  const tabs = Array.from(document.querySelectorAll(".pipboy-tab"));
  const panels = {
    map: document.getElementById("panel-map"),
    stat: document.getElementById("panel-stat"),
    items: document.getElementById("panel-items"),
    quests: document.getElementById("panel-quests"),
    radio: document.getElementById("panel-radio"),
    exchange: document.getElementById("panel-exchange"),
    battle: document.getElementById("panel-battle"),
  };
  
  // Configuration constants
  const MAP_INVALIDATE_DELAY_DESKTOP = 200;
  const MAP_INVALIDATE_DELAY_MOBILE = 500;
  
  // Shared mobile detection utility
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || window.innerWidth <= 768;
  }

  // Render character portrait in STAT tab
  function renderCharacterPortrait() {
    if (!Game.modules?.CharacterCreator) return;
    const cc = Game.modules.CharacterCreator;
    // Only render if module is actually initialized (has appearanceOptions)
    if (!cc.appearanceOptions) return;
    const savedAppearance = cc.loadSavedAppearance();
    const appearance = savedAppearance || (cc.getAppearance?.());
    if (appearance) {
      const portraitDiv = document.getElementById('statPortraitSvg');
      if (portraitDiv) {
        // Generate at 150px (height of frame) so portrait fills the 120×150 container
        const html = cc.generatePortraitSVG(appearance, 150);
        // Clip to container dimensions so image fills frame without overflow
        portraitDiv.innerHTML = `<div style="width:120px;height:150px;overflow:hidden;">${html}</div>`;
      }
    }
  }

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
      const tKey = tab.getAttribute("data-pipboy-tab"); // FIXED
      tab.classList.toggle("active", tKey === `panel-${panelKey}`);
    });

    // MAP PANEL ACTIVATION
    if (panelKey === "map") {
      // QUEST HOOK: Wake Up → open_map
      Game.quests?.completeObjective("wake_up", "open_map");

      // Only call onOpen() when the Pocket-Boy screen itself is visible.
      // At script startup (line below module body) setActivePanel("map") is
      // called while pipboyScreen still has the `hidden` class (display:none),
      // so the map container has 0×0 dimensions.  Firing onOpen() then starts
      // the 10-retry loop for nothing; the wristReady event in worldmap.js
      // will properly trigger onOpen() after the boot screen dismisses.
      const pipboyScreenEl = document.getElementById('pipboyScreen');
      const screenVisible = !pipboyScreenEl || !pipboyScreenEl.classList.contains('hidden');
      if (screenVisible && window.Game && Game.modules?.worldmap) {
        try {
          Game.modules.worldmap.onOpen();
        } catch (e) {
          console.warn("[PipBoy] worldmap.onOpen failed:", e);
        }
      }

      // Additional invalidateSize after panel switch (longer delay for mobile)
      const delay = isMobileDevice() ? MAP_INVALIDATE_DELAY_MOBILE : MAP_INVALIDATE_DELAY_DESKTOP;
      const secondDelay = delay + (isMobileDevice() ? 300 : 150);

      function doInvalidate() {
        // Check both window.map and Game.modules.worldmap.map
        const mapInstance = window.map || (Game.modules?.worldmap?.map);
        if (mapInstance && typeof mapInstance.invalidateSize === "function") {
          console.log(`[PipBoy] invalidating map size after panel switch`);
          mapInstance.invalidateSize(true);
        }
      }

      setTimeout(doInvalidate, delay);
      setTimeout(doInvalidate, secondDelay);
    }

    // ITEMS PANEL ACTIVATION
    if (panelKey === "items") {
      // QUEST HOOK: Wake Up → open_inventory
      Game.quests?.completeObjective("wake_up", "open_inventory");

      // Prefer the full-featured inventory-ui renderer (tabs + paperdoll)
      // Fall back to the simpler main.js renderer if unavailable
      try {
        if (Game.ui?.renderInventory) {
          Game.ui.renderInventory();
        } else if (window.renderInventoryPanel) {
          window.renderInventoryPanel();
        }
      } catch (e) {
        console.warn("[PipBoy] renderInventory failed:", e);
      }
    }

    // STAT PANEL ACTIVATION — Update character stats when tab is opened
    if (panelKey === "stat") {
      // Initialize character creator only when STATS tab is first opened
      if (Game.modules?.CharacterCreator && !Game.modules.CharacterCreator._initialized) {
        try {
          Game.modules.CharacterCreator.init().then(() => {
            Game.modules.CharacterCreator._initialized = true;
            console.log("[PipBoy] Character creator initialized on STATS tab open");
            // Update stats display after initialization
            if (window.updateStatDisplay) {
              window.updateStatDisplay();
            }
            // Render character portrait
            renderCharacterPortrait();
          }).catch(err => {
            console.warn("[PipBoy] Character creator initialization failed:", err);
          });
        } catch (e) {
          console.warn("[PipBoy] Character creator init call failed:", e);
        }
      } else {
        // Update stats display every time STATS tab is opened (after initialization)
        if (window.updateStatDisplay) {
          window.updateStatDisplay();
        }
        // Render character portrait
        renderCharacterPortrait();
      }
    }

    // QUESTS PANEL ACTIVATION - render quest UI
    if (panelKey === "quests") {
      // Prefer full-featured quest-ui renderer (objectives, accept/decline buttons)
      // Fall back to simpler main.js renderer
      try {
        if (Game.ui?.renderQuest) {
          Game.ui.renderQuest();
        } else if (window.renderQuestsPanel) {
          window.renderQuestsPanel();
        }
      } catch (e) {
        console.warn("[PipBoy] renderQuest failed:", e);
      }
    }

    // EXCHANGE PANEL ACTIVATION - render all exchange sections
    if (panelKey === "exchange") {
      try {
        if (window.renderExchangeClaimSection) window.renderExchangeClaimSection();
        if (window.renderExchangeCraftingSection) window.renderExchangeCraftingSection();
        if (window.renderDemoExchange) window.renderDemoExchange();
        console.log("[PipBoy] Exchange panel initialized");
      } catch (e) {
        console.warn("[PipBoy] Exchange panel initialization failed:", e);
      }
    }

    // RADIO PANEL ACTIVATION
    if (panelKey === "radio") {
      // QUEST HOOK: Wake Up → turn_on_radio
      Game.quests?.completeObjective("wake_up", "turn_on_radio");
    }
  }

  // ------------------------------------------------------------
  // CLICK‑TO‑SWITCH TABS
  // ------------------------------------------------------------
  tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const key = tab.getAttribute("data-pipboy-tab"); // FIXED
    if (!key) return;
    const panelKey = key.replace("panel-", ""); // FIXED
    setActivePanel(panelKey);
  });
});


  // ------------------------------------------------------------
  // SWIPE‑TO‑SWITCH TABS
  // ------------------------------------------------------------
  (function enableSwipeTabs() {
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;
    let touchStartedOnMap = false;
    let touchStartTime = 0;
    // Increased threshold (100px) to prevent accidental tab switches.
    // Swipe must also be predominantly horizontal (horiz > vertical) to
    // avoid triggering when the user is scrolling panel content.
    const threshold = 100;

    function activateTabByIndex(i) {
      const tab = tabs[i];
      if (!tab) return;
      const key = tab.getAttribute("data-pipboy-tab");
      if (!key) return;
      const panelKey = key.replace("panel-", "");
      setActivePanel(panelKey);
    }

    document.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      touchStartTime = Date.now();
      touchStartedOnMap = !!(e.target && e.target.closest && e.target.closest('#mapContainer'));
    });

    document.addEventListener("touchend", (e) => {
      if (touchStartedOnMap) return;
      endX = e.changedTouches[0].clientX;
      endY = e.changedTouches[0].clientY;
      const diffX = endX - startX;
      const diffY = endY - startY;
      const elapsed = Date.now() - touchStartTime;

      // Ignore long-press or slow drags (> 600ms)
      if (elapsed > 600) return;

      // Swipe must be more horizontal than vertical to avoid scroll conflicts
      if (Math.abs(diffX) <= Math.abs(diffY)) return;

      const activeIndex = tabs.findIndex((t) =>
        t.classList.contains("active")
      );

      if (diffX > threshold && activeIndex > 0) {
        activateTabByIndex(activeIndex - 1);
      } else if (diffX < -threshold && activeIndex !== -1 && activeIndex < tabs.length - 1) {
        activateTabByIndex(activeIndex + 1);
      }
    });
  })();

  // ------------------------------------------------------------
  // BOOT DIRECTLY INTO MAP PANEL
  // (Honour ?tab= deep-link if present in the URL)
  // ------------------------------------------------------------
  setActivePanel("map");

  // Support marketing / share links like /?tab=quests, /?tab=exchange, etc.
  // Run after setActivePanel("map") so the map panel is always the safe fallback.
  (function applyTabDeepLink() {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const validTabs = ["map", "stat", "items", "quests", "radio", "exchange"];
      if (tabParam && validTabs.includes(tabParam.toLowerCase())) {
        setActivePanel(tabParam.toLowerCase());
      }
    } catch (e) {
      // Silently ignore — URLSearchParams unavailable or malformed URL
    }
  })();

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

  // ------------------------------------------------------------
  // NOTE: pipboyReady event is now dispatched by boot.js after
  // the user dismisses the boot screen. This prevents duplicate
  // event dispatches that were causing multiple radio player
  // instances to be created (resulting in audio overlap).
  // ------------------------------------------------------------

  // Expose panel switcher for other modules (e.g. battle auto-open/close)
  if (!window.Game) window.Game = {};
  window.Game.pipboy = { setActivePanel };

})();

