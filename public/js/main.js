// main.js — Pip-Boy Map, Wallet, GPS, Loot Claim, Panels
(async function () {  // Make the whole IIFE async for easier await usage
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
        bootScreen.classList.add("hidden");
        pipboyScreen.classList.remove("hidden");
        // Boot finished → now safe to init map & GPS
        initMapAndFeatures();
      }
    }

    nextLine();
  }

  // ---------------- MAP & FEATURES (moved here to run after boot) ----------------
  async function initMapAndFeatures() {
    if (typeof L === "undefined") {
      console.error("Leaflet not loaded. Check /leaflet/leaflet.js");
      return;
    }

    // Create map with dark CartoDB theme
    map = L.map("map").setView([36.1699, -115.1398], 12); // Las Vegas area start

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    }).addTo(map);

    console.log("Wasteland map initialized - dark theme active ☢️");

    await loadLocations(); // Wait for locations before GPS/markers
    initGPS();
  }

  // ---------------- LOAD LOCATIONS ----------------
  async function loadLocations() {
    if (!map) return;

    try {
      const res = await fetch("/data/locations.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const locations = await res.json();

      locations.forEach((loc) => {
        let iconFile = "landmark.svg";
        if (loc.type === "vault") iconFile = "vault.svg";
        if (loc.type === "town") iconFile = "town.svg";
        if (loc.type === "quest") iconFile = "quest.svg";

        const icon = L.icon({
          iconUrl: `/img/icons/${iconFile}`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          className: "marker-active",
        });

        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);

        marker.bindPopup(
          `<b>${loc.name || `Location ${loc.n}`}</b><br>Level: ${loc.lvl ?? "?"}<br>Rarity: ${loc.rarity || "common"}`
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
  if (!gpsStatusEl || !gpsDot || !map) {
    console.warn("GPS elements or map not ready");
    return;
  }

  if (!navigator.geolocation) {
    gpsStatusEl.textContent = "GPS: NOT AVAILABLE";
    gpsDot.classList.add("acc-red");
    return;
  }

  gpsStatusEl.textContent = "GPS: INITIALIZING...";
  gpsDot.classList.add("acc-amber");

  let accuracyCircle = null; // Optional: shows GPS uncertainty radius

  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;

      // Update status text
      gpsStatusEl.textContent = `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`;

      // Update accuracy dot color
      gpsDot.classList.remove("acc-green", "acc-amber", "acc-red");
      if (accuracy <= 25) gpsDot.classList.add("acc-green");
      else if (accuracy <= 50) gpsDot.classList.add("acc-amber");
      else gpsDot.classList.add("acc-red");

      const ll = L.latLng(latitude, longitude);

      // Create/update player marker
      if (!playerMarker) {
        playerMarker = L.marker(ll, {
          title: "You",
          icon: L.divIcon({
            className: "player-marker",
            html: '<div class="gps-dot-inner"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        }).addTo(map);
      } else {
        playerMarker.setLatLng(ll);
      }

      // Optional: Accuracy circle (shows GPS error radius)
      if (!accuracyCircle) {
        accuracyCircle = L.circle(ll, {
          radius: accuracy,
          color: '#00ff41',
          weight: 1,
          opacity: 0.3,
          fillOpacity: 0.1,
        }).addTo(map);
      } else {
        accuracyCircle.setLatLng(ll);
        accuracyCircle.setRadius(accuracy);
      }

      // Center/fly to player (smooth on good accuracy, instant on poor)
      const targetZoom = accuracy <= 30 ? 17 : 14;
      if (!firstLock) {
        map.flyTo(ll, targetZoom, {
          animate: true,
          duration: 1.5, // smooth follow
        });
      } else {
        // First lock: quick zoom-in
        map.setView(ll, targetZoom, { animate: false });
        firstLock = false;
      }
    },
    (err) => {
      gpsStatusEl.textContent = `GPS ERROR: ${err.message}`;
      gpsDot.classList.remove("acc-green", "acc-amber");
      gpsDot.classList.add("acc-red");
      console.error("GPS error:", err);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,     // Use recent position if <5s old
      timeout: 15000,       // Give more time for first fix
    }
  );
}

  // ---------------- WALLET ----------------
  async function connectWallet() {
    const provider = window.solana;

    if (!provider || !provider.isPhantom) {
      alert("Phantom wallet not found. Install or enable it.");
      return;
    }

    try {
      const res = await provider.connect();
      connectedWallet = res.publicKey.toString();

      if (walletStatusBtn) {
        walletStatusBtn.textContent = "CONNECTED";
      }

      await refreshCapsFromBackend();
    } catch (err) {
      console.error("Wallet connect failed:", err);
      alert("Wallet connection failed.");
    }
  }

  async function refreshCapsFromBackend() {
    if (!connectedWallet) return;

    try {
      const res = await fetch(`/player/${connectedWallet}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const playerData = await res.json();
      const caps = playerData.caps || 0;

      if (playerCapsEl) playerCapsEl.textContent = caps;
      if (panelCapsEl) panelCapsEl.textContent = caps;
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

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Claim failed");
      }

      const data = await res.json();

      alert("Loot voucher created!");
      await refreshCapsFromBackend();

      const marker = markers[loc.n];
      if (marker?.getElement()) {
        marker.getElement().classList.add("marker-claimed");
      }
    } catch (err) {
      console.error("Claim error:", err);
      alert(`Claim failed: ${err.message}`);
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
        document.querySelectorAll(".panel-content").forEach((p) => p.classList.add("hidden"));
        panel.classList.remove("hidden");
      });
    });
  }

  // ---------------- STARTUP ----------------
  window.addEventListener("DOMContentLoaded", () => {
    // Auto-run boot animation on load
    runBootSequence();

    // Wallet connect button
    if (walletStatusBtn) {
      walletStatusBtn.textContent = "CONNECT";
      walletStatusBtn.addEventListener("click", connectWallet);
    }

    initPanels();
  });
})();