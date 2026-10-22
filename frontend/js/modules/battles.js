// battle.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Unified Battle Module (Resurrected)
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

  const battleModule = {
    gs: null,
    state: null,
    STORAGE_KEY: "afc_battle_state_v1",
    MAX_PERSIST_MS: 60 * 60 * 1000,

    // Secure [0,1) roll; tests may replace _rand.
    _rand() {
      return crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
    },

    // ---- persistence: survive reloads mid-fight --------------------------
    _persist() {
      try {
        if (!this.state) { localStorage.removeItem(this.STORAGE_KEY); return; }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), state: this.state }));
      } catch (_) { /* storage full / private mode */ }
    },
    _restore() {
      try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        const st = saved && saved.state;
        if (!st || !st.encounter || !Array.isArray(st.enemyHp) || Date.now() - (saved.savedAt || 0) > this.MAX_PERSIST_MS) {
          localStorage.removeItem(this.STORAGE_KEY);
          return false;
        }
        this.state = st;
        this.state.busy = false;
        return true;
      } catch (_) { return false; }
    },
    _end(result) {
      this.state = null;
      this._persist();
      window.dispatchEvent(new CustomEvent('battleEnd', { detail: { result } }));
    },

    // ---- targeting --------------------------------------------------------
    liveEnemies() {
      if (!this.state) return [];
      return this.state.enemyHp.map((hp, i) => ({ i, hp })).filter(e => e.hp > 0).map(e => e.i);
    },
    setTarget(idx) {
      if (!this.state) return false;
      if (typeof idx !== "number" || !(this.state.enemyHp[idx] > 0)) return false;
      this.state.activeEnemyIndex = idx;
      this._persist();
      this.updateUI();
      return true;
    },

    // ---- stat-based accuracy / evasion -----------------------------------
    // Player hit chance: Lookout (P) aims, enemy evasion dodges, rain hurts ranged.
    _playerHitChance(weapon, enemy, weather) {
      const sp = this._getSpecial();
      let c = 0.65 + (sp.P - 5) * 0.04 + ((weapon && weapon.accuracy) || 0) - ((enemy && enemy.evasion) || 0.05);
      const ranged = weapon && weapon.category !== 'melee' && weapon.category !== 'unarmed';
      if (weather === 'rain' && ranged) c -= 0.15;
      if (weather === 'fog' && ranged) c -= 0.10;
      if (!weapon || weapon.category === 'melee' || weapon.category === 'unarmed') c += (sp.A - 5) * 0.01;
      return Math.max(0.10, Math.min(0.95, c));
    },
    // Enemy hit chance: Escape (A) dodges.
    _enemyHitChance(enemy) {
      const sp = this._getSpecial();
      const c = 0.70 + ((enemy && enemy.accuracy) || 0) - (sp.A - 5) * 0.03;
      return Math.max(0.15, Math.min(0.95, c));
    },

    init(gameState) {
      this.gs = gameState || this.gs || null;
      this.state = null;
      this._restore();
      // World encounters can call start() before init(); always have a player.
      this._ensureGameState();
      // Set up death overlay respawn button
      const respawnBtn = document.getElementById('respawnBtn');
      if (respawnBtn) {
        respawnBtn.addEventListener('click', () => {
          this._applyRespawnPenalty();
          this._hideDeathOverlay();
          this.state = null;
          this._persist();
          this.updateUI();
          window.Game?.pipboy?.setActivePanel?.('map');
          window.dispatchEvent(new CustomEvent('battleEnd', { detail: { result: 'LOSE' } }));
        });
      }
    },

    // Bind a game-state object and a player record before any UI or combat read.
    // Encounter ticks call start() -> updateUI() even when init() never ran,
    // which previously threw "Cannot read properties of null (reading 'player')".
    _ensureGameState() {
      if (!this.gs || typeof this.gs !== "object") {
        this.gs = (typeof window !== "undefined" && window.gameState) || {};
      }
      if (!this.gs.player || typeof this.gs.player !== "object") {
        const ps = (typeof Game !== "undefined" && Game.modules?.PlayerState?.getState?.()) || null;
        const legacy =
          (typeof window !== "undefined" && (window.PLAYER || window.Game?.player)) || null;
        // Reuse the live player record so HP and caps mutations stick.
        if (legacy && typeof legacy === "object") {
          this.gs.player = legacy;
        } else if (ps && typeof ps === "object") {
          this.gs.player = ps;
        } else {
          this.gs.player = {
            hp: 100,
            maxHp: 100,
            caps: 0,
            xp: 0,
            equipped: {},
            special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 }
          };
        }
      }
      const player = this.gs.player;
      if (typeof player.hp !== "number") player.hp = 100;
      if (typeof player.maxHp !== "number") player.maxHp = 100;
      if (!player.equipped || typeof player.equipped !== "object") player.equipped = {};
      if (!player.special) {
        player.special = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };
      }
      return this.gs;
    },

    // --------------------------------------------------------
    // Shared respawn logic: restore 30% HP, 10% caps penalty
    // --------------------------------------------------------
    _applyRespawnPenalty() {
      this._ensureGameState();
      const player = this.gs && this.gs.player;
      if (!player) return;
      player.hp = Math.max(1, Math.ceil((player.maxHp || 100) * 0.3));
      if (player.caps > 0) {
        player.caps = Math.floor((player.caps || 0) * 0.9);
      }
    },

    // --------------------------------------------------------
    // Death overlay management
    // --------------------------------------------------------
    _showDeathOverlay() {
      const overlay = document.getElementById('deathOverlay');
      if (overlay) {
        overlay.classList.remove('hidden');
      }
    },

    _hideDeathOverlay() {
      const overlay = document.getElementById('deathOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
      }
    },

    // --------------------------------------------------------
    // Stealth mechanics
    // --------------------------------------------------------
    toggleSneak() {
      if (!this.state) return;
      this.state.playerSneaking = !this.state.playerSneaking;
      this.updateUI();
      console.log(`[Battle] Sneak ${this.state.playerSneaking ? 'enabled' : 'disabled'}`);
    },

    // Calculate detection chance for current enemy
    _calculateDetectionChance() {
      if (!this.state) return 0;
      
      const idx = this.state.activeEnemyIndex ?? 0;
      const awareness = this.state.enemyAwareness[idx];
      const special = this._getSpecial();
      
      // Base detection chance
      let chance = 0.20; // 20%
      
      // Distance factor (assume medium range for now, can be enhanced with actual distance)
      const distanceFactor = 0.15; // +15% for medium range
      chance += distanceFactor;
      
      // Awareness state modifier
      if (awareness === 'alerted') chance += 0.30; // +30% when alerted
      if (awareness === 'detected') chance += 0.50; // +50% when already detected
      
      // Weather modifiers
      const weather = this._getCurrentWeather();
      if (weather === 'fog') {
        chance += 0.25; // Fog increases detection chance by 25%
      } else if (weather === 'rain') {
        chance += 0.10; // Rain slightly increases detection chance by 10%
      }
      
      // Agility reduction
      const agiBonus = Math.max(0, (special.A - 5) * 0.02); // -2% per Agility above 5
      chance = Math.max(0.05, chance - agiBonus); // Minimum 5%
      
      return chance;
    },

    // Roll for detection
    _rollDetection() {
      if (!this.state || !this.state.playerSneaking) return false;
      
      const chance = this._calculateDetectionChance();
      const roll = crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF;
      
      this.state.lastDetectionRoll = roll;
      const detected = roll < chance;
      
      if (detected) {
        const idx = this.state.activeEnemyIndex ?? 0;
        this.state.enemyAwareness[idx] = 'detected';
        console.log(`[Battle] Detected! Roll: ${(roll * 100).toFixed(1)}% vs ${(chance * 100).toFixed(1)}%`);
      }
      
      return detected;
    },

    // Alert nearby enemies when detected
    _alertNearbyEnemies() {
      if (!this.state) return;
      
      const activeIdx = this.state.activeEnemyIndex ?? 0;
      // Alert all enemies when one detects the player
      this.state.enemyAwareness = this.state.enemyAwareness.map((_, idx) => 
        idx === activeIdx ? 'detected' : 'alerted'
      );
    },
    _spendAmmo(ammoType, amount) {
      const inv = this.gs && this.gs.inventory;
      if (!inv || !Array.isArray(inv.ammo)) return false;

      // BUG-019 FIX: treat amount <= 0 as "free fire" — no ammo required.
      // This prevents weapons with ammoPerShot:0 (or null) from falsely failing
      // the ammo check.  The call site already converts 0 with `|| 1`, but this
      // guard adds a second layer so the function stays correct if called directly.
      if (!amount || amount <= 0) return true;

      const ammoItem = inv.ammo.find(a => a.id === ammoType || a.type === ammoType);
      if (!ammoItem) return false;

      const currentAmount = ammoItem.amount || ammoItem.quantity || 0;
      if (currentAmount < amount) return false;

      if (ammoItem.amount !== undefined) {
        ammoItem.amount -= amount;
      } else {
        ammoItem.quantity -= amount;
      }
      return true;
    },

    // --------------------------------------------------------
    // Create a new battle state from an encounter
    // --------------------------------------------------------
    start(encounter) {
      // Encounter loop calls start() before battle.init(). Build gs.player
      // first so updateUI can read vitals without throwing.
      this._ensureGameState();

      // BUG FIX: validate that encounter and its enemies exist before accessing
      // encounter.enemies[0]. Previously would throw TypeError if enemies was
      // undefined or an empty array.
      if (!encounter || !Array.isArray(encounter.enemies) || encounter.enemies.length === 0) {
        console.error("[Battle] Cannot start: invalid encounter or no enemies", encounter);
        return;
      }

      // BUG-016 FIX: a player stored with hp <= 0 (dead state) must be
      // respawned before a new battle begins.  Without this guard the battle
      // loop starts with a dead player, and the "player dead" check fires only
      // after the first enemy attack — causing a silent one-turn ghost state.
      if (this.gs && this.gs.player && (this.gs.player.hp || 0) <= 0) {
        this._applyRespawnPenalty();
      }

      this.state = {
        encounter,
        // BUG FIX: was only tracking enemies[0] HP. Now tracks HP for all enemies
        // so multi-enemy encounters don't silently ignore enemies after the first.
        enemyHp: encounter.enemies.map(e => (typeof e.hp === 'number' ? e.hp : 20)),
        // BUG-004: track which enemy is currently being targeted
        activeEnemyIndex: 0,
        // Stealth mechanics
        playerSneaking: false,
        enemyAwareness: encounter.enemies.map(() => 'unaware'), // 'unaware', 'alerted', 'detected'
        lastDetectionRoll: 0,
        turns: 0,
        startedAt: Date.now(),
        battleId: null,
        busy: false
      };
      this._persist();
      this._registerWithServer();

      console.log("Battle started:", encounter);

      // If you have a Pocket-Boy battle tab, update it here
      this.updateUI();
    },

    // --------------------------------------------------------
    // Get player VITALS stats (reads from PlayerState or fallback)
    // --------------------------------------------------------
    _getSpecial() {
      if (Game.modules?.PlayerState?.getSpecial) {
        return Game.modules.PlayerState.getSpecial();
      }
      return (
        (this.gs && this.gs.player && this.gs.player.special) ||
        (window.PLAYER && window.PLAYER.special) ||
        { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 }
      );
    },

    // --------------------------------------------------------
    // Get active perks from PlayerState
    // --------------------------------------------------------
    _getActivePerks() {
      if (Game.modules?.PlayerState?.getPerks) {
        return Game.modules.PlayerState.getPerks();
      }
      return [];
    },

    // --------------------------------------------------------
    // Get current weather for battle modifiers
    // --------------------------------------------------------
    _getCurrentWeather() {
      try {
        const worldmap = Game.modules?.worldmap;
        if (worldmap && worldmap.gs) {
          const pos = worldmap.gs?.player?.position;
          if (pos && Game.modules?.world?.weather?.at) {
            const state = worldmap.gs.worldState || worldmap.gs;
            const weather = Game.modules.world.weather.at(state, {
              biome: "auto",
              continent: "north_america",
              lat: pos.lat,
              lng: pos.lng
            });
            return weather?.type || "clear";
          }
        }
      } catch (e) {
        console.warn("[Battle] Failed to get weather:", e.message);
      }
      return "clear";
    },

    // --------------------------------------------------------
    // Apply perk damage bonuses
    // --------------------------------------------------------
    _applyPerkDamageBonuses(baseDamage, weapon, activePerks) {
      let damage = baseDamage;

      // Iron Fist: +20% unarmed damage
      if (activePerks.includes('iron_fist') && (!weapon || weapon.category === 'unarmed')) {
        damage *= 1.2;
      }

      // Big Leagues: +20% melee damage
      if (activePerks.includes('big_leagues') && weapon && weapon.category === 'melee') {
        damage *= 1.2;
      }

      // Gunslinger: +20% pistol damage
      if (activePerks.includes('gunslinger') && weapon && weapon.category === 'pistol') {
        damage *= 1.2;
      }

      // Rifleman: +20% rifle damage
      if (activePerks.includes('rifleman') && weapon && weapon.category === 'rifle') {
        damage *= 1.2;
      }

      // Heavy Gunner: +20% heavy gun damage
      if (activePerks.includes('heavy_gunner') && weapon && weapon.category === 'heavy') {
        damage *= 1.2;
      }

      // Commando: +20% automatic weapon damage
      if (activePerks.includes('commando') && weapon && weapon.category === 'automatic') {
        damage *= 1.2;
      }

      // Bloody Mess: +5% damage with all attacks
      if (activePerks.includes('bloody_mess')) {
        damage *= 1.05;
      }

      return Math.floor(damage);
    },

    // --------------------------------------------------------
    // Apply perk damage resistance
    // --------------------------------------------------------
    async _applyPerkDamageResistance(damage, activePerks) {
      let dmg = damage;

      // Toughness: +10 Damage Resistance
      if (activePerks.includes('toughness')) {
        dmg = Math.max(1, dmg - 10);
      }

      // Armor set bonuses
      if (Game.modules?.PlayerState?.getActiveSetBonuses) {
        try {
          const setBonuses = await Game.modules.PlayerState.getActiveSetBonuses();
          if (setBonuses.damageResist) {
            dmg = Math.max(1, dmg - setBonuses.damageResist);
          }
        } catch (e) {
          console.warn('[Battles] Error getting set bonuses:', e);
        }
      }

      return dmg;
    },

    // --------------------------------------------------------
    // Roll for critical hit based on Luck
    // --------------------------------------------------------
    _rollCriticalHit(luck) {
      const critChance = 0.05 + (luck - 5) * 0.01; // Base 5%, +1% per Dumb Luck above 5
      return this._rand() < critChance;
    },

    // --------------------------------------------------------
    // Player attack logic
    // --------------------------------------------------------
    _unarmed() {
      const special = this._getSpecial();
      const strBonus = Math.max(0, Math.floor((special.S - 5) / 2));
      return { success: true, damage: 5 + strBonus, weapon: null, unarmed: true };
    },

    fireEquippedWeapon(opts = {}) {
      if (opts.unarmed) return this._unarmed();
      const weapon = this.gs.player.equipped && this.gs.player.equipped.weapon;
      // Fallback to PlayerState equipped weapon if gs doesn't have one
      if (!weapon) {
        const ps = Game.modules?.PlayerState?.getState?.();
        if (ps && ps.equipped && ps.equipped.weapon) {
          this.gs.player.equipped = this.gs.player.equipped || {};
          this.gs.player.equipped.weapon = ps.equipped.weapon;
        }
      }
      const equippedWeapon = (this.gs.player.equipped && this.gs.player.equipped.weapon) || null;
      
      // Allow unarmed attacks
      if (!equippedWeapon) return this._unarmed();

      // Melee or infinite ammo
      if (!equippedWeapon.ammoType) {
        // Strength adds +1 damage per 2 points above 5 for melee weapons
        const special = this._getSpecial();
        const strBonus = Math.max(0, Math.floor((special.S - 5) / 2));
        return { success: true, damage: (equippedWeapon.damage || 10) + strBonus, weapon: equippedWeapon };
      }

      // Spend ammo from gameState.inventory.ammo (no separate inventory module)
      const ok = this._spendAmmo(equippedWeapon.ammoType, equippedWeapon.ammoPerShot || 1);

      if (!ok) {
        return { success: false, reason: "NO_AMMO" };
      }

      return { success: true, damage: equippedWeapon.damage || 10, weapon: equippedWeapon };
    },

    playerAttack(opts = {}) {
      if (!this.state) return { success: false, reason: "NO_BATTLE" };
      if (!(this.state.enemyHp[this.state.activeEnemyIndex ?? 0] > 0)) {
        const live = this.liveEnemies();
        if (!live.length) return { success: false, reason: "NO_TARGET" };
        this.state.activeEnemyIndex = live[0];
      }

      // Stealth: Roll for detection before attacking
      const wasSneaking = this.state.playerSneaking;
      const detected = this._rollDetection();
      
      if (detected) {
        this._alertNearbyEnemies();
      }

      const res = this.fireEquippedWeapon(opts);
      if (!res.success) return res;
      this.state.turns = (this.state.turns || 0) + 1;
      const target = this.state.encounter.enemies[this.state.activeEnemyIndex ?? 0];

      // Calculate damage with perks and critical hits
      let damage = res.damage;
      const special = this._getSpecial();
      const activePerks = this._getActivePerks();

      // Apply perk bonuses
      damage = this._applyPerkDamageBonuses(damage, res.weapon, activePerks);

      // Sneak attack bonus
      let sneakMultiplier = 1.0;
      if (wasSneaking) {
        if (!detected) {
          sneakMultiplier = 2.0; // Undetected: 2x damage
        } else {
          sneakMultiplier = 1.5; // Detected: 1.5x damage
        }
        damage = Math.floor(damage * sneakMultiplier);
      }

      // Check for critical hit
      const isCritical = this._rollCriticalHit(special.L);
      if (isCritical) {
        damage = Math.floor(damage * 1.5);
      }

      // Stat-based accuracy vs enemy evasion (was a flat 100%)
      const weather = this._getCurrentWeather();
      const hitChance = wasSneaking && !detected ? Math.min(0.95, this._playerHitChance(res.weapon, target, weather) + 0.15)
                                                  : this._playerHitChance(res.weapon, target, weather);
      const hitRoll = this._rand();
      if (hitRoll >= hitChance) {
        this._persist();
        this.updateUI();
        return { success: true, damage: 0, isCritical: false, wasSneaking, detected, sneakMultiplier, hit: false, weather, hitChance, unarmed: !!res.unarmed };
      }

      // BUG-004: damage the active enemy, not always index 0
      const idx = this.state.activeEnemyIndex ?? 0;
      this.state.enemyHp[idx] -= damage;

      // If the active enemy just died, advance to the next live enemy (search from 0)
      if (this.state.enemyHp[idx] <= 0) {
        const nextIdx = this.state.enemyHp.findIndex(hp => hp > 0);
        this.state.activeEnemyIndex = nextIdx !== -1 ? nextIdx : idx;
      }

      // Durability decay for weapon after successful hit
      if (res.weapon && Game.modules?.PlayerState?.decayDurability) {
        Game.modules.PlayerState.decayDurability("weapon", 1);
      }

      this._persist();
      this.updateUI();
      return { ...res, damage, isCritical, wasSneaking, detected, sneakMultiplier, hit: true, weather, hitChance };
    },

    // --------------------------------------------------------
    // Enemy attack logic (Endurance reduces damage; armor subtracts flat DR)
    // --------------------------------------------------------
    async enemyAttack() {
      if (!this.state) return { success: false, reason: "NO_BATTLE", damage: 0, hits: [] };
      if (typeof this.gs.player.hp !== "number") {
        this.gs.player.hp = 100;
        this.gs.player.maxHp = 100;
      }
      const special = this._getSpecial();
      const endBonus = Math.max(0, special.E - 5);

      // Armor: each piece counted once (full-body suits cover several slots)
      const ARMOR_SLOTS = ["chest", "head", "arms", "legs"];
      const psEquipped = Game.modules?.PlayerState?.getState?.()?.equipped || {};
      const playerEquipped = this.gs.player.equipped || {};
      let totalArmor = 0, bestArmorItem = null, bestArmorSlot = null;
      const seenArmor = new Set();
      ARMOR_SLOTS.forEach(s => {
        const a = psEquipped[s] || playerEquipped[s];
        if (a && typeof a.armor === "number" && !seenArmor.has(a.id)) {
          seenArmor.add(a.id);
          totalArmor += a.armor;
          if (!bestArmorItem || a.armor > (bestArmorItem.armor || 0)) { bestArmorItem = a; bestArmorSlot = s; }
        }
      });
      const activePerks = this._getActivePerks();
      const weather = this._getCurrentWeather();

      // BUG-034: dead enemies never act. Every LIVE enemy gets a swing (was: only the target).
      const hits = [];
      let total = 0;
      for (const idx of this.liveEnemies()) {
        if (this.gs.player.hp <= 0) break;
        const enemy = this.state.encounter.enemies[idx] || {};
        if (this.state.enemyAwareness[idx] === 'unaware') this.state.enemyAwareness[idx] = 'alerted';
        if (this._rand() >= this._enemyHitChance(enemy)) {
          hits.push({ idx, name: enemy.name || enemy.id, hit: false, damage: 0 });
          continue;
        }
        let dmg = Math.max(1, (enemy.damage || 3) - endBonus);
        if (totalArmor > 0) dmg = Math.max(1, dmg - Math.floor(totalArmor / 5));
        dmg = await this._applyPerkDamageResistance(dmg, activePerks);
        this.gs.player.hp = Math.max(0, this.gs.player.hp - dmg);
        total += dmg;
        hits.push({ idx, name: enemy.name || enemy.id, hit: true, damage: dmg });
      }

      if (total > 0 && bestArmorSlot && Game.modules?.PlayerState?.decayDurability) {
        Game.modules.PlayerState.decayDurability(bestArmorSlot, 1);
      }

      let radiationDamage = 0;
      if (weather === 'radiation storm' && total > 0) {
        radiationDamage = Math.floor(total * 0.5);
        if (Game.modules?.PlayerState?.applyRadiation) Game.modules.PlayerState.applyRadiation(radiationDamage);
        else this.gs.player.radiation = (this.gs.player.radiation || 0) + radiationDamage;
      }

      this._persist();
      this.updateUI();
      return { success: true, damage: total, hits, radiationDamage, weather };
    },

    // One full player action followed by the enemy turn. Returns the outcome; UI only renders it.
    async takeTurn(action, opts = {}) {
      if (!this.state || this.state.busy) return { ignored: true };
      this.state.busy = true;
      try {
        if (action === "flee") {
          const sp = this._getSpecial();
          const fleeChance = Math.min(0.95, 0.5 + Math.max(0, sp.A - 5) * 0.05);
          if (this._rand() < fleeChance) {
            this._end('FLEE');
            return { action, escaped: true };
          }
          const enemy = await this.enemyAttack();
          const end = this.checkBattleEnd();
          if (end === "LOSE") { this._end('LOSE'); this._showDeathOverlay(); }
          return { action, escaped: false, enemy, end };
        }
        const res = this.playerAttack({ unarmed: action === "unarmed" || !!opts.unarmed });
        if (!res.success) return { action, res };
        let end = this.checkBattleEnd();
        if (end === "WIN") {
          // Lock the battle buttons before the state is cleared so a late FLEE click cannot hit a null state.
          const attackBtn = typeof document !== "undefined" ? document.getElementById("battleAttackBtn") : null;
          if (attackBtn) attackBtn.disabled = true;
          ["battlePunchBtn", "battleFleeBtn", "battleSneakBtn"].forEach(id => {
            const b = typeof document !== "undefined" ? document.getElementById(id) : null;
            if (b) b.disabled = true;
          });
          const rewards = await this.resolveWin();
          return { action, res, end, rewards };
        }
        const enemy = await this.enemyAttack();
        end = this.checkBattleEnd();
        if (end === "LOSE") { this._end('LOSE'); this._showDeathOverlay(); }
        return { action, res, enemy, end };
      } finally {
        if (this.state) { this.state.busy = false; this._persist(); }
      }
    },

    // ---- server-side reward validation (backend /api/encounter/battle/*) ----
    _session() {
      try { return localStorage.getItem("sessionId") || ""; } catch (_) { return ""; }
    },
    async _post(path, body) {
      const sid = this._session();
      if (!sid || typeof fetch !== "function") return null;
      try {
        const res = await fetch(`${window.API_BASE || ""}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sid}` },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        return { status: res.status, ok: res.ok && data.ok !== false, data };
      } catch (_) { return null; }
    },
    async _registerWithServer() {
      const st = this.state;
      if (!st) return;
      const enc = st.encounter;
      const r = await this._post("/api/encounter/battle/start", {
        encounterId: enc.id || null,
        enemies: enc.enemies.map(e => ({ id: e.id, hp: e.hp, damage: e.damage, level: e.level })),
        rewards: enc.rewards || {},
      });
      if (r && r.ok && r.data.battleId && this.state === st) { st.battleId = r.data.battleId; this._persist(); }
    },
    // WIN: signed-in players get only what the server approves (and the server credits the profile);
    // guests/offline keep the old local rewards.
    async resolveWin() {
      const st = this.state;
      const encounter = st.encounter;
      let applied = null;
      if (st.battleId) {
        const r = await this._post("/api/encounter/battle/resolve", { battleId: st.battleId, result: "WIN", turns: st.turns || 0 });
        if (r && r.ok && r.data.rewards) {
          applied = r.data.rewards;
          this.applyRewards({ rewards: applied });
        } else if (r && r.status >= 400 && r.status < 500) {
          applied = { xp: 0, caps: 0, items: [], rejected: (r.data && r.data.error) || "rejected" };
        }
      }
      if (!applied) { this.applyRewards(encounter); applied = { ...(encounter.rewards || {}), local: true }; }
      this._end('WIN');
      this.state = null; // _end clears it too; explicit so nothing after WIN can reuse it
      return applied;
    },

    // --------------------------------------------------------
    // Check win/lose
    // --------------------------------------------------------
    checkBattleEnd() {
      if (!this.state) return null;

      // BUG-004: win only when ALL enemies are dead
      const enemyDead = this.state.enemyHp.every(hp => hp <= 0);
      const playerDead = this.gs.player.hp <= 0;

      if (enemyDead) return "WIN";
      if (playerDead) return "LOSE";
      return null;
    },

    // --------------------------------------------------------
    // Rewards - uses unified PlayerState for proper persistence
    // --------------------------------------------------------
    applyRewards(encounter) {
      const r = encounter.rewards || {};
      
      // Award XP - use unified PlayerState
      if (r.xp) {
        if (Game.modules?.PlayerState?.awardXP) {
          Game.modules.PlayerState.awardXP(r.xp);
        } else {
          this.gs.player.xp = (this.gs.player.xp || 0) + r.xp;
        }
      }
      
      // Award caps - use unified PlayerState
      if (r.caps) {
        if (Game.modules?.PlayerState?.awardCaps) {
          Game.modules.PlayerState.awardCaps(r.caps);
        } else {
          this.gs.player.caps = (this.gs.player.caps || 0) + r.caps;
        }
      }

      // Award items - use unified system for proper persistence
      (r.items || []).forEach((itemId) => {
        // Try to resolve item from items database
        let item = null;
        
        if (typeof ITEMS_DB !== 'undefined') {
          item =
            ITEMS_DB.weapons?.find((x) => x.id === itemId) ||
            ITEMS_DB.ammo?.find((x) => x.id === itemId) ||
            ITEMS_DB.armor?.find((x) => x.id === itemId) ||
            ITEMS_DB.consumables?.find((x) => x.id === itemId) ||
            ITEMS_DB.questItems?.find((x) => x.id === itemId);
        }
        
        // If not found, try Game.player.items
        if (!item && Game.player?.items) {
          item = Game.player.items.find(i => i.id === itemId);
        }

        // Fallback: create basic item object
        if (!item) {
          item = { id: itemId, name: itemId, type: 'loot' };
        }

        // Use unified PlayerState for proper persistence
        if (Game.modules?.PlayerState?.addItem) {
          Game.modules.PlayerState.addItem(item, 1);
        } else if (Game.giveItem) {
          Game.giveItem(item, 1);
        } else if (Game.modules?.inventory?.addItem) {
          Game.modules.inventory.addItem(item, 1);
        }
      });
      
      console.log(`[Battle] Rewards applied: ${r.xp || 0} XP, ${r.caps || 0} caps, ${(r.items || []).length} items`);
    },

    // --------------------------------------------------------
    // UI Hook
    // --------------------------------------------------------
    onOpen() {
      if (!this.state) this._restore();
      this.updateUI();
    },

    updateUI() {
      const container = document.getElementById("tab-battle");
      if (!container) return;

      this._ensureGameState();
      const player = this.gs && this.gs.player;
      if (!player) {
        container.innerHTML = `
          <div class="battle-idle">
            <div class="battle-idle-note">Combat systems offline. Citizen vitals unavailable.</div>
          </div>
        `;
        return;
      }

      if (!this.state) {
        // No active battle - show player readiness stats
        const equipped = player.equipped || {};
        const weapon = equipped.weapon || (Game.modules?.PlayerState?.getState?.()?.equipped?.weapon);
        // Aggregate armor across all body slots for UI display
        const psEq = Game.modules?.PlayerState?.getState?.()?.equipped || {};
        const armorSlots = ["chest", "head", "arms", "legs"];
        const armorPieces = armorSlots.map(s => equipped[s] || psEq[s]).filter(Boolean);
        const totalArmorRating = armorPieces.reduce((sum, a) => sum + (a.armor || 0), 0);
        const armorDisplay = armorPieces.length
          ? `${armorPieces.map(a => escapeHtml(a.name)).join(", ")} (AR: ${totalArmorRating})`
          : "<em>None equipped</em>";
        const special = this._getSpecial();
        const hp = (typeof player.hp === 'number') ? player.hp : 100;
        const maxHp = (typeof player.maxHp === 'number') ? player.maxHp : 100;
        const hpPct = Math.max(0, Math.min(100, Math.round(hp / (maxHp || 1) * 100)));

        container.innerHTML = `
          <div class="battle-idle">
            <div class="battle-status-header">// COMBAT READINESS //</div>
            <div class="battle-stat-row">
              <span class="battle-label">HP</span>
              <span class="battle-bar-wrap"><span class="battle-bar" style="width:${hpPct}%"></span></span>
              <span class="battle-val">${hp} / ${maxHp}</span>
            </div>
            <div class="battle-stat-row">
              <span class="battle-label">WEAPON</span>
              <span class="battle-val">${weapon ? `${escapeHtml(weapon.name)} (DMG: ${weapon.damage || '?'})` : '<em>None equipped</em>'}</span>
            </div>
            <div class="battle-stat-row">
              <span class="battle-label">ARMOR</span>
              <span class="battle-val">${armorDisplay}</span>
            </div>
            <div class="battle-special-row">
              ${['S','P','E','C','I','A','L'].map(k => `<span class="battle-special-cell"><span class="bs-key">${k}</span><span class="bs-val">${special[k] || 5}</span></span>`).join('')}
            </div>
            <div class="battle-idle-note">No active encounter. Roam the wasteland to trigger combat.</div>
          </div>
        `;
        return;
      }

      // BUG-004: display the currently active enemy, not always index 0
      const activeIdx = this.state.activeEnemyIndex ?? 0;
      const enemy = this.state.encounter.enemies[activeIdx];
      if (!enemy) {
        console.error("[Battle] updateUI: no enemy at index", activeIdx, "— state may be corrupted");
        return;
      }
      const special = this._getSpecial();
      const equipped = player.equipped || {};
      const weapon = equipped.weapon || (Game.modules?.PlayerState?.getState?.()?.equipped?.weapon);
      // Aggregate armor across all body slots
      const psEq2 = Game.modules?.PlayerState?.getState?.()?.equipped || {};
      const armorSlots2 = ["chest", "head", "arms", "legs"];
      const activeArmorPieces = armorSlots2.map(s => equipped[s] || psEq2[s]).filter(Boolean);
      const activeTotalAR = activeArmorPieces.reduce((sum, a) => sum + (a.armor || 0), 0);
      const _activeArmorLabel = activeArmorPieces.length
        ? `${activeArmorPieces.map(a => escapeHtml(a.name)).join(", ")} (AR: ${activeTotalAR})`
        : "<em>None</em>";
      const hp = (typeof player.hp === 'number') ? player.hp : 100;
      const maxHp = (typeof player.maxHp === 'number') ? player.maxHp : 100;
      const hpPct = Math.max(0, Math.min(100, Math.round(hp / (maxHp || 1) * 100)));
      // BUG-001 FIX: use activeIdx not hardcoded 0
      const activeEnemyHp = this.state.enemyHp[activeIdx];
      const enemyHpPct = Math.max(0, Math.min(100, Math.round(activeEnemyHp / (enemy.hp || 20) * 100)));

      container.innerHTML = `
        <div class="battle-active">
          <div class="battle-targets" id="battleTargets">
            ${this.state.encounter.enemies.map((e, i) => {
              const hpI = this.state.enemyHp[i];
              const dead = !(hpI > 0);
              return `<button class="pipboy-button battle-target${i === activeIdx ? ' active' : ''}" data-target="${i}" ${dead ? 'disabled' : ''}>${escapeHtml(e.name || e.id)} ${dead ? '✝' : hpI + 'HP'}</button>`;
            }).join('')}
          </div>
          <div class="battle-combatant">
            <div class="battle-label-header">ENEMY</div>
            <div class="battle-enemy-name">${escapeHtml(enemy.name || enemy.id)}</div>
            <div class="battle-stat-row">
              <span class="battle-bar-wrap enemy"><span class="battle-bar enemy-bar" style="width:${enemyHpPct}%"></span></span>
              <span class="battle-val">${activeEnemyHp} / ${enemy.hp || 20} HP</span>
            </div>
          </div>
          <div class="battle-vs">VS</div>
          <div class="battle-combatant">
            <div class="battle-label-header">YOU</div>
            <div class="battle-stat-row">
              <span class="battle-bar-wrap"><span class="battle-bar" style="width:${hpPct}%"></span></span>
              <span class="battle-val">${hp} / ${maxHp} HP</span>
            </div>
            <div class="battle-gear-line">${weapon ? `⚔ ${escapeHtml(weapon.name)}` : '⚔ Unarmed'}${activeArmorPieces.length ? ` | 🛡 AR:${activeTotalAR}` : ''}</div>
            <div class="battle-special-row compact">
              ${['S','P','E','C','I','A','L'].map(k => `<span class="battle-special-cell"><span class="bs-key">${k}</span><span class="bs-val">${special[k] || 5}</span></span>`).join('')}
            </div>
          </div>
          <div id="battleOptions" class="battle-options">
            <button id="battleAttackBtn" class="pipboy-button">⚔ ATTACK</button>
            <button id="battlePunchBtn" class="pipboy-button">✊ PUNCH</button>
            <button id="battleSneakBtn" class="pipboy-button ${this.state.playerSneaking ? 'active' : ''}">👤 SNEAK ${this.state.playerSneaking ? 'ON' : 'OFF'}</button>
            <button id="battleFleeBtn" class="pipboy-button">🏃 FLEE</button>
          </div>
          <div id="battleStealthInfo" class="battle-stealth-info">
            ${this.state.playerSneaking ? `
              <div>Detection Chance: ${(this._calculateDetectionChance() * 100).toFixed(1)}%</div>
              <div>Enemy Status: ${this.state.enemyAwareness[this.state.activeEnemyIndex] || 'unaware'}</div>
            ` : '<div>Sneak mode disabled</div>'}
          </div>
          <div id="battleMsg" class="battle-msg"></div>
        </div>
      `;

      const attackBtn = document.getElementById("battleAttackBtn");
      const sneakBtn = document.getElementById("battleSneakBtn");
      const fleeBtn = document.getElementById("battleFleeBtn");

      if (sneakBtn) {
        sneakBtn.onclick = () => {
          this.toggleSneak();
        };
      }

      const punchBtn = document.getElementById("battlePunchBtn");
      const buttons = [attackBtn, punchBtn, fleeBtn, sneakBtn].filter(Boolean);
      const lock = (on) => buttons.forEach(b => { b.disabled = on; });
      if (this.state.busy) lock(true);

      container.querySelectorAll('.battle-target').forEach(b => {
        b.onclick = () => this.setTarget(Number(b.dataset.target));
      });

      const describe = (out) => {
        const lines = [];
        const r = out.res;
        if (out.escaped) return "You escaped!";
        if (out.action === "flee") lines.push("Failed to escape!");
        if (r) {
          if (!r.success) return r.reason === "NO_AMMO" ? "Out of ammo! Use PUNCH or flee." : "Can't attack.";
          if (!r.hit) lines.push(`You missed (${Math.round((r.hitChance || 0) * 100)}% to hit).`);
          else {
            let m = `${r.unarmed ? "You punch" : "You hit"} ${enemy.name || enemy.id} for ${r.damage}!`;
            if (r.wasSneaking) m = (r.detected ? "Detected! " : "SNEAK ATTACK! ") + m;
            if (r.isCritical) m = "CRITICAL! " + m;
            lines.push(m);
          }
        }
        if (out.end === "WIN") {
          const rw = out.rewards || {};
          lines.push(rw.rejected ? `Victory — reward rejected by server (${rw.rejected}).` : `Victory! +${rw.xp || 0} XP, +${rw.caps || 0} caps.`);
        }
        if (out.enemy && out.enemy.hits) {
          out.enemy.hits.forEach(h => lines.push(h.hit ? `${h.name} hits you for ${h.damage}.` : `${h.name} misses.`));
        }
        if (out.end === "LOSE") lines.push("You collapse...");
        return lines.join(" ");
      };

      const act = async (action) => {
        lock(true);
        const out = await this.takeTurn(action);
        if (out.ignored) return;
        const msg = document.getElementById("battleMsg");
        const text = describe(out);
        if (!this.state) {
          if (msg) msg.textContent = text;
          setTimeout(() => { this.updateUI(); if (out.end !== "LOSE") window.Game?.pipboy?.setActivePanel?.('map'); }, 1200);
          return;
        }
        this.updateUI();
        const msg2 = document.getElementById("battleMsg");
        if (msg2) msg2.textContent = text;
      };

      if (attackBtn) attackBtn.onclick = () => act("attack");
      if (punchBtn) punchBtn.onclick = () => act("unarmed");
      // BUG: a failed flee used to leave the buttons live during the enemy turn (double action)
      if (fleeBtn) fleeBtn.onclick = () => act("flee");
    }
  };

  Game.modules.battle = battleModule;
})();
