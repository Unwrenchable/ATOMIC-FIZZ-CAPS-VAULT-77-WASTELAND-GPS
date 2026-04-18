// public/js/main.js – Player State, Mint Integration, XP/CAPS, Quests + NFT inventory
(function () {
  "use strict";

  // ---------------------------
  // XSS PREVENTION HELPER
  // ---------------------------
  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = String(s == null ? "" : s);
    return d.innerHTML;
  }
  // Expose globally so other modules (struggle-quips, worldmap, etc.) can use one implementation
  window.escapeHtml = window.escapeHtml || escapeHtml;

  // ---------------------------
  // GLOBAL DATA
  // ---------------------------
  window.DATA = window.DATA || {
    scavenger: [],
    mintables: [],
    quests: [],
    locations: [],
    collectibles: [],
    factions: [],
    inventory: [],
    settings: {},
    player: null
  };

  // ---------------------------
  // PLAYER STATE (PER-DEVICE)
  // ---------------------------
  const PLAYER_STATE_KEY = "afc_player_state_v1";

  const PLAYER = {
    inventory: [],
    questsActive: [],
    questsDone: [],
    visitedLocations: [],
    xp: 0,
    caps: 0,
    level: 1
  };
  
  // Expose PLAYER globally for quest module and other systems to sync
  window.PLAYER = PLAYER;

  // ---------------------------
  // ON-CHAIN NFT STATE
  // ---------------------------
  const NFT_STATE = {
    list: [] // array of { mint, name, image, attributes, ... }
  };

  function safeLog(...args) {
    try { console.log(...args); } catch (e) {}
  }
  function safeWarn(...args) {
    try { console.warn(...args); } catch (e) {}
  }
  function safeError(...args) {
    try { console.error(...args); } catch (e) {}
  }

  function loadPlayerState() {
    try {
      const raw = localStorage.getItem(PLAYER_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      if (Array.isArray(parsed.inventory)) PLAYER.inventory = parsed.inventory;
      if (Array.isArray(parsed.questsActive)) PLAYER.questsActive = parsed.questsActive;
      if (Array.isArray(parsed.questsDone)) PLAYER.questsDone = parsed.questsDone;
      if (Array.isArray(parsed.visitedLocations)) PLAYER.visitedLocations = parsed.visitedLocations;
      if (typeof parsed.xp === "number") PLAYER.xp = parsed.xp;
      if (typeof parsed.caps === "number") PLAYER.caps = parsed.caps;
      if (typeof parsed.level === "number") PLAYER.level = parsed.level;

      safeLog("Player state loaded");
    } catch (e) {
      safeWarn("Failed to load player state:", e.message);
    }
  }

  function savePlayerState() {
    try {
      const payload = {
        inventory: PLAYER.inventory,
        questsActive: PLAYER.questsActive,
        questsDone: PLAYER.questsDone,
        visitedLocations: PLAYER.visitedLocations,
        xp: PLAYER.xp,
        caps: PLAYER.caps,
        level: PLAYER.level
      };
      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(payload));
    } catch (e) {
      safeWarn("Failed to save player state:", e.message);
    }
  }

  // ---------------------------
  // MAP / GAME CORE
  // ---------------------------

  let map = null;
  let _gameInitializing = false;
  let _gameInitialized = false;
  let _lastPlayerPosition = null;
  let _geoWatchId = null;
  let _lastQuestCheckPosition = null;
  let _lastQuestCheckAt = 0;
  let gpsLocked = false;
  let connectedWallet = false;

  const CONFIG = {
    defaultCenter: [36.1699, -115.1398],
    defaultZoom: 10,
    apiBase: window.API_BASE || window.BACKEND_URL || window.location.origin
  };

  function attachMapReference() {
    map = window.map || window._map || null;
  }

  // ---------------------------
  // DATA LOADING (hybrid: /api + /data)
  // ---------------------------

  async function loadJson(name) {
    // 1) Try backend API route first: /api/{name}
    try {
      const apiUrl = `${CONFIG.apiBase.replace(/\/+$/, "")}/api/${name}`;
      const res = await fetch(apiUrl, { headers: { "Accept": "application/json" } });
      if (res.ok) {
        const json = await res.json();
        safeLog(`API loaded /api/${name}`);
        return json;
      } else {
        safeWarn(`API /api/${name} responded with ${res.status}`);
      }
    } catch (e) {
      safeWarn(`API fetch failed for /api/${name}:`, e.message);
    }

    // 2) Fallback to static public/data/{name}.json
    try {
      const staticUrl = `/data/${name}.json`;
      const res = await fetch(staticUrl, { headers: { "Accept": "application/json" } });
      if (res.ok) {
        const json = await res.json();
        safeLog(`Static loaded ${staticUrl}`);
        return json;
      } else {
        safeWarn(`Static ${staticUrl} responded with ${res.status}`);
      }
    } catch (e) {
      safeWarn(`Local fallback failed for /data/${name}.json:`, e.message);
    }

    safeWarn(`Failed to load ${name} from API or /data`);
    return null;
  }

  async function loadAllData() {
    const names = ["locations", "quests", "mintables", "scavenger", "settings"];

    for (const name of names) {
      const data = await loadJson(name);
      if (data !== null) {
        window.DATA[name] = data;
        safeLog(`Loaded ${name}:`, Array.isArray(data) ? data.length : "object");
      } else {
        // Ensure types are sane even if missing
        if (["locations", "quests", "mintables", "scavenger"].includes(name)) {
          window.DATA[name] = [];
        } else if (name === "settings") {
          window.DATA.settings = window.DATA.settings || {};
        }
      }
    }

    window.DATA.locations = Array.isArray(window.DATA.locations) ? window.DATA.locations : [];
    window.DATA.quests = Array.isArray(window.DATA.quests) ? window.DATA.quests : [];
    window.DATA.mintables = Array.isArray(window.DATA.mintables) ? window.DATA.mintables : [];
    window.DATA.scavenger = Array.isArray(window.DATA.scavenger) ? window.DATA.scavenger : [];
    window.DATA.settings = window.DATA.settings || {};
  }

  // ---------------------------
  // GAMEPLAY HELPERS
  // ---------------------------

  function distanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function resolveItemById(id) {
    if (!id) return { name: "Unknown Item", description: "" };

    // Prefer Game.modules.mintables if loaded
    if (
      window.Game &&
      Game.modules &&
      Game.modules.mintables &&
      Game.modules.mintables.loaded
    ) {
      const fromMintables = Game.modules.mintables.getById(id);
      if (fromMintables) return fromMintables;
    }

    const mintables = window.DATA.mintables || [];
    const fromMintablesData = mintables.find(
      i => i && (i.id === id || i.slug === id || i.mintableId === id)
    );
    if (fromMintablesData) return fromMintablesData;

    // Check the items database (loaded by inventory-loader.js)
    if (window.Game && Game.player && Array.isArray(Game.player.items)) {
      const fromDb = Game.player.items.find(i => i && i.id === id);
      if (fromDb) return fromDb;
    }

    // Check the player's actual PlayerState inventory for full item objects
    if (window.Game && Game.modules?.PlayerState?.getItem) {
      const fromState = Game.modules.PlayerState.getItem(id);
      if (fromState) return fromState;
    }

    return { name: id, description: "" };
  }

  function givePlayerItemById(itemId) {
    if (!itemId) return;
    if (!PLAYER.inventory.includes(itemId)) {
      PLAYER.inventory.push(itemId);
      savePlayerState();
      renderInventoryPanel();
      safeLog("Player received item:", itemId);
    }
  }

  function markLocationVisited(locationIdOrName) {
    if (!locationIdOrName) return;
    if (!PLAYER.visitedLocations.includes(locationIdOrName)) {
      PLAYER.visitedLocations.push(locationIdOrName);
      savePlayerState();
    }
  }

  function activateQuest(questId) {
    if (!questId) return;
    if (
      PLAYER.questsDone.includes(questId) ||
      PLAYER.questsActive.includes(questId)
    ) {
      return;
    }
    PLAYER.questsActive.push(questId);
    savePlayerState();
    renderQuestsPanel();
    safeLog("Quest activated:", questId);
  }

  function addXP(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return;
    PLAYER.xp = Math.max(0, PLAYER.xp + amount);
    checkLevelUp();
    savePlayerState();
    updateHUD();
  }

  function addCaps(amount) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount === 0) return;
    PLAYER.caps = Math.max(0, PLAYER.caps + amount);

    // Sync to world simulation player caps
    if (window.overseerWorldState && window.overseerWorldState.player) {
      window.overseerWorldState.player.caps = PLAYER.caps;
    }

    savePlayerState();
    updateHUD();
  }

  function checkLevelUp() {
    const needed = PLAYER.level * 100;
    if (PLAYER.xp >= needed) {
      PLAYER.xp -= needed;
      PLAYER.level += 1;
      // Use non-blocking notification instead of alert()
      if (window.Game?.modules?.worldmap?.showMapMessage) {
        Game.modules.worldmap.showMapMessage(`⬆ LEVEL UP! You are now Level ${PLAYER.level}!`);
      } else {
        const lvlToast = document.createElement("div");
        lvlToast.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,20,0,0.95);border:2px solid #00ff41;padding:20px 32px;font-family:monospace;font-size:22px;color:#00ff41;z-index:99999;text-align:center;pointer-events:none;";
        lvlToast.textContent = `⬆ LEVEL UP! Level ${PLAYER.level}`;
        document.body.appendChild(lvlToast);
        setTimeout(() => lvlToast.remove(), 3000);
      }
    }
  }

  // eslint-disable-next-line no-unused-vars
  function completeQuest(questId) {
    if (!questId) return;
    if (!PLAYER.questsActive.includes(questId)) return;

    PLAYER.questsActive = PLAYER.questsActive.filter(id => id !== questId);
    if (!PLAYER.questsDone.includes(questId)) {
      PLAYER.questsDone.push(questId);
    }

    const quest = (window.DATA.quests || []).find(
      q => q && (q.id === questId || q.slug === questId)
    );

    if (quest?.rewards?.items) {
      quest.rewards.items.forEach(itemId => givePlayerItemById(itemId));
    }

    if (quest?.rewards?.xp) addXP(quest.rewards.xp);
    if (quest?.rewards?.caps) addCaps(quest.rewards.caps);

    savePlayerState();
    renderQuestsPanel();
    renderInventoryPanel();
    updateHUD();
    safeLog("Quest completed:", questId);
  }

  function checkQuestTriggersAtPosition(lat, lng) {
    const quests = window.DATA.quests;
    if (!Array.isArray(quests) || !quests.length) return;

    quests.forEach(q => {
      if (!q) return;
      const qId = q.id || q.slug;
      if (!qId) return;

      if (PLAYER.questsDone.includes(qId) || PLAYER.questsActive.includes(qId)) {
        return;
      }

      let triggered = false;

      // Direct coordinate trigger
      if (
        q.trigger &&
        typeof q.trigger.lat === "number" &&
        typeof q.trigger.lng === "number"
      ) {
        const radius =
          typeof q.trigger.radius === "number" ? q.trigger.radius : 75;
        const d = distanceMeters(lat, lng, q.trigger.lat, q.trigger.lng);
        if (d <= radius) triggered = true;
      }

      // Location-based trigger
      if (!triggered && q.location) {
        const locs = window.DATA.locations || [];
        const match = locs.find(
          loc =>
            loc &&
            (loc.id === q.location ||
              loc.slug === q.location ||
              loc.name === q.location)
        );
        if (
          match &&
          typeof match.lat === "number" &&
          typeof match.lng === "number"
        ) {
          const d = distanceMeters(lat, lng, match.lat, match.lng);
          if (d <= (match.triggerRadius || 75)) triggered = true;
        }
      }

      if (triggered) activateQuest(qId);
    });
  }

  // ---------------------------
  // NFT HELPERS (backend /api/player-nfts)
  // ---------------------------

  async function fetchPlayerNFTs(wallet) {
    if (!wallet) {
      safeLog("[NFT] No wallet set; skipping NFT fetch.");
      return [];
    }

    const backend = window.BACKEND_URL || CONFIG.apiBase;
    if (!backend) {
      safeWarn("[NFT] No BACKEND_URL/api base; skipping NFT fetch.");
      return [];
    }

    try {
      const base = backend.replace(/\/+$/, "");
      const url = `${base}/api/player-nfts?wallet=${encodeURIComponent(wallet)}`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        safeWarn("[NFT] NFT fetch failed:", json.error || `HTTP ${res.status}`);
        return [];
      }

      const nfts = Array.isArray(json.nfts) ? json.nfts : [];
      safeLog(`[NFT] Loaded ${nfts.length} NFTs for wallet ${wallet}`);
      return nfts;
    } catch (e) {
      safeError("[NFT] Failed to load NFTs:", e);
      return [];
    }
  }

  async function refreshNFTs() {
    const wallet =
      window.PLAYER_WALLET ||
      (window.solana &&
        window.solana.publicKey &&
        window.solana.publicKey.toBase58
        ? window.solana.publicKey.toBase58()
        : null);

    if (!wallet) {
      NFT_STATE.list = [];
      renderInventoryPanel();
      return;
    }

    const nfts = await fetchPlayerNFTs(wallet);
    NFT_STATE.list = nfts;
    renderInventoryPanel();
  }

  // ---------------------------
  // PANELS RENDERING (Pocket-Boy panels)
  // ---------------------------

  function renderInventoryPanel() {
    const panel = document.getElementById("inventoryList");
    if (!panel) return;

    const parts = [];

    // Off-chain/local items (mintables, quest rewards, etc.)
    if (!PLAYER.inventory.length) {
      parts.push(
        "<p>No items yet — explore the Mojave and claim some caps.</p>"
      );
    } else {
      const entries = PLAYER.inventory
        .map(id => {
          const item = resolveItemById(id);
          const name = escapeHtml(item.name || item.id || item.slug || id);
          const desc = escapeHtml(item.description || "");
          return `
          <div class="pip-entry">
            <strong>${name}</strong><br>
            <span>${desc}</span>
          </div>
        `;
        })
        .join("");
      parts.push("<h2>Inventory</h2>");
      parts.push(entries);
    }

    // On-chain NFTs (devnet, from backend)
    if (NFT_STATE.list.length > 0) {
      const nftEntries = NFT_STATE.list
        .map(nft => {
          const name = escapeHtml(nft.name || "Unnamed NFT");
          const mint = escapeHtml(nft.mint || nft.id || "Unknown mint");
          const attrs = Array.isArray(nft.attributes)
            ? nft.attributes.slice(0, 3)
            : [];
          const attrsHtml = attrs
            .map(
              a =>
                `<div class="pip-attr"><span>${escapeHtml(a.trait_type || "Trait")}:</span> ${escapeHtml(a.value)}</div>`
            )
            .join("");

          const moreTag =
            Array.isArray(nft.attributes) && nft.attributes.length > 3
              ? `<div class="pip-item-more">+ more…</div>`
              : "";

          return `
          <div class="pip-entry pip-entry-nft">
            <strong>${name}</strong><br>
            <span class="pip-nft-mint">${mint}</span>
            <div class="pip-nft-tag">NFT • DEVNET</div>
            <div class="pip-nft-attrs">
              ${attrsHtml}
              ${moreTag}
            </div>
          </div>
        `;
        })
        .join("");

      parts.push("<h2>On-Chain NFTs</h2>");
      parts.push(nftEntries);
    }

    if (!parts.length) {
      panel.innerHTML =
        "<p>No items yet — explore the Mojave and claim some caps.</p>";
    } else {
      panel.innerHTML = parts.join("");
    }
  }

  function renderQuestsPanel() {
    // New Pocket-Boy layout uses questBody
    const panel = document.getElementById("questBody");
    if (!panel) return;

    const quests = window.DATA.quests || [];

    // Get available quests from the quest module
    const available = Game.modules?.quests?.getAvailableQuests?.() || [];

    const active = PLAYER.questsActive
      .map(id => quests.find(q => q && (q.id === id || q.slug === id)))
      .filter(Boolean);

    const done = PLAYER.questsDone
      .map(id => quests.find(q => q && (q.id === id || q.slug === id)))
      .filter(Boolean);

    const renderQuest = (q, extraClass) => {
      const name = escapeHtml(q.name || q.title || q.id || q.slug || "Quest");
      const desc = escapeHtml(q.description || q.flavor || "");
      return `
        <div class="pip-entry ${escapeHtml(extraClass || "")}">
          <strong>${name}</strong><br>
          <span>${desc}</span>
        </div>
      `;
    };

    const renderAvailableQuest = (q) => {
      const name = escapeHtml(q.name || q.title || q.id || q.slug || "Quest");
      const desc = escapeHtml(q.description || q.flavor || "");
      const message = escapeHtml(q.offer?.message || "");
      const questId = escapeHtml(q.id);
      return `
        <div class="pip-entry available-quest">
          <strong style="color: #ffaa00;">⚠️ ${name}</strong><br>
          <span>${message || desc}</span><br>
          <div style="margin-top: 8px;">
            <button class="pipboy-button-small quest-accept-btn" data-quest-id="${questId}">ACCEPT</button>
            <button class="pipboy-button-small quest-decline-btn" data-quest-id="${questId}" style="margin-left: 8px;">DECLINE</button>
          </div>
        </div>
      `;
    };

    const availableHtml = available.length
      ? available.map(q => renderAvailableQuest(q)).join("")
      : "";

    const activeHtml = active.length
      ? active.map(q => renderQuest(q, "active")).join("")
      : "<p>No active quests.</p>";

    const doneHtml = done.length
      ? done.map(q => renderQuest(q, "done")).join("")
      : "<p>No completed quests.</p>";

    panel.innerHTML = `
      ${availableHtml ? `<h2>Available Quests</h2>${availableHtml}` : ''}
      <h2>Active Quests</h2>
      ${activeHtml}
      <h2>Completed</h2>
      ${doneHtml}
    `;

    // Attach event listeners for accept/decline buttons
    panel.querySelectorAll(".quest-accept-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const questId = e.target.getAttribute("data-quest-id");
        if (Game.modules?.quests?.acceptQuest) {
          await Game.modules.quests.acceptQuest(questId);
          renderQuestsPanel(); // Re-render to show updated state
        }
      });
    });

    panel.querySelectorAll(".quest-decline-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const questId = e.target.getAttribute("data-quest-id");
        if (Game.modules?.quests?.declineQuest) {
          Game.modules.quests.declineQuest(questId);
          renderQuestsPanel(); // Re-render to show updated state
        }
      });
    });
  }

  function updateHUD() {
    // Old HUD (if present somewhere)
    const lvlEl = document.getElementById("lvl");
    const capsEl = document.getElementById("caps");
    const xpText = document.getElementById("xpText");
    const xpFill = document.getElementById("xpFill");

    if (lvlEl) lvlEl.textContent = PLAYER.level;
    if (capsEl) capsEl.textContent = PLAYER.caps;

    const needed = PLAYER.level * 100;
    if (xpText) xpText.textContent = `${PLAYER.xp} / ${needed}`;
    if (xpFill) {
      xpFill.style.width = `${Math.min(100, (PLAYER.xp / needed) * 100)}%`;
    }

    // STAT panel in Pocket-Boy
    const statLevel = document.getElementById("stat-level");
    const statXP = document.getElementById("stat-xp");
    const statCaps = document.getElementById("stat-caps");

    if (statLevel) statLevel.textContent = PLAYER.level;
    if (statCaps) statCaps.textContent = PLAYER.caps;
    if (statXP) statXP.textContent = `${PLAYER.xp} / ${needed}`;
  }

  // ---------------------------
  // GEOLOCATION
  // ---------------------------

  function updateGPSBadge(acc) {
    const accDot = document.getElementById("accDot");
    const accText = document.getElementById("accText");
    if (accDot && accText) {
      accText.textContent = `GPS: ${Math.round(acc)}m`;
      accDot.className = acc <= 20 ? "acc-dot acc-good" : "acc-dot";
    }
  }

  function updatePlayerMarker(lat, lng) {
    attachMapReference();
    if (!map || typeof L === "undefined") return;

    if (!map._playerMarker) {
      map._playerMarker = L.circleMarker([lat, lng], {
        radius: 8,
        color: "#00ff66",
        fillColor: "#00ff66",
        fillOpacity: 0.8
      }).addTo(map);
    } else {
      map._playerMarker.setLatLng([lat, lng]);
    }
  }

  function startGeolocationWatch() {
    if (!navigator.geolocation || gpsLocked) return;

    _geoWatchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        _lastPlayerPosition = { lat, lng, acc };

        updateGPSBadge(acc);
        updatePlayerMarker(lat, lng);

        const locs = window.DATA.locations || [];
        locs.forEach(loc => {
          if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
            return;
          }
          const d = distanceMeters(lat, lng, loc.lat, loc.lng);
          const idOrName = loc.id || loc.slug || loc.name;
          if (d <= (loc.triggerRadius || 50) && idOrName) {
            markLocationVisited(idOrName);
          }
        });

        const now = Date.now();
        const canCheckQuests =
          !_lastQuestCheckPosition ||
          distanceMeters(lat, lng, _lastQuestCheckPosition.lat, _lastQuestCheckPosition.lng) > 10 ||
          now - _lastQuestCheckAt > 30000;

        if (canCheckQuests) {
          checkQuestTriggersAtPosition(lat, lng);
          _lastQuestCheckPosition = { lat, lng };
          _lastQuestCheckAt = now;
        }
      },
      err => {
        safeWarn("Geolocation error:", err);
        if (err.code === 1) { // PERMISSION_DENIED
          const permBanner = document.createElement("div");
          permBanner.id = "gps-permission-banner";
          // Accessible colors: high-contrast dark background, white text (avoids red-green blindness)
          permBanner.style.cssText = "position:fixed;top:0;left:0;right:0;background:#1a1a00;color:#ffe066;border-bottom:2px solid #ffe066;font-family:monospace;text-align:center;padding:10px 8px;z-index:9999;font-size:13px;";
          // Platform-aware instructions
          const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
          const isAndroid = /android/i.test(navigator.userAgent);
          let instructions = "go to browser Settings → Site Settings → Location and set to Allow.";
          if (isIOS) instructions = "go to iPhone Settings → Privacy → Location Services → your browser and set to While Using.";
          else if (isAndroid) instructions = "tap the lock icon in your browser address bar → Permissions → Location → Allow.";
          permBanner.textContent = "⚠️ GPS REQUIRED — To explore the Wasteland, " + instructions;
          if (!document.getElementById("gps-permission-banner")) {
            document.body.appendChild(permBanner);
          }
        }
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
    );
  }

  function stopGeolocationWatch() {
    if (_geoWatchId !== null) {
      navigator.geolocation.clearWatch(_geoWatchId);
      _geoWatchId = null;
      gpsLocked = false;
      safeLog("GPS watch stopped");
    }
  }

  // Page Visibility API — stop GPS watch when the page is hidden to save
  // battery; restart it when the page becomes visible again.
  if (!window._mainGpsVisibilityBound) {
    window._mainGpsVisibilityBound = true;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopGeolocationWatch();
      } else {
        startGeolocationWatch();
      }
    });
  }

  // ---------------------------
  // WALLET + MINT
  // ---------------------------

  // WeakMap to track which Phantom providers already have listeners attached,
  // avoiding duplicate event registrations without mutating external objects.
  const _phantomListenersAttached = new WeakMap();

  // Helper function to get Phantom provider (handles in-app browser delay)
  async function getPhantomProvider(maxWaitMs = 3000) {
    // Check immediate availability
    if (window.solana?.isPhantom) {
      return window.solana;
    }
    // Also check newer provider location
    if (window.phantom?.solana?.isPhantom) {
      return window.phantom.solana;
    }

    // In Phantom's in-app browser, provider may take a moment to inject
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = 100; // ms

      function check() {
        if (window.solana?.isPhantom) {
          resolve(window.solana);
          return;
        }
        if (window.phantom?.solana?.isPhantom) {
          resolve(window.phantom.solana);
          return;
        }
        if (Date.now() - startTime < maxWaitMs) {
          setTimeout(check, checkInterval);
        } else {
          resolve(null); // Timeout - provider not found
        }
      }

      check();
    });
  }

  async function connectWallet() {
    // Wait for Phantom provider (handles in-app browser timing)
    const provider = await getPhantomProvider();
    
    if (!provider) {
      // Check if we're in a browser that might be Phantom but provider isn't ready
      const userAgent = navigator.userAgent || "";
      const isPhantomBrowser = userAgent.toLowerCase().includes("phantom");
      
      if (isPhantomBrowser) {
        alert("Phantom wallet is loading. Please try again in a moment.");
      } else {
        alert("Please install Phantom wallet.\n\nVisit https://phantom.app to install.");
      }
      return;
    }

    try {
      await provider.connect();
      const addr = provider.publicKey.toBase58();
      const label = `${addr.slice(0, 4)}...${addr.slice(-4)}`;

      // New Pocket-Boy buttons
      const btnHUD = document.getElementById("connectWalletHUD");
      const btnStat = document.getElementById("connectWalletStat");

      // Legacy id (if present somewhere else)
      const legacyBtn = document.getElementById("connectWallet");

      if (btnHUD) {
        btnHUD.textContent = label;
        btnHUD.classList.add("connected");
      }
      if (btnStat) {
        btnStat.textContent = label;
        btnStat.classList.add("connected");
      }
      if (legacyBtn) {
        legacyBtn.textContent = label;
        legacyBtn.classList.add("connected");
      }

      const walletAddressEl = document.getElementById("walletAddress");
      const statWalletEl = document.getElementById("stat-wallet");

      if (walletAddressEl) walletAddressEl.textContent = `WALLET: ${label}`;
      if (statWalletEl) statWalletEl.textContent = label;

      connectedWallet = true;
      window.PLAYER_WALLET = addr;
      safeLog("Wallet connected:", addr);

      // Dispatch wallet connection event for other systems (e.g., Courier dialogue)
      window.dispatchEvent(new CustomEvent("walletConnected", { detail: { address: addr } }));

      // Bind Phantom provider events so that account switches and user-initiated
      // disconnects are reflected in the UI without requiring a page reload.
      if (!_phantomListenersAttached.has(provider)) {
        provider.on('accountChanged', (publicKey) => {
          if (publicKey) {
            const newAddr = publicKey.toBase58 ? publicKey.toBase58() : publicKey.toString();
            const newLabel = `${newAddr.slice(0, 4)}...${newAddr.slice(-4)}`;
            window.PLAYER_WALLET = newAddr;
            if (btnHUD) { btnHUD.textContent = newLabel; }
            if (btnStat) { btnStat.textContent = newLabel; }
            if (legacyBtn) { legacyBtn.textContent = newLabel; }
            if (walletAddressEl) walletAddressEl.textContent = `WALLET: ${newLabel}`;
            if (statWalletEl) statWalletEl.textContent = newLabel;
            window.dispatchEvent(new CustomEvent("walletConnected", { detail: { address: newAddr } }));
            safeLog("Phantom account changed to:", newAddr);
          } else {
            // User disconnected all accounts from inside the extension
            connectedWallet = false;
            window.PLAYER_WALLET = null;
            const disconnectLabel = "CONNECT";
            if (btnHUD) { btnHUD.textContent = disconnectLabel; btnHUD.classList.remove("connected"); }
            if (btnStat) { btnStat.textContent = disconnectLabel; btnStat.classList.remove("connected"); }
            if (legacyBtn) { legacyBtn.textContent = disconnectLabel; legacyBtn.classList.remove("connected"); }
            if (walletAddressEl) walletAddressEl.textContent = "WALLET: DISCONNECTED";
            if (statWalletEl) statWalletEl.textContent = "DISCONNECTED";
            window.dispatchEvent(new CustomEvent("walletDisconnected", {}));
          }
        });
        provider.on('disconnect', () => {
          connectedWallet = false;
          window.PLAYER_WALLET = null;
          const disconnectLabel = "CONNECT";
          if (btnHUD) { btnHUD.textContent = disconnectLabel; btnHUD.classList.remove("connected"); }
          if (btnStat) { btnStat.textContent = disconnectLabel; btnStat.classList.remove("connected"); }
          if (legacyBtn) { legacyBtn.textContent = disconnectLabel; legacyBtn.classList.remove("connected"); }
          if (walletAddressEl) walletAddressEl.textContent = "WALLET: DISCONNECTED";
          if (statWalletEl) statWalletEl.textContent = "DISCONNECTED";
          window.dispatchEvent(new CustomEvent("walletDisconnected", {}));
          safeLog("Phantom wallet disconnected via extension");
        });
        _phantomListenersAttached.set(provider, true);
      }

      // Load NFTs as soon as wallet is connected
      await refreshNFTs();
    } catch (e) {
      safeError("Wallet connection failed:", e);
    }
  }

  async function claimMintableFromServer() {
    try {
      const base = (window.BACKEND_URL || CONFIG.apiBase || "").replace(/\/+$/, "");
      const res = await fetch(`${base}/api/mint-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert("Mint failed: " + (data.error || `HTTP ${res.status}`));
        return;
      }

      const itemId = data.itemId;
      if (itemId) {
        givePlayerItemById(itemId);
        addCaps(5); // example reward
        addXP(10);  // example reward
      }

      alert(`Minted: ${itemId}`);
    } catch (e) {
      safeError("Mint error:", e);
      alert("Mint failed");
    }
  }

  window.connectWallet = connectWallet;
  window.claimMintableFromServer = claimMintableFromServer;

  // ---------------------------
  // UI INIT (core controls)
  // ---------------------------

  function initUI() {
    // --- CRAFTING & CLAIM IN EXCHANGE PANEL ---
    const exchangePanel = document.getElementById("panel-exchange");
    const exchangeContent = document.getElementById("exchangeContent");
    function renderExchangeCraftingSection() {
      if (!exchangeContent) return;
      // Find or create crafting section
      let craftingSection = document.getElementById("exchangeCraftingSection");
      if (!craftingSection) {
        craftingSection = document.createElement("div");
        craftingSection.id = "exchangeCraftingSection";
        exchangeContent.appendChild(craftingSection);
      }
      const recipes = (Game.modules.recipes && Game.modules.recipes.listAll && Game.modules.recipes.listAll()) || [];
      if (!recipes.length) {
        craftingSection.innerHTML = '<div class="panel-divider"></div><h3>Crafting Recipes</h3><p>No recipes available.</p>';
      } else {
        let html = '<div class="panel-divider"></div><h3>Crafting Recipes</h3>';
        html += '<ul style="list-style:none;padding:0;">';
        recipes.forEach(r => {
          html += `<li style="margin-bottom:12px;border-bottom:1px solid #222;padding-bottom:8px;">
            <strong>${escapeHtml(r.name || r.id)}</strong><br/>
            <span style='font-size:12px;opacity:0.7;'>${escapeHtml(r.description || '')}</span><br/>
            <span>Requires: </span>
            ${r.inputs.map(inp => `${escapeHtml(String(inp.amount))}x ${escapeHtml(inp.id)}`).join(', ')}<br/>
            <button class="pipboy-button-small" data-craft="${escapeHtml(r.id)}">Craft</button>
          </li>`;
        });
        html += '</ul>';
        craftingSection.innerHTML = html;
      }
      // Wire up buttons
      Array.from(craftingSection.querySelectorAll('[data-craft]')).forEach(btn => {
        btn.onclick = async function() {
          const recipeId = this.getAttribute('data-craft');
          if (!Game.modules.crafting.canCraft(recipeId)) {
            alert('Missing ingredients!');
            return;
          }
          this.disabled = true;
          this.textContent = 'Crafting...';
          try {
            const item = await Game.modules.crafting.craftAsync(recipeId);
            if (item) {
              alert('Crafted: ' + (item.name || item.id));
              renderExchangeCraftingSection();
            } else {
              alert('Crafting failed.');
            }
          } catch (err) {
            alert(err.message || 'Crafting failed.');
          } finally {
            this.disabled = false;
            this.textContent = 'Craft';
          }
        };
      });
    }

    function renderExchangeClaimSection() {
      if (!exchangeContent) return;
      let claimSection = document.getElementById("exchangeClaimSection");
      if (!claimSection) {
        claimSection = document.createElement("div");
        claimSection.id = "exchangeClaimSection";
        exchangeContent.insertBefore(claimSection, exchangeContent.firstChild);
      }
      let html = '<div class="panel-divider"></div><h3>Claim Mintable Item</h3>';
      html += '<button id="claimMintablesExchange" class="pipboy-button" style="width:100%;margin-bottom:10px;">CLAIM NEARBY ITEM</button>';
      html += '<div id="claimStatusExchange" style="margin-top:6px;font-size:12px;opacity:0.8;"></div>';
      claimSection.innerHTML = html;

      // Button logic
      const claimBtn = document.getElementById("claimMintablesExchange");
      const claimStatus = document.getElementById("claimStatusExchange");
      function updateClaimButtonState() {
        const walletConnected = window.connectedWallet || window.PLAYER_WALLET;
        // Use geolocation and POI distance if available, else fallback to true
        let inRange = true;
        if (window.Game && Game.player && Game.player.position && window.Game.nearbyPOI) {
          // Example: check if player is within 50 meters of a POI
          const playerPos = Game.player.position;
          const poi = Game.nearbyPOI;
          if (poi && poi.lat && poi.lng && playerPos.lat && playerPos.lng) {
            const R = 6371e3; // meters
            const toRad = deg => deg * Math.PI / 180;
            const dLat = toRad(poi.lat - playerPos.lat);
            const dLng = toRad(poi.lng - playerPos.lng);
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(toRad(playerPos.lat)) * Math.cos(toRad(poi.lat)) *
                      Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const dist = R * c;
            inRange = dist < 50; // 50 meters
          }
        }
        if (claimBtn) {
          claimBtn.disabled = !(walletConnected && inRange);
          claimBtn.textContent = walletConnected ? (inRange ? "CLAIM NEARBY ITEM" : "OUT OF RANGE") : "CONNECT WALLET";
        }
      }
      window.addEventListener("walletConnected", updateClaimButtonState);
      window.addEventListener("playerMoved", updateClaimButtonState);
      // Store cleanup references on the element to prevent duplicate listeners
      if (claimBtn) {
        // Remove any previously added listeners before adding new ones
        if (claimBtn._walletListener) window.removeEventListener("walletConnected", claimBtn._walletListener);
        if (claimBtn._movedListener) window.removeEventListener("playerMoved", claimBtn._movedListener);
        claimBtn._walletListener = updateClaimButtonState;
        claimBtn._movedListener = updateClaimButtonState;
      }
      updateClaimButtonState();
      if (claimBtn) {
        claimBtn.onclick = async () => {
          if (claimBtn.disabled) return;
          const originalText = claimBtn.textContent;
          claimBtn.textContent = "CLAIMING...";
          claimBtn.disabled = true;
          claimStatus.textContent = "Processing claim...";
          try {
            await claimMintableFromServer();
            claimBtn.textContent = "CLAIMED!";
            claimStatus.textContent = "Item claimed and added to your inventory.";
            setTimeout(() => {
              claimBtn.textContent = originalText;
              claimStatus.textContent = "";
              updateClaimButtonState();
            }, 2000);
          } catch (e) {
            claimBtn.textContent = "ERROR";
            claimStatus.textContent = "Claim failed. Please try again.";
            setTimeout(() => {
              claimBtn.textContent = originalText;
              claimStatus.textContent = "";
              updateClaimButtonState();
            }, 2000);
          }
        };
      }
    }

    // Render both sections when EXCHANGE tab is opened
    const exchangeTabBtn = document.querySelector('[data-pipboy-tab="panel-exchange"]');
    if (exchangeTabBtn) {
      exchangeTabBtn.addEventListener('click', () => {
        renderExchangeClaimSection();
        renderExchangeCraftingSection();
        // Re-render demo exchange (caps may have changed)
        renderDemoExchange();
      });
    }
    // Optionally, render immediately if EXCHANGE is default
    if (exchangePanel && exchangePanel.classList.contains('active')) {
      renderExchangeClaimSection();
      renderExchangeCraftingSection();
      renderDemoExchange();
    }
    // ...existing code...
    const bound = new Set();

    function once(id, fn) {
      if (bound.has(id)) return;
      bound.add(id);
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", fn);
    }

    // Old layout controls (noop if not present)
    once("requestGpsBtn", () => {
      startGeolocationWatch();
      const btn = document.getElementById("requestGpsBtn");
      if (btn) btn.style.display = "none";
    });

    once("centerBtn", () => {
      attachMapReference();
      if (map && _lastPlayerPosition) {
        map.setView([_lastPlayerPosition.lat, _lastPlayerPosition.lng], 15);
      }
    });

    once("stylePipboy", () => window.overseerMapStyle && window.overseerMapStyle.setStyle("pipboy"));
    once("styleWinter", () => window.overseerMapStyle && window.overseerMapStyle.setStyle("winter"));
    once("styleDesert", () => window.overseerMapStyle && window.overseerMapStyle.setStyle("desert"));
    once("styleNone", () => window.overseerMapStyle && window.overseerMapStyle.setStyle("none"));

    once("recenterMojave", () => {
      attachMapReference();
      if (map) map.setView(CONFIG.defaultCenter, CONFIG.defaultZoom);
    });

    const drawer = document.getElementById("bottom-drawer");
    const drawerToggle = document.getElementById("drawer-toggle");
    if (drawerToggle && drawer) {
      drawerToggle.addEventListener("click", () => {
        drawer.classList.toggle("hidden");
        setTimeout(() => {
          attachMapReference();
          if (map && map.invalidateSize) map.invalidateSize();
        }, 260);
      });
    }

    once("gps-lock-btn", () => {
      if (gpsLocked) {
        stopGeolocationWatch();
        alert("GPS unlocked");
      } else {
        startGeolocationWatch();
        gpsLocked = true;
        alert("GPS locked");
      }
    });

    // New Pocket-Boy wallet buttons
    once("connectWalletHUD", connectWallet);
    once("connectWalletStat", connectWallet);

    // Character Creator button
    once("characterCreatorBtn", () => {
      if (Game?.modules?.CharacterCreator) {
        Game.modules.CharacterCreator.open(null, (newAppearance) => {
          console.log('[CharacterCreator] Saved appearance:', newAppearance);
          // Update the display with new character data
          updateStatDisplay();
        });
      } else {
        console.warn('[CharacterCreator] Module not available');
      }
    });

    // ...existing code...

    // GPS badge click toggles GPS lock
    once("gpsBadge", () => {
      if (gpsLocked) {
        stopGeolocationWatch();
        gpsLocked = false;
        alert("GPS unlocked");
      } else {
        startGeolocationWatch();
        gpsLocked = true;
        alert("GPS locked on your position.");
      }
    });

    // Map style buttons in MAP panel
    const styleButtons = document.querySelectorAll(".map-style-btn");
    styleButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const style = btn.getAttribute("data-style");
        if (window.overseerMapStyle && typeof window.overseerMapStyle.setStyle === "function") {
          window.overseerMapStyle.setStyle(style);
        }
      });
    });

    safeLog("UI initialized (core controls wired)");
  }

  // ---------------------------
  // STARTER PACK
  // ---------------------------

  const STARTER_PACK_KEY = "afc_starter_pack_granted";

  const STARTER_PACK_ITEMS = [
    {
      id: "stimpak",
      name: "Stimpak",
      type: "aid",
      effect: "heal",
      healAmt: 25,
      rarity: "common",
      quantity: 2,
      weight: 0.5,
      description: "A pre-war medical injector. Heals 25 HP."
    },
    {
      id: "radaway",
      name: "RadAway",
      type: "aid",
      effect: "radflush",
      rarity: "common",
      quantity: 1,
      weight: 0.5,
      description: "Flushes radiation from your system."
    },
    {
      id: "rusty_pistol",
      name: "Rusty 10mm Pistol",
      type: "weapon",
      damage: 15,
      rarity: "common",
      quantity: 1,
      weight: 2.5,
      description: "A battered pistol from before the war."
    }
  ];

  function grantStarterPack() {
    if (localStorage.getItem(STARTER_PACK_KEY)) return; // already granted
    localStorage.setItem(STARTER_PACK_KEY, "true");

    // Give starter caps + XP (additive — reward is on top of whatever they already have)
    PLAYER.caps = (PLAYER.caps || 0) + 50;
    PLAYER.xp = (PLAYER.xp || 0) + 10;

    // Add items to inventory
    STARTER_PACK_ITEMS.forEach(function (item) {
      // Try unified addItem API first
      if (window.Game && window.Game.player && typeof window.Game.player.addItem === "function") {
        try {
          window.Game.player.addItem(item);
          return;
        } catch (e) {
          safeWarn("[StarterPack] addItem failed:", e.message);
        }
      }
      // Fallback: push item id/name string into local PLAYER.inventory
      const key = item.id || item.name;
      if (!PLAYER.inventory.includes(key)) {
        PLAYER.inventory.push(key);
      }
    });

    savePlayerState();
    updateHUD();
    renderInventoryPanel();

    // Show toast notification
    showStarterPackToast();
    safeLog("[StarterPack] Starter pack granted to new player");
  }

  function showStarterPackToast() {
    const toast = document.createElement("div");
    toast.id = "starterPackToast";
    toast.innerHTML = [
      "✦ STARTER PACK RECEIVED ✦",
      '<div class="toast-items">',
      "2× Stimpak | 1× RadAway | Rusty 10mm Pistol<br/>",
      "50 CAPS | 10 XP",
      "</div>"
    ].join("");
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 4000);
  }

  // ---------------------------
  // WEATHER SYSTEM
  // ---------------------------

  const WEATHER_TYPES = ["Clear", "Cloudy", "Ash Storm", "Rad Storm", "Fog"];
  let _currentWeather = "Clear";
  let _weatherTick = 0;
  let _weatherInterval = null;
  let _radFromWeather = 0; // accumulated radiation from weather (per-minute basis)

  // +2 rads/minute converted to per-second rate (weatherTick runs every ~1s)
  const RAD_STORM_RATE_PER_SECOND = 2 / 60;
  // Rotate weather every 5 minutes (300 ticks @ 1s interval)
  const WEATHER_ROTATION_TICKS = 300;

  function pickNewWeather() {
    const rng = new Uint32Array(1);
    crypto.getRandomValues(rng);
    _currentWeather = WEATHER_TYPES[rng[0] % WEATHER_TYPES.length];
    window.currentWeather = _currentWeather;
    updateWeatherDisplay();
    safeLog("[Weather] New weather:", _currentWeather);
  }

  function updateWeatherDisplay() {
    const el = document.getElementById("stat-weather");
    if (!el) return;

    try {
      const worldmap = Game.modules?.worldmap;
      if (worldmap && worldmap.gs) {
        const pos = worldmap.gs?.player?.position;
        if (pos && Game.modules?.world?.weather?.at) {
          const state = worldmap.gs.worldState || worldmap.gs;
          const weather = Game.modules.world.weather.at(state, {
            biome: "auto",
            continent: "north_america",
            lat: pos.lat,
            lng: pos.lng
          });
          const weatherType = weather?.type || "clear";
          // Capitalize first letter for display
          el.textContent = weatherType.charAt(0).toUpperCase() + weatherType.slice(1);
          return;
        }
      }
    } catch (e) {
      console.warn("[Weather] Failed to get weather for display:", e.message);
    }

    // Fallback to old system
    el.textContent = _currentWeather;
  }

  function weatherTick() {
    _weatherTick++;

    // Apply radiation from Rad Storm
    if (_currentWeather === "Rad Storm") {
      _radFromWeather += RAD_STORM_RATE_PER_SECOND;
      if (_radFromWeather >= 1) {
        const radGain = Math.floor(_radFromWeather);
        _radFromWeather -= radGain;
        // Increment player radiation (if stored)
        if (!PLAYER.radiation) PLAYER.radiation = 0;
        PLAYER.radiation = Math.min(100, PLAYER.radiation + radGain);
        updateRadDisplay();
      }
    } else {
      _radFromWeather = 0; // reset accumulator on non-rad weather
    }

    // Rotate weather every 5 minutes (WEATHER_ROTATION_TICKS @ 1s interval)
    if (_weatherTick % WEATHER_ROTATION_TICKS === 0) {
      pickNewWeather();
    }
  }

  function updateRadDisplay() {
    const radBar = document.getElementById("stat-rad-bar");
    const radLabel = document.getElementById("stat-rad-label");
    if (radBar) radBar.style.width = (PLAYER.radiation || 0) + "%";
    if (radLabel) radLabel.textContent = Math.round(PLAYER.radiation || 0) + "%";
  }

  function startWeatherSystem() {
    // Seed initial weather from world module if available
    if (window.Game && window.Game.modules && window.Game.modules.worldWeather &&
        window.Game.modules.worldWeather.getCurrent) {
      try {
        const ww = window.Game.modules.worldWeather.getCurrent();
        if (ww && ww.type) {
          _currentWeather = ww.type;
          window.currentWeather = _currentWeather;
        }
      } catch (e) { /* ignore */ }
    }
    // Also check window.currentWeather if already set
    if (window.currentWeather && typeof window.currentWeather === "string") {
      _currentWeather = window.currentWeather;
    }

    updateWeatherDisplay();

    // Tick every second for radiation, rotate every 5 minutes
    if (_weatherInterval) clearInterval(_weatherInterval);
    _weatherInterval = setInterval(weatherTick, 1000);
    safeLog("[Weather] Weather system started. Current:", _currentWeather);
  }

  // ---------------------------
  // MAP SCAN ENHANCEMENT
  // ---------------------------

  const WASTELAND_DISCOVERIES = [
    { name: "The Crimson Dunes",       flavor: "A sea of blood-red sand hides pre-war secrets beneath." },
    { name: "Ruined Vault 77",         flavor: "The blast doors hang open. Something left — or got in." },
    { name: "Dead Wind Cavern",        flavor: "A low moan echoes from deep within the darkness." },
    { name: "Abandoned Settlement",    flavor: "Scorch marks and scattered caps tell a grim story." },
    { name: "Radiation Crater",        flavor: "The Geiger counter screams. Valuable ore glints below." },
    { name: "Old Gas Station",         flavor: "Faded neon flickers: 'NUKA-COLA — 10¢'. A relic." },
    { name: "Scavenger's Camp",        flavor: "Still-warm embers. Someone was just here." },
    { name: "The Glowing Sea",         flavor: "The air shimmers with sickly light. Proceed with caution." },
    { name: "Desert Outpost Alpha",    flavor: "Brotherhood tags and scorched concrete. Long abandoned." },
    { name: "Collapsed Highway",       flavor: "Miles of cracked asphalt, rusted cars, and bones." }
  ];

  const MAP_SCAN_KEY = "afc_map_discoveries";
  let _mapDiscoveries = [];

  function loadMapDiscoveries() {
    try {
      const raw = localStorage.getItem(MAP_SCAN_KEY);
      if (raw) _mapDiscoveries = JSON.parse(raw) || [];
    } catch (e) { _mapDiscoveries = []; }
  }

  function saveMapDiscoveries() {
    try { localStorage.setItem(MAP_SCAN_KEY, JSON.stringify(_mapDiscoveries)); } catch (e) {}
  }

  function initMapScanEnhancement() {
    const exploreBtn = document.getElementById("exploreToggleBtn");
    if (!exploreBtn) return;

    loadMapDiscoveries();

    exploreBtn.addEventListener("click", function () {
      // Only trigger discovery if we just switched to explore mode
      // (worldmap.js toggles the text to "RETURN TO PLAYER" after click)
      const textEl = document.getElementById("exploreText");
      const _currentText = textEl ? textEl.textContent : exploreBtn.textContent;

      // If worldmap toggled it to "RETURN TO PLAYER", we are now exploring → show scan
      // We use a short delay to check after worldmap.js has processed the click
      setTimeout(function () {
        const afterText = textEl ? textEl.textContent : exploreBtn.textContent;
        const nowExploring = afterText && afterText.indexOf("RETURN") !== -1;
        if (nowExploring) {
          runMapScan();
        }
      }, 100);
    });

    safeLog("[MapScan] Map scan enhancement active");
  }

  function runMapScan() {
    const mapLog = document.getElementById("mapLog");
    const mapStatus = document.getElementById("mapStatus");

    if (mapStatus) mapStatus.textContent = "SCANNING...";

    // Show scanning animation in mapLog
    if (mapLog) {
      const scanEntry = document.createElement("div");
      scanEntry.style.cssText = "color:#00ff41;font-size:12px;animation:header-flicker 0.6s infinite;";
      scanEntry.textContent = "[ SCANNING REGION... ]";
      mapLog.prepend(scanEntry);

      // After 2–3 seconds, discover a location
      const rng = new Uint32Array(1);
      crypto.getRandomValues(rng);
      const delayMs = 2000 + (rng[0] % 1001); // 2000–3000ms

      setTimeout(function () {
        scanEntry.remove();
        discoverRandomLocation(mapLog, mapStatus);
      }, delayMs);
    } else {
      // No mapLog — just discover after delay
      const rng = new Uint32Array(1);
      crypto.getRandomValues(rng);
      setTimeout(function () { discoverRandomLocation(null, mapStatus); }, 2000 + (rng[0] % 1001));
    }
  }

  function discoverRandomLocation(mapLog, mapStatus) {
    // Pick an undiscovered location first; fall back to any if all discovered
    const undiscovered = WASTELAND_DISCOVERIES.filter(function (d) {
      return !_mapDiscoveries.includes(d.name);
    });
    const pool = undiscovered.length ? undiscovered : WASTELAND_DISCOVERIES;

    const rng = new Uint32Array(1);
    crypto.getRandomValues(rng);
    const loc = pool[rng[0] % pool.length];

    const isNew = !_mapDiscoveries.includes(loc.name);
    if (isNew) {
      _mapDiscoveries.push(loc.name);
      saveMapDiscoveries();
      markLocationVisited(loc.name);
      addXP(5);
    }

    const prefix = isNew ? "★ DISCOVERED:" : "REVISITED:";

    // Update map status
    if (mapStatus) {
      mapStatus.textContent = isNew ? "LOCATION FOUND" : "AREA SCANNED";
    }

    // Log the discovery
    if (mapLog) {
      const entry = document.createElement("div");
      entry.style.cssText = "border-bottom:1px solid rgba(0,255,65,0.15);padding:6px 0;font-size:12px;";
      entry.innerHTML = [
        '<span style="color:#ffcc44;font-weight:bold;">' + escapeHtml(prefix) + " " + escapeHtml(loc.name) + "</span><br/>",
        '<span style="opacity:0.7;">' + escapeHtml(loc.flavor) + "</span>",
        isNew ? '<br/><span style="color:#00ff41;font-size:11px;">+5 XP — New discovery logged</span>' : ""
      ].join("");
      mapLog.prepend(entry);
      // Auto-remove after 5 seconds so the log doesn't accumulate and block the map
      setTimeout(function () {
        if (entry.parentNode === mapLog) mapLog.removeChild(entry);
      }, 5000);
    }

    safeLog("[MapScan]", prefix, loc.name);
  }

  // ---------------------------
  // DEMO EXCHANGE (walletless)
  // ---------------------------

  const DEMO_SHOP_ITEMS = [
    {
      id: "stimpak",
      name: "Stimpak",
      cost: 20,
      description: "Heals 25 HP. Essential for wasteland survival.",
      item: { id: "stimpak", name: "Stimpak", type: "aid", effect: "heal", healAmt: 25, rarity: "common", quantity: 1, weight: 0.5 }
    },
    {
      id: "radaway",
      name: "RadAway",
      cost: 30,
      description: "Flushes radiation. Use after entering hot zones.",
      item: { id: "radaway", name: "RadAway", type: "aid", effect: "radflush", rarity: "common", quantity: 1, weight: 0.5 }
    },
    {
      id: "nuka_cola",
      name: "Nuka-Cola",
      cost: 10,
      description: "Classic pre-war soft drink. Restores 10 HP and 5 AP.",
      item: { id: "nuka_cola", name: "Nuka-Cola", type: "aid", effect: "heal", healAmt: 10, rarity: "common", quantity: 1, weight: 0.5 }
    },
    {
      id: "bobby_pin",
      name: "Bobby Pin (x5)",
      cost: 15,
      description: "Useful for lockpicking. A wasteland staple.",
      item: { id: "bobby_pin", name: "Bobby Pin", type: "misc", rarity: "common", quantity: 5, weight: 0.1 }
    },
    {
      id: "scrap_metal",
      name: "Scrap Metal",
      cost: 5,
      description: "Salvaged steel. Useful for crafting repairs.",
      item: { id: "scrap_metal", name: "Scrap Metal", type: "component", rarity: "common", quantity: 1, weight: 1.0 }
    }
  ];

  function renderDemoExchange() {
    const scavengerItems = document.getElementById("scavengerItems");
    if (!scavengerItems) return;

    let html = '<div style="margin-bottom:8px;font-size:11px;opacity:0.7;">Browse wasteland goods — no wallet required.</div>';
    html += '<div id="demoExchangeStatus"></div>';

    DEMO_SHOP_ITEMS.forEach(function (shopItem) {
      html += [
        '<div class="demo-shop-item">',
        '  <div class="demo-shop-item-info">',
        '    <div class="demo-shop-item-name">' + escapeHtml(shopItem.name) + "</div>",
        '    <div class="demo-shop-item-desc">' + escapeHtml(shopItem.description) + "</div>",
        '    <div class="demo-shop-item-cost">⚙ ' + shopItem.cost + " CAPS</div>",
        "  </div>",
        '  <button class="demo-shop-buy-btn" data-shop-id="' + escapeHtml(shopItem.id) + '">BUY</button>',
        "</div>"
      ].join("");
    });

    scavengerItems.innerHTML = html;

    // Wire buy buttons
    scavengerItems.querySelectorAll(".demo-shop-buy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const shopId = this.getAttribute("data-shop-id");
        const shopItem = DEMO_SHOP_ITEMS.find(function (s) { return s.id === shopId; });
        if (!shopItem) return;

        const statusEl = document.getElementById("demoExchangeStatus");

        if (PLAYER.caps < shopItem.cost) {
          if (statusEl) {
            statusEl.className = "demo-shop-status";
            statusEl.textContent = "INSUFFICIENT CAPS — you need " + shopItem.cost + " CAPS.";
            setTimeout(function () { statusEl.textContent = ""; }, 3000);
          }
          return;
        }

        // Deduct caps and add item
        PLAYER.caps = Math.max(0, PLAYER.caps - shopItem.cost);
        savePlayerState();

        // Try to add item via unified API
        if (window.Game && window.Game.player && typeof window.Game.player.addItem === "function") {
          try {
            // Use structuredClone for a deep copy to prevent mutations affecting the shop catalog
            const itemCopy = typeof structuredClone === "function"
              ? structuredClone(shopItem.item)
              : JSON.parse(JSON.stringify(shopItem.item));
            window.Game.player.addItem(itemCopy);
          } catch (e) {
            PLAYER.inventory.push(shopItem.id);
            savePlayerState();
          }
        } else {
          PLAYER.inventory.push(shopItem.id);
          savePlayerState();
        }

        updateHUD();
        renderInventoryPanel();

        if (statusEl) {
          statusEl.className = "demo-shop-status ok";
          statusEl.textContent = "✓ " + shopItem.name + " added to inventory.";
          setTimeout(function () { statusEl.textContent = ""; }, 3000);
        }

        safeLog("[DemoExchange] Purchased:", shopItem.name, "for", shopItem.cost, "caps");
      });
    });
  }

  // ---------------------------
  // GAME INIT
  // ---------------------------

  async function initGame() {
    // Use sessionStorage to prevent multiple initializations across tabs/windows
    const initKey = "afc_game_initialized_" + window.location.pathname;
    const existingInit = sessionStorage.getItem(initKey);
    console.log("[main] Checking game initialization for", window.location.pathname, "- existing:", existingInit);
    
    if (existingInit) {
      console.log("[main] Game already initialized for this context, skipping");
      return;
    }
    sessionStorage.setItem(initKey, "true");

    if (_gameInitialized || _gameInitializing) {
      console.log("[main] Game already initializing or initialized, skipping");
      return;
    }
    _gameInitializing = true;
    
    console.log("[main] Starting game initialization...");

    try {
      loadPlayerState();
      await loadAllData();

      // Initialize quest module FIRST to give starter gear (vault jumpsuit, etc)
      if (
        window.Game &&
        Game.modules &&
        Game.modules.quests &&
        typeof Game.modules.quests.init === "function"
      ) {
        // Pass DATA as gameState for quest module to use
        Game.modules.quests.init(window.DATA);
        safeLog("Quest module initialized with starter gear");
        
        // Verify equipped items (quest module sets Game.player.equipped directly)
        if (Game.player && Game.player.equipped) {
          const eq = Game.player.equipped;
          const armorSlots = ["chest", "head", "arms", "legs"];
          armorSlots.forEach(s => {
            if (eq[s]) safeLog("Player equipped " + s + ":", eq[s].name);
          });
        }
      }

      // Initialize mintables module if present
      if (
        window.Game &&
        Game.modules &&
        Game.modules.mintables &&
        typeof Game.modules.mintables.init === "function"
      ) {
        await Game.modules.mintables.init();
      }

      // Initialize NPC spawn system if present
      if (
        window.Game &&
        Game.modules &&
        Game.modules.npcSpawn &&
        typeof Game.modules.npcSpawn.init === "function"
      ) {
        await Game.modules.npcSpawn.init();
      }

      // Initialize Character Creator module if present
      if (
        window.Game &&
        Game.modules &&
        Game.modules.CharacterCreator &&
        typeof Game.modules.CharacterCreator.init === "function"
      ) {
        try {
          console.log('[Main] Initializing Character Creator module...');
          await Game.modules.CharacterCreator.init();
          console.log('[Main] Character Creator module initialized successfully');
          safeLog("Character Creator module initialized");

          // Dispatch event to notify that character creator is ready
          window.dispatchEvent(new Event("characterCreatorReady"));
        } catch (error) {
          console.error("Failed to initialize Character Creator module:", error);
        }
      }

      attachMapReference();
      initUI();

      const locCountEl = document.getElementById("locations-count");
      if (locCountEl) locCountEl.textContent = window.DATA.locations.length;

      // Render local inventory + quests + HUD
      renderInventoryPanel();
      renderQuestsPanel();
      updateHUD();
      updateStatDisplay(); // Update character stats display

      // Grant starter pack to new players (boot.js sets window._isNewGame)
      if (window._isNewGame === true) {
        grantStarterPack();
      } else {
        // Also grant if no starter pack has ever been given (upgrade path)
        if (!localStorage.getItem(STARTER_PACK_KEY)) {
          // Only grant if player has very little progress (xp === 0 && caps < 10)
          if (PLAYER.xp === 0 && PLAYER.caps < 10) {
            grantStarterPack();
          }
        }
      }

      // Start weather system
      startWeatherSystem();

      // Hook up map scan enhancement
      initMapScanEnhancement();

      // Render demo exchange (walletless shop)
      renderDemoExchange();

      // Sync caps into world simulation player state
      if (window.overseerWorldState && window.overseerWorldState.player) {
        window.overseerWorldState.player.caps = PLAYER.caps;
      }

      // Set a default region for the world simulation
      if (window.overseerWorldState && typeof window.overseerWorldState.setRegion === "function") {
        window.overseerWorldState.setRegion("mojave_core");
      }

      // If a wallet is already known (e.g. reconnect), pull NFTs too
      if (window.PLAYER_WALLET || connectedWallet) {
        refreshNFTs();
      }

      _gameInitialized = true;
      safeLog("Game initialized successfully");

      // Dispatch event to signal game is ready (for boot.js courier dialogue)
      window.dispatchEvent(new Event("gameInitialized"));

      // Start the world simulation loop once game is ready
      if (window.overseerGameLoop && typeof window.overseerGameLoop.start === "function") {
        window.overseerGameLoop.start();
        safeLog("World simulation loop started");
      }
    } catch (e) {
      safeError("Game initialization failed:", e);
    } finally {
      _gameInitializing = false;
    }
  }

  // ---------------------------
  // CHARACTER CUSTOMIZATION SYSTEM
  // ---------------------------

  // Update the STATS panel display with character data
  function updateStatDisplay() {
    console.log('[Stats] Updating stat display');

    // Update SPECIAL stats bars
    const specialStats = ['S', 'P', 'E', 'C', 'I', 'A', 'L'];
    specialStats.forEach(stat => {
      const valueEl = document.getElementById(`special-${stat}`);
      const barEl = document.querySelector(`[data-special-key="${stat}"]`);

      // Get current character SPECIAL values (from character creator or defaults)
      let statValue = 5; // default
      if (window.Game?.modules?.CharacterCreator?.currentCharacter?.special) {
        statValue = window.Game.modules.CharacterCreator.currentCharacter.special[stat] || 5;
      }

      if (valueEl) valueEl.textContent = statValue;
      if (barEl) {
        // Update the visual bar (assuming CSS handles the styling)
        barEl.style.width = `${(statValue / 10) * 100}%`;
      }
    });

    // Update perks display if available
    const perksContainer = document.getElementById('character-perks-list');
    if (perksContainer && window.Game?.modules?.CharacterCreator?.currentCharacter?.perks) {
      const currentPerks = window.Game.modules.CharacterCreator.currentCharacter.perks;
      if (currentPerks.length > 0) {
        perksContainer.innerHTML = currentPerks.map(perkId => {
          // Find perk details
          const perk = window.Game?.modules?.CharacterCreator?.perks?.find(p => p.id === perkId);
          return perk ? `<div class="character-perk">${perk.name}</div>` : '';
        }).join('');
      } else {
        perksContainer.innerHTML = '<div class="no-perks">No perks selected</div>';
      }
    }

    // Update character appearance preview if available
    const appearancePreview = document.getElementById('character-appearance-preview');
    if (appearancePreview && window.Game?.modules?.CharacterCreator?.currentCharacter?.appearance) {
      const appearance = window.Game.modules.CharacterCreator.currentCharacter.appearance;
      let previewText = [];
      if (appearance.hairStyle) previewText.push(`Hair: ${appearance.hairStyle}`);
      if (appearance.eyeColor) previewText.push(`Eyes: ${appearance.eyeColor}`);
      if (appearance.skinTone) previewText.push(`Skin: ${appearance.skinTone}`);
      appearancePreview.innerHTML = previewText.length > 0 ?
        previewText.join('<br>') :
        'Default appearance';
    }

    console.log('[Stats] Stat display updated');
  }

  // Expose updateStatDisplay globally for character creator
  window.updateStatDisplay = updateStatDisplay;

  // ---------------------------
  // BOOT EVENTS
  // ---------------------------

  // Fired by boot.js when Pocket-Boy is fully visible
  window.addEventListener("pipboyReady", () => {
    safeLog("Pocket-Boy ready");
    initGame();
  });

  // Fired by map init when Leaflet is ready
  window.addEventListener("map-ready", () => {
    safeLog("Map ready");
    attachMapReference();
    if (map && map.invalidateSize) {
      map.invalidateSize();
    }
    if (gpsLocked) {
      startGeolocationWatch();
    }
  });

  // Listen for quest events to update the quests panel
  window.addEventListener("questOffered", () => {
    renderQuestsPanel();
  });

  window.addEventListener("questAccepted", () => {
    renderQuestsPanel();
  });
})();
