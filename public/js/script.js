// /js/script.js – Final polished drop-in version

let map, playerMarker = null, playerLatLng = null, lastAccuracy = 999, watchId = null, firstLock = true;
let wallet = null;
let player = {
  lvl: 1,
  hp: 100,
  maxHp: 100,
  caps: 0,
  rads: 0,
  xp: 0,
  xpToNext: 100,
  gear: [],
  equipped: {}, // {gearId: gearObject}
  claimed: new Set(),
  quests: []
};
let locations = [], allQuests = [], markers = {};
const API_BASE = window.location.origin;
const CLAIM_RADIUS = 50;
const MAX_RADS = 1000;
let terminalSignal = null;

// Gear drop chances and effect pools
const DROP_CHANCE = { legendary: 0.35, epic: 0.18, rare: 0.09, common: 0.04 };

const GEAR_NAMES = {
  common: ['Pipe Rifle', '10mm Pistol', 'Leather Armor', 'Vault Suit'],
  rare: ['Hunting Rifle', 'Combat Shotgun', 'Laser Pistol', 'Metal Armor'],
  epic: ['Plasma Rifle', 'Gauss Rifle', 'Combat Armor', 'T-51b Power Armor'],
  legendary: ['Alien Blaster', 'Fat Man', 'Lincoln\'s Repeater', 'Experimental MIRV']
};

const EFFECT_POOL = {
  common: [{type: 'maxHp', min: 5, max: 20}, {type: 'radResist', min: 20, max: 60}],
  rare: [{type: 'maxHp', min: 25, max: 50}, {type: 'radResist', min: 70, max: 140}, {type: 'capsBonus', min: 10, max: 25}],
  epic: [{type: 'maxHp', min: 50, max: 90}, {type: 'radResist', min: 150, max: 250}, {type: 'capsBonus', min: 25, max: 45}, {type: 'xpBonus', min: 15, max: 30}],
  legendary: [{type: 'maxHp', min: 100, max: 180}, {type: 'radResist', min: 300, max: 500}, {type: 'capsBonus', min: 40, max: 80}, {type: 'critDrop', min: 20, max: 40}]
};

function randomEffect(rarity) {
  const pool = EFFECT_POOL[rarity] || EFFECT_POOL.common;
  const eff = pool[Math.floor(Math.random() * pool.length)];
  const val = eff.min + Math.floor(Math.random() * (eff.max - eff.min + 1));
  return {type: eff.type, val};
}

