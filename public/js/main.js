// ============================================================================
// SOLANA GLOBALS VIA CDNs (NO IMPORTS)
// ============================================================================

const { Connection, clusterApiUrl } = solanaWeb3;
const { WalletAdapterNetwork } = WalletAdapterBase;
const {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
} = WalletAdapterWallets;

// bs58 is provided by the CDN as global `bs58`

const network = WalletAdapterNetwork.Devnet;
const endpoint = clusterApiUrl(network);

const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
  new BackpackWalletAdapter(),
];

let selectedWallet = null;
let publicKey = null;

// ============================================================================
// CONSTANTS & PLAYER STATE
// ============================================================================

const API_BASE = window.location.origin;
const CLAIM_RADIUS = 50;
const MAX_RADS = 1000;
const DROP_CHANCE = { legendary: 0.35, epic: 0.18, rare: 0.09, common: 0.04 };

const GEAR_NAMES = {
  common: ['Pipe Rifle', '10mm Pistol', 'Leather Armor', 'Vault Suit'],
  rare: ['Hunting Rifle', 'Combat Shotgun', 'Laser Pistol', 'Metal Armor'],
  epic: ['Plasma Rifle', 'Gauss Rifle', 'Combat Armor', 'T-51b Power Armor'],
  legendary: ['Alien Blaster', 'Fat Man', "Lincoln's Repeater", 'Experimental MIRV']
};

const EFFECT_POOL = {
  common: [{type: 'maxHp', min: 5, max: 20}, {type: 'radResist', min: 20, max: 60}],
  rare: [
    {type: 'maxHp', min: 25, max: 50},
    {type: 'radResist', min: 70, max: 140},
    {type: 'capsBonus', min: 10, max: 25}
  ],
  epic: [
    {type: 'maxHp', min: 50, max: 90},
    {type: 'radResist', min: 150, max: 250},
    {type: 'capsBonus', min: 25, max: 45},
    {type: 'xpBonus', min: 15, max: 30}
  ],
  legendary: [
    {type: 'maxHp', min: 100, max: 180},
    {type: 'radResist', min: 300, max: 500},
    {type: 'capsBonus', min: 40, max: 80},
    {type: 'critDrop', min: 20, max: 40}
  ]
};

let player = {
  wallet: localStorage.getItem('connectedWallet') || null,
  lvl: 1,
  hp: 100,
  maxHp: 100,
  caps: 0,
  rads: 0,
  xp: 0,
  xpToNext: 100,
  gear: [],
  equipped: {},
  claimed: new Set(),
  quests: []
};

let map, playerMarker = null, playerLatLng = null, lastAccuracy = 999, watchId = null, firstLock = true;
let locations = [], allQuests = [], markers = {};
let terminalSignal = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function randomEffect(rarity) {
  const pool = EFFECT_POOL[rarity] || EFFECT_POOL.common;
  const eff = pool[Math.floor(Math.random() * pool.length)];
  const val = eff.min + Math.floor(Math.random() * (eff.max - eff.min + 1));
  return { type: eff.type, val };
}

