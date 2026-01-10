// inventory-ui.js — Pip‑Boy ITEMS panel renderer (New Vegas style)

window.Game = window.Game || {};
Game.ui = Game.ui || {};

/**
 * Renders the player's inventory into the ITEMS panel.
 * Expects:
 *   Game.player.items = [
 *     { name: "Laser Pistol", rarity: "RARE", level: 3 },
 *     { name: "Stimpak", rarity: "COMMON", level: 1 }
 *   ]
 */
Game.ui.renderInventory = function () {
  const body = document.getElementById("inventoryList");
  if (!body) return;

  const items = (Game.player && Game.player.items) || [];

  // No items
  if (!items.length) {
    body.innerHTML = "<div>No items in stash.</div>";
    return;
  }

  // Render items
  body.innerHTML = "";
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "inventory-item";

    div.innerHTML = `
      <div class="inv-name">${item.name}</div>
      <div class="inv-meta">
        RARITY: ${item.rarity || "COMMON"}
        ${item.level ? ` • LVL ${item.level}` : ""}
      </div>
    `;

    body.appendChild(div);
  });
};

// Optional: auto-render when inventory changes
if (!Game.hooks) Game.hooks = {};
Game.hooks.onInventoryUpdated = function () {
  Game.ui.renderInventory();
};
