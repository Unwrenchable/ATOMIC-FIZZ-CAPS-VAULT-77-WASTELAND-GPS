// ======================================================================
//  ATOMIC FIZZ • VAULT 77 • WASTELAND GPS
//  FULL FALLOUT MAP-CORE (FINAL CLEAN VERSION)
// ======================================================================

const API_BASE = window.location.origin;

let map, playerMarker = null, wallet = null, playerLatLng = null, lastAccuracy = 999;
let player = { lvl: 1, hp: 100, maxHp: 100, caps: 0, rads: 0, gear: [], found: [], claimed: new Set() };
let locations = [], markers = {};

const CLAIM_RADIUS = 50;
const SOL_RECIPIENT = "YOUR_VAULT_OR_DEV_WALLET_HERE";

// ======================================================================
//  PIP-BOY ICON SYSTEM (SVG + DOT FALLBACK)
// ======================================================================

const ICON_SVGS = {
    vault: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" stroke="#00ff41" fill="none"/></svg>`,
    rad: `<svg viewBox="0 0 24 24"><path d="M12 2L13.5 9h-3zM4 20l4.5-6L6 12zM20 20l-2-8-2.5 2z" fill="#00ff41"/></svg>`,
    boss: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" stroke="#ffff00" fill="none"/></svg>`
};

