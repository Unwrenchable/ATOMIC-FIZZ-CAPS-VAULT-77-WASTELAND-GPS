// inventory.js
// Inventory, equip/unequip, ammo logic, consumables

(function () {
  const gs = window.gameState;

  function addItemToInventory(item, amount = 1) {
    const inv = gs.inventory;

    switch (item.type) {
      case "weapon":
        inv.weapons.push({ ...item });
        break;
      case "ammo":
        {
          const existing = inv.ammo.find((a) => a.id === item.id);
          if (existing) existing.amount += amount;
          else inv.ammo.push({ ...item, amount });
        }
        break;
      case "armor":
        inv.armor.push({ ...item });
        break;
      case "consumable":
        inv.consumables.push({ ...item, amount });
        break;
      case "questItem":
        inv.questItems.push({ ...item });
        break;
      default:
        inv.misc.push({ ...item });
    }
  }

  function getAmmoCount(ammoId) {
    const ammo = gs.inventory.ammo.find((a) => a.id === ammoId);
    return ammo ? ammo.amount : 0;
  }

  function spendAmmo(ammoId, count) {
    const ammo = gs.inventory.ammo.find((a) => a.id === ammoId);
    if (!ammo || ammo.amount < count) return false;
    ammo.amount -= count;
    return true;
  }

  function equipWeapon(weaponId) {
    const w = gs.inventory.weapons.find((w) => w.id === weaponId);
    if (!w) return false;
    gs.player.equipped.weapon = w;
    return true;
  }

  function equipArmor(armorId) {
    const a = gs.inventory.armor.find((a) => a.id === armorId);
    if (!a) return false;
    gs.player.equipped.armor = a;
    return true;
  }

  function useConsumable(consumableId) {
    const inv = gs.inventory;
    const i = inv.consumables.findIndex((c) => c.id === consumableId);
    if (i === -1) return false;

    const c = inv.consumables[i];
    if (c.heal) {
      gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + c.heal);
    }

    c.amount -= 1;
    if (c.amount <= 0) inv.consumables.splice(i, 1);
    return true;
  }

  // Expose
  window.inventory = {
    addItemToInventory,
    getAmmoCount,
    spendAmmo,
    equipWeapon,
    equipArmor,
    useConsumable,
  };
})();
