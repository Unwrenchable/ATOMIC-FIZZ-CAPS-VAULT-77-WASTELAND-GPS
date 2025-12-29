// main.js — Pip-Boy Map, Wallet, GPS, Loot Claim, Panels

(function () {
  let map;
  let playerMarker = null;
  let connectedWallet = null;
  let markers = {};

  const CONFIG = {
    network: "devnet",
    rpcEndpoint: "https://api.devnet.solana.com",
  };

  // DOM
  const bootScreen = document.getElementById("bootScreen");
  const bootText = document.getElementById("bootText");
  const loginScreen = document.getElementById("loginScreen");
  const pipboyScreen = document.getElementById("pipboyScreen");

  const connectBtn = document.getElementById("connectWalletBtn");
  const walletStatusBtn = document.getElementById("walletStatusBtn");

  const gpsStatusEl = document.getElementById("gpsStatus");
  const gpsDot = document.getElementById("gpsDot");

  const playerCapsEl = document.getElementById("playerCaps");
  const panelCapsEl = document.getElementById("panelCaps");

  const gearListEl = document.getElementById("gearList");
  const questsListEl = document.getElementById("questsList");

  // ---------------- BOOT SEQUENCE ----------------

  function runBootSequence() {
    if (!bootScreen || !bootText) {
      // If boot screen isn't present, just fall back to showing login
      if (loginScreen) loginScreen.classList.remove("hidden");
      return;
    }

    const bootLines = [
      "ATOMIC FIZZ SYSTEMS\n",
      "Initializing Pip-Unit 3000-AF...",
      "Loading Wasteland Navigation Kernel...",
      "Calibrating Geo-Tracker...",
      "Decrypting FizzCap Ledger...",
      "Establishing SolLink Handshake...",
      "Boot Complete.\n",
      "Welcome, Survivor."
    ];

    let i = 0;

    function nextLine() {
      if (i < bootLines.length) {
        bootText.textContent += bootLines[i] + "\n";
        i++;
        setTimeout(nextLine, 350);
      } else {
        bootScreen.classList.add("hidden");
        if (loginScreen) loginScreen.classList.remove("hidden");
      }
    }

    nextLine();
  }

  // ---------------- MAP ----------------

  function initMap() {
    const start = [36.0023, -114.9538];

    map = L.map("map", {
      zoomControl: true,
      minZoom: 3,
      maxZoom: 19,
    }).setView(start, 13);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        attribution: "",
      }
    ).addTo(map);

    loadLocations();
  }

  // ---------------- LOAD LOCATIONS WITH ICONS ----------------

  async function loadLocations() {
    try {
      const res = await fetch("/data/locations.json");
      const locations = await res.json();

      locations.forEach((loc) => {
        let iconFile = "landmark.png";
        if (loc.type === "vault") iconFile = "vault.png";
        if (loc.type === "town") iconFile = "town.png";
        if (loc.type === "quest") iconFile = "quest.png"; // diamond icon

        const icon = L.icon({
          iconUrl: `/img/icons/${iconFile}`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          className: "marker-active",
        });

        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);

        const name = loc.name || `Location ${loc.n}`;
        const lvl = loc.lvl != null ? loc.lvl : "?";
        const rarity = loc.rarity || "common";

        marker.bindPopup(
          `
          <b>${name}</b><br>
          Level: ${lvl}<br>
          Rarity: ${rarity}
        `.trim()
        );

        marker.on("click", () => attemptClaim(loc));

        markers[loc.n] = marker;
      });
    } catch (err) {
      console.error("Failed to load locations:", err);
    }
  }

  // ---------------- GPS ----------------

  function initGPS() {
    if (!gpsStatusEl || !gpsDot) return;

    if (!navigator.geolocation) {
      gpsStatusEl.textContent = "GPS: NOT AVAILABLE";
      return;
    }

    gpsStatusEl.textContent = "GPS: WATCHING...";
    gpsDot.classList.add("acc-amber");

    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        gpsStatusEl.textContent = `GPS: ${latitude.toFixed(
          5
        )}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`;

        gpsDot.classList.remove("acc-green", "acc-amber");
        gpsDot.classList.add(accuracy <= 25 ? "acc-green" : "acc-amber");

        const ll = [latitude, longitude];

        if (!playerMarker) {
          playerMarker = L.marker(ll, { title: "You" }).addTo(map);
        } else {
          playerMarker.setLatLng(ll);
        }
      },
      (err) => {
        console.error("GPS error:", err);
        gpsStatusEl.textContent = "GPS: ERROR";
        gpsDot.classList.remove("acc-green", "acc-amber");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }

  // ---------------- WALLET ----------------

  async function connectWallet() {
    const provider = window.solana;

    if (!provider || !provider.isPhantom) {
      alert("Phantom wallet not found.");
      return;
    }

    try {
      const res = await provider.connect();
      connectedWallet = res.publicKey.toString();

      if (loginScreen) loginScreen.classList.add("hidden");
      if (pipboyScreen) pipboyScreen.classList.remove("hidden");

      if (walletStatusBtn) {
        walletStatusBtn.textContent =
          `TERMINAL ONLINE (${connectedWallet.slice(0, 4)}...)`;
      }

      await refreshCapsFromBackend();
    } catch (err) {
      console.error("Wallet connect failed:", err);
    }
  }

  async function refreshCapsFromBackend() {
    if (!connectedWallet) return;

    try {
      const capsRes = await fetch(`/player/${connectedWallet}`);
      const playerData = await capsRes.json();
      const caps = playerData.caps || 0;

      if (playerCapsEl) playerCapsEl.textContent = caps.toString();
      if (panelCapsEl) panelCapsEl.textContent = caps.toString();
    } catch (err) {
      console.warn("Failed to load stored CAPS:", err);
    }
  }

  // ---------------- CLAIM LOOT (PHANTOM SIGNATURE) ----------------

  async function attemptClaim(loc) {
    if (!connectedWallet) {
      alert("Connect your terminal first.");
      return;
    }

    if (!playerMarker) {
      alert("GPS not ready.");
      return;
    }

    const playerPos = playerMarker.getLatLng();
    const dist = map.distance(playerPos, L.latLng(loc.lat, loc.lng));

    if (dist > 50) {
      alert(`Too far from location (${Math.round(dist)}m). Move closer.`);
      return;
    }

    const message = `Claim:${loc.n}:${Date.now()}`;
    const encoded = new TextEncoder().encode(message);

    try {
      const signed = await window.solana.signMessage(encoded, "utf8");
      const signature = bs58.encode(signed);

      const payload = {
        wallet: connectedWallet,
        loot_id: loc.n,
        signature,
        message,
        timestamp: Date.now(),
        latitude: playerPos.lat,
        longitude: playerPos.lng,
        location_hint: loc.name,
      };

      const res = await fetch("/claim-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || "Claim failed.");
        return;
      }

      alert("Loot voucher created!");
      refreshCapsFromBackend();

      const marker = markers[loc.n];
      if (marker && marker.getElement()) {
        marker.getElement().classList.add("marker-claimed");
      }
    } catch (err) {
      console.error("Claim error:", err);
      alert("Claim failed.");
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

      if (!btn || !panel) return;

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
    runBootSequence();
    initMap();
    initGPS();
    initPanels();

    if (connectBtn) {
      connectBtn.addEventListener("click", connectWallet);
    }
  });
})();
