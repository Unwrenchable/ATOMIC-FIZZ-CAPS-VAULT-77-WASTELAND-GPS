// inventory-ui.js — Pip‑Boy ITEMS panel with category tabs

window.Game = window.Game || {};
Game.ui = Game.ui || {};

Game.ui.renderInventory = function () {
  Game.quests?.completeObjective("wake_up", "open_inventory");

  const body = document.getElementById("inventoryList");
  const tabs = document.getElementById("inventoryTabs");
  if (!body || !tabs) return;

  // FIX: Only show what the player actually owns
  const items = Game.player.inventory || [];

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

      if (item.type === "weapon") {
        stats = `DMG: ${item.damage} • ${item.category.toUpperCase()}`;
      } else if (item.type === "armor") {
        stats = `ARMOR: ${item.armor} • SLOT: ${item.slot.toUpperCase()}`;
      }

      // ⭐ ADDED: Equip button
      div.innerHTML = `
        <div class="inv-name">${item.name}</div>
        <div class="inv-meta">${stats}</div>
        <button class="equip-btn" data-item-id="${item.id}">EQUIP</button>
      `;

      body.appendChild(div);
    });

    // ⭐ ADDED: Equip button handler
    document.querySelectorAll(".equip-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-item-id");
        const item = Game.player.inventory.find(i => i.id === id);
        if (item) {
          Game.equipItem(item);
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
