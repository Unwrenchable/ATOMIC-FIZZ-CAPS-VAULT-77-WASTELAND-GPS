// public/js/main.js – Player State, Mint Integration, XP/CAPS, Quests + NFT inventory
(function () {
  "use strict";

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
    apiBase: window.BACKEND_URL || window.location.origin
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

    const items = window.DATA.mintables || [];
    return (
      items.find(
        i => i && (i.id === id || i.slug === id || i.mintableId === id)
      ) || { name: id, description: "" }
    );
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
    if (!amount) return;
    PLAYER.caps += amount;

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
      alert(`LEVEL UP! You are now level ${PLAYER.level}`);
    }
  }

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
  // PANELS RENDERING (Pip-Boy panels)
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
          const name = item.name || item.id || item.slug || id;
          const desc = item.description || "";
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
          const name = nft.name || "Unnamed NFT";
          const mint = nft.mint || nft.id || "Unknown mint";
          const attrs = Array.isArray(nft.attributes)
            ? nft.attributes.slice(0, 3)
            : [];
          const attrsHtml = attrs
            .map(
              a =>
                `<div class="pip-attr"><span>${a.trait_type || "Trait"}:</span> ${
                  a.value
                }</div>`
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
    // New Pip-Boy layout uses questBody
    const panel = document.getElementById("questBody");
    if (!panel) return;

    const quests = window.DATA.quests || [];

    const active = PLAYER.questsActive
      .map(id => quests.find(q => q && (q.id === id || q.slug === id)))
      .filter(Boolean);

    const done = PLAYER.questsDone
      .map(id => quests.find(q => q && (q.id === id || q.slug === id)))
      .filter(Boolean);

    const renderQuest = (q, extraClass) => {
      const name = q.name || q.title || q.id || q.slug || "Quest";
      const desc = q.description || q.flavor || "";
      return `
        <div class="pip-entry ${extraClass || ""}">
          <strong>${name}</strong><br>
          <span>${desc}</span>
        </div>
      `;
    };

    const activeHtml = active.length
      ? active.map(q => renderQuest(q, "active")).join("")
      : "<p>No active quests.</p>";

    const doneHtml = done.length
      ? done.map(q => renderQuest(q, "done")).join("")
      : "<p>No completed quests.</p>";

    panel.innerHTML = `
      <h2>Active Quests</h2>
      ${activeHtml}
      <h2>Completed</h2>
      ${doneHtml}
    `;
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

    // STAT panel in Pip-Boy
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
      err => safeWarn("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
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

  // ---------------------------
  // WALLET + MINT
  // ---------------------------

  async function connectWallet() {
    const provider = window.solana;
    if (!provider || !provider.isPhantom) {
      alert("Please install Phantom wallet");
      return;
    }

    try {
      await provider.connect();
      const addr = provider.publicKey.toBase58();
      const label = `${addr.slice(0, 4)}...${addr.slice(-4)}`;

      // New Pip-Boy buttons
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
      if (!res.ok || !data.success) {
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

    // New Pip-Boy wallet buttons
    once("connectWalletHUD", connectWallet);
    once("connectWalletStat", connectWallet);

    // New Pip-Boy claim button in STAT panel
    once("claimMintablesStat", () => {
      if (!connectedWallet && !window.PLAYER_WALLET) {
        alert("Connect your wallet first.");
        return;
      }
      claimMintableFromServer();
    });

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
  // GAME INIT
  // ---------------------------

  async function initGame() {
    if (_gameInitialized || _gameInitializing) return;
    _gameInitializing = true;

    try {
      loadPlayerState();
      await loadAllData();

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

      attachMapReference();
      initUI();

      const locCountEl = document.getElementById("locations-count");
      if (locCountEl) locCountEl.textContent = window.DATA.locations.length;

      // Render local inventory + quests + HUD
      renderInventoryPanel();
      renderQuestsPanel();
      updateHUD();

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
  // BOOT EVENTS
  // ---------------------------

  // Fired by boot.js when Pip-Boy is fully visible
  window.addEventListener("pipboyReady", () => {
    safeLog("Pip-Boy ready");
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
})();
