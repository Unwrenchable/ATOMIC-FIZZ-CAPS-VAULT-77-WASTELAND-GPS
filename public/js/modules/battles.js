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
    // Spend ammo from gameState inventory (no separate inventory module)
    // --------------------------------------------------------
    _spendAmmo(ammoType, amount) {
      const inv = this.gs && this.gs.inventory;
      if (!inv || !Array.isArray(inv.ammo)) return false;

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

      this.state = {
        encounter,
        // BUG FIX: was only tracking enemies[0] HP. Now tracks HP for all enemies
        // so multi-enemy encounters don't silently ignore enemies after the first.
        enemyHp: encounter.enemies.map(e => (typeof e.hp === 'number' ? e.hp : 20)),
        // BUG-004: track which enemy is currently being targeted
        activeEnemyIndex: 0
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
      if (!equippedWeapon) {
        return { success: false, reason: "NO_WEAPON" };
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

      const res = this.fireEquippedWeapon();
      if (!res.success) return res;

      // BUG-004: damage the active enemy, not always index 0
      const idx = this.state.activeEnemyIndex ?? 0;
      this.state.enemyHp[idx] -= res.damage;

      // If the active enemy just died, advance to the next live enemy (search from 0)
      if (this.state.enemyHp[idx] <= 0) {
        const nextIdx = this.state.enemyHp.findIndex(hp => hp > 0);
        this.state.activeEnemyIndex = nextIdx !== -1 ? nextIdx : idx;
      }

      this.updateUI();
      return res;
    },

    // --------------------------------------------------------
    // Enemy attack logic (Endurance reduces damage; armor subtracts flat DR)
    // --------------------------------------------------------
    enemyAttack() {
      if (!this.state) return;

      const idx = this.state.activeEnemyIndex ?? 0;
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

      this.gs.player.hp -= dmg;
      if (this.gs.player.hp < 0) this.gs.player.hp = 0;

      this.updateUI();
      return { success: true, damage: dmg };
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
            <button id="battleFleeBtn" class="pipboy-button">🏃 FLEE</button>
          </div>
          <div id="battleMsg" class="battle-msg"></div>
        </div>
      `;

      const attackBtn = document.getElementById("battleAttackBtn");
      const fleeBtn = document.getElementById("battleFleeBtn");
      const msgDiv = document.getElementById("battleMsg");

      if (attackBtn) {
        attackBtn.onclick = () => {
          const res = this.playerAttack();
          if (!res.success) {
            msgDiv.textContent = res.reason === "NO_AMMO" ? "Out of ammo!" : "No weapon equipped! Try to flee!";
            return;
          }
          msgDiv.textContent = `You hit ${enemy.name || enemy.id} for ${res.damage} damage!`;
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
            setTimeout(() => this.updateUI(), 1200);
            window.dispatchEvent(new CustomEvent('battleEnd', { detail: { result: 'WIN' } }));
            return;
          }
          // Disable attack + flee buttons during enemy turn to prevent post-death input window
          attackBtn.disabled = true;
          if (fleeBtn) fleeBtn.disabled = true;
          setTimeout(() => {
            const enemyRes = this.enemyAttack();
            msgDiv.textContent = `${enemy.name || enemy.id} attacks for ${enemyRes.damage} damage!`;
            const end2 = this.checkBattleEnd();
            if (end2 === "LOSE") {
              msgDiv.textContent = "You have been defeated. Respawning...";
              this.state = null;
              // BUG-003: Restore HP to 30% and apply caps penalty on death
              this._applyRespawnPenalty();
              setTimeout(() => this.updateUI(), 1500);
              window.dispatchEvent(new CustomEvent('battleEnd', { detail: { result: 'LOSE' } }));
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
            setTimeout(() => this.updateUI(), 1200);
          } else {
            msgDiv.textContent = "Failed to escape! Enemy attacks!";
            setTimeout(() => {
              const enemyRes = this.enemyAttack();
              msgDiv.textContent = `${enemy.name || enemy.id} attacks for ${enemyRes.damage} damage!`;
              const end2 = this.checkBattleEnd();
              if (end2 === "LOSE") {
                msgDiv.textContent = "You have been defeated. Respawning...";
                this.state = null;
                // BUG-003: Restore HP to 30% and apply caps penalty on death
                this._applyRespawnPenalty();
                setTimeout(() => this.updateUI(), 1500);
                window.dispatchEvent(new CustomEvent('battleEnd', { detail: { result: 'LOSE' } }));
              }
            }, 800);
          }
        };
      }
    }
  };

  Game.modules.battle = battleModule;
})();
