import { Connection, clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
} from '@solana/wallet-adapter-wallets';

const network = WalletAdapterNetwork.Devnet;
const endpoint = clusterApiUrl(network);

const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
  new BackpackWalletAdapter(),
];

let selectedWallet = null;
let publicKey = null;

const API_BASE = window.location.origin;
const CLAIM_RADIUS = 50;
const MAX_RADS = 1000;

// ... keep your GEAR_NAMES, EFFECT_POOL, player object, utility functions ...

let map, playerMarker = null, playerLatLng = null, lastAccuracy = 999, watchId = null, firstLock = true;
let markers = {};

// ============================================================================
// WALLET CONNECT
// ============================================================================

async function connectWallet() {
  try {
    const walletName = prompt('Enter wallet (phantom, solflare, backpack):')?.toLowerCase().trim();
    selectedWallet = wallets.find(w => w.name.toLowerCase().includes(walletName));
    if (!selectedWallet) throw new Error('Wallet not found');

    await selectedWallet.connect();
    publicKey = selectedWallet.publicKey.toString();
    player.wallet = publicKey;
    localStorage.setItem('connectedWallet', publicKey);
    document.getElementById('connectWalletBtn').textContent = `CONNECTED (${publicKey.slice(0,6)}...)`;
    setStatus('Wallet connected!', true, 5000);
    await fetchPlayer();
  } catch (err) {
    setStatus('Connection failed: ' + err.message, false, 8000);
  }
}

// Auto-reconnect
if (player.wallet) {
  (async () => {
    try {
      await connectWallet();
    } catch (e) {}
  })();
}

// ============================================================================
// PLAYER DATA
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
    setStatus('STATUS: OFFLINE', false);
  }
}

// ============================================================================
// MAP & GPS (auto-start + reliable load)
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

  document.getElementById('gpsStatus').textContent = `GPS: ${Math.round(accuracy)}m`;
  document.getElementById('gpsDot').className = accuracy <= 20 ? 'acc-green' : 'acc-amber';

  if (firstLock) {
    map.flyTo(playerLatLng, 16);
    firstLock = false;
  }
  setStatus("GPS LOCK ACQUIRED", true, 5000);
}

function startLocation() {
  if (!navigator.geolocation) return setStatus("GPS not supported", false);
  if (watchId) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(
    pos => placeMarker(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
    err => setStatus("GPS error: " + err.message, false),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
  );
  setStatus("Requesting GPS lock...");
}

// ============================================================================
// INIT – auto GPS + map fix
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Map init
  map = L.map('map').setView([37.7749, -122.4194], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);

  // Force map to load (this fixed it in the awesome version)
  setTimeout(() => map.invalidateSize(true), 500);
  window.addEventListener('resize', () => map?.invalidateSize());

  // Auto-start GPS on load
  startLocation();

  // Buttons
  document.getElementById('connectWalletBtn')?.addEventListener('click', connectWallet);
  document.getElementById('refreshPlayerBtn')?.addEventListener('click', fetchPlayer);

  // Panel buttons (show/hide content)
  document.getElementById('statsBtn')?.addEventListener('click', () => showPanel('stats'));
  document.getElementById('itemsBtn')?.addEventListener('click', () => showPanel('items'));
  document.getElementById('questsBtn')?.addEventListener('click', () => showPanel('quests'));
  document.getElementById('scavengersBtn')?.addEventListener('click', () => showPanel('scavengers'));

  // Initial load
  if (player.wallet) await fetchPlayer();
  updateHPBar();
});

function showPanel(panelId) {
  document.querySelectorAll('.panel-content').forEach(p => p.classList.add('hidden'));
  document.getElementById(`${panelId}Panel`)?.classList.remove('hidden');
  setStatus(`Viewing ${panelId.toUpperCase()}`, true, 3000);
}
