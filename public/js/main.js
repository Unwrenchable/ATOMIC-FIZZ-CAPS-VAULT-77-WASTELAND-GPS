// /js/main.js — Map + Locations + Wallet + Panels + Devnet CAPS + Items + Quests + Scavengers + Claim/Mint hooks

(function () {
  let map;
  let playerMarker = null;
  let connectedWallet = null;

  // Network / program configuration (mainnet-ready)
  const CONFIG = {
    network: "devnet",
    rpcEndpoint: "https://api.devnet.solana.com",
  };

  const connectBtn = document.getElementById("connectWalletBtn");
  const gpsStatusEl = document.getElementById("gpsStatus");
  const gpsDot = document.getElementById("gpsDot");

  const playerCapsEl = document.getElementById("playerCaps");
  const panelCapsEl = document.getElementById("panelCaps");

  const gearListEl = document.getElementById("gearList");
  const questsListEl = document.getElementById("questsList");

  const claimBtn = document.getElementById("claimBtn");
  const mintBtn = document.getElementById("mintBtn");

  // ---------------- MAP ----------------

  function initMap() {
    const start = [36.0023, -114.9538];

    map = L.map("map").setView(start, 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    loadLocations();
  }

  // ---------------- LOAD LOCATIONS ----------------

  async function loadLocations() {
    try {
      const res = await fetch("/data/locations.json");
      const locations = await res.json();

      locations.forEach((loc) => {
        const marker = L.marker([loc.lat, loc.lng]).addTo(map);
        marker.bindPopup(`
          <b>${loc.n}</b><br>
          Level: ${loc.lvl}<br>
          Rarity: ${loc.rarity}
        `);
      });
    } catch (err) {
      console.error("Failed to load locations:", err);
    }
  }

  // ---------------- ITEMS (from /data/mintables.json) ----------------

  async function loadItems() {
    if (!gearListEl) return;

    try {
      const res = await fetch("/data/mintables.json");
      const data = await res.json();

      gearListEl.innerHTML = "";

      const items = Array.isArray(data) ? data : data.items || [];

      if (!items.length) {
        gearListEl.textContent = "No gear available.";
        return;
      }

      items.forEach((item) => {
        const name = item.name || item.title || item.symbol || "Unknown item";
        const desc = item.description || item.desc || item.flavor || "No description.";

        const div = document.createElement("div");
        div.className = "pip-item-row";
        div.innerHTML = `
          <div class="pip-item-name">${name}</div>
          <div class="pip-item-desc">${desc}</div>
        `;
        gearListEl.appendChild(div);
      });
    } catch (err) {
      console.error("Failed to load items from /data/mintables.json:", err);
      gearListEl.textContent = "Error loading gear.";
    }
  }

  // ---------------- QUESTS (from /data/quests.json) ----------------

  async function loadQuests() {
    if (!questsListEl) return;

    try {
      const res = await fetch("/data/quests.json");
      const data = await res.json();

      questsListEl.innerHTML = "";

      const quests = Array.isArray(data) ? data : data.quests || [];

      if (!quests.length) {
        questsListEl.textContent = "No quests available.";
        return;
      }

      quests.forEach((q) => {
        const title = q.title || q.name || "Unknown Quest";
        const desc = q.description || q.desc || "No description.";
        const status = q.status || "ACTIVE";

        const li = document.createElement("li");
        li.className = "pip-quest-row";
        li.innerHTML = `
          <div class="pip-quest-title">${title}</div>
          <div class="pip-quest-desc">${desc}</div>
          <div class="pip-quest-status">[${status}]</div>
        `;
        questsListEl.appendChild(li);
      });
    } catch (err) {
      console.error("Failed to load quests from /data/quests.json:", err);
      questsListEl.textContent = "Error loading quests.";
    }
  }

  // ---------------- SCAVENGERS EXCHANGE (placeholder) ----------------

  async function loadScavengerExchange() {
    const container = document.getElementById("scavengerOffers");
    if (!container) return;

    container.innerHTML = `
      <div class="pip-scavenger-row">
        <div class="pip-scavenger-title">SCAVENGERS EXCHANGE</div>
        <div class="pip-scavenger-desc">
          Players will be able to list unwanted or valuable NFTs here for buyback by the community.<br>
          This marketplace activates once the backend is live.
        </div>
      </div>
    `;
  }

  // ---------------- GPS ----------------

  function initGPS() {
    if (!navigator.geolocation) {
      gpsStatusEl.textContent = "GPS: NOT AVAILABLE";
      gpsDot.classList.add("bad");
      return;
    }

    gpsStatusEl.textContent = "GPS: WATCHING...";
    gpsDot.classList.add("ok");

    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        gpsStatusEl.textContent = `GPS: ${latitude.toFixed(
          5
        )}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`;

        const ll = [latitude, longitude];

        if (!playerMarker) {
          playerMarker = L.marker(ll, { title: "You" }).addTo(map);
        } else {
          playerMarker.setLatLng(ll);
        }
      },
      () => {
        gpsStatusEl.textContent = "GPS: ERROR";
        gpsDot.classList.remove("ok");
        gpsDot.classList.add("bad");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }

  // ---------------- WALLET + DEVNET CAPS ----------------

  async function connectWallet() {
    const provider = window.solana;

    if (!provider || !provider.isPhantom) {
      alert("Phantom wallet not found.");
      return;
    }

    try {
      const res = await provider.connect();
      connectedWallet = res.publicKey.toString();

      connectBtn.textContent =
        connectedWallet.slice(0, 4) + "..." + connectedWallet.slice(-4);
      connectBtn.classList.add("connected");

      try {
        const connection = new solanaWeb3.Connection(CONFIG.rpcEndpoint);
        const publicKey = new solanaWeb3.PublicKey(connectedWallet);

        const balanceLamports = await connection.getBalance(publicKey);
        const sol = balanceLamports / solanaWeb3.LAMPORTS_PER_SOL;

        const CAPS_PER_SOL = 1555556;
        const caps = Math.floor(sol * CAPS_PER_SOL);

        playerCapsEl.textContent = caps.toString();
        panelCapsEl.textContent = caps.toString();
      } catch (rpcErr) {
        console.warn("RPC failed:", rpcErr);
      }
    } catch (err) {
      console.error("Wallet connect failed:", err);
    }
  }

  // ---------------- CLAIM LOOT ----------------

  async function handleClaimClick() {
    if (!connectedWallet) {
      alert("Connect your wallet before claiming loot.");
      return;
    }

    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: connectedWallet }),
      });

      if (!res.ok) throw new Error(`Claim failed: ${res.status}`);

      const data = await res.json();
      alert(data.message || "Claim successful.");

      loadItems();
      connectWallet();
    } catch (err) {
      console.error("Claim failed:", err);
      alert("Claim failed.");
    }
  }

  // ---------------- MINT ITEMS ----------------

  async function handleMintClick() {
    if (!connectedWallet) {
      alert("Connect your wallet before minting items.");
      return;
    }

    try {
      const res = await fetch("/api/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: connectedWallet }),
      });

      if (!res.ok) throw new Error(`Mint failed: ${res.status}`);

      const data = await res.json();
      alert(data.message || "Mint request submitted.");

      loadItems();
    } catch (err) {
      console.error("Mint failed:", err);
      alert("Mint failed.");
    }
  }

  // ---------------- PANELS ----------------

  function initPanels() {
    const mapping = {
      statsBtn: "statsPanel",
      itemsBtn: "itemsPanel",
      questsBtn: "questsPanel",
      scavengersBtn: "scavengersPanel",
    };

    Object.keys(mapping).forEach((btnId) => {
      const panelId = mapping[btnId];
      const btn = document.getElementById(btnId);
      const panel = document.getElementById(panelId);

      btn.addEventListener("click", () => {
        document.querySelectorAll(".panel-content").forEach((p) => p.classList.add("hidden"));
        panel.classList.remove("hidden");
      });
    });
  }

  // ---------------- BOOT ----------------

  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    initGPS();
    initPanels();
    loadItems();
    loadQuests();
    loadScavengerExchange();

    connectBtn.addEventListener("click", connectWallet);

    if (claimBtn) claimBtn.addEventListener("click", handleClaimClick);
    if (mintBtn) mintBtn.addEventListener("click", handleMintClick);
  });
})();
