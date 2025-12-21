let map, playerMarker = null, playerLatLng = null, lastAccuracy = 999, watchId = null, firstLock = true;
let wallet = null;
let player = { 
  lvl: 1, 
  hp: 100, 
  maxHp: 100, 
  caps: 0, 
  rads: 0, 
  gear: [], 
  claimed: new Set() 
};
let locations = [], markers = {};

const API_BASE = window.location.origin;
const CLAIM_RADIUS = 50;

// Hidden terminal signal button
let terminalSignal = null;

function updateHPBar() {
  if (!document.getElementById('hpFill')) return;
  const hpPct = player.hp / player.maxHp * 100;
  const radPct = (player.rads || 0) / 1000 * 100;
  document.getElementById('hpFill').style.width = `${hpPct}%`;
  document.getElementById('radFill').style.width = `${radPct}%`;
  document.getElementById('hpText').textContent = `HP ${player.hp} / ${player.maxHp}`;
  document.getElementById('lvl').textContent = player.lvl;
  document.getElementById('caps').textContent = player.caps;
  document.getElementById('claimed').textContent = player.claimed.size;
}

function setStatus(text, isGood = true, time = 5000) {
  const s = document.getElementById('status');
  if (!s) return;
  s.textContent = `Status: ${text}`;
  s.className = isGood ? 'status-good' : 'status-bad';
  clearTimeout(s.to);
  if (time > 0) {
    s.to = setTimeout(() => {
      s.textContent = 'Status: ready';
      s.className = 'status-good';
    }, time);
  }
}

function updateGpsDisplay() {
  const textEl = document.getElementById('accText');
  const dotEl = document.getElementById('accDot');
  if (!textEl || !dotEl) return;
  textEl.textContent = `GPS: ${Math.round(lastAccuracy)}m`;
  dotEl.className = 'acc-dot ' + (lastAccuracy <= 20 ? 'acc-green' : 'acc-amber');
}

function placeMarker(lat, lng, accuracy) {
  playerLatLng = L.latLng(lat, lng);
  lastAccuracy = accuracy;

  if (!playerMarker) {
    playerMarker = L.circleMarker(playerLatLng, {
      radius: 10,
      color: '#00ff41',
      weight: 3,
      fillOpacity: 0.9
    }).addTo(map).bindPopup('You are here');
  } else {
    playerMarker.setLatLng(playerLatLng);
  }

  updateGpsDisplay();
  if (firstLock) {
    map.flyTo(playerLatLng, 16);
    firstLock = false;
  }
  document.getElementById('requestGpsBtn').style.display = 'none';
  setStatus("GPS LOCK ACQUIRED", true, 5000);
}

function handleLocationError(err) {
  setStatus("GPS error – tap REQUEST GPS", false, 10000);
  document.getElementById('requestGpsBtn').style.display = 'block';
}

function startLocation() {
  if (!navigator.geolocation) {
    setStatus("GPS not supported", false);
    return;
  }
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(
    pos => placeMarker(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
    handleLocationError,
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
  );
  setStatus("Requesting GPS...");
}

document.getElementById('requestGpsBtn').onclick = startLocation;

// Wallet connect
document.getElementById('connectWallet').onclick = async () => {
  if (wallet) {
    setStatus("Wallet already connected");
    return;
  }
  const provider = window.solana;
  if (!provider || !provider.isPhantom) {
    setStatus("Phantom wallet not detected", false);
    return;
  }
  try {
    await provider.connect();
    wallet = provider;
    const addr = wallet.publicKey.toBase58();
    document.getElementById('connectWallet').textContent = `${addr.slice(0,4)}...${addr.slice(-4)}`;
    setStatus("Wallet connected", true);

    // Load player data
    try {
      const res = await fetch(`${API_BASE}/player/${addr}`);
      if (res.ok) {
        const data = await res.json();
        player = { ...player, ...data };
        player.claimed = new Set(data.claimed || []);
        updateHPBar();
        checkTerminalAccess(); // Check if they already earned the terminal
      }
    } catch (e) {
      console.error("Player load error:", e);
    }
  } catch (err) {
    setStatus("Wallet connection failed", false);
  }
};

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const panel = document.getElementById('sidePanel');
    if (tab.dataset.panel === 'map') {
      panel.classList.remove('open');
    } else {
      panel.classList.add('open');
      document.getElementById('panelTitle').textContent = tab.textContent;

      if (tab.dataset.panel === 'stat') renderStats();
      if (tab.dataset.panel === 'items') renderItems();
      if (tab.dataset.panel === 'quests') renderQuests();
      if (tab.dataset.panel === 'shop') renderShop();
    }
  });
});

document.getElementById('panelClose').onclick = () => {
  document.getElementById('sidePanel').classList.remove('open');
  document.querySelector('.tab[data-panel="map"]').classList.add('active');
};

function renderStats() {
  document.getElementById('panelBody').innerHTML = `
    <div class="list-item"><strong>LEVEL</strong><div>${player.lvl}</div></div>
    <div class="list-item"><strong>HP</strong><div>${player.hp}/${player.maxHp}</div></div>
    <div class="list-item"><strong>RADS</strong><div>${player.rads || 0}</div></div>
    <div class="list-item"><strong>CAPS</strong><div>${player.caps}</div></div>
    <div class="list-item"><strong>CLAIMED</strong><div>${player.claimed.size}</div></div>
  `;
}