function generateGearDrop(rarity = 'common') {
  const names = GEAR_NAMES[rarity] || GEAR_NAMES.common;
  const effectCount =
    rarity === 'legendary' ? 3 :
    rarity === 'epic' ? 2 :
    rarity === 'rare' ? 2 : 1;

  const effects = Array.from({ length: effectCount }, () => randomEffect(rarity));
  return {
    id: `gear_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
    name: names[Math.floor(Math.random() * names.length)],
    rarity,
    effects,
    nftMint: null
  };
}

function applyGearBonuses() {
  let hpBonus = 0, radRes = 0, capsBonus = 0;
  Object.values(player.equipped || {}).forEach(g => {
    (g.effects || []).forEach(e => {
      if (e.type === 'maxHp') hpBonus += e.val;
      if (e.type === 'radResist') radRes += e.val;
      if (e.type === 'capsBonus') capsBonus += e.val;
    });
  });
  player.maxHp = 100 + (player.lvl - 1) * 10 + hpBonus;
  player.radResist = radRes;
  player.capsBonus = capsBonus;
  if (player.hp > player.maxHp) player.hp = player.maxHp;
}

function updateHPBar() {
  const hpFill = document.getElementById('hpFill');
  const radFill = document.getElementById('radFill');
  const hpText = document.getElementById('hpText');
  const lvlEl = document.getElementById('playerLevel');
  const capsEl = document.getElementById('playerCaps');
  const xpFill = document.getElementById('xpFill');
  const xpStatus = document.getElementById('xpStatus');

  const hpPct = Math.min(100, (player.hp / player.maxHp) * 100);
  const radPct = Math.min(100, (player.rads / MAX_RADS) * 100);

  if (hpFill) hpFill.style.width = `${hpPct}%`;
  if (radFill) radFill.style.width = `${radPct}%`;
  if (hpText) hpText.textContent = `HP ${Math.floor(player.hp)} / ${player.maxHp}`;
  if (lvlEl) lvlEl.textContent = player.lvl;
  if (capsEl) capsEl.textContent = player.caps.toLocaleString();
  if (xpFill) xpFill.style.width = `${Math.min(100, (player.xp / player.xpToNext) * 100)}%`;
  if (xpStatus) xpStatus.textContent = `XP: ${player.xp} / ${player.xpToNext}`;
}

function setStatus(text, isGood = true, time = 5000) {
  const s = document.getElementById('status');
  if (!s) return;
  s.textContent = `STATUS: ${text}`;
  s.className = isGood ? 'status-good' : 'status-bad';
  clearTimeout(s._to);
  if (time > 0) s._to = setTimeout(() => {
    s.textContent = 'STATUS: STANDBY';
    s.className = '';
  }, time);
}

function playSfx(id, volume = 0.4) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch(() => {});
  }
}

// ============================================================================
// NARRATIVE API (BACKEND, OPTIONAL)
// ============================================================================

const NarrativeAPI = {
  async getMain() {
    try {
      const r = await fetch(`${API_BASE}/api/narrative/main`);
      return r.ok ? r.json() : { acts: [] };
    } catch {
      return { acts: [] };
    }
  },
  async getDialogList() {
    try {
      const r = await fetch(`${API_BASE}/api/narrative/dialog`);
      return r.ok ? r.json() : [];
    } catch {
      return [];
    }
  },
  async getDialog(key) {
    try {
      const r = await fetch(`${API_BASE}/api/narrative/dialog/${key}`);
      return r.ok ? r.json() : null;
    } catch {
      return null;
    }
  },
  async getTerminals() {
    try {
      const r = await fetch(`${API_BASE}/api/narrative/terminals`);
      return r.ok ? r.json() : { terminals: [] };
    } catch {
      return { terminals: [] };
    }
  },
  async getCollectibles() {
    try {
      const r = await fetch(`${API_BASE}/api/narrative/collectibles`);
      return r.ok ? r.json() : { collectibles: [] };
    } catch {
      return { collectibles: [] };
    }
  }
};

// ============================================================================
// PLAYER DATA FETCH & SYNC (BACKEND)
// ============================================================================

async function fetchPlayer() {
  if (!player.wallet) return;
  try {
    const res = await fetch(`${API_BASE}/player/${player.wallet}`);
    if (!res.ok) throw new Error('Player fetch failed');
    const data = await res.json();

    Object.assign(player, data);
    player.claimed = new Set(data.claimed || []);
    player.quests = data.quests || [];
    player.gear = data.gear || [];
    player.equipped = data.equipped || {};

    applyGearBonuses();
    updateHPBar();
  } catch (e) {
    console.error('Player fetch failed:', e);
    setStatus('OFFLINE', false);
  }
}

async function savePlayer() {
  if (!player.wallet) return;
  const payload = {
    ...player,
    claimed: Array.from(player.claimed || []),
  };
  try {
    await fetch(`${API_BASE}/player/${player.wallet}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error('Save player failed:', e);
  }
}

// ============================================================================
// WALLET CONNECT
// ============================================================================

async function connectWallet() {
  try {
    const walletName = prompt('Enter wallet (phantom, solflare, backpack):')
      ?.toLowerCase()
      .trim();
    selectedWallet = wallets.find(w =>
      w.name.toLowerCase().includes(walletName || '')
    );
    if (!selectedWallet) throw new Error('Wallet not found / supported');

    await selectedWallet.connect();
    publicKey = selectedWallet.publicKey.toString();
    player.wallet = publicKey;
    localStorage.setItem('connectedWallet', publicKey);

    const btn = document.getElementById('connectWalletBtn');
    if (btn) btn.textContent = `CONNECTED (${publicKey.slice(0, 6)}...)`;

    setStatus('Wallet connected!', true, 5000);
    await fetchPlayer();
  } catch (err) {
    console.error('Wallet connection failed:', err);
    setStatus('Connection failed: ' + err.message, false, 8000);
  }
}

