# 🎒 Inventory System

The Inventory System manages the player's items, equipment, and item operations.

---

## Overview

The inventory UI module (`inventory-ui.js`) renders the player's inventory with category tabs and equip functionality.

---

## Features

- **Category Tabs**: Weapons, Armor, Consumables, Ammo, etc.
- **Item Display**: Stats and properties shown
- **Equip System**: Equip items directly from inventory
- **Quest Integration**: Opening inventory completes quest objectives

---

## Item Categories

| Category | Key | Items |
|----------|-----|-------|
| Weapons | `weapon` | Guns, melee weapons |
| Armor | `armor` | Protective gear |
| Consumables | `consumable` | Stimpaks, food, drinks |
| Ammo | `ammo` | Ammunition |
| Tools | `tool` | Bobby pins, repair kits |
| Junk | `junk` | Scrap materials |
| Keys | `key` | Access cards, keys |
| Notes | `note` | Written documents |
| Holotapes | `holotape` | Audio recordings |
| Quest | `quest` | Quest-related items |

---

## Functions

### Rendering

#### `Game.ui.renderInventory()`
Renders the inventory UI.

```javascript
Game.ui.renderInventory();
```

**Process:**
1. Gets player's inventory
2. Groups items by type
3. Creates category tabs
4. Renders default category (weapons)

---

### Item Display

For each item, shows:

**Weapons:**
```
[Item Name]
DMG: 25 • RIFLE
[EQUIP]
```

**Armor:**
```
[Item Name]
ARMOR: 15 • SLOT: CHEST
[EQUIP]
```

---

## Tab System

```html
<div id="inventoryTabs">
  <div class="inv-tab" onclick="renderCategory('weapon')">WEAPON</div>
  <div class="inv-tab" onclick="renderCategory('armor')">ARMOR</div>
  <div class="inv-tab" onclick="renderCategory('consumable')">CONSUMABLE</div>
  <!-- ... more tabs ... -->
</div>
```

---

## Equip Functionality

```javascript
// Equip button handler
document.querySelectorAll(".equip-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const id = btn.getAttribute("data-item-id");
    const item = Game.player.inventory.find(i => i.id === id);
    if (item) {
      Game.equipItem(item);
    }
  });
});
```

---

## Data Structure

### Player Inventory
```javascript
Game.player.inventory = [
  { id: "hunting_rifle", name: "Hunting Rifle", type: "weapon", damage: 25, category: "rifle" },
  { id: "leather_armor", name: "Leather Armor", type: "armor", armor: 15, slot: "chest" },
  { id: "stimpak", name: "Stimpak", type: "consumable", quantity: 3 }
];
```

### Item Properties
| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Display name |
| `type` | string | Item category |
| `damage` | number | Weapon damage |
| `armor` | number | Armor value |
| `slot` | string | Equipment slot |
| `category` | string | Weapon category |
| `quantity` | number | Stack count |

---

## Quest Integration

Opening inventory completes Wake Up objective:

```javascript
Game.quests?.completeObjective("wake_up", "open_inventory");
```

---

## Hooks

### `Game.hooks.onInventoryUpdated()`
Called when inventory changes.

```javascript
Game.hooks.onInventoryUpdated = function() {
  Game.ui.renderInventory();
};
```

---

## UI Elements

### Inventory List
```html
<div id="inventoryList">
  <div class="inventory-item">
    <div class="inv-name">Hunting Rifle</div>
    <div class="inv-meta">DMG: 25 • RIFLE</div>
    <button class="equip-btn" data-item-id="hunting_rifle">EQUIP</button>
  </div>
</div>
```

### Tab Buttons
```html
<div id="inventoryTabs">
  <div class="inv-tab">WEAPON</div>
  <div class="inv-tab">ARMOR</div>
  <!-- ... -->
</div>
```

---

## Example: Displaying Items

```javascript
// Render inventory
Game.ui.renderInventory();

// User clicks ARMOR tab
renderCategory("armor");

// Shows armor items:
// - Leather Armor | ARMOR: 15 • SLOT: CHEST [EQUIP]
// - Metal Helmet | ARMOR: 8 • SLOT: HEAD [EQUIP]
```

---

## Empty State

When category has no items:

```html
<div>No items in this category.</div>
```

---

# 🛡️ Equipment System

Handles equipping items to slots.

---

## Equipment Slots

| Slot | Item Types |
|------|------------|
| `weapon` | Guns, melee weapons |
| `helmet` | Head armor |
| `chest` | Body armor |
| `legs` | Leg armor |
| `accessory` | Rings, trinkets |

---

## Functions

### `Game.equipItem(item)`
Equips an item to appropriate slot.

```javascript
Game.equipItem({
  id: "hunting_rifle",
  type: "weapon",
  damage: 25
});
```

---

## Equipped Items

Stored in game state:

```javascript
gameState.player.equipped = {
  weapon: { id: "hunting_rifle", damage: 25 },
  helmet: null,
  chest: { id: "leather_armor", armor: 15 },
  legs: null,
  accessory: null
};
```

---

## Integration with Combat

Battle system uses equipped weapon:

```javascript
const weapon = gameState.player.equipped.weapon;
if (!weapon) {
  return { success: false, reason: "NO_WEAPON" };
}
const damage = weapon.damage;
```
