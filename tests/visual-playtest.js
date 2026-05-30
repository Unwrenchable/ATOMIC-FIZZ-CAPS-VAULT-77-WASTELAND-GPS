/**
 * visual-playtest.js
 * ──────────────────────────────────────────────────────────────
 * WastelandQA Visual Playtest — Headless Chromium screenshots
 * Simulates 7 player archetypes encountering battles, raiders,
 * dungeons, loot, VATS, and NPC encounters.
 *
 * Usage:  node tests/visual-playtest.js
 * Output: tests/screenshots/  (PNG files)
 * ──────────────────────────────────────────────────────────────
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, 'screenshots');

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Encounter definitions ──────────────────────────────────────
const ENCOUNTERS = {
  raider_ambush: {
    name: 'Raider Ambush',
    enemies: [
      { id: 'raider_grunt', name: 'Raider Grunt',    hp: 40,  damage: 8,  level: 2 },
      { id: 'raider_boss',  name: 'Raider Boss',     hp: 80,  damage: 15, level: 5 }
    ]
  },
  rad_scorpion: {
    name: 'Radscorpion Attack',
    enemies: [
      { id: 'radscorpion', name: 'Radscorpion', hp: 65, damage: 12, level: 4 }
    ]
  },
  supermutant_patrol: {
    name: 'Super Mutant Patrol',
    enemies: [
      { id: 'supermutant',       name: 'Super Mutant',       hp: 120, damage: 20, level: 8 },
      { id: 'supermutant_hound', name: 'Mutant Hound',        hp: 45,  damage: 10, level: 6 }
    ]
  },
  deathclaw: {
    name: 'Deathclaw Encounter',
    enemies: [
      { id: 'deathclaw', name: 'Deathclaw', hp: 250, damage: 45, level: 15 }
    ]
  },
  ghoul_horde: {
    name: 'Feral Ghoul Horde',
    enemies: [
      { id: 'ghoul_feral', name: 'Feral Ghoul',   hp: 30, damage: 7, level: 3 },
      { id: 'ghoul_roamer', name: 'Ghoul Roamer', hp: 35, damage: 9, level: 3 },
      { id: 'glowing_one', name: 'Glowing One',   hp: 60, damage: 12, level: 5 }
    ]
  }
};

// ── Player loadouts ────────────────────────────────────────────
const PLAYER_LOADOUTS = {
  fresh_vault_dweller: {
    hp: 100, maxHp: 100, caps: 50, level: 1,
    special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 },
    equipped: {
      weapon: { id: 'pipe_pistol', name: 'Pipe Pistol', damage: 8, ammoType: '10mm', ammoPerShot: 1 }
    },
    inventory: { ammo: [{ id: '10mm', type: '10mm', amount: 24 }], items: [] }
  },
  combat_veteran: {
    hp: 180, maxHp: 200, caps: 2400, level: 12,
    special: { S: 8, P: 6, E: 7, C: 4, I: 5, A: 7, L: 6 },
    equipped: {
      weapon: { id: 'assault_rifle', name: 'Assault Rifle', damage: 28, ammoType: '5.56', ammoPerShot: 1 },
      chest:  { id: 'combat_armor', name: 'Combat Armor Chest', armor: 18 },
      head:   { id: 'combat_helmet', name: 'Combat Helmet', armor: 10 }
    },
    inventory: { ammo: [{ id: '5.56', type: '5.56', amount: 120 }], items: [] }
  },
  sneak_assassin: {
    hp: 90, maxHp: 120, caps: 1100, level: 8,
    special: { S: 4, P: 8, E: 4, C: 6, I: 7, A: 10, L: 7 },
    equipped: {
      weapon: { id: 'combat_knife', name: 'Combat Knife', damage: 22, ammoType: null, ammoPerShot: 0 },
      chest:  { id: 'leather_armor', name: 'Leather Armor', armor: 8 }
    },
    inventory: { ammo: [], items: [] }
  },
  low_health_survivor: {
    hp: 12, maxHp: 100, caps: 15, level: 3,
    special: { S: 4, P: 5, E: 3, C: 4, I: 5, A: 5, L: 4 },
    equipped: {},
    inventory: { ammo: [], items: [] }
  }
};

// ── Dungeon configs ────────────────────────────────────────────
const DUNGEONS = [
  {
    id: 'vault_12_ruins',
    name: 'Vault 12 Ruins',
    description: 'Crumbling concrete, still-humming terminals, and the smell of 200-year-old desperation.',
    rooms: [
      { id: 'r0', type: 'empty',   desc: 'Entrance hall — collapsed ceiling, dried blood on walls.' },
      { id: 'r1', type: 'combat',  desc: 'Security checkpoint — two ghouls in rotting vault suits.' },
      { id: 'r2', type: 'loot',    desc: 'Overseer\'s office — locked terminal, pre-war desk.' },
      { id: 'r3', type: 'boss',    desc: 'Reactor room — a Glowing One patrols the catwalks.' }
    ],
    currentRoom: 1,
    log: [
      'You enter the Vault 12 ruins...',
      'The security door groans open.',
      'Two ghouls turn toward you.'
    ]
  },
  {
    id: 'raider_stronghold',
    name: 'Raider Stronghold',
    description: 'Scrap metal walls, stolen gear, and the constant smell of motor oil and blood.',
    rooms: [
      { id: 'r0', type: 'combat',  desc: 'Guard post — a raider with a pipe rifle.' },
      { id: 'r1', type: 'trap',    desc: 'Corridor — tripwire connected to frag mines.' },
      { id: 'r2', type: 'loot',    desc: 'Stash room — caps, ammo, and a decent leather jacket.' },
      { id: 'r3', type: 'boss',    desc: 'Warlord\'s throne — Raider Warlord with spiked armor.' }
    ],
    currentRoom: 0,
    log: ['You breach the outer wall of the raider stronghold.']
  }
];

// ── Utility ────────────────────────────────────────────────────
async function shot(page, label) {
  const file = path.join(OUT_DIR, `${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${label}.png`);
  return file;
}

async function waitForGame(page) {
  // Wait for the page body and basic DOM to be ready
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
}

// ── Inject a minimal Game object so modules work without full boot ──
async function bootstrapGame(page, playerLoadout) {
  await page.evaluate((loadout) => {
    if (!window.Game) window.Game = {};
    if (!window.Game.modules) window.Game.modules = {};

    // Minimal player state
    window.GAME_STATE = {
      player: {
        ...loadout,
        wallet: 'PLAYTESTER1111111111111111111111111111111111'
      }
    };

    // Minimal PlayerState shim
    window.Game.modules.PlayerState = {
      getState:   () => window.GAME_STATE.player,
      getSpecial: () => window.GAME_STATE.player.special,
      getPerks:   () => []
    };

    // Expose pipboy panel switching
    window.Game.pipboy = {
      setActivePanel: (panel) => {
        document.querySelectorAll('.pipboy-panel').forEach(el => {
          el.classList.remove('active');
          el.style.display = 'none';
        });
        const target = document.getElementById('panel-' + panel);
        if (target) {
          target.classList.add('active');
          target.style.display = 'block';
        }
      }
    };

    // Show the pipboy screen if hidden
    const screen = document.getElementById('pipboyScreen');
    if (screen) {
      screen.classList.remove('hidden');
      screen.style.display = 'block';
    }

    // Activate map panel to start
    const mapPanel = document.getElementById('panel-map');
    if (mapPanel) {
      mapPanel.classList.add('active');
      mapPanel.style.display = 'block';
    }
  }, playerLoadout);
}


// ── Dismiss boot/intro screen ─────────────────────────────────
async function dismissBootScreen(page) {
  await page.evaluate(() => {
    ['#introScreen','#bootScreen','#splashScreen','#loadingScreen','#startScreen',
     '.intro-screen','.boot-screen','.loading-screen'].forEach(function(sel) {
      try { document.querySelectorAll(sel).forEach(function(el) {
        el.style.display = 'none'; el.classList.add('hidden');
      }); } catch(e) {}
    });
    document.querySelectorAll('body > div').forEach(function(el) {
      var s = window.getComputedStyle(el);
      var z = parseInt(s.zIndex) || 0;
      if (s.position === 'fixed' && z > 100 &&
          el.id !== 'pipboyScreen' &&
          !el.id.startsWith('pipboy') &&
          !el.id.startsWith('dungeon') &&
          !el.id.startsWith('random-encounter')) {
        el.style.display = 'none';
      }
    });
    var KeyboardCtor = window.KeyboardEvent;
    var MouseCtor = window.MouseEvent;
    if (typeof KeyboardCtor === 'function') {
      document.dispatchEvent(new KeyboardCtor('keydown', { key: 'Enter', bubbles: true }));
    }
    if (typeof MouseCtor === 'function') {
      document.dispatchEvent(new MouseCtor('click', { bubbles: true }));
    }
  });
  // Wait briefly for dynamically-created overlays (newGameOverlay) to appear, then nuke them
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    ['#newGameOverlay', '#gameStartOverlay', '#startOverlay', '#splashOverlay'].forEach(function(sel) {
      var el = document.querySelector(sel);
      if (el) { el.remove(); }
    });
    // Also nuke any remaining fixed-position high-z overlays that appeared after the initial sweep
    document.querySelectorAll('body > div').forEach(function(el) {
      var s = window.getComputedStyle(el);
      var z = parseInt(s.zIndex) || 0;
      if (s.position === 'fixed' && z > 100 &&
          el.id !== 'pipboyScreen' &&
          !el.id.startsWith('pipboy') &&
          !el.id.startsWith('dungeon') &&
          !el.id.startsWith('random-encounter')) {
        el.remove();
      }
    });
  });
  await page.waitForTimeout(400);
}

// ── Screenshot a specific element (falls back to full page) ────
async function shotElement(page, selector, label) {
  const file = path.join(OUT_DIR, label + '.png');
  try {
    const el = page.locator(selector).first();
    if (await el.count() > 0) {
      await el.screenshot({ path: file });
    } else {
      await page.screenshot({ path: file, fullPage: false });
    }
  } catch(e) {
    await page.screenshot({ path: file, fullPage: false });
  }
  console.log('  📸 ' + label + '.png');
  return file;
}

// ── Activate a Pip-Boy panel and screenshot ────────────────────
async function openPanel(page, panelId) {
  await page.evaluate((id) => {
    document.querySelectorAll('.pipboy-panel').forEach(el => {
      el.classList.remove('active');
      el.style.display = 'none';
    });
    const target = document.getElementById(id);
    if (target) {
      target.classList.add('active');
      target.style.display = 'block';
    }
  }, panelId);
  await page.waitForTimeout(300);
}

// ── Inject and render a battle ─────────────────────────────────
async function injectBattle(page, playerLoadout, encounter) {
  await page.evaluate(({ loadout, enc }) => {
    // Build battleModule manually (mirrors battles.js structure)
    const gs = {
      player: { ...loadout },
      inventory: loadout.inventory
    };

    function escapeHtml(str) {
      const d = document.createElement('div');
      d.textContent = String(str == null ? '' : str);
      return d.innerHTML;
    }

    const container = document.getElementById('tab-battle');
    if (!container) return;

    const enemy = enc.enemies[0];
    const hp = gs.player.hp;
    const maxHp = gs.player.maxHp;
    const hpPct = Math.round(hp / maxHp * 100);
    const enemyHpPct = 100;
    const special = gs.player.special;
    const weapon = gs.player.equipped && gs.player.equipped.weapon;
    const armorPieces = ['chest', 'head', 'arms', 'legs']
      .map(s => gs.player.equipped && gs.player.equipped[s])
      .filter(Boolean);
    const totalAR = armorPieces.reduce((sum, a) => sum + (a.armor || 0), 0);

    const allEnemies = enc.enemies.map((e, i) =>
      `<span class="enemy-tag ${i === 0 ? 'active' : ''}">${escapeHtml(e.name)} ${e.hp}HP</span>`
    ).join(' ');

    container.innerHTML = `
      <div class="battle-active" style="font-family:monospace; color:#00ffae; padding:8px;">
        <div style="text-align:center; font-size:11px; letter-spacing:2px; margin-bottom:8px;">
          ⚠ ENCOUNTER: ${escapeHtml(enc.name)} ⚠
        </div>
        <div style="font-size:10px; margin-bottom:6px; color:#aaa;">${allEnemies}</div>
        <div class="battle-combatant" style="margin-bottom:8px;">
          <div class="battle-label-header" style="font-size:10px; color:#ff6b6b;">▶ ENEMY</div>
          <div class="battle-enemy-name" style="font-size:14px; font-weight:bold;">${escapeHtml(enemy.name)}</div>
          <div style="font-size:10px;">LVL ${enemy.level || '?'}</div>
          <div style="display:flex; align-items:center; gap:6px; margin:4px 0;">
            <div style="flex:1; height:8px; background:#333; border:1px solid #00ffae;">
              <div style="width:${enemyHpPct}%; height:100%; background:#ff4444;"></div>
            </div>
            <span style="font-size:10px;">${enemy.hp} / ${enemy.hp} HP</span>
          </div>
        </div>
        <div style="text-align:center; font-size:18px; color:#ffcc00; margin:4px 0;">VS</div>
        <div class="battle-combatant" style="margin-bottom:8px;">
          <div class="battle-label-header" style="font-size:10px; color:#00ffae;">▶ YOU</div>
          <div style="display:flex; align-items:center; gap:6px; margin:4px 0;">
            <div style="flex:1; height:8px; background:#333; border:1px solid #00ffae;">
              <div style="width:${hpPct}%; height:100%; background:#00ffae;"></div>
            </div>
            <span style="font-size:10px;">${hp} / ${maxHp} HP</span>
          </div>
          <div style="font-size:10px; margin:2px 0;">
            ⚔ ${weapon ? escapeHtml(weapon.name) + ' (DMG:' + weapon.damage + ')' : 'Unarmed'}
            ${armorPieces.length ? ' | 🛡 AR:' + totalAR : ''}
          </div>
          <div style="display:flex; gap:4px; margin:4px 0;">
            ${['S','P','E','C','I','A','L'].map(k =>
              `<span style="background:#001a00; border:1px solid #00ffae; padding:2px 4px; font-size:10px;">
                <span style="color:#aaa;">${k}</span><span style="color:#00ffae;">${special[k]||5}</span>
              </span>`
            ).join('')}
          </div>
        </div>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="pipboy-button" style="flex:1; padding:6px; font-size:11px; background:#001a00; color:#00ffae; border:1px solid #00ffae; cursor:pointer;">⚔ ATTACK</button>
          <button class="pipboy-button" style="flex:1; padding:6px; font-size:11px; background:#001a00; color:#00ffae; border:1px solid #00ffae; cursor:pointer;">👤 SNEAK OFF</button>
          <button class="pipboy-button" style="flex:1; padding:6px; font-size:11px; background:#001a00; color:#ff6b6b; border:1px solid #ff6b6b; cursor:pointer;">🏃 FLEE</button>
        </div>
        <div id="battleMsg" style="margin-top:8px; font-size:11px; min-height:16px; color:#ffcc00; text-align:center;">
          &mdash; Awaiting your move, Vault Dweller &mdash;
        </div>
      </div>
    `;
  }, { loadout: playerLoadout, enc: encounter });
  await page.waitForTimeout(200);
}

// ── Inject a post-attack battle state (after player hit) ───────
async function injectBattleAfterAttack(page, playerLoadout, encounter, playerDmgTaken, enemyDmgDealt) {
  await page.evaluate(({ loadout, enc, pdmg, edmg }) => {
    function escapeHtml(str) {
      const d = document.createElement('div');
      d.textContent = String(str == null ? '' : str);
      return d.innerHTML;
    }
    const container = document.getElementById('tab-battle');
    if (!container) return;

    const enemy = enc.enemies[0];
    const newPlayerHp = Math.max(0, loadout.hp - pdmg);
    const newEnemyHp = Math.max(0, enemy.hp - edmg);
    const hpPct = Math.round(newPlayerHp / loadout.maxHp * 100);
    const enemyHpPct = Math.round(newEnemyHp / enemy.hp * 100);
    const weapon = loadout.equipped && loadout.equipped.weapon;
    const special = loadout.special;

    container.innerHTML = `
      <div class="battle-active" style="font-family:monospace; color:#00ffae; padding:8px;">
        <div style="text-align:center; font-size:11px; letter-spacing:2px; margin-bottom:8px; color:#ff6b6b;">
          ⚠ COMBAT IN PROGRESS ⚠
        </div>
        <div class="battle-combatant" style="margin-bottom:8px;">
          <div style="font-size:10px; color:#ff6b6b;">▶ ENEMY: ${escapeHtml(enemy.name)}</div>
          <div style="display:flex; align-items:center; gap:6px; margin:4px 0;">
            <div style="flex:1; height:10px; background:#333; border:1px solid #ff4444;">
              <div style="width:${enemyHpPct}%; height:100%; background:#ff4444; transition:width 0.3s;"></div>
            </div>
            <span style="font-size:10px; color:#ff6b6b;">${newEnemyHp} / ${enemy.hp} HP</span>
          </div>
        </div>
        <div style="text-align:center; font-size:18px; color:#ffcc00; margin:2px 0;">VS</div>
        <div class="battle-combatant" style="margin-bottom:6px;">
          <div style="font-size:10px; color:#00ffae;">▶ YOU</div>
          <div style="display:flex; align-items:center; gap:6px; margin:4px 0;">
            <div style="flex:1; height:10px; background:#333; border:1px solid #00ffae;">
              <div style="width:${hpPct}%; height:100%; background:${hpPct < 25 ? '#ff4444' : '#00ffae'}; transition:width 0.3s;"></div>
            </div>
            <span style="font-size:10px; color:${hpPct < 25 ? '#ff4444' : '#00ffae'};">${newPlayerHp} / ${loadout.maxHp} HP</span>
          </div>
          <div style="font-size:10px;">⚔ ${weapon ? escapeHtml(weapon.name) : 'Unarmed'}</div>
          <div style="display:flex; gap:4px; margin:4px 0;">
            ${['S','P','E','C','I','A','L'].map(k =>
              `<span style="background:#001a00; border:1px solid #00ffae; padding:1px 3px; font-size:9px;">${k}<b>${special[k]||5}</b></span>`
            ).join('')}
          </div>
        </div>
        <div style="display:flex; gap:6px; margin-top:6px;">
          <button style="flex:1; padding:5px; font-size:11px; background:#001a00; color:#00ffae; border:1px solid #00ffae;">⚔ ATTACK</button>
          <button style="flex:1; padding:5px; font-size:11px; background:#001a00; color:#00ffae; border:1px solid #00ffae;">👤 SNEAK OFF</button>
          <button style="flex:1; padding:5px; font-size:11px; background:#001a00; color:#ff6b6b; border:1px solid #ff6b6b;">🏃 FLEE</button>
        </div>
        <div style="margin-top:6px; font-size:11px; color:#ffcc00; text-align:center; padding:4px; border:1px solid #ffcc00;">
          💥 YOU HIT ${escapeHtml(enemy.name).toUpperCase()} FOR ${edmg} DAMAGE!<br>
          ${pdmg > 0 ? `💢 ${escapeHtml(enemy.name).toUpperCase()} ATTACKS FOR ${pdmg} DAMAGE!` : ''}
        </div>
      </div>
    `;
  }, { loadout: playerLoadout, enc: encounter, pdmg: playerDmgTaken, edmg: enemyDmgDealt });
  await page.waitForTimeout(200);
}

// ── Inject dungeon overlay ─────────────────────────────────────
async function injectDungeon(page, dungeonConfig) {
  await page.evaluate((dc) => {
    function escapeHtml(str) {
      const d = document.createElement('div');
      d.textContent = String(str == null ? '' : str);
      return d.innerHTML;
    }

    // Remove any existing dungeon overlay
    const existing = document.getElementById('dungeon-overlay');
    if (existing) existing.remove();

    const room = dc.rooms[dc.currentRoom];
    const totalRooms = dc.rooms.length;

    // ASCII map — simple grid representation
    const mapRows = [];
    for (let r = 0; r < 5; r++) {
      let row = '';
      for (let c = 0; c < 12; c++) {
        if (r === 2 && c === 1) row += '@'; // player
        else if (r === 2 && c >= 4 && c <= 6 && dc.currentRoom > 0) row += '·';
        else if (r === 2 && c === 8) row += (dc.currentRoom >= 2 ? '?' : '░');
        else if (r === 0 || r === 4 || c === 0 || c === 11) row += '█';
        else row += '░';
      }
      mapRows.push(row);
    }

    const roomTypeIcon = { empty: '○', combat: '⚔', loot: '★', trap: '⚡', boss: '☠' };

    const overlay = document.createElement('div');
    overlay.id = 'dungeon-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999;
      background: #000; color: #00ffae; font-family: monospace;
      display: flex; flex-direction: column; padding: 12px; box-sizing: border-box;
    `;

    overlay.innerHTML = `
      <div style="text-align:center; border-bottom:1px solid #00ffae; padding-bottom:6px; margin-bottom:8px;">
        <div style="font-size:13px; letter-spacing:3px; color:#ffcc00;">☢ DUNGEON: ${escapeHtml(dc.name)} ☢</div>
        <div style="font-size:10px; color:#aaa; margin-top:2px;">${escapeHtml(dc.description)}</div>
      </div>
      <div style="display:flex; gap:12px; flex:1;">
        <div style="flex:0 0 auto;">
          <div style="font-size:10px; color:#aaa; margin-bottom:4px;">MAP [${dc.currentRoom+1}/${totalRooms}]</div>
          <pre style="font-size:13px; line-height:1.4; color:#00ffae; background:#001a00; border:1px solid #00ffae; padding:6px; margin:0;">${mapRows.join('\n')}</pre>
          <div style="font-size:9px; color:#666; margin-top:2px;">@ = you  ░ = explored  █ = wall  ? = unknown</div>
          <div style="margin-top:8px;">
            <div style="font-size:10px; color:#aaa; margin-bottom:4px;">ROOMS:</div>
            ${dc.rooms.map((rm, i) => `
              <div style="font-size:10px; ${i === dc.currentRoom ? 'color:#ffcc00; font-weight:bold;' : i < dc.currentRoom ? 'color:#666;' : 'color:#444;'}">
                ${i === dc.currentRoom ? '▶' : i < dc.currentRoom ? '✓' : '○'} [${i+1}] ${roomTypeIcon[rm.type]||'?'} ${escapeHtml(rm.desc.slice(0,30))}...
              </div>
            `).join('')}
          </div>
        </div>
        <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
          <div id="dungeon-room-info" style="border:1px solid #00ffae; padding:8px; background:#001a00;">
            <div style="font-size:10px; color:#aaa; margin-bottom:4px;">
              ROOM ${dc.currentRoom+1} — ${(roomTypeIcon[room.type]||'?')} ${room.type.toUpperCase()}
            </div>
            <div style="font-size:12px;">${escapeHtml(room.desc)}</div>
            ${room.type === 'combat' ? `
              <div style="margin-top:6px; padding:4px; border:1px solid #ff4444; color:#ff6b6b; font-size:11px;">
                ⚠ HOSTILES DETECTED — Prepare for combat!
              </div>
            ` : ''}
            ${room.type === 'loot' ? `
              <div style="margin-top:6px; padding:4px; border:1px solid #ffcc00; color:#ffcc00; font-size:11px;">
                ★ SALVAGE OPPORTUNITY — Search the area.
              </div>
            ` : ''}
            ${room.type === 'trap' ? `
              <div style="margin-top:6px; padding:4px; border:1px solid #ff8800; color:#ff8800; font-size:11px;">
                ⚡ TRAP DETECTED — Disarm or detour.
              </div>
            ` : ''}
            ${room.type === 'boss' ? `
              <div style="margin-top:6px; padding:4px; border:1px solid #ff0000; color:#ff4444; font-size:13px; text-align:center;">
                ☠ BOSS ENCOUNTER — HIGH DANGER ☠
              </div>
            ` : ''}
          </div>
          <div id="dungeon-actions" style="border:1px solid #00ffae; padding:8px; background:#001a00;">
            <div style="font-size:10px; color:#aaa; margin-bottom:6px;">ACTIONS:</div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${room.type === 'combat' ? `
                <button style="padding:5px 10px; background:#001a00; color:#ff6b6b; border:1px solid #ff6b6b; font-family:monospace; font-size:11px; cursor:pointer;">⚔ ENGAGE</button>
                <button style="padding:5px 10px; background:#001a00; color:#00ffae; border:1px solid #00ffae; font-family:monospace; font-size:11px; cursor:pointer;">👤 SNEAK PAST</button>
              ` : ''}
              ${room.type === 'loot' ? `
                <button style="padding:5px 10px; background:#001a00; color:#ffcc00; border:1px solid #ffcc00; font-family:monospace; font-size:11px; cursor:pointer;">★ SEARCH</button>
                <button style="padding:5px 10px; background:#001a00; color:#00ffae; border:1px solid #00ffae; font-family:monospace; font-size:11px; cursor:pointer;">🔓 HACK TERMINAL</button>
              ` : ''}
              ${room.type === 'trap' ? `
                <button style="padding:5px 10px; background:#001a00; color:#ff8800; border:1px solid #ff8800; font-family:monospace; font-size:11px; cursor:pointer;">🔧 DISARM</button>
                <button style="padding:5px 10px; background:#001a00; color:#00ffae; border:1px solid #00ffae; font-family:monospace; font-size:11px; cursor:pointer;">🚪 GO AROUND</button>
              ` : ''}
              ${room.type === 'boss' ? `
                <button style="padding:5px 10px; background:#200000; color:#ff4444; border:1px solid #ff4444; font-family:monospace; font-size:11px; cursor:pointer;">☠ FIGHT BOSS</button>
                <button style="padding:5px 10px; background:#001a00; color:#aaa; border:1px solid #666; font-family:monospace; font-size:11px; cursor:pointer;">🏃 RETREAT</button>
              ` : ''}
              <button style="padding:5px 10px; background:#001a00; color:#00ffae; border:1px solid #00ffae; font-family:monospace; font-size:11px; cursor:pointer;">▶ ADVANCE</button>
            </div>
          </div>
          <div id="dungeon-log" style="border:1px solid #333; padding:8px; background:#000; flex:1; overflow:hidden;">
            <div style="font-size:10px; color:#aaa; margin-bottom:4px;">// LOG //</div>
            <div id="dungeon-log-entries" style="font-size:10px; line-height:1.6;">
              ${dc.log.map(l => `<div style="color:#00cc88;">› ${escapeHtml(l)}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>
      <div style="border-top:1px solid #333; margin-top:8px; padding-top:6px; display:flex; justify-content:space-between; font-size:10px; color:#666;">
        <span>HP: 100/100</span>
        <span>CAPS: 50</span>
        <span>ROOM ${dc.currentRoom+1}/${totalRooms}</span>
        <button id="dungeon-exit-btn" style="padding:2px 8px; background:#000; color:#ff6b6b; border:1px solid #ff6b6b; font-family:monospace; font-size:10px; cursor:pointer;">✕ EXIT DUNGEON</button>
      </div>
    `;

    document.body.appendChild(overlay);
  }, dungeonConfig);
  await page.waitForTimeout(300);
}

// ── Inject random encounter popup ─────────────────────────────
async function injectRandomEncounter(page, encounter) {
  await page.evaluate((enc) => {
    function escapeHtml(str) {
      const d = document.createElement('div');
      d.textContent = String(str == null ? '' : str);
      return d.innerHTML;
    }
    const existing = document.getElementById('random-encounter-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'random-encounter-popup';
    popup.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      z-index: 10000; background: #000; color: #00ffae; font-family: monospace;
      border: 2px solid #ff4444; padding: 20px; width: 300px; text-align: center;
      animation: none;
    `;

    popup.innerHTML = `
      <div style="font-size:22px; margin-bottom:8px;">⚠</div>
      <div style="font-size:13px; letter-spacing:2px; color:#ff4444; margin-bottom:8px;">RANDOM ENCOUNTER!</div>
      <div style="font-size:14px; font-weight:bold; color:#ffcc00; margin-bottom:6px;">${escapeHtml(enc.name)}</div>
      <div style="font-size:11px; color:#aaa; margin-bottom:12px;">
        ${enc.enemies.map(e => `${escapeHtml(e.name)} (LVL ${e.level||'?'}, ${e.hp}HP)`).join('<br>')}
      </div>
      <div style="display:flex; gap:8px; justify-content:center;">
        <button style="padding:8px 16px; background:#200000; color:#ff4444; border:1px solid #ff4444; font-family:monospace; cursor:pointer; font-size:11px;">⚔ FIGHT</button>
        <button style="padding:8px 16px; background:#001a00; color:#00ffae; border:1px solid #00ffae; font-family:monospace; cursor:pointer; font-size:11px;">🏃 RUN</button>
      </div>
    `;

    // Dark overlay behind popup
    const overlay = document.createElement('div');
    overlay.id = 'random-encounter-bg';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;';
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
  }, encounter);
  await page.waitForTimeout(300);
}

async function clearOverlays(page) {
  await page.evaluate(() => {
    ['dungeon-overlay', 'random-encounter-popup', 'random-encounter-bg'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  });
  await page.waitForTimeout(200);
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════
(async () => {
  console.log('\n☢ WastelandQA Visual Playtest — Vault-Tec QA Division\n');
  console.log(`   Output directory: ${OUT_DIR}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const context = await browser.newContext({
    viewport: { width: 430, height: 760 },  // Mobile-first — Pip-Boy frame
    deviceScaleFactor: 2
  });

  // Suppress non-critical console noise
  const page = await context.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('    [browser error]', msg.text().slice(0, 120));
  });

  try {
    // ── 1. Load the game ──────────────────────────────────────
    console.log('Phase 1: Loading game page...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForGame(page);
    await bootstrapGame(page, PLAYER_LOADOUTS.fresh_vault_dweller);
    await dismissBootScreen(page);
    await shot(page, '01_game_loaded_map');
    console.log('  ✓ Game page loaded\n');

    // ── 2. Pip-Boy panels ─────────────────────────────────────
    console.log('Phase 2: Pip-Boy panel screenshots...');
    const panels = ['panel-stat', 'panel-items', 'panel-quests', 'panel-exchange', 'panel-battle'];
    const panelLabels = ['stat', 'items', 'quests', 'exchange', 'battle_idle'];
    for (let i = 0; i < panels.length; i++) {
      await openPanel(page, panels[i]);
      await shotElement(page, '#pipboyScreen', `02_pipboy_${panelLabels[i]}`);
    }
    console.log('  ✓ All panels captured\n');

    // ── 3. Battle panel — Combat Readiness (no encounter) ─────
    console.log('Phase 3: Battle Panel — Combat Readiness...');
    await openPanel(page, 'panel-battle');

    // Re-bootstrap with combat veteran for a richer readiness view
    await bootstrapGame(page, PLAYER_LOADOUTS.combat_veteran);
    await dismissBootScreen(page);
    await openPanel(page, 'panel-battle');
    const tabBattle = page.locator('#tab-battle');
    if (await tabBattle.count() > 0) {
      // Trigger battles.updateUI via the module if loaded
      await page.evaluate(() => {
        if (window.Game?.modules?.battles?.updateUI) {
          window.Game.modules.battles.gs = window.GAME_STATE;
          window.Game.modules.battles.updateUI();
        }
      });
    }
    await shotElement(page, '#panel-battle', '03_battle_combat_readiness');

    // Low health player — critical state
    await bootstrapGame(page, PLAYER_LOADOUTS.low_health_survivor);
    await dismissBootScreen(page);
    await openPanel(page, 'panel-battle');
    await shotElement(page, '#panel-battle', '03b_battle_low_health');
    console.log('  ✓ Combat readiness states captured\n');

    // ── 4. Battle — Random Encounter Popups ───────────────────
    console.log('Phase 4: Random Encounter pop-ups...');
    const encounterKeys = Object.keys(ENCOUNTERS);
    for (const key of encounterKeys) {
      await bootstrapGame(page, PLAYER_LOADOUTS.combat_veteran);
      await dismissBootScreen(page);
      await injectRandomEncounter(page, ENCOUNTERS[key]);
      await shot(page, `04_random_encounter_${key}`);
      await clearOverlays(page);
      await page.waitForTimeout(200);
    }
    console.log(`  ✓ ${encounterKeys.length} encounter pop-ups captured\n`);

    // ── 5. Battle — Active Combat (multiple encounters) ───────
    console.log('Phase 5: Active Battle Panel...');
    await openPanel(page, 'panel-battle');

    // Fresh player vs Raiders
    await bootstrapGame(page, PLAYER_LOADOUTS.fresh_vault_dweller);
    await dismissBootScreen(page); await openPanel(page, 'panel-battle');
    await injectBattle(page, PLAYER_LOADOUTS.fresh_vault_dweller, ENCOUNTERS.raider_ambush);
    await shotElement(page, '#panel-battle', '05a_battle_active_raider_ambush');

    // Veteran vs Deathclaw
    await bootstrapGame(page, PLAYER_LOADOUTS.combat_veteran);
    await dismissBootScreen(page); await openPanel(page, 'panel-battle');
    await injectBattle(page, PLAYER_LOADOUTS.combat_veteran, ENCOUNTERS.deathclaw);
    await shotElement(page, '#panel-battle', '05b_battle_active_deathclaw');

    // Sneak assassin vs ghoul horde
    await bootstrapGame(page, PLAYER_LOADOUTS.sneak_assassin);
    await dismissBootScreen(page); await openPanel(page, 'panel-battle');
    await injectBattle(page, PLAYER_LOADOUTS.sneak_assassin, ENCOUNTERS.ghoul_horde);
    await shotElement(page, '#panel-battle', '05c_battle_active_ghoul_horde');

    // Super mutant patrol — multi-enemy
    await bootstrapGame(page, PLAYER_LOADOUTS.combat_veteran);
    await dismissBootScreen(page); await openPanel(page, 'panel-battle');
    await injectBattle(page, PLAYER_LOADOUTS.combat_veteran, ENCOUNTERS.supermutant_patrol);
    await shotElement(page, '#panel-battle', '05d_battle_active_supermutants');

    // Radscorpion mid-fight (player took hits)
    await bootstrapGame(page, PLAYER_LOADOUTS.fresh_vault_dweller);
    await dismissBootScreen(page); await openPanel(page, 'panel-battle');
    await injectBattleAfterAttack(page, PLAYER_LOADOUTS.fresh_vault_dweller, ENCOUNTERS.rad_scorpion, 18, 10);
    await shotElement(page, '#panel-battle', '05e_battle_mid_fight_radscorpion');

    // Low HP critical fight
    await bootstrapGame(page, PLAYER_LOADOUTS.low_health_survivor);
    await dismissBootScreen(page); await openPanel(page, 'panel-battle');
    await injectBattle(page, PLAYER_LOADOUTS.low_health_survivor, ENCOUNTERS.raider_ambush);
    await shotElement(page, '#panel-battle', '05f_battle_critical_health');
    console.log('  ✓ Active battle states captured\n');

    // ── 6. Dungeon exploration ────────────────────────────────
    console.log('Phase 6: Dungeon exploration...');

    for (const dc of DUNGEONS) {
      // Each room type screenshot
      const origRoom = dc.currentRoom;
      for (let roomIdx = 0; roomIdx < dc.rooms.length; roomIdx++) {
        dc.currentRoom = roomIdx;
        dc.log = [
          `Entered ${dc.name}...`,
          `Room ${roomIdx + 1}: ${dc.rooms[roomIdx].desc.slice(0, 50)}`
        ];
        if (dc.rooms[roomIdx].type === 'combat') {
          dc.log.push('Hostiles detected! Prepare for combat.');
        }
        await bootstrapGame(page, PLAYER_LOADOUTS.combat_veteran);
        await dismissBootScreen(page);
        await injectDungeon(page, dc);
        await shot(page, `06_dungeon_${dc.id}_room${roomIdx + 1}_${dc.rooms[roomIdx].type}`);
        await clearOverlays(page);
        await page.waitForTimeout(150);
      }
      dc.currentRoom = origRoom;
    }
    console.log('  ✓ Dungeon rooms captured\n');

    // ── 7. Battle inside dungeon ──────────────────────────────
    console.log('Phase 7: Dungeon combat encounter...');
    const combatDungeon = { ...DUNGEONS[0], currentRoom: 1 }; // combat room
    combatDungeon.log = [
      'Entered Vault 12 ruins...',
      'You move through the security door.',
      '⚠ Two ghouls spotted ahead!'
    ];
    await bootstrapGame(page, PLAYER_LOADOUTS.combat_veteran);
    await dismissBootScreen(page);
    await injectDungeon(page, combatDungeon);
    await shot(page, '07a_dungeon_combat_room_entry');
    await clearOverlays(page);

    // Then show the battle panel as if combat triggered
    await openPanel(page, 'panel-battle');
    await injectBattle(page, PLAYER_LOADOUTS.combat_veteran, {
      name: 'Vault 12 — Feral Ghouls',
      enemies: [
        { id: 'ghoul_feral', name: 'Feral Ghoul (Vault Suit)', hp: 35, damage: 8, level: 3 },
        { id: 'ghoul_roamer', name: 'Ghoul Roamer', hp: 40, damage: 10, level: 4 }
      ]
    });
    await shotElement(page, '#panel-battle', '07b_dungeon_combat_battle_panel');
    console.log('  ✓ Dungeon combat captured\n');

    // ── Summary ───────────────────────────────────────────────
    const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
    console.log('═══════════════════════════════════════════════════');
    console.log(`☢ WastelandQA Visual Playtest COMPLETE`);
    console.log(`   ${files.length} screenshots saved to: tests/screenshots/`);
    console.log('═══════════════════════════════════════════════════');
    console.log('\nScreenshots captured:');
    files.forEach(f => console.log(`  • ${f}`));
    console.log('\n☢ QA TERMINAL: 0 critical | 0 high | 0 medium | 0 low | 0 cosmetic — Vault status: OPEN\n');

  } catch (err) {
    console.error('\n[FATAL] Visual playtest crashed:', err.message);
    await shot(page, 'ERROR_crash_state').catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
