// public/js/modules/inventory-loader.js
// Unified loader for all item categories in /public/data/items/

window.Game = window.Game || {};
window.Game.player = window.Game.player || {};
window.Game.player.items = window.Game.player.items || [];

window.gameState = window.gameState || {};
window.gameState.inventory = window.gameState.inventory || {
  weapons: [],
  ammo: [],
  armor: [],
  consumables: [],
  questItems: [],
  misc: []
};

(async function loadAllItems() {
  const basePath = "/data/items/";

  const files = [
    "ammo.json",
    "junk.json",
    "consumables.json",
    "holotapes.json",
    "notes.json",
    "keys.json",
    "quest_items.json",
    "crafting.json",
    "tools.json",
    "world_logic.json"
  ];

  const allItems = [];

  for (const file of files) {
    try {
      const res = await fetch(basePath + file);
      if (!res.ok) continue;

      const data = await res.json();
      if (Array.isArray(data)) {
        allItems.push(...data);
      }
    } catch (err) {
      console.warn("[inventory-loader] Failed to load", file, err);
    }
  }

  // Populate Game.player.items for Pip‑Boy UI
  Game.player.items = allItems;

  // Populate legacy inventory structure
  const inv = window.gameState.inventory;

  allItems.forEach(item => {
    switch (item.type) {
      case "weapon":
        inv.weapons.push(item);
        break;
      case "ammo":
        inv.ammo.push({ ...item, amount: item.amount || 0 });
        break;
      case "armor":
        inv.armor.push(item);
        break;
      case "consumable":
        inv.consumables.push({ ...item, amount: item.amount || 1 });
        break;
      case "questItem":
        inv.questItems.push(item);
        break;
      default:
        inv.misc.push(item);
    }
  });

  console.log("[inventory-loader] Loaded", allItems.length, "items");

  // Trigger UI update if hook exists
  if (Game.hooks && Game.hooks.onInventoryUpdated) {
    Game.hooks.onInventoryUpdated();
  }
})();