function renderItems() {
  const gear = player.gear || [];
  document.getElementById('panelBody').innerHTML = gear.length 
    ? gear.map(g => `<div class="list-item"><strong>${g.name}</strong><div class="muted-small">${g.rarity || 'common'} • PWR ${g.power || 0}</div></div>`).join('')
    : '<div class="list-item">No gear equipped</div>';
}

async function renderQuests() {
  try {
    const res = await fetch(`${API_BASE}/quests`);
    const quests = await res.json();
    document.getElementById('panelBody').innerHTML = quests.length
      ? quests.map(q => `<div class="list-item"><strong>${q.name}</strong><div class="muted-small">${q.description}</div></div>`).join('')
      : '<div class="list-item">No active quests</div>';
  } catch {
    document.getElementById('panelBody').innerHTML = '<div class="list-item">Quests offline</div>';
  }
}

async function renderShop() {
  document.getElementById('panelBody').innerHTML = '<div class="list-item">Shop loading...</div>';
  // Add shop logic here if needed
}

// Claim logic
async function attemptClaim(loc) {
  if (lastAccuracy > CLAIM_RADIUS) {
    setStatus(`GPS too weak (${Math.round(lastAccuracy)}m needed ≤${CLAIM_RADIUS}m)`, false);
    return;
  }
  if (!playerLatLng) {
    setStatus("No GPS lock", false);
    return;
  }
  const dist = map.distance(playerLatLng, L.latLng(loc.lat, loc.lng));
  if (dist > CLAIM_RADIUS) {
    setStatus(`Too far (${Math.round(dist)}m)`, false);
    return;
  }
  if (!wallet) {
    setStatus("Connect wallet first", false);
    return;
  }
  if (player.claimed.has(loc.n)) {
    setStatus("Already claimed", false);
    return;
  }

  const message = `Claim:${loc.n}:${Date.now()}`;
  try {
    const encoded = new TextEncoder().encode(message);
    const signed = await wallet.signMessage(encoded);
    const signature = bs58.encode(signed);

    const res = await fetch(`${API_BASE}/find-loot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: wallet.publicKey.toBase58(),
        spot: loc.n,
        message,
        signature
      })
    });

    const data = await res.json();
    if (data.success) {
      player.caps = data.totalCaps || player.caps;
      player.claimed.add(loc.n);
      markers[loc.n]?.setStyle({ fillColor: '#003300', fillOpacity: 0.5 });
      player.rads = (player.rads || 0) + 50;
      updateHPBar();
      setStatus(`+${data.capsFound || 0} CAPS from ${loc.n}!`, true);
      showLootModal(data.capsFound || 0, loc.n);

      // Check for terminal unlock
      checkTerminalAccess();
    } else {
      setStatus(data.error || "Claim failed", false);
    }
  } catch (err) {
    console.error(err);
    setStatus("Claim error", false);
  }
}

function showLootModal(caps, location) {
  document.getElementById('mintTitle').textContent = 'LOOT CLAIMED';
  document.getElementById('mintMsg').textContent = `+${caps} CAPS from ${location}`;
  document.getElementById('mintModal').classList.add('open');
}

// Random battle (optional - you had this before)
async function triggerRandomBattle(location) {
  // Your battle code here if you want to keep it
}

// Terminal gating
function checkTerminalAccess() {
  const REQUIRED_CLAIMS = 10; // Change this number to make it easier/harder

  if (player.claimed.size >= REQUIRED_CLAIMS && !terminalSignal) {
    terminalSignal = document.createElement('a');
    terminalSignal.href = 'terminal.html';
    terminalSignal.className = 'hidden-signal';
    terminalSignal.textContent = '[RESTRICTED SIGNAL ACQUIRED]';
    terminalSignal.title = 'Access hidden terminal';

    document.querySelector('.pipboy').appendChild(terminalSignal);

    setTimeout(() => {
      terminalSignal.classList.add('visible');
    }, 100);

    setStatus('Faint restricted signal detected...', true, 10000);
  }
}

// Map init
async function initMap() {
  map = L.map('map', { zoomControl: false }).setView([36.1146, -115.1728], 11);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: ''
  }).addTo(map);

  try {
    const res = await fetch(`${API_BASE}/locations`);
    if (!res.ok) throw new Error('Locations fetch failed');
    locations = await res.json();

    locations.forEach(loc => {
      const color = loc.rarity === 'legendary' ? '#ffff00' 
        : loc.rarity === 'epic' ? '#ff6200' 
        : loc.rarity === 'rare' ? '#00ffff' 
        : '#00ff41';

      const m = L.circleMarker([loc.lat, loc.lng], {
        radius: 16,
        weight: 4,
        color: '#001100',
        fillColor: color,
        fillOpacity: 0.9
      })
      .addTo(map)
      .bindPopup(`<b>${loc.n}</b><br>Level ${loc.lvl || 1}`)
      .on('click', () => attemptClaim(loc));

      markers[loc.n] = m;

      // Mark already claimed
      if (player.claimed.has(loc.n)) {
        m.setStyle({ fillColor: '#003300', fillOpacity: 0.5 });
      }
    });

    setStatus(`Loaded ${locations.length} locations`, true);
  } catch (err) {
    console.error(err);
    setStatus("Locations offline", false);
  }

  startLocation();
  updateHPBar();
}

// Start everything when page loads
window.addEventListener('load', initMap);
