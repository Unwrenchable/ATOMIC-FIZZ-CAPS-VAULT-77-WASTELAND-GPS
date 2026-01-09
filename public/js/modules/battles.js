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

      const ok = Game.modules.inventory.spendAmmo(
        weapon.ammoType,
        weapon.ammoPerShot || 1
      );

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
    // Rewards
    // --------------------------------------------------------
    applyRewards(encounter) {
      const r = encounter.rewards || {};
      this.gs.player.xp += r.xp || 0;
      this.gs.player.caps += r.caps || 0;

      (r.items || []).forEach((itemId) => {
        const item =
          ITEMS_DB.weapons.find((x) => x.id === itemId) ||
          ITEMS_DB.ammo.find((x) => x.id === itemId) ||
          ITEMS_DB.armor.find((x) => x.id === itemId) ||
          ITEMS_DB.consumables.find((x) => x.id === itemId) ||
          ITEMS_DB.questItems.find((x) => x.id === itemId);

        if (item) Game.modules.inventory.addItem(item, 1);
      });
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

        <button id="battleAttackBtn">Attack</button>
      `;

      const btn = document.getElementById("battleAttackBtn");
      if (btn) {
        btn.onclick = () => {
          const res = this.playerAttack();
          if (!res.success) {
            alert(res.reason === "NO_AMMO" ? "Out of ammo!" : "No weapon equipped!");
            return;
          }

          const end = this.checkBattleEnd();
          if (end === "WIN") {
            alert("Enemy defeated!");
            this.applyRewards(this.state.encounter);
            this.state = null;
            this.updateUI();
            return;
          }

          this.enemyAttack();

          const end2 = this.checkBattleEnd();
          if (end2 === "LOSE") {
            alert("You died!");
            this.state = null;
            this.updateUI();
          }
        };
      }
    }
  };

  Game.modules.battle = battleModule;
})();
