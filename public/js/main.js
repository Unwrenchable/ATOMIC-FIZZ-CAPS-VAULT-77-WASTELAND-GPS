const { Connection, clusterApiUrl } = window.solanaWeb3;
const { WalletAdapterNetwork } = window.solanaWalletAdapterBase;
const {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
} = window.solanaWalletAdapterWallets;

// bs58 from CDN
// global: bs58

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

const DROP_CHANCE = {
  legendary: 0.35,
  epic: 0.18,
  rare: 0.09,
  common: 0.04,
};

const GEAR_NAMES = {
  common: ['Pipe Rifle', '10mm Pistol', 'Leather Armor', 'Vault Suit'],
  rare: ['Hunting Rifle', 'Combat Shotgun', 'Laser Pistol', 'Metal Armor'],
  epic: ['Plasma Rifle', 'Gauss Rifle', 'Combat Armor', 'T-51b Power Armor'],
  legendary: ['Alien Blaster', 'Fat Man', "Lincoln's Repeater", 'Experimental MIRV'],
};

const EFFECT_POOL = {
  common: [
    { type: 'maxHp', min: 5, max: 20 },
    { type: 'radResist', min: 20, max: 60 },
  ],
  rare: [
    { type: 'maxHp', min: 25, max: 50 },
    { type: 'radResist', min: 70, max: 140 },
    { type: 'capsBonus', min: 10, max: 25 },
  ],
  epic: [
    { type: 'maxHp', min: 50, max: 90 },
    { type: 'radResist', min: 150, max: 250 },
    { type: 'capsBonus', min: 25, max: 45 },
    { type: 'xpBonus', min: 15, max: 30 },
  ],
  legendary: [
    { type: 'maxHp', min: 100, max: 180 },
    { type: 'radResist', min: 300, max: 500 },
    { type: 'capsBonus', min: 40, max: 80 },
    { type: 'critDrop', min: 20, max: 40 },
  ],
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
  quests: [],
};

let map;
let playerMarker = null;
let playerLatLng = null;
let lastAccuracy = 999;
let watchId = null;
let firstLock = true;

let locations = [];
let allQuests = [];
let markers = {};

// ============================================================================
// UTILITY
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
    id: `gear_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: names[Math.floor(Math.random() * names.length)],
    rarity,
    effects,
    nftMint: null,
  };
}

function applyGearBonuses() {
  let hpBonus = 0;
  let radRes = 0;
  let capsBonus = 0;

  Object.values(player.equipped || {}).forEach((g) => {
    (g.effects || []).forEach((e) => {
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
  const hpPct = Math.min(100, (player.hp / player.maxHp) * 100);
  const radPct = Math.min(100, (player.rads / MAX_RADS) * 100);

  document.getElementById('hpFill').style.width = `${hpPct}%`;
  document.getElementById('radFill').style.width = `${radPct}%`;
  document.getElementById('hpText').textContent = `HP ${Math.floor(player.hp)} / ${player.maxHp}`;
  document.getElementById('playerLevel').textContent = player.lvl;
  document.getElementById('playerCaps').textContent = player.caps.toLocaleString();

  document.getElementById('xpFill').style.width = `${Math.min(100, (player.xp / player.xpToNext) * 100)}%`;
  document.getElementById('xpStatus').textContent = `XP: ${player.xp} / ${player.xpToNext}`;
}

function setStatus(text, isGood = true, time = 5000) {
  // You removed the visible status bar — this safely no-ops.
  console.log(`STATUS: ${text}`);
}

function playSfx(id, volume = 0.4) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play().catch(() => {});
  }
}

// ============================================================================
// PLAYER SYNC
// ============================================================================
async function fetchPlayer() {
  if (!player.wallet) return;

  try {
    const res = await fetch(`${API_BASE}/player/${player.wallet}`);
    if (!res.ok) throw new Error('Player fetch failed');

    const data = await res.json();
    Object.assign(player, data);

    player.claimed = new Set(data.claimed || []);
    player.gear = data.gear || [];
    player.equipped = data.equipped || {};
    player.quests = data.quests || [];

    applyGearBonuses();
    updateHPBar();
  } catch (e) {
    console.error('Player fetch failed:', e);
  }
}

async function savePlayer() {
  if (!player.wallet) return;

  const payload = {
    ...player,
    claimed: Array.from(player.claimed),
  };

  try {
    await fetch(`${API_BASE}/player/${player.wallet}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

    selectedWallet = wallets.find((w) =>
      w.name.toLowerCase().includes(walletName || '')
    );

    if (!selectedWallet) throw new Error('Wallet not found');

    await selectedWallet.connect();
    publicKey = selectedWallet.publicKey.toString();
    player.wallet = publicKey;

    localStorage.setItem('connectedWallet', publicKey);

    document.getElementById('connectWalletBtn').textContent =
      `CONNECTED (${publicKey.slice(0, 6)}...)`;

    await fetchPlayer();
  } catch (err) {
    console.error('Wallet connection failed:', err);
  }
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
// LOAD LOCAL JSON
// ============================================================================
async function loadLocations() {
  try {
    const res = await fetch('/data/locations.json');
    locations = await res.json();
  } catch (e) {
    console.error('Failed to load locations:', e);
    locations = [];
  }
}

