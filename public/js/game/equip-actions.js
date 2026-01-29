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
    // Note: equip_armor objective removed - player starts with jumpsuit equipped
  } else {
    Game.player.equipped.misc = item;
  }

  // Save equipped items to localStorage for persistence
  // Use quests module method if available, otherwise save directly
  if (Game.modules?.quests?.saveEquippedItems) {
    Game.modules.quests.saveEquippedItems();
  } else if (Game.quests?.saveEquippedItems) {
    Game.quests.saveEquippedItems();
  } else {
    // Fallback direct save
    try {
      localStorage.setItem("afc_equipped_items", JSON.stringify(Game.player.equipped));
    } catch (e) {
      console.warn("[equip] Failed to save equipped items:", e);
    }
  }

  // Optional: trigger UI refresh if needed
  if (Game.hooks?.onInventoryUpdated) {
    Game.hooks.onInventoryUpdated();
  }
};
