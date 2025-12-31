// main.js – Atomic Fizz Caps Wasteland GPS
// Map, GPS, tabs, terminal, wallet, data-driven locations, quests, loot, collectibles

(function () {
  let map;
  let playerMarker = null;
  let locationsLayer = null;
  let currentPosition = null;

  // Mojave default (approx around Vegas)
  const MOJAVE_COORDS = [36.1699, -115.1398];
  const DEFAULT_ZOOM = 13;
  const CLAIM_RADIUS_METERS = 50;

  // === DOM HOOKS ===
  const statusEl = document.getElementById("status");
  const accDot = document.getElementById("accDot");
  const accText = document.getElementById("accText");
  const requestGpsBtn = document.getElementById("requestGpsBtn");
  const centerBtn = document.getElementById("centerBtn");
  const recenterMojaveBtn = document.getElementById("recenterMojave");
  const connectWalletBtn = document.getElementById("connectWallet");
  const enterNukeVaultBtn = document.getElementById("enterNukeVault");

  const tabs = document.querySelectorAll(".tab");
  const terminal = document.getElementById("terminal");
  const panelClose = document.getElementById("panelClose");
  const panelTitle = document.getElementById("panelTitle");
  const panelBody = document.getElementById("panelBody");

  const tutorialModal = document.getElementById("tutorialModal");
  const tutorialClose = document.getElementById("tutorialClose");

  const mintModal = document.getElementById("mintModal");
  const mintTitle = document.getElementById("mintTitle");
  const mintMsg = document.getElementById("mintMsg");
  const mintProgressBar = document.getElementById("mintProgressBar");
  const mintCloseBtn = document.getElementById("mintCloseBtn");

  const capsEl = document.getElementById("caps");
  const lvlEl = document.getElementById("lvl");
  const xpTextEl = document.getElementById("xpText");
  const xpFillEl = document.getElementById("xpFill");
  const claimedEl = document.getElementById("claimed");

  // === GAME STATE ===
  let caps = 0;
  let level = 1;
  let xp = 0;
  let claimedCount = 0;
  let walletPubkey = null;

  // === DATA STORE (all from /public/data/*.json) ===
  const DATA = {
    locations: [],       // locations.json – [{ n, lat, lng, lvl, rarity }]
    quests: [],          // quests.json
    scavenger: [],       // scavenger.json – loot table by spawnPOI
    collectiblesPack: {  // collectibles.json
      id: null,
      description: "",
      collectibles: []
    },
    factions: [],        // factions.json (optional)
    mintables: []        // mintables.json (optional / future use)
  };

  // ==========================
  // UTILITIES
  // ==========================
  function setStatus(text, levelClass) {
    statusEl.textContent = text;
    statusEl.classList.remove("status-good", "status-warn", "status-bad");
    if (levelClass) statusEl.classList.add(levelClass);
  }

  function setGpsAccuracy(accMeters) {
    if (accMeters == null) {
      accText.textContent = "GPS: waiting...";
      accDot.classList.remove("acc-good", "acc-bad");
      return;
    }

    accText.textContent = `GPS: ~${Math.round(accMeters)}m`;
    accDot.classList.remove("acc-good", "acc-bad");

    if (accMeters <= 25) {
      accDot.classList.add("acc-good");
    } else if (accMeters > 75) {
      accDot.classList.add("acc-bad");
    }
  }

  function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function rarityLabel(rarity) {
    const r = (rarity || "").toLowerCase();
    if (r === "legendary") return "LEGENDARY";
    if (r === "epic") return "EPIC";
    if (r === "rare") return "RARE";
    return "COMMON";
  }

  function rarityColor(rarity) {
    const r = (rarity || "").toLowerCase();
    if (r === "legendary") return "#ffd700";
    if (r === "epic") return "#ff66ff";
    if (r === "rare") return "#66ccff";
    return "#00ff66";
  }

  // ==========================
  // DATA LOADING
  // ==========================
  async function loadDataFile(name) {
    try {
      const res = await fetch(`/data/${name}.json`);
      if (!res.ok) return;

      const json = await res.json();

      if (name === "collectibles") {
        DATA.collectiblesPack = {
          id: json.id || null,
          description: json.description || "",
          collectibles: Array.isArray(json.collectibles) ? json.collectibles : []
        };
      } else {
        DATA[name] = json;
      }
    } catch (e) {
      console.error(`Failed to load ${name}.json`, e);
    }
  }

  async function loadAllData() {
    await Promise.all([
      loadDataFile("locations"),
      loadDataFile("quests"),
      loadDataFile("scavenger"),
      loadDataFile("collectibles"),
      loadDataFile("factions"),
      loadDataFile("mintables")
    ]);
  }

  // ==========================
  // MAP & LOCATIONS
  // ==========================
  function initMap() {
    map = L.map("map", {
      zoomControl: false,
      attributionControl: false
    }).setView(MOJAVE_COORDS, DEFAULT_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(map);

    locationsLayer = L.layerGroup().addTo(map);

    renderLocations();
  }

  function renderLocations() {
    if (!locationsLayer) return;
    locationsLayer.clearLayers();

    DATA.locations.forEach(loc => {
      const name = loc.n || "Unknown Location";
      const marker = L.marker([loc.lat, loc.lng]);
      marker.addTo(locationsLayer);
      marker.bindPopup(name);

      marker.on("click", () => {
        openLocationPanel(loc);
      });
    });
  }

  function updatePlayerMarker(lat, lng) {
    currentPosition = { lat, lng };

    if (!map) return;
    if (!playerMarker) {
      playerMarker = L.circleMarker([lat, lng], {
        radius: 7,
        color: "#00ff66",
        fillColor: "#00ff66",
        fillOpacity: 0.8
      }).addTo(map);
    } else {
      playerMarker.setLatLng([lat, lng]);
    }
  }

  // ==========================
  // GPS
  // ==========================
  function requestGps() {
    if (!navigator.geolocation) {
      setStatus("GPS not supported on this device.", "status-bad");
      return;
    }

    setStatus("Requesting GPS lock...", "status-warn");

    navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        updatePlayerMarker(latitude, longitude);
        setGpsAccuracy(accuracy);

        if (map && !map._movedOnce) {
          map.setView([latitude, longitude], DEFAULT_ZOOM);
          map._movedOnce = true;
        }

        setStatus("GPS lock acquired.", "status-good");
      },
      err => {
        console.error(err);
        setStatus("GPS error or permission denied.", "status-bad");
        setGpsAccuracy(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000
      }
    );
  }

  function centerOnPlayer() {
    if (currentPosition && map) {
      map.setView([currentPosition.lat, currentPosition.lng], DEFAULT_ZOOM);
    } else {
      setStatus("No GPS lock yet. Request GPS first.", "status-warn");
    }
  }

  function recenterMojave() {
    if (map) {
      map.setView(MOJAVE_COORDS, DEFAULT_ZOOM);
    }
  }

  // ==========================
  // TERMINAL / PANELS
  // ==========================
  function openTerminalPanel(title, html) {
    panelTitle.textContent = title;
    panelBody.innerHTML = html;
    terminal.classList.remove("hidden");
  }

  function closeTerminalPanel() {
    terminal.classList.add("hidden");
  }

  function openTutorial() {
    if (tutorialModal) {
      tutorialModal.classList.remove("hidden");
    }
  }

  function closeTutorial() {
    if (tutorialModal) {
      tutorialModal.classList.add("hidden");
    }
  }

  // ==========================
  // MINT MODAL / LOOT
  // ==========================
  function openMintModal(title, msg) {
    mintTitle.textContent = title;
    mintMsg.textContent = msg;
    mintProgressBar.style.width = "0%";
    mintModal.classList.remove("hidden");

    setTimeout(() => {
      mintProgressBar.style.width = "100%";
    }, 50);
  }

  function closeMintModal() {
    mintModal.classList.add("hidden");
  }

  function addCaps(amount) {
    caps += amount;
    capsEl.textContent = caps.toString();
  }

  function addXp(amount) {
    xp += amount;
    const xpNeeded = 100;
    if (xp >= xpNeeded) {
      xp -= xpNeeded;
      level++;
      lvlEl.textContent = level.toString();
      setStatus(`Level up! You are now LVL ${level}.`, "status-good");
    }

    const pct = Math.max(0, Math.min(100, (xp / xpNeeded) * 100));
    xpFillEl.style.width = `${pct}%`;
    xpTextEl.textContent = `${xp} / ${xpNeeded}`;
  }

  function incrementClaimed() {
    claimedCount++;
    claimedEl.textContent = claimedCount.toString();
  }

  function randomChoice(arr) {
    if (!arr || arr.length === 0) return null;
    const idx = Math.floor(Math.random() * arr.length);
    return arr[idx];
  }

  function computeXpReward(loc, chosenItems) {
    const base = (loc.lvl || 1) * 2;
    const rarityBonusMap = {
      common: 0,
      rare: 10,
      epic: 25,
      legendary: 50
    };
    let rarityBonus = rarityBonusMap[(loc.rarity || "").toLowerCase()] || 0;
    let itemBonus = 0;

    if (Array.isArray(chosenItems)) {
      chosenItems.forEach(item => {
        const r = (item.rarity || "").toLowerCase();
        if (r === "rare") itemBonus += 5;
        if (r === "epic") itemBonus += 15;
        if (r === "legendary") itemBonus += 30;
      });
    }

    return base + rarityBonus + itemBonus;
  }

  function computeCapsReward(chosenItems) {
    if (!Array.isArray(chosenItems) || chosenItems.length === 0) return 25;
    // Scale down from priceCAPS so rewards are reasonable
    const totalPrice = chosenItems.reduce(
      (sum, item) => sum + (item.priceCAPS || 0),
      0
    );
    return Math.max(10, Math.round(totalPrice * 0.15));
  }

  function getLootForLocation(loc) {
    const poiName = loc.n || "";
    const locLevel = loc.lvl || 1;

    const pool = DATA.scavenger.filter(item => {
      if (!item.spawnPOI || item.spawnPOI !== poiName) return false;
      if (item.levelRequirement && item.levelRequirement > level) return false;
      return true;
    });

    if (pool.length === 0) return [];

    const results = [];
    const maxItems = Math.min(3, pool.length);
    const rolls = 1 + Math.floor(Math.random() * maxItems);

    const usedIds = new Set();
    for (let i = 0; i < rolls; i++) {
      const candidate = randomChoice(pool);
      if (!candidate || usedIds.has(candidate.id)) continue;
      usedIds.add(candidate.id);
      results.push(candidate);
    }

    return results;
  }

  async function handleClaimLoot(loc) {
    if (!currentPosition) {
      setStatus("Cannot claim: GPS not locked.", "status-bad");
      return;
    }

    const d = distanceMeters(
      currentPosition.lat,
      currentPosition.lng,
      loc.lat,
      loc.lng
    );

    if (d > CLAIM_RADIUS_METERS) {
      setStatus(`Too far away to claim (${Math.round(d)}m).`, "status-warn");
      return;
    }

    const lootItems = getLootForLocation(loc);
    const lootListText =
      lootItems.length > 0
        ? lootItems.map(i => `- ${i.name} [${rarityLabel(i.rarity)}]`).join("\n")
        : "Scavenged basic supplies.";

    openMintModal(
      "LOOT CLAIMED",
      `Scanning area for salvage...\n\n${lootListText}`
    );

    try {
      // Placeholder for backend claim hook if needed.
      await new Promise(res => setTimeout(res, 1500));

      const xpReward = computeXpReward(loc, lootItems);
      const capsReward = computeCapsReward(lootItems);

      addCaps(capsReward);
      addXp(xpReward);
      incrementClaimed();

      mintMsg.textContent = `Claim successful.\n+${capsReward} CAPS\n+${xpReward} XP`;
      setStatus("Loot claimed successfully.", "status-good");
    } catch (e) {
      console.error(e);
      mintMsg.textContent = "Claim failed. Try again.";
      setStatus("Loot claim failed.", "status-bad");
    }
  }

  function openLocationPanel(loc) {
    const name = loc.n || "Unknown Location";
    const lvl = loc.lvl || 1;
    const rarity = loc.rarity || "common";
    const rarityText = rarityLabel(rarity);
    const rarityCssColor = rarityColor(rarity);

    const pack = DATA.collectiblesPack;
    const allCols = Array.isArray(pack.collectibles) ? pack.collectibles : [];
    const colsForPoi = allCols.filter(c => c.poi === name);

    const lootPreview = DATA.scavenger.filter(
      item => item.spawnPOI === name
    );

    let collectiblesHtml = "";
    if (colsForPoi.length > 0) {
      collectiblesHtml =
        "<br/><b>COLLECTIBLES AT THIS LOCATION:</b><br/><br/>" +
        colsForPoi
          .map(
            c => `
<b>${c.title}</b><br/>
<small>Type: ${c.type}</small><br/>
<pre style="white-space:pre-wrap;font-family:inherit;margin:4px 0 10px 0;">${c.content}</pre>
`
          )
          .join("");
    }

    let lootHtml = "";
    if (lootPreview.length > 0) {
      lootHtml =
        "<br/><b>POSSIBLE LOOT:</b><br/><br/>" +
        lootPreview
          .slice(0, 6)
          .map(
            item => `
<span style="color:${rarityColor(item.rarity)};">
  ${item.name} [${rarityLabel(item.rarity)}]
</span><br/>
<small>${item.type} – LVL ${item.levelRequirement || 1} – ${item.priceCAPS} CAPS</small><br/><br/>
`
          )
          .join("");
    }

    openTerminalPanel(
      "LOCATION",
      `
<b>${name}</b><br/>
LVL ${lvl} – <span style="color:${rarityCssColor};">${rarityText}</span><br/>
LAT: ${loc.lat.toFixed(4)}, LNG: ${loc.lng.toFixed(4)}<br/><br/>
Distance: <span id="locDistance">calculating...</span><br/><br/>
<button class="btn" id="claimBtn">CLAIM LOOT</button>
${lootHtml}
${collectiblesHtml}
    `
    );

    setTimeout(() => {
      const claimBtn = document.getElementById("claimBtn");
      const locDistance = document.getElementById("locDistance");
      if (!claimBtn || !locDistance) return;

      if (currentPosition) {
        const d = distanceMeters(
          currentPosition.lat,
          currentPosition.lng,
          loc.lat,
          loc.lng
        );
        locDistance.textContent = `${Math.round(d)}m`;
      } else {
        locDistance.textContent = "GPS not locked";
      }

      claimBtn.addEventListener("click", () => {
        handleClaimLoot(loc);
      });
    }, 0);
  }

  // ==========================
  // TABS
  // ==========================
  function renderStatsPanel() {
    openTerminalPanel(
      "STATUS",
      `
LEVEL: ${level}<br/>
XP: ${xp} / 100<br/>
CAPS: ${caps}<br/>
CLAIMED LOCATIONS: ${claimedCount}<br/>
`
    );
  }

  function renderQuestsPanel() {
    if (!Array.isArray(DATA.quests) || DATA.quests.length === 0) {
      openTerminalPanel("QUESTS", "No quests available.");
      return;
    }

    const html = DATA.quests.map(q => {
      const typeLabel =
        (q.type || "").toLowerCase() === "side" ? "SIDE QUEST" : "MAIN QUEST";
      const poiLine = Array.isArray(q.poIs)
        ? q.poIs.join(", ")
        : "Unknown POIs";

      const objectivesHtml = Array.isArray(q.objectives)
        ? q.objectives
            .map(o => `- ${o}`)
            .join("<br/>")
        : "No objectives listed.";

      const endingsHtml = Array.isArray(q.endings) && q.endings.length > 0
        ? q.endings
            .map(
              e => `
<b>Ending:</b> ${e.description}<br/>
<b>Reward:</b> ${e.reward || "Unknown"}<br/>
<b>Consequence:</b> ${e.consequence || "Unknown"}<br/><br/>
`
            )
            .join("")
        : "Endings TBD.<br/><br/>";

      return `
<div style="margin-bottom:18px;">
  <b>${q.name}</b> <small>(${typeLabel})</small><br/>
  <small>POIs: ${poiLine}</small><br/><br/>
  ${q.description}<br/><br/>
  <b>Objectives:</b><br/>
  ${objectivesHtml}<br/><br/>
  ${endingsHtml}
</div>
`;
    }).join("");

    openTerminalPanel("QUESTS", html);
  }

  function renderItemsPanel() {
    const pack = DATA.collectiblesPack;
    const collectibles = Array.isArray(pack.collectibles)
      ? pack.collectibles
      : [];

    if (collectibles.length === 0) {
      openTerminalPanel("ITEMS", "No collectibles available.");
      return;
    }

    const byPoi = {};
    collectibles.forEach(c => {
      const key = c.poi || "Unknown Location";
      if (!byPoi[key]) byPoi[key] = [];
      byPoi[key].push(c);
    });

    const sections = Object.keys(byPoi)
      .sort()
      .map(poi => {
        const entries = byPoi[poi]
          .map(
            c => `
<b>${c.title}</b><br/>
<small>Type: ${c.type}</small><br/>
<pre style="white-space:pre-wrap;font-family:inherit;margin:4px 0 10px 0;">${c.content}</pre>
`
          )
          .join("");

        return `
<div style="margin-bottom:16px;">
  <div><b>POI:</b> ${poi}</div>
  ${entries}
</div>
`;
      })
      .join("");

    const header = `
<b>COLLECTIBLES – ${pack.id || "UNLABELED PACK"}</b><br/>
${pack.description || ""}<br/><br/>
`;

    openTerminalPanel("ITEMS", header + sections);
  }

  function renderShopPanel() {
    if (!Array.isArray(DATA.scavenger) || DATA.scavenger.length === 0) {
      openTerminalPanel(
        "SCAVENGER'S EXCHANGE",
        "No items catalogued for exchange."
      );
      return;
    }

    const html = DATA.scavenger
      .slice(0, 80)
      .map(item => {
        const rColor = rarityColor(item.rarity);
        const rLabel = rarityLabel(item.rarity);
        return `
<span style="color:${rColor};">
  ${item.name} [${rLabel}]
</span><br/>
<small>${item.type} – LVL ${item.levelRequirement || 1} – ${item.priceCAPS} CAPS – POI: ${
          item.spawnPOI || "Unknown"
        }</small><br/><br/>
`;
      })
      .join("");

    openTerminalPanel("SCAVENGER'S EXCHANGE", html);
  }

  function initTabs() {
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");

        const panel = tab.getAttribute("data-panel");
        if (panel === "map") {
          closeTerminalPanel();
        } else if (panel === "stat") {
          renderStatsPanel();
        } else if (panel === "items") {
          renderItemsPanel();
        } else if (panel === "quests") {
          renderQuestsPanel();
        } else if (panel === "shop") {
          renderShopPanel();
        }
      });
    });
  }

  // ==========================
  // WALLET
  // ==========================
  function initWallet() {
    if (!connectWalletBtn) return;

    connectWalletBtn.addEventListener("click", async () => {
      if (!window.solana || !window.solana.isPhantom) {
        setStatus("Phantom wallet not detected.", "status-warn");
        return;
      }

      try {
        const resp = await window.solana.connect();
        walletPubkey = resp.publicKey.toString();
        setStatus(
          `Wallet connected: ${walletPubkey.slice(0, 4)}...${walletPubkey.slice(
            -4
          )}`,
          "status-good"
        );
        connectWalletBtn.textContent = "Wallet Connected";
      } catch (e) {
        console.error(e);
        setStatus("Wallet connection rejected.", "status-bad");
      }
    });
  }

  // ==========================
  // UI INIT
  // ==========================
  function initUi() {
    if (requestGpsBtn) {
      requestGpsBtn.addEventListener("click", requestGps);
    }
    if (centerBtn) {
      centerBtn.addEventListener("click", centerOnPlayer);
    }
    if (recenterMojaveBtn) {
      recenterMojaveBtn.addEventListener("click", recenterMojave);
    }

    if (panelClose) {
      panelClose.addEventListener("click", closeTerminalPanel);
    }
    if (mintCloseBtn) {
      mintCloseBtn.addEventListener("click", closeMintModal);
    }

    if (tutorialClose) {
      tutorialClose.addEventListener("click", closeTutorial);
    }

    if (enterNukeVaultBtn) {
      enterNukeVaultBtn.addEventListener("click", () => {
        window.location = "/nuke.html";
      });
    }

    initTabs();
    initWallet();
  }

  // ==========================
  // GAME INIT
  // ==========================
  async function initGame() {
    await loadAllData();
    initMap();
    initUi();
    openTutorial();
    setStatus("Pip-Boy online. Request GPS to begin tracking.", "status-good");
  }

  // Start game when boot sequence says ready
  window.addEventListener("pipboyReady", () => {
    initGame();
  });

})();
