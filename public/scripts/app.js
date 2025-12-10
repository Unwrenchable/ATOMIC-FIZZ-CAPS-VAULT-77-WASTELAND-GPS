/* ATOMIC FIZZ — FINAL WORKING VERSION — DEC 2025 */

const API_BASE = window.location.origin;
let map, playerMarker = null, wallet = null;
let player = {
    lvl: 1, hp: 100, maxHp: 100, caps: 0, gear: [], claimed: new Set()
}

;
let markers = {
}

, lastAccuracy = 999, playerLatLng = null;

// GPS smoothing
const MAX_ACCEPTABLE_ACCURACY = 20, AMBER_THRESHOLD = 40, SMOOTHING_WINDOW = 8;
const MIN_UPDATE_DISTANCE = 1.5, CLAIM_RADIUS_METERS = 250;

class SimpleKalman {
    constructor(q = 1e-7, r = 1e-5)

{
    this .q = q;
    this .r = r;
    this .x = null;
    this .p = 1;
}

update(m) {
    if (this.x === null) return (this.x = m);
    this .p += this.q;
    const k = this.p / (this.p + this.r);
    this .x += k * (m - this.x);
    this .p = (1 - k) * this.p;
    return this.x;
}

}

const kfLat = new SimpleKalman(), kfLng = new SimpleKalman();
let gpsSamples = [];

// GPS sample handling
function pushGpsSample(lat, lng, accuracy) {
    gpsSamples .push({ lat, lng, accuracy: accuracy || 999, ts: Date.now() });
    if (gpsSamples.length > 60) gpsSamples = gpsSamples.slice(-60);
    ensurePlayerMarkerFromSamples();
    updateAccuracyBadge(accuracy || 999);
}

function weightedCentroid(samples) {
    if (!samples?.length) return null;
    let sumLat = 0, sumLng = 0, sumW = 0, eps = 0.0001;
    samples .forEach(s => {
    const w = 1 / ((s.accuracy || 999) + eps);
    sumLat += s.lat * w; sumLng += s.lng * w; sumW += w;
  });
    return

{
    lat: sumLat / sumW, lng: sumLng / sumW
}

;
}

function updateAccuracyBadge(acc) {
    lastAccuracy = acc || 999;
    const dot = document.getElementById("accDot"), text = document.getElementById("accText");
    text .textContent = `GPS: $

{
    Math .round(lastAccuracy)
}

m`;
dot.className =
lastAccuracy <= MAX_ACCEPTABLE_ACCURACY ? "acc-dot acc-green" :
lastAccuracy <= AMBER_THRESHOLD ? "acc-dot acc-amber" : "acc-dot";
}

function ensurePlayerMarkerFromSamples() {
    if (!gpsSamples.length) return;
    const recent = gpsSamples.slice(-SMOOTHING_WINDOW);
    const c = weightedCentroid(recent);
    if (!c) return;
    const lat = kfLat.update(c.lat), lng = kfLng.update(c.lng);
    const ll = L.latLng(lat, lng);
    if (!playerLatLng || map.distance(playerLatLng, ll) > MIN_UPDATE_DISTANCE)

{
    playerLatLng = ll;
    if (!playerMarker)

{
    playerMarker = L.circleMarker([lat, lng], {
        radius: 8, color: "#00ff41", weight: 3, fillColor: "#00ff41", fillOpacity: 1
      }).addTo(map).bindPopup("You");
}

else playerMarker.setLatLng(ll);
saveState();
}
}

// State persistence
function saveState() {
    try

{
    localStorage .setItem("af_state", JSON.stringify({
      player: { lvl: player.lvl, hp: player.hp, maxHp: player.maxHp, caps: player.caps },
      claimed: Array.from(player.claimed),
      playerLatLng: playerLatLng ? [playerLatLng.lat, playerLatLng.lng] : null
    }));
}

catch (e) {
}

}

function loadState() {
    try

{
    const s = JSON.parse(localStorage.getItem("af_state") || "null");
    if (s)

{
    if (s.player) Object.assign(player, s.player);
    if (Array.isArray(s.claimed)) player.claimed = new Set(s.claimed);
    if (Array.isArray(s.playerLatLng)) playerLatLng = L.latLng(s.playerLatLng[0], s.playerLatLng[1]);
}

}

catch (e) {
}

}

