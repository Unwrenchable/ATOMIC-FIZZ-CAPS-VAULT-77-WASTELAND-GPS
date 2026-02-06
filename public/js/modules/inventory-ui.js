// inventory-ui.js — Pip‑Boy ITEMS panel with category tabs

window.Game = window.Game || {};
Game.ui = Game.ui || {};

Game.ui.renderInventory = function () {
  Game.quests?.completeObjective("wake_up", "open_inventory");

  const body = document.getElementById("inventoryList");
  const tabs = document.getElementById("inventoryTabs");
  if (!body || !tabs) return;

  // Get items from PlayerState if available, otherwise fallback
  let items = [];
  if (Game.modules?.PlayerState?.getInventory) {
    items = Game.modules.PlayerState.getInventory();
  } else {
    items = Game.player.inventory || [];
  }

  // Get equipped items
  const equipped = Game.player.equipped || {};

  // Group items by type
  const groups = {
    weapon: [],
    armor: [],
    consumable: [],
    ammo: [],
    tool: [],
    junk: [],
    key: [],
    note: [],
    holotape: [],
    quest: []
  };

  items.forEach(item => {
    if (groups[item.type]) groups[item.type].push(item);
  });

  // Build tab buttons
  tabs.innerHTML = "";
  Object.keys(groups).forEach(type => {
    const btn = document.createElement("div");
    btn.className = "inv-tab";
    btn.innerText = type.toUpperCase();
    btn.onclick = () => renderCategory(type);
    tabs.appendChild(btn);
  });

  // Default: show weapons
  renderCategory("weapon");

  function renderCategory(type) {
    const list = groups[type];
    body.innerHTML = "";

    if (!list.length) {
      body.innerHTML = "<div>No items in this category.</div>";
      return;
    }

    list.forEach(item => {
      const div = document.createElement("div");
      div.className = "inventory-item";

      let stats = "";
      let isEquipped = false;

      if (item.type === "weapon") {
        stats = `DMG: ${item.damage || 'N/A'} • ${item.category?.toUpperCase() || 'UNKNOWN'}`;
        isEquipped = equipped.weapon && equipped.weapon.id === item.id;
      } else if (item.type === "armor") {
        stats = `ARMOR: ${item.armor || 'N/A'} • SLOT: ${item.slot?.toUpperCase() || 'UNKNOWN'}`;
        isEquipped = equipped.armor && equipped.armor.id === item.id;
      }

      // Show equipped status
      const equippedText = isEquipped ? " [EQUIPPED]" : "";
      
      // Equip/Unequip button
      const buttonText = isEquipped ? "UNEQUIP" : "EQUIP";
      const buttonClass = isEquipped ? "unequip-btn" : "equip-btn";

      div.innerHTML = `
        <div class="inv-name">${item.name}${equippedText}</div>
        <div class="inv-meta">${stats}</div>
        <button class="${buttonClass}" data-item-id="${item.id}">${buttonText}</button>
      `;

      body.appendChild(div);
    });

    // Equip/Unequip button handler
    document.querySelectorAll(".equip-btn, .unequip-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-item-id");
        const item = items.find(i => i.id === id);
        if (item) {
          if (btn.classList.contains("unequip-btn")) {
            Game.unequipItem(item.type === "weapon" ? "weapon" : "armor");
          } else {
            Game.equipItem(item);
          }
          // Re-render after equip/unequip
          setTimeout(() => Game.ui.renderInventory(), 100);
        }
      });
    });
  }
};

// Hook
if (!Game.hooks) Game.hooks = {};
Game.hooks.onInventoryUpdated = function () {
  Game.ui.renderInventory();
};
