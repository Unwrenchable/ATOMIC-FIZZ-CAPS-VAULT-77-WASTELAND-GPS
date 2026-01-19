window.Game = window.Game || {};
Game.player = Game.player || {};
Game.player.inventory = Game.player.inventory || [];

// SAFE: unified function for giving the player an item
Game.giveItem = function (item) {
  if (!item) return;

  // Add to inventory
  Game.player.inventory.push(item);

  // QUEST HOOK: Wake Up → pick_item
  Game.quests?.completeObjective("wake_up", "pick_item");

  // Optional: trigger UI refresh if needed
  if (Game.hooks?.onInventoryUpdated) {
    Game.hooks.onInventoryUpdated();
  }
};