function getPipboyIcon(loc) {
    const rarity = (loc.rarity || "common").toLowerCase();
    const iconKey = loc.iconKey || null;
    const svg = iconKey && ICON_SVGS[iconKey] ? ICON_SVGS[iconKey] : null;

    if (svg) {
        return L.divIcon({
            className: "pipboy-marker",
            html: `<div class="pipboy-marker-svg">${svg}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });
    }

    return L.divIcon({
        className: "pipboy-marker",
        html: `<div class="pipboy-marker-dot ${rarity}"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
}

// ======================================================================
//  UI HELPERS
// ======================================================================

function updateHPBar() {
    const radPercent = (player.rads || 0) / 1000 * 100;
    const hpPercent = player.hp / player.maxHp * 100;

    document.getElementById('hpFill').style.width = `${hpPercent}%`;
    document.getElementById('radFill').style.width = `${radPercent}%`;

    const effectiveMax = player.maxHp - Math.floor(player.maxHp * radPercent / 100);
    document.getElementById('hpText').textContent = `HP ${player.hp} / ${effectiveMax}`;

    document.getElementById('lvl').textContent = player.lvl || 1;
    document.getElementById('caps').textContent = player.caps || 0;
    document.getElementById('claimed').textContent = player.claimed.size;
}

function setStatus(text, time = 3000) {
    const s = document.getElementById('status');
    s.textContent = `Status: ${text}`;
    clearTimeout(s.to);
    s.to = setTimeout(() => s.textContent = wallet ? 'Status: connected' : 'Status: ready', time);
}

// ======================================================================
//  WALLET CONNECT
// ======================================================================

document.getElementById('connectPhantom').onclick = async () => {
    if (wallet) { setStatus('Syncing...'); await syncPlayer(); return; }
    try {
        const p = window.solana;
        if (!p?.isPhantom) return alert('Install Phantom wallet: https://phantom.app');
        await p.connect();
        wallet = p;
        const addr = p.publicKey.toBase58();
        document.getElementById('connectPhantom').textContent = `${addr.slice(0,4)}...${addr.slice(-4)}`;
        await syncPlayer();
    } catch { setStatus('Connection canceled'); }
};

async function syncPlayer() {
    if (!wallet) return;
    try {
        const res = await fetch(`${API_BASE}/player/${wallet.publicKey.toBase58()}`);
        if (res.ok) {
            const d = await res.json();
            player = { ...player, ...d };
            player.claimed = new Set(d.found || []);
            updateHPBar();
            markClaimed();
            setStatus(`Synced – ${player.caps} CAPS`);
        }
    } catch { setStatus('Local mode'); }
}

// ======================================================================
//  TABS + DRAWER
// ======================================================================

document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');

    const drawer = document.getElementById('sidePanel');
    if (t.dataset.panel === 'map') {
        drawer.classList.remove('open');
    } else {
        drawer.classList.add('open');
        document.getElementById('panelTitle').textContent = t.textContent;

        if (t.dataset.panel === 'stat') renderStats();
        if (t.dataset.panel === 'quests') renderQuests();
        if (t.dataset.panel === 'shop') renderShop();
        if (t.dataset.panel === 'items') renderItems();
    }
});

document.getElementById('panelClose').onclick = () => {
    document.getElementById('sidePanel').classList.remove('open');
    document.querySelector('.tab[data-panel="map"]').classList.add('active');
};

// ======================================================================
//  PANEL RENDERERS
// ======================================================================

function renderStats() {
    document.getElementById('panelBody').innerHTML = `
        <div class="list-item"><strong>LEVEL</strong><div>${player.lvl}</div></div>
        <div class="list-item"><strong>HP</strong><div>${player.hp}/${player.maxHp}</div></div>
        <div class="list-item"><strong>RADS</strong><div>${player.rads}</div></div>
        <div class="list-item"><strong>CAPS</strong><div>${player.caps}</div></div>
        <div class="list-item"><strong>CLAIMED</strong><div>${player.claimed.size}</div></div>
    `;
}

function renderItems() {
    const gear = player.gear || [];
    document.getElementById('panelBody').innerHTML =
        gear.length
            ? gear.map(g => `<div class="list-item"><strong>${g.name}</strong><div>${g.rarity || 'common'}</div></div>`).join('')
            : '<div class="list-item"><strong>No gear yet</strong></div>';
}

async function renderQuests() {
    document.getElementById('panelBody').innerHTML = '<div class="list-item">Loading quests...</div>';
    try {
        const res = await fetch(`${API_BASE}/quests`);
        const q = await res.json();
        document.getElementById('panelBody').innerHTML =
            q.length
                ? q.map(x => `<div class="list-item"><strong>${x.title}</strong><div class="muted-small">${x.desc}</div></div>`).join('')
                : '<div class="list-item">No quests available</div>';
    } catch {
        document.getElementById('panelBody').innerHTML = '<div class="list-item">Quests offline</div>';
    }
}

async function renderShop() {
    document.getElementById('panelBody').innerHTML = '<div class="list-item">Loading shop...</div>';
    try {
        const res = await fetch(`${API_BASE}/shop/listings`);
        const list = await res.json();
        document.getElementById('panelBody').innerHTML =
            list.length
                ? list.map(l => `
                    <div class="shop-listing">
                        <div><strong>NFT ${l.nft.slice(0,8)}...</strong><br><span class="muted">${l.price} CAPS</span></div>
                        <div>
                            <button class="buy-btn" onclick="buyCaps('${l.nft}',${l.price})">Buy CAPS</button>
                            <button class="buy-btn sol-btn" onclick="solPay('${l.nft}',${l.price})">SOL Pay</button>
                        </div>
                        <div id="qr-${l.nft}"></div>
                    </div>
                `).join('')
                : '<div class="list-item">Shop is empty</div>';
    } catch {
        document.getElementById('panelBody').innerHTML = '<div class="list-item">Shop offline</div>';
    }
}

// ======================================================================
//  SHOP ACTIONS
// ======================================================================

window.buyCaps = async (nft, price) => {
    if (!wallet) return alert('Connect wallet first');
    const msg = `Buy ${nft} for ${price} CAPS ${Date.now()}`;
    try {
        const enc = new TextEncoder().encode(msg);
        const sig = await wallet.signMessage(enc);
        const res = await fetch(`${API_BASE}/shop/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet: wallet.publicKey.toBase58(),
                nftAddress: nft,
                message: msg,
                signature: bs58.encode(sig)
            })
        });
        const d = await res.json();
        alert(d.success ? 'Purchase complete!' : d.error || 'Failed');
        if (d.success) {
            player.caps -= price;
            updateHPBar();
            renderShop();
        }
    } catch { alert('Canceled'); }
};

window.solPay = (nft, price) => {
    const amt = (price / 10000).toFixed(6);
    const url = `solana:${SOL_RECIPIENT}?amount=${amt}&label=Atomic%20Fizz%20NFT&message=Pay%20for%20${nft.slice(0,8)}&reference=${nft}`;
    const c = document.getElementById(`qr-${nft}`);
    c.style.display = 'block';
    c.innerHTML = `<canvas></canvas><div class="muted">Scan: ${amt} SOL</div>`;
    QRCode.toCanvas(c.querySelector('canvas'), url, { width: 200 });
};

// ======================================================================
//  FALLOUT MAP INITIALIZATION
// ======================================================================

const MOJAVE_CENTER = [36.1147, -115.1728];
const MOJAVE_ZOOM = 11;

async function initMap() {
    map = L.map("map", {
        zoomControl: false,
        attributionControl: false
    }).setView(MOJAVE_CENTER, MOJAVE_ZOOM);

    L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
    ).addTo(map);

    // === Load Fallout POIs ===
    try {
        const res = await fetch("/data/fallout_pois.json");
        locations = await res.json();

        locations.forEach(loc => {
            const marker = L.marker([loc.lat, loc.lng], {
                icon: getPipboyIcon(loc),
                title: loc.name
            })
            .addTo(map)
            .on("click", () => attemptClaim(loc));

            markers[loc.id] = marker;
        });

        markClaimed();
        setStatus(`Loaded ${locations.length} Fallout locations`);
    } catch (err) {
        console.error("Failed to load fallout_pois.json", err);
        setStatus("Error loading Fallout POIs");
    }

    // === OPTIONAL dynamic backend POIs ===
    // loadDynamicLocationsFromAPI();
}

// ======================================================================
//  CLAIM SYSTEM
// ======================================================================

function markClaimed() {
    Object.keys(markers).forEach(id => {
        if (player.claimed.has(id)) {
            const m = markers[id];
            if (m._icon) m._icon.classList.add("claimed");
        }
    });
}

async function attemptClaim(loc) {
    if (lastAccuracy > 20) return setStatus(`GPS too weak (${Math.round(lastAccuracy)}m)`);
    if (!playerLatLng) return setStatus('No GPS lock');

    const dist = map.distance(playerLatLng, L.latLng(loc.lat, loc.lng));
    if (dist > CLAIM_RADIUS) return setStatus(`Too far (${Math.round(dist)}m)`);

    if (!wallet) return alert('Connect Phantom wallet first');
    if (player.claimed.has(loc.id)) return setStatus('Already claimed');

    const message = `Claim:${loc.id}:${Date.now()}`;
    try {
        const encoded = new TextEncoder().encode(message);
        const signed = await wallet.signMessage(encoded);
        const signature = bs58.encode(signed);

        setStatus('Submitting claim...');
        const res = await fetch(`${API_BASE}/find-loot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet: wallet.publicKey.toBase58(),
                spot: loc.id,
                lat: playerLatLng.lat,
                lng: playerLatLng.lng,
                message,
                signature
            })
        });

        const data = await res.json();
        if (data.success) {
            player.caps = data.totalCaps;
            player.claimed.add(loc.id);

            if (markers[loc.id]?._icon) markers[loc.id]._icon.classList.add("claimed");

            player.rads = (player.rads || 0) + 50;
            updateHPBar();

            setStatus(`+${data.capsFound} CAPS from ${loc.name}!`);
            document.getElementById('mintModal').classList.add('open');
            document.getElementById('mintMsg').textContent = `LOOTED ${loc.name}! +${data.capsFound} CAPS`;
        } else {
            setStatus(data.error || 'Claim failed');
        }
    } catch {
        setStatus('Signature canceled');
    }
}