function generateGearDrop(rarity = 'common') {
  const names = GEAR_NAMES[rarity] || GEAR_NAMES.common;
  const effectCount = rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : rarity === 'rare' ? 2 : 1;
  const effects = Array.from({length: effectCount}, () => randomEffect(rarity));
  return {
    id: `gear_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
    name: names[Math.floor(Math.random() * names.length)],
    rarity,
    effects,
    nftMint: null
  };
}

// Sound effects
function playSfx(id, volume = 0.4) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0;
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.play().catch(() => {});
  }
}

// Apply to all interactive elements once (after DOM ready)
function initButtonSounds() {
  document.querySelectorAll('.btn, .tab, .equip-btn').forEach(el => {
    el.addEventListener('click', () => playSfx('sfxButton', 0.3));
  });
}

// Gear bonuses
function applyGearBonuses() {
  let hpBonus = 0, radRes = 0, capsBonus = 0;
  Object.values(player.equipped).forEach(g => {
    g.effects.forEach(e => {
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
  const hpPct = Math.min(100, player.hp / player.maxHp * 100);
  const radPct = Math.min(100, player.rads / MAX_RADS * 100);
  document.getElementById('hpFill').style.width = `${hpPct}%`;
  document.getElementById('radFill').style.width = `${radPct}%`;
  document.getElementById('hpText').textContent = `HP ${Math.floor(player.hp)} / ${player.maxHp}`;
  document.getElementById('lvl').textContent = player.lvl;
  document.getElementById('caps').textContent = player.caps;
  document.getElementById('claimed').textContent = player.claimed.size;
}

function setStatus(text, isGood = true, time = 5000) {
  const s = document.getElementById('status');
  if (!s) return;
  s.textContent = `Status: ${text}`;
  s.className = isGood ? 'status-good' : 'status-bad';
  clearTimeout(s._to);
  if (time > 0) s._to = setTimeout(() => { s.textContent = 'Status: ready'; s.className = 'status-good'; }, time);
}

// ... [Keep your existing GPS, wallet connect, tabs, initMap, renderStats, etc.]

async function renderItems() {
  // ... your existing renderItems HTML ...
  document.getElementById('panelBody').innerHTML = html;

  document.querySelectorAll('.equip-btn').forEach(btn => {
    btn.onclick = async () => {
      const i = parseInt(btn.dataset.index);
      const gear = player.gear[i];
      if (player.equipped[gear.id]) {
        delete player.equipped[gear.id];
      } else {
        player.equipped[gear.id] = gear;
      }
      playSfx('sfxEquip', 0.4);
      applyGearBonuses();
      updateHPBar();
      renderItems();
      await fetch(`${API_BASE}/equip`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({equipped: Object.keys(player.equipped)})
      });
    };
  });
}

// Radiation drain + geiger SFX
setInterval(() => {
  const effectiveRads = Math.max(0, player.rads - player.radResist);
  if (effectiveRads > 150 && player.hp > 0) {
    player.hp -= Math.floor(effectiveRads / 250);
    if (player.hp <= 0) player.hp = 0;
    updateHPBar();
    playSfx('sfxRadTick', 0.3 + (effectiveRads / 1000)); // louder with higher rads
  }
}, 30000);

// attemptClaim – full success block
async function attemptClaim(loc) {
  // ... validation and signing ...

  const res = await fetch(`${API_BASE}/find-loot`, { /* ... */ });
  const data = await res.json();

  if (data.success) {
    const oldLvl = player.lvl;
    player.caps = data.totalCaps || player.caps;
    player.claimed.add(loc.n);
    markers[loc.n]?.setStyle({fillColor: '#003300', fillOpacity: 0.5});

    // Rad gain
    const baseRad = loc.rarity === 'legendary' ? 120 : loc.rarity === 'epic' ? 80 : loc.rarity === 'rare' ? 50 : 20;
    player.rads = Math.min(MAX_RADS, player.rads + Math.max(5, baseRad - player.radResist / 3));

    let gearDropped = false;
    const chance = DROP_CHANCE[loc.rarity] || DROP_CHANCE.common;
    if (Math.random() < chance) {
      const newGear = generateGearDrop(loc.rarity || 'common');
      player.gear.push(newGear);
      setStatus(`GEAR DROP! ${newGear.name} (${newGear.rarity.toUpperCase()})`, true, 15000);
      playSfx('sfxGearDrop', 0.7);
      gearDropped = true;
      // Backend mint
      fetch(`${API_BASE}/mint-gear`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(newGear)});
    }

    // Quest/XP/level (assume backend sends updated player data)
    if (data.player) Object.assign(player, data.player);
    if (data.quests) player.quests = data.quests;

    // Level up sound
    if (oldLvl < player.lvl) playSfx('sfxLevelUp', 0.8);

    playSfx('sfxClaim', 0.5);
    renderQuests();
    renderItems();
    applyGearBonuses();
    updateHPBar();

    document.getElementById('mintTitle').textContent = gearDropped && player.gear[player.gear.length-1].rarity === 'legendary' ? 'LEGENDARY LOOT!' : 'LOOT CLAIMED';
    document.getElementById('mintMsg').textContent = gearDropped ? `${player.gear[player.gear.length-1].name} added to inventory!` : `+${data.capsFound || 0} CAPS`;
    document.getElementById('mintModal').classList.add('open');

    checkTerminalAccess();
  } else {
    setStatus(data.error || "Claim failed", false);
  }
}

// Call once after page load
window.addEventListener('load', () => {
  initMap();
  initButtonSounds(); // Activate button click sounds
});