loadState();

// UI helpers
function setStatus(t, ms = 2500) {
    const el = document.getElementById("status");
    el .textContent = `Status: $

{
    t
}

`;
clearTimeout(el._t);
el._t = setTimeout(() => el.textContent = wallet ? "Status: connected" : "Status: ready", ms);
}

function updateUI() {
    document .getElementById("lvl").textContent = player.lvl;
    document .getElementById("hp").textContent = `$

{
    player .hp
}

/$ {
    player .maxHp
}

`;
document.getElementById("caps").textContent = player.caps;
document.getElementById("claimed").textContent = player.claimed.size;
}

// Wallet + server sync
document.getElementById("connectPhantom").addEventListener("click", async () => {
  if (wallet) { setStatus("Refreshing..."); await syncPlayerFromServer(); return; }
  try {
    const p = window.solana;
    if (!p?.isPhantom) return alert("Install Phantom: https://phantom.app");
    await p.connect(); wallet = p;
    const addr = p.publicKey.toBase58();
    document.getElementById("connectPhantom").textContent = `${addr.slice(0,4)}...${addr.slice(-4)}`;
    await syncPlayerFromServer();
  } catch (e) { setStatus("Canceled"); }
});

async function syncPlayerFromServer() {
    if (!wallet) return;
    try

{
    const res = await fetch(`/player/${wallet.publicKey.toBase58()}`);
    if (!res.ok) throw 0;
    const d = await res.json();
    Object .assign(player, d);
    player .claimed = new Set(d.claimed || []);
    updateUI();
    saveState();
    setStatus(`Synced – Lvl ${player.lvl} | ${player.caps} CAPS`);
}

catch (e) {
    setStatus("Server offline – local save active");
}

}

function afterSuccessfulClaim() {
    saveState();
    updateUI();
    syncPlayerFromServer();
}

// Map init
async function loadAndInitMap() {
    map = L.map("map").setView([36.1146, -115.1728], 12);
    L .tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", { maxZoom: 20 }).addTo(map);
    try

{
    const res = await fetch(`${API_BASE}/locations`);
    const locs = await res.json();
    locs .forEach(loc => {
      const color = loc.rarity === "legendary" ? "#ffff00" :
                    loc.rarity === "epic" ? "#ff6200" :
                    loc.rarity === "rare" ? "#00ffff" : "#00ff41";
      const m = L.circleMarker([loc.lat, loc.lng], {
        radius: 14, color: "#001100", weight: 4, fillColor: color, fillOpacity: 0.95
      })
        .bindPopup(`<b style="color:#0ff">${loc.n}</b><br><span style="padding:4px 8px;border-radius:12px;background:${color};color:#000">${(loc.rarity||"common").toUpperCase()}</span><br>Level ${loc.lvl||1}`)
        .on("click", () => attemptClaim(loc)).addTo(map);
      markers[loc.n] = m;
      if (player.claimed.has(loc.n)) m.setStyle({ fillColor: "#001a00", fillOpacity: 0.6 });
    });
}

catch (e) {
    setStatus("POI load failed");
}

if (playerLatLng) {
    playerMarker = L.circleMarker([playerLatLng.lat, playerLatLng.lng], {
      radius: 8, color: "#00ff41", weight: 3, fillColor: "#00ff41", fillOpacity: 1
    }).addTo(map).bindPopup("You");
    map .panTo(playerLatLng);
}

}
loadAndInitMap();

// Geolocation
navigator.geolocation?.watchPosition( p => { const { latitude: lat, longitude: lng, accuracy } = p.coords; pushGpsSample(lat, lng, accuracy); }, null, { enableHighAccuracy: true } );

// Controls
document.getElementById("centerBtn").onclick = () = > playerLatLng && map.flyTo([playerLatLng.lat, playerLatLng.lng], 16, { duration: 0.6 });
document.getElementById("recenterMojave").onclick = () = > map.flyTo([36.17, -115.14], 8,