async function loadQuests() {
  try {
    const res = await fetch('/data/quests.json');
    allQuests = await res.json();
  } catch (e) {
    console.error('Failed to load quests:', e);
    allQuests = [];
  }
}

async function loadMintables() {
  try {
    const res = await fetch('/data/mintables.json');
    await res.json();
  } catch (e) {
    console.error('Failed to load mintables:', e);
  }
}

// ============================================================================
// MAP + MARKERS
// ============================================================================
function renderMarkers() {
  if (!map) return;

  Object.values(markers).forEach((m) => map.removeLayer(m));
  markers = {};

  locations.forEach((loc) => {
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
      fillOpacity: claimed ? 0.3 : 0.8,
    }).addTo(map);

    marker.bindPopup(`${loc.name} (${loc.rarity || 'common'})`);

    marker.on('click', () => {
      if (!player.wallet) {
        setStatus('Connect wallet to claim', false);
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
  playerLatLng = L.latLng(lat, lng);
  lastAccuracy = accuracy;

  if (!playerMarker) {
    playerMarker = L.circleMarker(playerLatLng, {
      radius: 10,
      color: '#00ff41',
      weight: 3,
      fillOpacity: 0.9,
    })
      .addTo(map)
      .bindPopup('You are here');
  } else {
    playerMarker.setLatLng(playerLatLng);
  }

  document.getElementById('gpsStatus').textContent = `GPS: ${Math.round(accuracy)}m`;
  document.getElementById('gpsDot').className =
    'acc-dot ' + (accuracy <= 20 ? 'acc-green' : 'acc-amber');

  if (firstLock) {
    map.flyTo(playerLatLng, 16);
    firstLock = false;
  }
}

function startLocation() {
  if (!navigator.geolocation) {
    setStatus('GPS not supported', false);
    return;
  }

  if (watchId) navigator.geolocation.clearWatch(watchId);

  watchId = navigator.geolocation.watchPosition(
    (pos) =>
      placeMarker(
        pos.coords.latitude,
        pos.coords.longitude,
        pos.coords.accuracy
      ),
    (err) => setStatus('GPS error: ' + err.message, false),
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    }
  );
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
    setStatus('GPS too inaccurate (>50m)', false);
    return;
  }

  const dist = map.distance(playerLatLng, L.latLng(loc.lat, loc.lng));
  if (dist > CLAIM_RADIUS) {
    setStatus(`Too far (${Math.round(dist)}m away)`, false);
    return;
  }

  const message = `Claim:${loc.n}:${Date.now()}`;

  try {
    const encoded = new TextEncoder().encode(message);
    const signed = await selectedWallet.signMessage(encoded);
    const signature = bs58.encode(signed);

    playSfx('click-sfx'); // feedback if sound exists

    setStatus('Claiming location...');

    const res = await fetch(`${API_BASE}/find-loot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: player.wallet,
        locationId: loc.n,
        signature: signature,
        timestamp: Date.now(),
        lat: playerLatLng.lat,
        lng: playerLatLng.lng
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: ${res.status}`);
    }

    const data = await res.json();

    // Apply rewards (server is source of truth)
    player.caps += data.caps || 0;
    player.xp += data.xp || 0;
    player.claimed.add(loc.n);

    let msg = `Success! +${data.caps || 0} CAPS +${data.xp || 0} XP`;

    if (data.gear) {
      player.gear.push(data.gear);
      msg += ` & ${data.gear.name} (${data.gear.rarity})`;
      playSfx('loot-sfx');
    }

    if (data.nftMint) {
      msg += ` • Rare NFT: ${data.nftMint.slice(0, 8)}...`;
    }

    setStatus(msg, true, 7000);

    applyGearBonuses();
    updateHPBar();
    renderMarkers();   // show claimed marker change
    await savePlayer(); // persist to backend

  } catch (err) {
    console.error('Claim failed:', err);
    setStatus(`Failed: ${err.message}`, false, 6000);
  }
}