function disconnectWallet() {
  if (selectedWallet) {
    selectedWallet.disconnect();
  }
  selectedWallet = null;
  publicKey = null;
  player.wallet = null;
  localStorage.removeItem('connectedWallet');

  const btn = document.getElementById('connectWalletBtn');
  if (btn) btn.textContent = 'CONNECT WALLET';
  setStatus('Disconnected', true);
}

function setupWalletButtonLabel() {
  const btn = document.getElementById('connectWalletBtn');
  if (!btn) return;
  if (player.wallet) {
    btn.textContent = `CONNECTED (${player.wallet.slice(0, 6)}...)`;
  } else {
    btn.textContent = 'CONNECT WALLET';
  }
}

// ============================================================================
// MAP + LOCATION DATA (LOCAL JSON)
// ============================================================================

async function loadLocations() {
  try {
    const res = await fetch('/data/locations.json');
    if (!res.ok) throw new Error('locations.json not found');
    locations = await res.json();
  } catch (e) {
    console.error('Failed to load locations:', e);
    locations = [];
  }
}

async function loadQuests() {
  try {
    const res = await fetch('/data/quests.json');
    if (!res.ok) throw new Error('quests.json not found');
    allQuests = await res.json();
  } catch (e) {
    console.error('Failed to load quests:', e);
    allQuests = [];
  }
}

async function loadMintables() {
  try {
    const res = await fetch('/data/mintables.json');
    if (!res.ok) return;
    const mintables = await res.json();
    console.log('Mintables:', mintables);
  } catch (e) {
    console.error('Failed to load mintables:', e);
  }
}

function renderMarkers() {
  if (!map) return;
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};

  locations.forEach(loc => {
    const claimed = player.claimed.has(loc.n);
    const color =
      loc.rarity === 'legendary' ? '#ffcc00' :
      loc.rarity === 'epic' ? '#ff66ff' :
      loc.rarity === 'rare' ? '#66ccff' :
      '#00ff41';

    const marker = L.circleMarker([loc.lat, loc.lng], {
      radius: claimed ? 6 : 10,
      color,
      weight: claimed ? 1 : 3,
      fillOpacity: claimed ? 0.3 : 0.8
    }).addTo(map);

    marker.bindPopup(`${loc.name} (${loc.rarity || 'common'})`);

    marker.on('click', () => {
      if (!player.wallet) {
        setStatus('Connect wallet to claim', false, 6000);
        return;
      }
      attemptClaim(loc);
    });

    markers[loc.n] = marker;
  });
}

// ============================================================================
// GPS + CLAIMING
// ============================================================================

function placeMarker(lat, lng, accuracy) {
  if (!map) return;

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

  const gpsStatus = document.getElementById('gpsStatus');
  const gpsDot = document.getElementById('gpsDot');
  const gpsBtn = document.getElementById('requestGpsBtn');

  if (gpsStatus) gpsStatus.textContent = `GPS: ${Math.round(accuracy)}m`;
  if (gpsDot) gpsDot.className = 'acc-dot ' + (accuracy <= 20 ? 'acc-green' : 'acc-amber');
  if (gpsBtn) gpsBtn.style.display = 'none';

  if (firstLock) {
    map.flyTo(playerLatLng, 16);
    firstLock = false;
  }

  setStatus('GPS LOCK ACQUIRED', true, 5000);
}

