window.Game = window.Game || {};
Game.player = Game.player || {};
Game.player.equipped = Game.player.equipped || {};

// SAFE: unified function for equipping an item
Game.equipItem = function (item) {
  if (!item) return;

  // Equip by type
  if (item.type === "weapon") {
    Game.player.equipped.weapon = item;
    // QUEST HOOK: Wake Up → equip_weapon
    Game.quests?.completeObjective("wake_up", "equip_weapon");
  } else if (item.type === "armor") {
    Game.player.equipped.armor = item;
    // QUEST HOOK: Wake Up → equip_armor
    Game.quests?.completeObjective("wake_up", "equip_armor");
  } else {
    Game.player.equipped.misc = item;
  }

  // Optional: trigger UI refresh if needed
  if (Game.hooks?.onInventoryUpdated) {
    Game.hooks.onInventoryUpdated();
  }
};
