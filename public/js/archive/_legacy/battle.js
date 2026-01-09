// battle.js
// Simple ammo-aware battle loop

(function () {
  const gs = window.gameState;

  function fireEquippedWeapon() {
    const weapon = gs.player.equipped.weapon;
    if (!weapon) {
      return { success: false, reason: "NO_WEAPON" };
    }

    if (!weapon.ammoType) {
      return { success: true, damage: weapon.damage };
    }

    const ok = window.inventory.spendAmmo(
      weapon.ammoType,
      weapon.ammoPerShot || 1
    );

    if (!ok) {
      return { success: false, reason: "NO_AMMO" };
    }

    return { success: true, damage: weapon.damage };
  }

  function playerAttack(battleState) {
    const res = fireEquippedWeapon();
    if (!res.success) return res;

    battleState.enemyHp[0] -= res.damage;
    return res;
  }

  function enemyAttack(battleState) {
    const enemy = battleState.encounter.enemies[0];
    const dmg = enemy.damage;
    gs.player.hp -= dmg;
    if (gs.player.hp < 0) gs.player.hp = 0;
    return { success: true, damage: dmg };
  }

  function checkBattleEnd(battleState) {
    const enemyDead = battleState.enemyHp[0] <= 0;
    const playerDead = gs.player.hp <= 0;
    if (enemyDead) return "WIN";
    if (playerDead) return "LOSE";
    return null;
  }

  function applyRewards(encounter) {
    const r = encounter.rewards || {};
    gs.player.xp += r.xp || 0;
    gs.player.caps += r.caps || 0;

    (r.items || []).forEach((itemId) => {
      const item =
        ITEMS_DB.weapons.find((x) => x.id === itemId) ||
        ITEMS_DB.ammo.find((x) => x.id === itemId) ||
        ITEMS_DB.armor.find((x) => x.id === itemId) ||
        ITEMS_DB.consumables.find((x) => x.id === itemId) ||
        ITEMS_DB.questItems.find((x) => x.id === itemId);
      if (item) window.inventory.addItemToInventory(item, 1);
    });
  }

  function startBattle(battleState) {
    // Hook into UI as you like.
    // For now this just logs; your Pip-Boy battle UI can call playerAttack/enemyAttack etc.
    console.log("Battle started:", battleState.encounter.id);
  }

  window.battle = {
    startBattle,
    playerAttack,
    enemyAttack,
    checkBattleEnd,
    applyRewards,
  };
})();