document.getElementById('mintCloseBtn').onclick =
    () => document.getElementById('mintModal').classList.remove('open');

// ======================================================================
//  GPS SYSTEM
// ======================================================================

navigator.geolocation?.watchPosition(p => {
    lastAccuracy = p.coords.accuracy || 999;
    document.getElementById('accText').textContent = `GPS: ${Math.round(lastAccuracy)}m`;

    const dot = document.getElementById('accDot');
    if (lastAccuracy <= 20) dot.className = 'acc-dot acc-green';
    else if (lastAccuracy <= 40) dot.className = 'acc-dot acc-amber';
    else dot.className = 'acc-dot';

    playerLatLng = L.latLng(p.coords.latitude, p.coords.longitude);

    if (!playerMarker) {
        playerMarker = L.circleMarker(playerLatLng, {
            radius: 10,
            color: '#00ff41',
            fillOpacity: 0.9
        }).addTo(map).bindPopup('You');
    } else {
        playerMarker.setLatLng(playerLatLng);
    }
}, null, { enableHighAccuracy: true });

// ======================================================================
//  BUTTONS
// ======================================================================

document.getElementById('centerBtn').onclick =
    () => playerLatLng && map.flyTo(playerLatLng, 17);

document.getElementById('recenterMojave').onclick =
    () => map.setView(MOJAVE_CENTER, MOJAVE_ZOOM);

// ======================================================================
//  BOOT
// ======================================================================

initMap();
updateHPBar();
