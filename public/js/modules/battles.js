<<<<<<< HEAD
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

    init(gameState) {
      this.gs = gameState;
      this.state = null;
      // Ensure player has an hp field (not initialized elsewhere)
      if (this.gs && this.gs.player && typeof this.gs.player.hp !== "number") {
        this.gs.player.hp = 100;
        this.gs.player.maxHp = 100;
      }
      // Set up death overlay respawn button
      const respawnBtn = document.getElementById('respawnBtn');
      if (respawnBtn) {
        respawnBtn.addEventListener('click', () => {
          this._applyRespawnPenalty();
          this._hideDeathOverlay();
          this.state = null;
          this.updateUI();
          window.Game?.pipboy?.setActivePanel?.('map');
          window.dispatchEvent(new CustomEvent('battleEnd', { detail: { result: 'LOSE' } }));
        });
      }
    },

    // --------------------------------------------------------
    // Shared respawn logic: restore 30% HP, 10% caps penalty
    // --------------------------------------------------------
    _applyRespawnPenalty() {
      this.gs.player.hp = Math.max(1, Math.ceil((this.gs.player.maxHp || 100) * 0.3));
      if (this.gs.player.caps > 0) {
        this.gs.player.caps = Math.floor((this.gs.player.caps || 0) * 0.9);
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
        lastDetectionRoll: 0
      };

      console.log("Battle started:", encounter);

      // If you have a Pocket-Boy battle tab, update it here
      this.updateUI();
    },

    // --------------------------------------------------------
    // Get player SPECIAL stats (reads from PlayerState or fallback)
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
      const critChance = 0.05 + (luck - 5) * 0.01; // Base 5%, +1% per Luck above 5
      const roll = crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF; // Secure random [0,1)
      return roll < critChance;
    },

    // --------------------------------------------------------
    // Player attack logic
    // --------------------------------------------------------
    fireEquippedWeapon() {
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
      if (!equippedWeapon) {
        // Unarmed attack: base damage 5 + Strength bonus
        const special = this._getSpecial();
        const strBonus = Math.max(0, Math.floor((special.S - 5) / 2));
        return { success: true, damage: 5 + strBonus, weapon: null };
      }

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

    playerAttack() {
      if (!this.state) return;

      // Stealth: Roll for detection before attacking
      const wasSneaking = this.state.playerSneaking;
      const detected = this._rollDetection();
      
      if (detected) {
        this._alertNearbyEnemies();
      }

      const res = this.fireEquippedWeapon();
      if (!res.success) return res;

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

      // Weather accuracy modifiers
      const weather = this._getCurrentWeather();
      let hitChance = 1.0; // Base 100% hit chance
      if (weather === 'rain' && res.weapon && res.weapon.category !== 'melee' && res.weapon.category !== 'unarmed') {
        hitChance = 0.85; // Rain reduces ranged accuracy by 15%
      }

      // Roll for hit
      const hitRoll = crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF;
      if (hitRoll > hitChance) {
        // Miss!
        console.log(`[Battle] Player attack missed due to ${weather}! Roll: ${(hitRoll * 100).toFixed(1)}% vs ${(hitChance * 100).toFixed(1)}%`);
        return { success: true, damage: 0, isCritical: false, wasSneaking, detected, sneakMultiplier, hit: false, weather };
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
      if (res.weapon && res.weapon.slot) {
        if (Game.modules?.PlayerState?.decayDurability) {
          Game.modules.PlayerState.decayDurability(res.weapon.slot, 1);
        }
      }

      this.updateUI();
      return { ...res, damage, isCritical, wasSneaking, detected, sneakMultiplier, hit: true, weather };
    },

    // --------------------------------------------------------
    // Enemy attack logic (Endurance reduces damage; armor subtracts flat DR)
    // --------------------------------------------------------
    async enemyAttack() {
      if (!this.state) return;

      const idx = this.state.activeEnemyIndex ?? 0;
      // BUG-034 FIX: guard against a dead enemy attacking after the last kill.
      // When all enemies are defeated activeEnemyIndex can still point at the
      // just-killed enemy (hp <= 0). A dead enemy must never deal damage —
      // doing so could flip a WON battle into a LOSE state.
      if (!this.state.enemyHp || this.state.enemyHp[idx] <= 0) {
        return { success: false, reason: "ENEMY_DEAD" };
      }

      const enemy = this.state.encounter.enemies[idx];
      let dmg = enemy.damage || 3;

      // Guard: ensure player.hp is initialized
      if (typeof this.gs.player.hp !== "number") {
        this.gs.player.hp = 100;
        this.gs.player.maxHp = 100;
      }

      // Endurance damage reduction: each point above 5 reduces damage by 1 (min 1)
      const special = this._getSpecial();
      const endBonus = Math.max(0, special.E - 5);
      dmg = Math.max(1, dmg - endBonus);

      // Armor damage reduction — check all body armor slots (chest, head, arms, legs)
      const ARMOR_SLOTS = ["chest", "head", "arms", "legs"];
      const psEquipped = Game.modules?.PlayerState?.getState?.()?.equipped || {};
      const playerEquipped = this.gs.player.equipped || {};
      let totalArmor = 0;
      let bestArmorItem = null;
      ARMOR_SLOTS.forEach(s => {
        const a = playerEquipped[s] || psEquipped[s];
        if (a && typeof a.armor === "number") {
          totalArmor += a.armor;
          if (!bestArmorItem || a.armor > (bestArmorItem.armor || 0)) bestArmorItem = a;
        }
      });
      if (totalArmor > 0) {
        dmg = Math.max(1, dmg - Math.floor(totalArmor / 5));
      }

      // Apply perk damage resistance
      const activePerks = this._getActivePerks();
      dmg = await this._applyPerkDamageResistance(dmg, activePerks);

      // Enemy awareness: attacking alerts the enemy
      if (this.state.enemyAwareness[idx] === 'unaware') {
        this.state.enemyAwareness[idx] = 'alerted';
      }

      this.gs.player.hp -= dmg;
      if (this.gs.player.hp < 0) this.gs.player.hp = 0;

      // Durability decay for armor after taking damage
      if (dmg > 0 && bestArmorItem && bestArmorItem.slot) {
        if (Game.modules?.PlayerState?.decayDurability) {
          Game.modules.PlayerState.decayDurability(bestArmorItem.slot, 1);
        }
      }

      // Weather radiation effects
      const weather = this._getCurrentWeather();
      let radiationDamage = 0;
      if (weather === 'radiation storm') {
        radiationDamage = Math.floor(dmg * 0.5); // Radiation storms add 50% of damage as radiation
        // Apply radiation damage to player
        if (Game.modules?.PlayerState?.applyRadiation) {
          Game.modules.PlayerState.applyRadiation(radiationDamage);
        } else {
          // Fallback: increase player's radiation directly
          this.gs.player.radiation = (this.gs.player.radiation || 0) + radiationDamage;
        }
      }

      this.updateUI();
      return { success: true, damage: dmg, radiationDamage, weather };
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
      this.updateUI();
    },

    updateUI() {
      const container = document.getElementById("tab-battle");
      if (!container) return;

      if (!this.state) {
        // No active battle - show player readiness stats
        const equipped = this.gs.player.equipped || {};
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
        const hp = (typeof this.gs.player.hp === 'number') ? this.gs.player.hp : 100;
        const maxHp = (typeof this.gs.player.maxHp === 'number') ? this.gs.player.maxHp : 100;
        const hpPct = Math.max(0, Math.min(100, Math.round(hp / maxHp * 100)));

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
      const equipped = this.gs.player.equipped || {};
      const weapon = equipped.weapon || (Game.modules?.PlayerState?.getState?.()?.equipped?.weapon);
      // Aggregate armor across all body slots
      const psEq2 = Game.modules?.PlayerState?.getState?.()?.equipped || {};
      const armorSlots2 = ["chest", "head", "arms", "legs"];
      const activeArmorPieces = armorSlots2.map(s => equipped[s] || psEq2[s]).filter(Boolean);
      const activeTotalAR = activeArmorPieces.reduce((sum, a) => sum + (a.armor || 0), 0);
      const _activeArmorLabel = activeArmorPieces.length
        ? `${activeArmorPieces.map(a => escapeHtml(a.name)).join(", ")} (AR: ${activeTotalAR})`
        : "<em>None</em>";
      const hp = (typeof this.gs.player.hp === 'number') ? this.gs.player.hp : 100;
      const maxHp = (typeof this.gs.player.maxHp === 'number') ? this.gs.player.maxHp : 100;
      const hpPct = Math.max(0, Math.min(100, Math.round(hp / maxHp * 100)));
      // BUG-001 FIX: use activeIdx not hardcoded 0
      const activeEnemyHp = this.state.enemyHp[activeIdx];
      const enemyHpPct = Math.max(0, Math.min(100, Math.round(activeEnemyHp / (enemy.hp || 20) * 100)));

      container.innerHTML = `
        <div class="battle-active">
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
      const msgDiv = document.getElementById("battleMsg");

      if (sneakBtn) {
        sneakBtn.onclick = () => {
          this.toggleSneak();
        };
      }

      if (attackBtn) {
        attackBtn.onclick = () => {
          const res = this.playerAttack();
          if (!res.success) {
            msgDiv.textContent = res.reason === "NO_AMMO" ? "Out of ammo!" : "No weapon equipped! Try to flee!";
            return;
          }
          let message = `You hit ${enemy.name || enemy.id} for ${res.damage} damage!`;
          if (res.wasSneaking) {
            if (!res.detected) {
              message = `SNEAK ATTACK! You hit ${enemy.name || enemy.id} for ${res.damage} damage!`;
            } else {
              message = `Detected! You hit ${enemy.name || enemy.id} for ${res.damage} damage!`;
            }
          }
          if (res.isCritical) {
            message = `CRITICAL HIT! ${message}`;
          }
          msgDiv.textContent = message;
          const end = this.checkBattleEnd();
          if (end === "WIN") {
            // BUG-018 FIX: disable buttons immediately on WIN to prevent
            // flee-after-victory crash (this.state is null, enemyAttack() would
            // throw because this.state.encounter is undefined).
            attackBtn.disabled = true;
            if (fleeBtn) fleeBtn.disabled = true;
            msgDiv.textContent = `${enemy.name || enemy.id} defeated!`;
            this.applyRewards(this.state.encounter);
            this.state = null;
            setTimeout(() => { this.updateUI(); window.Game?.pipboy?.setActivePanel?.('map'); }, 1200);
            window.dispatchEvent(new CustomEvent('battleEnd', { detail: { result: 'WIN' } }));
            return;
          }
          // Disable attack + flee buttons during enemy turn to prevent post-death input window
          attackBtn.disabled = true;
          if (fleeBtn) fleeBtn.disabled = true;
          setTimeout(async () => {
            const enemyRes = await this.enemyAttack();
            msgDiv.textContent = `${enemy.name || enemy.id} attacks for ${enemyRes.damage} damage!`;
            const end2 = this.checkBattleEnd();
            if (end2 === "LOSE") {
              this.state = null;
              this._showDeathOverlay();
            } else {
              // Re-enable buttons only if battle is still active
              if (this.state) {
                attackBtn.disabled = false;
                if (fleeBtn) fleeBtn.disabled = false;
              }
            }
          }, 800);
        };
      }
      if (fleeBtn) {
        fleeBtn.onclick = () => {
          // Agility improves flee chance: base 50% + 5% per Agility above 5
          const agiBonus = Math.max(0, special.A - 5) * 5;
          // Multiply before dividing to preserve integer precision
          const fleeThreshold = Math.floor((50 + agiBonus) * 0xFFFFFFFF / 100);
          const fleeRoll = new Uint32Array(1);
          crypto.getRandomValues(fleeRoll);
          if (fleeRoll[0] < fleeThreshold) {
            msgDiv.textContent = "You escaped!";
            this.state = null;
            setTimeout(() => { this.updateUI(); window.Game?.pipboy?.setActivePanel?.('map'); }, 1200);
          } else {
            msgDiv.textContent = "Failed to escape! Enemy attacks!";
            setTimeout(async () => {
              const enemyRes = await this.enemyAttack();
              msgDiv.textContent = `${enemy.name || enemy.id} attacks for ${enemyRes.damage} damage!`;
              const end2 = this.checkBattleEnd();
              if (end2 === "LOSE") {
                this.state = null;
                this._showDeathOverlay();
              }
            }, 800);
          }
        };
      }
    }
  };

  Game.modules.battle = battleModule;
})();
=======
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

    init(gameState) {
      this.gs = gameState;
      this.state = null;
      // Ensure player has an hp field (not initialized elsewhere)
      if (this.gs && this.gs.player && typeof this.gs.player.hp !== "number") {
        this.gs.player.hp = 100;
        this.gs.player.maxHp = 100;
      }
      // Set up death overlay respawn button
      const respawnBtn = document.getElementById('respawnBtn');
      if (respawnBtn) {
        respawnBtn.addEventListener('click', () => {
          this._applyRespawnPenalty();
          this._hideDeathOverlay();
          this.state = null;
          this.updateUI();
          window.Game?.pipboy?.setActivePanel?.('map');
          window.dispatchEvent(new CustomEvent('battleEnd', { detail: { result: 'LOSE' } }));
        });
      }
    },

    // --------------------------------------------------------
    // Shared respawn logic: restore 30% HP, 10% caps penalty
    // --------------------------------------------------------
    _applyRespawnPenalty() {
      this.gs.player.hp = Math.max(1, Math.ceil((this.gs.player.maxHp || 100) * 0.3));
      if (this.gs.player.caps > 0) {
        this.gs.player.caps = Math.floor((this.gs.player.caps || 0) * 0.9);
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
        lastDetectionRoll: 0
      };

      console.log("Battle started:", encounter);

      // If you have a Pocket-Boy battle tab, update it here
      this.updateUI();
    },

    // --------------------------------------------------------
    // Get player SPECIAL stats (reads from PlayerState or fallback)
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
      const critChance = 0.05 + (luck - 5) * 0.01; // Base 5%, +1% per Luck above 5
      const roll = crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF; // Secure random [0,1)
      return roll < critChance;
    },

    // --------------------------------------------------------
    // Player attack logic
    // --------------------------------------------------------
    fireEquippedWeapon() {
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
      if (!equippedWeapon) {
        // Unarmed attack: base damage 5 + Strength bonus
        const special = this._getSpecial();
        const strBonus = Math.max(0, Math.floor((special.S - 5) / 2));
        return { success: true, damage: 5 + strBonus, weapon: null };
      }

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

    playerAttack() {
      if (!this.state) return;

      // Stealth: Roll for detection before attacking
      const wasSneaking = this.state.playerSneaking;
      const detected = this._rollDetection();
      
      if (detected) {
        this._alertNearbyEnemies();
      }

      const res = this.fireEquippedWeapon();
      if (!res.success) return res;

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

      // Weather accuracy modifiers
      const weather = this._getCurrentWeather();
      let hitChance = 1.0; // Base 100% hit chance
      if (weather === 'rain' && res.weapon && res.weapon.category !== 'melee' && res.weapon.category !== 'unarmed') {
        hitChance = 0.85; // Rain reduces ranged accuracy by 15%
      }

      // Roll for hit
      const hitRoll = crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF;
      if (hitRoll > hitChance) {
        // Miss!
        console.log(`[Battle] Player attack missed due to ${weather}! Roll: ${(hitRoll * 100).toFixed(1)}% vs ${(hitChance * 100).toFixed(1)}%`);
        return { success: true, damage: 0, isCritical: false, wasSneaking, detected, sneakMultiplier, hit: false, weather };
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
      if (res.weapon && res.weapon.slot) {
        if (Game.modules?.PlayerState?.decayDurability) {
          Game.modules.PlayerState.decayDurability(res.weapon.slot, 1);
        }
      }

      this.updateUI();
      return { ...res, damage, isCritical, wasSneaking, detected, sneakMultiplier, hit: true, weather };
    },

    // --------------------------------------------------------
    // Enemy attack logic (Endurance reduces damage; armor subtracts flat DR)
    // --------------------------------------------------------
    async enemyAttack() {
      if (!this.state) return;

      const idx = this.state.activeEnemyIndex ?? 0;
      // BUG-034 FIX: guard against a dead enemy attacking after the last kill.
      // When all enemies are defeated activeEnemyIndex can still point at the
      // just-killed enemy (hp <= 0). A dead enemy must never deal damage —
      // doing so could flip a WON battle into a LOSE state.
      if (!this.state.enemyHp || this.state.enemyHp[idx] <= 0) {
        return { success: false, reason: "ENEMY_DEAD" };
      }

      const enemy = this.state.encounter.enemies[idx];
      let dmg = enemy.damage || 3;

      // Guard: ensure player.hp is initialized
      if (typeof this.gs.player.hp !== "number") {
        this.gs.player.hp = 100;
        this.gs.player.maxHp = 100;
      }

      // Endurance damage reduction: each point above 5 reduces damage by 1 (min 1)
      const special = this._getSpecial();
      const endBonus = Math.max(0, special.E - 5);
      dmg = Math.max(1, dmg - endBonus);

      // Armor damage reduction — check all body armor slots (chest, head, arms, legs)
      const ARMOR_SLOTS = ["chest", "head", "arms", "legs"];
      const psEquipped = Game.modules?.PlayerState?.getState?.()?.equipped || {};
      const playerEquipped = this.gs.player.equipped || {};
      let totalArmor = 0;
      let bestArmorItem = null;
      ARMOR_SLOTS.forEach(s => {
        const a = playerEquipped[s] || psEquipped[s];
        if (a && typeof a.armor === "number") {
          totalArmor += a.armor;
          if (!bestArmorItem || a.armor > (bestArmorItem.armor || 0)) bestArmorItem = a;
        }
      });
      if (totalArmor > 0) {
        dmg = Math.max(1, dmg - Math.floor(totalArmor / 5));
      }

      // Apply perk damage resistance
      const activePerks = this._getActivePerks();
      dmg = await this._applyPerkDamageResistance(dmg, activePerks);

      // Enemy awareness: attacking alerts the enemy
      if (this.state.enemyAwareness[idx] === 'unaware') {
        this.state.enemyAwareness[idx] = 'alerted';
      }

      this.gs.player.hp -= dmg;
      if (this.gs.player.hp < 0) this.gs.player.hp = 0;

      // Durability decay for armor after taking damage
      if (dmg > 0 && bestArmorItem && bestArmorItem.slot) {
        if (Game.modules?.PlayerState?.decayDurability) {
          Game.modules.PlayerState.decayDurability(bestArmorItem.slot, 1);
        }
      }

      // Weather radiation effects
      const weather = this._getCurrentWeather();
      let radiationDamage = 0;
      if (weather === 'radiation storm') {
        radiationDamage = Math.floor(dmg * 0.5); // Radiation storms add 50% of damage as radiation
        // Apply radiation damage to player
        if (Game.modules?.PlayerState?.applyRadiation) {
          Game.modules.PlayerState.applyRadiation(radiationDamage);
        } else {
          // Fallback: increase player's radiation directly
          this.gs.player.radiation = (this.gs.player.radiation || 0) + radiationDamage;
        }
      }

      this.updateUI();
      return { success: true, damage: dmg, radiationDamage, weather };
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
      this.updateUI();
    },

    updateUI() {
      const container = document.getElementById("tab-battle");
      if (!container) return;

      if (!this.state) {
        // No active battle - show player readiness stats
        const equipped = this.gs.player.equipped || {};
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
        const hp = (typeof this.gs.player.hp === 'number') ? this.gs.player.hp : 100;
        const maxHp = (typeof this.gs.player.maxHp === 'number') ? this.gs.player.maxHp : 100;
        const hpPct = Math.max(0, Math.min(100, Math.round(hp / maxHp * 100)));

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
      const equipped = this.gs.player.equipped || {};
      const weapon = equipped.weapon || (Game.modules?.PlayerState?.getState?.()?.equipped?.weapon);
      // Aggregate armor across all body slots
      const psEq2 = Game.modules?.PlayerState?.getState?.()?.equipped || {};
      const armorSlots2 = ["chest", "head", "arms", "legs"];
      const activeArmorPieces = armorSlots2.map(s => equipped[s] || psEq2[s]).filter(Boolean);
      const activeTotalAR = activeArmorPieces.reduce((sum, a) => sum + (a.armor || 0), 0);
      const _activeArmorLabel = activeArmorPieces.length
        ? `${activeArmorPieces.map(a => escapeHtml(a.name)).join(", ")} (AR: ${activeTotalAR})`
        : "<em>None</em>";
      const hp = (typeof this.gs.player.hp === 'number') ? this.gs.player.hp : 100;
      const maxHp = (typeof this.gs.player.maxHp === 'number') ? this.gs.player.maxHp : 100;
      const hpPct = Math.max(0, Math.min(100, Math.round(hp / maxHp * 100)));
      // BUG-001 FIX: use activeIdx not hardcoded 0
      const activeEnemyHp = this.state.enemyHp[activeIdx];
      const enemyHpPct = Math.max(0, Math.min(100, Math.round(activeEnemyHp / (enemy.hp || 20) * 100)));

      container.innerHTML = `
        <div class="battle-active">
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
      const msgDiv = document.getElementById("battleMsg");

      if (sneakBtn) {
        sneakBtn.onclick = () => {
          this.toggleSneak();
        };
      }

      if (attackBtn) {
        attackBtn.onclick = () => {
          const res = this.playerAttack();
          if (!res.success) {
            msgDiv.textContent = res.reason === "NO_AMMO" ? "Out of ammo!" : "No weapon equipped! Try to flee!";
            return;
          }
          let message = `You hit ${enemy.name || enemy.id} for ${res.damage} damage!`;
          if (res.wasSneaking) {
            if (!res.detected) {
              message = `SNEAK ATTACK! You hit ${enemy.name || enemy.id} for ${res.damage} damage!`;
            } else {
              message = `Detected! You hit ${enemy.name || enemy.id} for ${res.damage} damage!`;
            }
          }
          if (res.isCritical) {
            message = `CRITICAL HIT! ${message}`;
          }
          msgDiv.textContent = message;
          const end = this.checkBattleEnd();
          if (end === "WIN") {
            // BUG-018 FIX: disable buttons immediately on WIN to prevent
            // flee-after-victory crash (this.state is null, enemyAttack() would
            // throw because this.state.encounter is undefined).
            attackBtn.disabled = true;
            if (fleeBtn) fleeBtn.disabled = true;
            msgDiv.textContent = `${enemy.name || enemy.id} defeated!`;
            this.applyRewards(this.state.encounter);
            this.state = null;
            setTimeout(() => { this.updateUI(); window.Game?.pipboy?.setActivePanel?.('map'); }, 1200);
            window.dispatchEvent(new CustomEvent('battleEnd', { detail: { result: 'WIN' } }));
            return;
          }
          // Disable attack + flee buttons during enemy turn to prevent post-death input window
          attackBtn.disabled = true;
          if (fleeBtn) fleeBtn.disabled = true;
          setTimeout(async () => {
            const enemyRes = await this.enemyAttack();
            msgDiv.textContent = `${enemy.name || enemy.id} attacks for ${enemyRes.damage} damage!`;
            const end2 = this.checkBattleEnd();
            if (end2 === "LOSE") {
              this.state = null;
              this._showDeathOverlay();
            } else {
              // Re-enable buttons only if battle is still active
              if (this.state) {
                attackBtn.disabled = false;
                if (fleeBtn) fleeBtn.disabled = false;
              }
            }
          }, 800);
        };
      }
      if (fleeBtn) {
        fleeBtn.onclick = () => {
          // Agility improves flee chance: base 50% + 5% per Agility above 5
          const agiBonus = Math.max(0, special.A - 5) * 5;
          // Multiply before dividing to preserve integer precision
          const fleeThreshold = Math.floor((50 + agiBonus) * 0xFFFFFFFF / 100);
          const fleeRoll = new Uint32Array(1);
          crypto.getRandomValues(fleeRoll);
          if (fleeRoll[0] < fleeThreshold) {
            msgDiv.textContent = "You escaped!";
            this.state = null;
            setTimeout(() => { this.updateUI(); window.Game?.pipboy?.setActivePanel?.('map'); }, 1200);
          } else {
            msgDiv.textContent = "Failed to escape! Enemy attacks!";
            setTimeout(async () => {
              const enemyRes = await this.enemyAttack();
              msgDiv.textContent = `${enemy.name || enemy.id} attacks for ${enemyRes.damage} damage!`;
              const end2 = this.checkBattleEnd();
              if (end2 === "LOSE") {
                this.state = null;
                this._showDeathOverlay();
              }
            }, 800);
          }
        };
      }
    }
  };

  Game.modules.battle = battleModule;
})();
>>>>>>> sync/main-reconcile-20260524-081701
