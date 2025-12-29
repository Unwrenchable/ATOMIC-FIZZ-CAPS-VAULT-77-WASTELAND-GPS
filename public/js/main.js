// /js/main.js — Map + Locations + Wallet + Panels + Devnet CAPS

(function () {
  let map;
  let playerMarker = null;
  let connectedWallet = null;

  const connectBtn = document.getElementById("connectWalletBtn");
  const gpsStatusEl = document.getElementById("gpsStatus");
  const gpsDot = document.getElementById("gpsDot");

  const playerCapsEl = document.getElementById("playerCaps");
  const panelCapsEl = document.getElementById("panelCaps");

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
      const res = await fetch("/locations.json");
      const locations = await res.json();

      locations.forEach((loc) => {
        const marker = L.marker([loc.latitude, loc.longitude]).addTo(map);
        marker.bindPopup(`
          <b>${loc.name}</b><br>
          Level: ${loc.level}<br>
          Rarity: ${loc.rarity}
        `);
      });
    } catch (err) {
      console.error("Failed to load locations:", err);
    }
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

      // --- REAL CAPS BALANCE (DEVNET) ---
      try {
        const connection = new solanaWeb3.Connection("https://api.devnet.solana.com");

        const publicKey = new solanaWeb3.PublicKey(connectedWallet);

        const balanceLamports = await connection.getBalance(publicKey);
        const sol = balanceLamports / solanaWeb3.LAMPORTS_PER_SOL;

        // Your tokenomics:
        // Total supply: 77,777,777 CAPS
        // 10% to liquidity = 7,777,778 CAPS
        // 5 SOL added to liquidity
        // => 1 SOL = 1,555,556 CAPS
        const CAPS_PER_SOL = 1555556;

        const caps = Math.floor(sol * CAPS_PER_SOL);

        playerCapsEl.textContent = caps.toString();
        panelCapsEl.textContent = caps.toString();

      } catch (rpcErr) {
        console.warn("RPC failed, using fallback CAPS:", rpcErr);
      }

    } catch (err) {
      console.error("Wallet connect failed:", err);
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
        document
          .querySelectorAll(".panel-content")
          .forEach((p) => p.classList.add("hidden"));
        panel.classList.remove("hidden");
      });
    });
  }

  // ---------------- BOOT ----------------

  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    initGPS();
    initPanels();
    connectBtn.addEventListener("click", connectWallet);
  });
})();
