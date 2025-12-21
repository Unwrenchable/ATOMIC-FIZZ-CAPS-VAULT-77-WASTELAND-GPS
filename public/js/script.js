// /js/script.js – Full drop-in replacement with dynamic quests + gear equipping + random NFT gear drops

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

// Gear drop chances and effect pools – matches mintables rarity system
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
    nftMint: null // backend fills with real mint address after Metaplex mint
  };
}

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
  s.textContent = `Status: ${text}`;
  s.className = isGood ? 'status-good' : 'status-bad';
  clearTimeout(s._to);
  if (time > 0) s._to = setTimeout(() => { s.textContent = 'Status: ready'; s.className = 'status-good'; }, time);
}

// Keep your existing GPS functions, wallet connect, tabs logic, initMap, etc. here...

async function renderItems() {
  let html = '';
  if (player.gear.length === 0) {
    html = '<div class="list-item">Inventory empty – explore rare locations for gear drops!</div>';
  } else {
    player.gear.forEach((g, i) => {
      const isEq = player.equipped[g.id];
      const effStr = g.effects.map(e => `${e.type} +${e.val}`).join(', ');
      html += `<div class="list-item">
        <strong>${g.name}${isEq ? ' <span class="equipped">[EQUIPPED]</span>' : ''}</strong>
        <div>
          <button class="equip-btn" data-index="${i}">${isEq ? 'UNEQUIP' : 'EQUIP'}</button>
          <small>${g.rarity.toUpperCase()} • ${effStr}</small>
        </div>
      </div>`;
    });
  }
  document.getElementById('panelBody').innerHTML = html;

  // Equip button handlers
  document.querySelectorAll('.equip-btn').forEach(btn => {
    btn.onclick = async () => {
      const i = parseInt(btn.dataset.index);
      const gear = player.gear[i];
      if (player.equipped[gear.id]) {
        delete player.equipped[gear.id];
      } else {
        player.equipped[gear.id] = gear;
      }
      applyGearBonuses();
      updateHPBar();
      renderItems();
      // Save equipped state
      await fetch(`${API_BASE}/equip`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({equipped: Object.keys(player.equipped)})
      });
    };
  });
}

async function renderQuests() {
  if (allQuests.length === 0) {
    try {
      allQuests = await (await fetch(`${API_BASE}/quests`)).json();
    } catch (e) {}
  }
  let html = '';
  allQuests.forEach(q => {
    const pq = player.quests.find(p => p.id === q.id) || {progress: 0, completed: false};
    const status = pq.completed ? 'COMPLETED ✓' : `${pq.progress}/${q.objectives.length}`;
    html += `<div class="list-item">
      <strong>${q.name}</strong>
      <div><small>${q.description}</small><br>Progress: ${status}</div>
    </div>`;
  });
  document.getElementById('panelBody').innerHTML = html || '<div class="list-item">No quests available</div>';
}

// Radiation drain with resistance
setInterval(() => {
  const effectiveRads = Math.max(0, player.rads - player.radResist);
  if (effectiveRads > 150 && player.hp > 0) {
    player.hp -= Math.floor(effectiveRads / 250);
    if (player.hp <= 0) player.hp = 0;
    updateHPBar();
  }
}, 30000);

// Inside attemptClaim success block (after data.success check)
{
  player.caps = data.totalCaps || player.caps;
  player.claimed.add(loc.n);
  markers[loc.n]?.setStyle({fillColor: '#003300', fillOpacity: 0.5});

  // Rarity-based rad gain reduced by resistance
  const baseRad = loc.rarity === 'legendary' ? 120 : loc.rarity === 'epic' ? 80 : loc.rarity === 'rare' ? 50 : 20;
  player.rads = Math.min(MAX_RADS, player.rads + Math.max(5, baseRad - player.radResist / 3));

  // Random gear drop
  const chance = DROP_CHANCE[loc.rarity] || DROP_CHANCE.common;
  if (Math.random() < chance) {
    const newGear = generateGearDrop(loc.rarity || 'common');
    player.gear.push(newGear);
    setStatus(`GEAR DROP! ${newGear.name} (${newGear.rarity.toUpperCase()}) added!`, true, 15000);
    renderItems();
    // Trigger backend mint
    fetch(`${API_BASE}/mint-gear`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({rarity: newGear.rarity, name: newGear.name})
    });
  }

  // Quest progress update (backend should return updated quests)
  if (data.quests) player.quests = data.quests;
  renderQuests();

  applyGearBonuses();
  updateHPBar();
  document.getElementById('mintTitle').textContent = player.gear.slice(-1)[0]?.rarity === 'legendary' ? 'LEGENDARY LOOT!' : 'LOOT CLAIMED';
  document.getElementById('mintModal').classList.add('open');
}

// Keep the rest of your script.js logic (map init, terminal unlock, etc.)

window.addEventListener('load', () => {
  initMap(); // your existing initMap function
});
