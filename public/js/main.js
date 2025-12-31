// main.js – map, GPS, tabs, terminal, data-driven loot & quests

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

  // === DATA STORE (all from /data/*.json) ===
  const DATA = {
    locations: [],   // from locations.json
    quests: [],      // from quests.json
    mintables: [],   // from mintables.json
    scavenger: [],   // from scavenger.json
    factions: []     // from factions.json
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

  // ==========================
  // DATA LOADING
  // ==========================
  async function loadDataFile(name) {
    try {
      const res = await fetch(`/data/${name}.json`);
      if (!res.ok) return;
      DATA[name] = await res.json();
    } catch (e) {
      console.error(`Failed to load ${name}.json`, e);
    }
  }

  async function loadAllData() {
    await Promise.all([
      loadDataFile("locations"),
      loadDataFile("quests"),
      loadDataFile("mintables"),
      loadDataFile("scavenger"),
      loadDataFile("factions")
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
      const marker = L.marker([loc.lat, loc.lng]);
      marker.addTo(locationsLayer);
      marker.bindPopup(loc.name || "Unknown location");

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
    tutorialModal.classList.remove("hidden");
  }

  function closeTutorial() {
    tutorialModal.classList.add("hidden");
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

  function findMintForLocation(loc) {
    if (!loc || !DATA.mintables || !Array.isArray(DATA.mintables)) return null;
    if (!loc.mintId) return null;
    return DATA.mintables.find(m => m.id === loc.mintId) || null;
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

    const mint = findMintForLocation(loc);

    const title = mint?.title || "LOOT FOUND";
    const message =
      mint?.message || "Minting CAPS from the wasteland...";

    openMintModal(title, message);

    try {
      // Placeholder – hook your backend claim endpoint here if needed.
      // Example:
      // const res = await fetch("/api/claim", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ locationId: loc.id, wallet: walletPubkey })
      // });

      await new Promise(res => setTimeout(res, 1500));

      const capsReward = mint?.caps ?? 5;
      const xpReward = mint?.xp ?? 10;

      addCaps(capsReward);
      addXp(xpReward);
      incrementClaimed();

      mintMsg.textContent = mint?.successMessage || "Claim successful.";
      setStatus("Loot claimed successfully.", "status-good");
    } catch (e) {
      console.error(e);
      mintMsg.textContent = mint?.failureMessage || "Claim failed. Try again.";
      setStatus("Loot claim failed.", "status-bad");
    }
  }

  function openLocationPanel(loc) {
    openTerminalPanel("LOCATION", `
<b>${loc.name || "Unknown Location"}</b><br/>
${loc.description || ""}<br/><br/>
Distance: <span id="locDistance">calculating...</span><br/><br/>
<button class="btn" id="claimBtn">CLAIM LOOT</button>
    `);

    // After render, wire the claim button
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
    openTerminalPanel("STATUS", `
LEVEL: ${level}<br/>
XP: ${xp} / 100<br/>
CAPS: ${caps}<br/>
CLAIMED LOCATIONS: ${claimedCount}<br/>
    `);
  }

  function renderQuestsPanel() {
    if (!DATA.quests || DATA.quests.length === 0) {
      openTerminalPanel("QUESTS", "No quests available.");
      return;
    }

    const html = DATA.quests.map(q => `
<b>${q.name}</b><br/>
${q.description}<br/><br/>
    `).join("");

    openTerminalPanel("QUESTS", html);
  }

  function renderItemsPanel() {
    // Placeholder – you can later wire inventory here.
    openTerminalPanel("ITEMS", "Inventory system coming soon.");
  }

  function renderShopPanel() {
    if (!DATA.scavenger || DATA.scavenger.length === 0) {
      openTerminalPanel("SCAVENGER'S EXCHANGE", "No items available in the shop.");
      return;
    }

    const html = DATA.scavenger.map(item => `
<b>${item.name}</b> – ${item.cost} CAPS<br/>
${item.description}<br/><br/>
    `).join("");

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
    connectWalletBtn.addEventListener("click", async () => {
      if (!window.solana || !window.solana.isPhantom) {
        setStatus("Phantom wallet not detected.", "status-warn");
        return;
      }

      try {
        const resp = await window.solana.connect();
        walletPubkey = resp.publicKey.toString();
        setStatus(
          `Wallet connected: ${walletPubkey.slice(0, 4)}...${walletPubkey.slice(-4)}`,
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
    requestGpsBtn.addEventListener("click", requestGps);
    centerBtn.addEventListener("click", centerOnPlayer);
    recenterMojaveBtn.addEventListener("click", recenterMojave);

    panelClose.addEventListener("click", closeTerminalPanel);
    mintCloseBtn.addEventListener("click", closeMintModal);

    tutorialClose.addEventListener("click", () => {
      closeTutorial();
    });

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
