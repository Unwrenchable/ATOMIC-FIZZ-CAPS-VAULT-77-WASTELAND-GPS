// battle.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Unified Battle Module (Resurrected)
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

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
      this.state = {
        encounter,
        enemyHp: [encounter.enemies[0].hp || 20] // fallback
      };

      console.log("Battle started:", encounter);

      // If you have a Pip-Boy battle tab, update it here
      this.updateUI();
    },

    // --------------------------------------------------------
    // Player attack logic
    // --------------------------------------------------------
    fireEquippedWeapon() {
      const weapon = this.gs.player.equipped.weapon;
      if (!weapon) {
        return { success: false, reason: "NO_WEAPON" };
      }

      // Melee or infinite ammo
      if (!weapon.ammoType) {
        return { success: true, damage: weapon.damage };
      }

      // Spend ammo from gameState.inventory.ammo (no separate inventory module)
      const ok = this._spendAmmo(weapon.ammoType, weapon.ammoPerShot || 1);

      if (!ok) {
        return { success: false, reason: "NO_AMMO" };
      }

      return { success: true, damage: weapon.damage };
    },

    playerAttack() {
      if (!this.state) return;

      const res = this.fireEquippedWeapon();
      if (!res.success) return res;

      this.state.enemyHp[0] -= res.damage;
      this.updateUI();
      return res;
    },

    // --------------------------------------------------------
    // Enemy attack logic
    // --------------------------------------------------------
    enemyAttack() {
      if (!this.state) return;

      const enemy = this.state.encounter.enemies[0];
      const dmg = enemy.damage || 3;

      // Guard: ensure player.hp is initialized
      if (typeof this.gs.player.hp !== "number") {
        this.gs.player.hp = 100;
        this.gs.player.maxHp = 100;
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

      const enemyDead = this.state.enemyHp[0] <= 0;
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
        container.innerHTML = `<p>No active battle.</p>`;
        return;
      }

      const enemy = this.state.encounter.enemies[0];

      container.innerHTML = `
        <h2>Battle</h2>
        <p><strong>Enemy:</strong> ${enemy.id}</p>
        <p><strong>Enemy HP:</strong> ${this.state.enemyHp[0]}</p>
        <p><strong>Your HP:</strong> ${this.gs.player.hp}</p>
        <div id="battleOptions">
          <button id="battleAttackBtn">Attack</button>
          <button id="battleFleeBtn">Flee</button>
        </div>
        <div id="battleMsg" style="margin-top:10px;color:#ff0;"></div>
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
          msgDiv.textContent = `You hit the enemy for ${res.damage} damage!`;
          const end = this.checkBattleEnd();
          if (end === "WIN") {
            msgDiv.textContent = "Enemy defeated!";
            this.applyRewards(this.state.encounter);
            this.state = null;
            setTimeout(() => this.updateUI(), 1200);
            return;
          }
          setTimeout(() => {
            const enemyRes = this.enemyAttack();
            msgDiv.textContent = `Enemy attacks for ${enemyRes.damage} damage!`;
            const end2 = this.checkBattleEnd();
            if (end2 === "LOSE") {
              msgDiv.textContent = "You died!";
              this.state = null;
              setTimeout(() => this.updateUI(), 1200);
            }
          }, 800);
        };
      }
      if (fleeBtn) {
        fleeBtn.onclick = () => {
          // 50% chance to escape — use crypto random per project standard
          const fleeRoll = new Uint32Array(1);
          crypto.getRandomValues(fleeRoll);
          if (fleeRoll[0] < 0x80000000) {
            msgDiv.textContent = "You escaped!";
            this.state = null;
            setTimeout(() => this.updateUI(), 1200);
          } else {
            msgDiv.textContent = "Failed to escape! Enemy attacks!";
            setTimeout(() => {
              const enemyRes = this.enemyAttack();
              msgDiv.textContent = `Enemy attacks for ${enemyRes.damage} damage!`;
              const end2 = this.checkBattleEnd();
              if (end2 === "LOSE") {
                msgDiv.textContent = "You died!";
                this.state = null;
                setTimeout(() => this.updateUI(), 1200);
              }
            }, 800);
          }
        };
      }
    }
  };

  Game.modules.battle = battleModule;
})();