function startLocation() {
  if (!navigator.geolocation) {
    setStatus('GPS not supported', false);
    return;
  }
  if (watchId) navigator.geolocation.clearWatch(watchId);

  watchId = navigator.geolocation.watchPosition(
    pos => placeMarker(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
    err => setStatus('GPS error: ' + err.message, false),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
  setStatus('Requesting GPS lock...');
}

async function attemptClaim(loc) {
  if (!playerLatLng || !player.wallet) {
    setStatus('Missing GPS or wallet', false);
    return;
  }
  if (player.claimed.has(loc.n)) {
    setStatus('Already claimed', false);
    return;
  }
  if (lastAccuracy > CLAIM_RADIUS) {
    setStatus('GPS too inaccurate', false);
    return;
  }

  const dist = map.distance(playerLatLng, L.latLng(loc.lat, loc.lng));
  if (dist > CLAIM_RADIUS) {
    setStatus(`Too far (${Math.round(dist)}m)`, false);
    return;
  }

  const message = `Claim:${loc.n}:${Date.now()}`;

  try {
    if (!selectedWallet || !selectedWallet.signMessage) {
      setStatus('Wallet does not support message signing', false);
      return;
    }

    const encoded = new TextEncoder().encode(message);
    const signed = await selectedWallet.signMessage(encoded);
    const signature = bs58.encode(signed);

    const res = await fetch(`${API_BASE}/find-loot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: player.wallet,
        spot: loc.n,
        message,
        signature
      })
    });
    const data = await res.json();

    if (!data.success) {
      setStatus(data.error || 'Claim failed', false);
      return;
    }

    // Update caps
    player.caps = data.totalCaps ?? player.caps;

    // Mark claimed
    player.claimed.add(loc.n);
    if (markers[loc.n]) {
      markers[loc.n].setStyle({ fillOpacity: 0.3, radius: 6, weight: 1 });
    }

    // Rads
    const baseRad =
      loc.rarity === 'legendary' ? 120 :
      loc.rarity === 'epic' ? 80 :
      loc.rarity === 'rare' ? 50 : 20;

    player.rads = Math.min(
      MAX_RADS,
      player.rads + Math.max(5, baseRad - (player.radResist || 0) / 3)
    );

    // XP
    const xpGain =
      loc.rarity === 'legendary' ? 150 :
      loc.rarity === 'epic' ? 100 :
      loc.rarity === 'rare' ? 60 : 30;

    player.xp += xpGain;

    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.lvl++;
      player.xpToNext = Math.floor(player.xpToNext * 1.5);
      player.maxHp += 10;
      player.hp = player.maxHp;
      setStatus(`LEVEL UP! Level ${player.lvl}`, true, 12000);
      playSfx('sfxLevelUp', 0.8);
    }

    // Gear drops
    if (Math.random() < (DROP_CHANCE[loc.rarity] || DROP_CHANCE.common)) {
      const newGear = generateGearDrop(loc.rarity || 'common');
      player.gear.push(newGear);
      setStatus(`GEAR DROP! ${newGear.name} (${newGear.rarity.toUpperCase()})`, true, 15000);
      playSfx('sfxGearDrop', 0.7);
    }

    playSfx('sfxClaim', 0.5);
    updateHPBar();
    await savePlayer();
  } catch (err) {
    console.error('Claim error:', err);
    setStatus('Claim error', false);
  }
}

// ============================================================================
// PANELS / TABS (if used)
// ============================================================================

function showTab(tabId) {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach(t => t.classList.remove('active'));
  contents.forEach(c => c.classList.add('hidden'));

  const activeTab = document.querySelector(`.tab[data-tab="${tabId}"]`);
  const content = document.getElementById(`tab-${tabId}`);
  if (activeTab) activeTab.classList.add('active');
  if (content) content.classList.remove('hidden');
}

// ============================================================================
// INIT
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Map init
  const mapEl = document.getElementById('map');
  if (mapEl) {
    map = L.map('map').setView([37.7749, -122.4194], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    setTimeout(() => map.invalidateSize(true), 500);
    window.addEventListener('resize', () => map && map.invalidateSize());
  }

  // Wire controls
  document.getElementById('connectWalletBtn')?.addEventListener('click', connectWallet);
  document.getElementById('refreshPlayerBtn')?.addEventListener('click', fetchPlayer);
  document.getElementById('requestGpsBtn')?.addEventListener('click', startLocation);

  document.querySelectorAll('.btn, .tab, .dropdown-btn').forEach(el => {
    el.addEventListener('click', () => playSfx('sfxButton', 0.3));
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      if (tabId) showTab(tabId);
    });
  });

  // Radiation tick
  setInterval(() => {
    const effectiveRads = Math.max(0, player.rads - (player.radResist || 0));
    if (effectiveRads > 150 && player.hp > 0) {
      player.hp -= Math.floor(effectiveRads / 250);
      if (player.hp <= 0) player.hp = 0;
      updateHPBar();
    }
  }, 30000);

  setupWalletButtonLabel();
  updateHPBar();

  // Load data
  await Promise.all([loadLocations(), loadQuests(), loadMintables()]);
  renderMarkers();

  // Auto GPS on load
  startLocation();

  // Auto player fetch if wallet known
  if (player.wallet) {
    try { await fetchPlayer(); } catch (e) { console.warn(e); }
  }
});
