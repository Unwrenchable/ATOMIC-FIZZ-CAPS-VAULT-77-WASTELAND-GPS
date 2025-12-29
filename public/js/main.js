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

  // ---------------- DOM ELEMENTS ----------------

  const bootScreen = document.getElementById("bootScreen");
  const bootText = document.getElementById("bootText");
  const pipboyScreen = document.getElementById("pipboyScreen");

  const walletStatusBtn = document.getElementById("walletStatusBtn");

  const gpsStatusEl = document.getElementById("gpsStatus");
  const gpsDot = document.getElementById("gpsDot");

  const playerCapsEl = document.getElementById("playerCaps");
  const panelCapsEl = document.getElementById("panelCaps");

  const gearListEl = document.getElementById("gearList");
  const questsListEl = document.getElementById("questsList");

  // ---------------- BOOT SEQUENCE ----------------

  function runBootSequence() {
    if (!bootScreen || !bootText) return;

    bootText.textContent = "";

    const bootLines = [
      "              █████████████████████████████",
      "              █    A T O M I C  F I Z Z   █",
      "              █          C A P S          █",
      "              █████████████████████████████",
      "",
      "Initializing Pip-Unit 3000-AF...",
      "Loading Wasteland Navigation Kernel...",
      "Calibrating Geo-Tracker...",
      "Decrypting FizzCap Ledger...",
      "Establishing SolLink Handshake...",
      "Boot Complete.",
      "Welcome, Survivor."
    ];

    let i = 0;

    function nextLine() {
      if (i < bootLines.length) {
        bootText.textContent += bootLines[i] + "\n";
        i++;
        setTimeout(nextLine, 350);
      } else {
        // Clear boot text and swap to Pip-Boy
        bootText.textContent = "";
        bootScreen.classList.add("hidden");
        pipboyScreen.classList.remove("hidden");
      }
    }

    nextLine();
  }

  // ---------------- MAP ----------------

  function initMap() {
    if (typeof L === "undefined") {
      console.error("Leaflet not loaded.");
      return;
    }

    const start = [36.0023, -114.9538];

    map = L.map("map", {
      zoomControl: true,
      minZoom: 13,
      maxZoom: 19,
      attributionControl: false,
    }).setView(start, 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "",
    }).addTo(map);


    loadLocations();
  }

  // ---------------- LOAD LOCATIONS ----------------

  async function loadLocations() {
    if (!map) return;

    try {
      const res = await fetch("/data/locations.json");
      const locations = await res.json();

      locations.forEach((loc) => {
        let iconFile = "landmark.png";
        if (loc.type === "vault") iconFile = "vault.png";
        if (loc.type === "town") iconFile = "town.png";
        if (loc.type === "quest") iconFile = "quest.png";

        const icon = L.icon({
          iconUrl: `/img/icons/${iconFile}`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          className: "marker-active",
        });

        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);

        marker.bindPopup(
          `<b>${loc.name || `Location ${loc.n}`}</b><br>
           Level: ${loc.lvl ?? "?"}<br>
           Rarity: ${loc.rarity || "common"}`
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
    if (!map || typeof L === "undefined") return;

    if (!navigator.geolocation) {
      gpsStatusEl.textContent = "GPS: NOT AVAILABLE";
      return;
    }

    gpsStatusEl.textContent = "GPS: WATCHING...";
    gpsDot.classList.add("acc-amber");

    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        gpsStatusEl.textContent =
          `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`;

        gpsDot.classList.remove("acc-green", "acc-amber");
        gpsDot.classList.add(accuracy <= 25 ? "acc-green" : "acc-amber");

        const ll = [latitude, longitude];

        if (!playerMarker) {
          playerMarker = L.marker(ll, { title: "You" }).addTo(map);
        } else {
          playerMarker.setLatLng(ll);
        }
      },
      () => {
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

      walletStatusBtn.textContent = "CONNECTED";

      refreshCapsFromBackend();
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

      playerCapsEl.textContent = caps;
      panelCapsEl.textContent = caps;
    } catch (err) {
      console.warn("Failed to load stored CAPS:", err);
    }
  }

  // ---------------- CLAIM LOOT ----------------

  async function attemptClaim(loc) {
    if (!connectedWallet) return alert("Connect your terminal first.");
    if (!playerMarker) return alert("GPS not ready.");

    const playerPos = playerMarker.getLatLng();
    const dist = map.distance(playerPos, L.latLng(loc.lat, loc.lng));

    if (dist > 50) {
      return alert(`Too far from location (${Math.round(dist)}m). Move closer.`);
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

      if (!data.success) return alert(data.error || "Claim failed.");

      alert("Loot voucher created!");
      refreshCapsFromBackend();

      const marker = markers[loc.n];
      if (marker?.getElement()) {
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

  // ---------------- BOOT & EVENT WIRING ----------------

  window.addEventListener("DOMContentLoaded", () => {
    initMap();
    initGPS();
    initPanels();

    // Auto-run boot animation on load
    runBootSequence();

    // Wallet connect button in header
    if (walletStatusBtn) {
      walletStatusBtn.textContent = "CONNECT";
      walletStatusBtn.addEventListener("click", connectWallet);
    }
  });
})();

