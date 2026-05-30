// inventory-ui.js — Pocket-Boy ITEMS panel with category tabs + Fallout-style EQUIP screen

window.Game = window.Game || {};
Game.ui = Game.ui || {};

// BUG FIX: escapeHtml helper to prevent XSS when inserting item data into innerHTML.
// Item names, stats, and IDs come from game data and could contain HTML if tampered with.
function escapeHtml(str) { // eslint-disable-line no-unused-vars
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Fallout-style equipment slots displayed in the EQUIP tab (paperdoll order)
const EQUIP_SLOTS = [
  { key: "weapon", label: "WEAPON", icon: "🔫" },
  { key: "head",   label: "HEAD",   icon: "⛑" },
  { key: "chest",  label: "CHEST",  icon: "🦺" },
  { key: "arms",   label: "ARMS",   icon: "🥊" },
  { key: "legs",   label: "LEGS",   icon: "👖" },
  { key: "aid",    label: "AID",    icon: "💉" },
];

Game.ui.renderInventory = function () {
  Game.quests?.completeObjective("wake_up", "open_inventory");

  const body = document.getElementById("inventoryList");
  const tabs = document.getElementById("inventoryTabs");
  if (!body || !tabs) return;

  // Get items from PlayerState if available, otherwise fallback
  let items;
  if (Game.modules?.PlayerState?.getInventory) {
    items = Game.modules.PlayerState.getInventory();
  } else {
    items = Game.player.inventory || [];
  }

  // Get equipped items (prefer PlayerState, fall back to Game.player.equipped)
  const equipped = (Game.modules?.PlayerState?.getState?.()?.equipped) || Game.player.equipped || {};

  // Group items by type.
  // Quest-type items are intentionally excluded here — they belong in the QUEST
  // panel (quest-ui.js) and must not pollute the ITEMS tab.
  const groups = {
    weapon: [],
    armor: [],
    consumable: [],
    ammo: [],
    tool: [],
    junk: [],
    key: [],
    note: [],
    holotape: []
  };

  items.forEach(item => {
    // Skip quest items entirely — they are rendered in the QUEST panel.
    if (item.type === "quest" || item.type === "questItem") return;
    if (groups[item.type]) groups[item.type].push(item);
  });

  // ── Build tab buttons ──────────────────────────────────────────
  tabs.innerHTML = "";

  // EQUIP tab first (Pocket-Boy paperdoll)
  const equipTab = document.createElement("div");
  equipTab.className = "inv-tab active";
  equipTab.innerText = "EQUIP";
  equipTab.onclick = () => { setActiveTab(equipTab); renderEquipScreen(); };
  tabs.appendChild(equipTab);

  // Item category tabs — show all categories, even if empty
  const categoryOrder = ['weapon', 'armor', 'consumable', 'ammo', 'tool', 'junk', 'key', 'note', 'holotape'];
  categoryOrder.forEach(type => {
    const btn = document.createElement("div");
    btn.className = "inv-tab";
    btn.innerText = type.toUpperCase();
    btn.onclick = () => { setActiveTab(btn); renderCategory(type); };
    tabs.appendChild(btn);
  });

  function setActiveTab(activeBtn) {
    tabs.querySelectorAll(".inv-tab").forEach(t => t.classList.remove("active"));
    activeBtn.classList.add("active");
  }

  // Default view: EQUIP screen
  renderEquipScreen();

  // ── EQUIP SCREEN (Fallout paperdoll) ──────────────────────────
  function renderEquipScreen() {
    body.innerHTML = "";

    // Calculate carry weight
    const totalWeight = Game.modules?.PlayerState?.getTotalCarryWeight?.() || 0;
    const maxWeight = Game.modules?.PlayerState?.getMaxCarryWeight?.() || 150;
    const isOverWeight = totalWeight > maxWeight;
    const weightClass = isOverWeight ? "weight-over-limit" : "weight-normal";

    const header = document.createElement("div");
    header.className = "equip-screen-header";
    header.innerHTML = `
      <div class="equip-screen-title">[ EQUIPPED ITEMS ]</div>
      <div class="carry-weight-display ${weightClass}">
        CARRY WEIGHT: ${totalWeight.toFixed(1)} / ${maxWeight} lbs
      </div>
    `;
    body.appendChild(header);

    EQUIP_SLOTS.forEach(function(slotDef) {
      const item = equipped[slotDef.key] || null;
      const row = document.createElement("div");
      row.className = "equip-slot-row" + (item ? " equip-slot-filled" : "");

      const slotLabel = document.createElement("div");
      slotLabel.className = "equip-slot-label";
      slotLabel.textContent = slotDef.icon + " " + slotDef.label;

      const slotItem = document.createElement("div");
      slotItem.className = "equip-slot-item";
      slotItem.textContent = item ? item.name : "---";

      const slotBtn = document.createElement("button");
      if (item) {
        slotBtn.className = "unequip-btn";
        slotBtn.textContent = "REMOVE";
        slotBtn.addEventListener("click", function() {
          if (Game.modules?.PlayerState?.unequipItem) Game.modules.PlayerState.unequipItem(slotDef.key);
          else if (Game.unequipItem) Game.unequipItem(slotDef.key);
          setTimeout(function() { Game.ui.renderInventory(); }, 80);
        });
      } else {
        slotBtn.className = "equip-slot-empty-btn";
        slotBtn.textContent = "EMPTY";
        slotBtn.disabled = true;
      }

      row.appendChild(slotLabel);
      row.appendChild(slotItem);
      row.appendChild(slotBtn);
      body.appendChild(row);
    });

    // Show active set bonuses
    const setBonusesDiv = document.createElement("div");
    setBonusesDiv.className = "set-bonuses-section";
    setBonusesDiv.innerHTML = `<div class="set-bonuses-title">[ ACTIVE SET BONUSES ]</div>`;
    
    if (Game.modules?.PlayerState?.getActiveSetBonuses) {
      Game.modules.PlayerState.getActiveSetBonuses().then(bonuses => {
        if (bonuses.damageResist > 0) {
          const bonusDiv = document.createElement("div");
          bonusDiv.className = "set-bonus-item";
          bonusDiv.textContent = `Damage Resistance: +${bonuses.damageResist}`;
          setBonusesDiv.appendChild(bonusDiv);
        } else {
          const noBonusDiv = document.createElement("div");
          noBonusDiv.className = "set-bonuses-none";
          noBonusDiv.textContent = "No active set bonuses";
          setBonusesDiv.appendChild(noBonusDiv);
        }
      }).catch(e => {
        console.warn('[InventoryUI] Error getting set bonuses:', e);
        const errorDiv = document.createElement("div");
        errorDiv.className = "set-bonuses-error";
        errorDiv.textContent = "Error loading set bonuses";
        setBonusesDiv.appendChild(errorDiv);
      });
    } else {
      const noBonusDiv = document.createElement("div");
      noBonusDiv.className = "set-bonuses-none";
      noBonusDiv.textContent = "No active set bonuses";
      setBonusesDiv.appendChild(noBonusDiv);
    }
    
    body.appendChild(setBonusesDiv);

    const hint = document.createElement("div");
    hint.className = "equip-screen-hint";
    hint.textContent = "Browse WEAPON / ARMOR / CONSUMABLE tabs to equip items.";
    body.appendChild(hint);
  }

  // ── CATEGORY VIEW ─────────────────────────────────────────────
  function renderCategory(type) {
    const list = groups[type];
    body.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      empty.textContent = "No " + type + " items in inventory.";
      body.appendChild(empty);
      return;
    }

    list.forEach(function(item) {
      const div = document.createElement("div");
      div.className = "inventory-item";

      let statsText;
      let isEquipped = false;
      let itemSlot;
      const canEquip = (item.type === "weapon" || item.type === "armor" || item.type === "consumable");

      if (item.type === "weapon") {
        statsText = "DMG: " + (item.damage != null ? item.damage : "N/A") +
                    " \u2022 " + (item.category ? item.category.toUpperCase() : "UNKNOWN");
        isEquipped = !!(equipped.weapon && equipped.weapon.id === item.id);
      } else if (item.type === "armor") {
        // Use item.slot (head/chest/arms/legs) for the correct equipment slot
        itemSlot = item.slot || "chest";
        statsText = "DR: " + (item.armor != null ? item.armor : "N/A") +
                    " \u2022 SLOT: " + itemSlot.toUpperCase();
        isEquipped = !!(equipped[itemSlot] && equipped[itemSlot].id === item.id);
      } else if (item.type === "consumable") {
        let addictionText = "";
        if (item.tags && item.tags.includes("chem")) {
          const addiction = Game.modules?.PlayerState?.getAddiction?.() || {};
          const chemType = item.id;
          const level = addiction[chemType] || 0;
          addictionText = level > 0 ? ` \u2022 ADDICTION: ${level}%` : "";
          if (level >= 20) addictionText += " [WITHDRAWAL]";
        }
        statsText = (item.heal ? "HEAL: +" + item.heal + " HP" : (item.description ? item.description.slice(0, 30) : "")) + addictionText;
        isEquipped = !!(equipped.aid && equipped.aid.id === item.id);
      } else {
        // BUG FIX: use nullish coalescing so that a quantity of 0 is preserved
        // (not silently promoted to 1 by the || operator treating 0 as falsy).
        const qty = item.quantity != null ? item.quantity : (item.amount != null ? item.amount : 1);
        statsText = qty > 1 ? "QTY: " + qty
                            : (item.description ? item.description.slice(0, 40) : "");
      }

      const nameEl = document.createElement("div");
      nameEl.className = "inv-name";
      nameEl.textContent = item.name + (isEquipped ? " [EQUIPPED]" : "");

      const metaEl = document.createElement("div");
      metaEl.className = "inv-meta";
      metaEl.textContent = statsText;

      div.appendChild(nameEl);
      div.appendChild(metaEl);

      if (canEquip) {
        const btn = document.createElement("button");
        btn.className = isEquipped ? "unequip-btn" : "equip-btn";
        btn.dataset.itemId = item.id;
        btn.textContent = isEquipped ? "UNEQUIP" : "EQUIP";
        btn.addEventListener("click", function() {
          if (btn.classList.contains("unequip-btn")) {
            const slot = item.type === "weapon" ? "weapon"
                       : item.type === "consumable" ? "aid"
                       : (item.slot || "chest");
            if (Game.modules?.PlayerState?.unequipItem) Game.modules.PlayerState.unequipItem(slot);
            else if (Game.unequipItem) Game.unequipItem(slot);
          } else {
            if (Game.modules?.PlayerState?.equipItem) Game.modules.PlayerState.equipItem(item);
            else if (Game.equipItem) Game.equipItem(item);
          }
          setTimeout(function() { Game.ui.renderInventory(); }, 80);
        });
        div.appendChild(btn);
      }

      // Add USE button for consumables
      if (item.type === "consumable") {
        const useBtn = document.createElement("button");
        useBtn.className = "use-btn";
        useBtn.dataset.itemId = item.id;
        useBtn.textContent = "USE";
        useBtn.addEventListener("click", function() {
          if (Game.modules?.PlayerState?.useItem) {
            Game.modules.PlayerState.useItem(item);
            setTimeout(function() { Game.ui.renderInventory(); }, 80);
          }
        });
        div.appendChild(useBtn);
      }

      body.appendChild(div);
    });
  }
};

// Hook
if (!Game.hooks) Game.hooks = {};
Game.hooks.onInventoryUpdated = function () {
  Game.ui.renderInventory();
};
