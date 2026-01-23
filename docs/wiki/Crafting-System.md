# 🛠️ Crafting System

The Crafting System allows players to create items using collected components and discovered recipes.

---

## Overview

The crafting module (`crafting.js`) enables players to combine inventory items into new equipment, consumables, and gear.

---

## Features

- Recipe-based crafting
- Component consumption
- Stat rolling on crafted items
- Variant system for unique items
- Integration with mintables and inventory

---

## Functions

### Initialization

#### `Game.modules.crafting.init(gameState)`
Initializes the crafting module.

```javascript
Game.modules.crafting.init(window.gameState);
```

---

### Crafting Operations

#### `canCraft(recipeId)`
Checks if the player has all required ingredients.

```javascript
if (Game.modules.crafting.canCraft("recipe_stimpak")) {
  console.log("Can craft Stimpak!");
}
```

**Returns:** `boolean`

#### `craft(recipeId)`
Executes the crafting process.

```javascript
const item = Game.modules.crafting.craft("recipe_leather_armor");
// Returns crafted item or null if failed
```

**Process:**
1. Validates recipe exists
2. Checks all ingredients available
3. Consumes ingredients from inventory
4. Rolls stats for crafted item
5. May apply variant modifier
6. Adds to player inventory
7. Returns crafted item

---

### Ingredient Checking

#### `hasIngredient(req)`
Checks if player has the required ingredient quantity.

```javascript
const req = { id: "scrap_metal", type: "junk", amount: 3 };
if (Game.modules.crafting.hasIngredient(req)) {
  // Has enough scrap metal
}
```

**Checks across all inventory categories:**
- Weapons
- Armor
- Consumables
- Misc
- Quest Items
- Ammo

#### `consumeIngredient(req)`
Removes the required amount from inventory.

```javascript
Game.modules.crafting.consumeIngredient({ id: "leather", amount: 2 });
```

---

## Recipe Structure

Recipes define input materials and output items:

```javascript
{
  id: "recipe_stimpak",
  name: "Stimpak",
  inputs: [
    { id: "antiseptic", type: "junk", amount: 1 },
    { id: "blood_pack", type: "consumable", amount: 1 },
    { id: "steel", type: "junk", amount: 1 }
  ],
  outputId: "stimpak",
  outputAmount: 1
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique recipe identifier |
| `name` | string | Display name |
| `inputs` | array | Required ingredients |
| `outputId` | string | Mintable item ID to create |
| `outputAmount` | number | Quantity produced (default: 1) |

---

## Crafted Item Output

Crafted items include:

```javascript
{
  // Base item properties (from mintables)
  id: "leather_armor",
  name: "Leather Armor",
  type: "armor",
  
  // Rolled properties
  rolledStats: {
    armor: 12,
    weight: 8
  },
  
  // Variant (if rolled)
  variant: {
    modifier: "Sturdy",
    effect: "+2 armor"
  },
  
  // Crafting flag
  crafted: true
}
```

---

## Stat Rolling

Crafted items have randomized stats within ranges:

```javascript
// Base stats from mintable
baseStats: { armor: 10, weight: 10 }

// Roll ranges
rollRanges: { armor: [0, 5], weight: [-2, 2] }

// Final rolled stats could be:
// armor: 10 + 3 = 13
// weight: 10 - 1 = 9
```

---

## Variant System

30% chance to apply a variant modifier:

```javascript
variant: {
  modifier: "Reinforced",
  effect: "+3 armor",
  rarityBoost: "rare"  // Can upgrade rarity
}
```

Variants can:
- Add prefix to item name ("Reinforced Leather Armor")
- Apply special effects
- Boost minimum rarity

---

## Dependencies

The crafting system requires:

- `Game.modules.recipes` - Recipe definitions
- `Game.modules.mintables` - Item templates
- `Game.modules.inventory` - Adding crafted items

---

## Example Usage

```javascript
// Check if we can craft a Stimpak
if (Game.modules.crafting.canCraft("recipe_stimpak")) {
  
  // Craft the item
  const stimpak = Game.modules.crafting.craft("recipe_stimpak");
  
  if (stimpak) {
    console.log(`Crafted: ${stimpak.name}`);
    console.log(`Stats: HP restore ${stimpak.rolledStats.hpRestore}`);
    
    if (stimpak.variant) {
      console.log(`Variant: ${stimpak.variant.modifier}`);
    }
  }
} else {
  console.log("Missing ingredients!");
}
```

---

## Crafting Categories

### Weapons
- Pipe guns
- Melee weapons
- Explosives

### Armor
- Leather armor
- Metal armor
- Combat armor

### Consumables
- Stimpaks
- Rad-Away
- Food items

### Ammo
- Various calibers
- Energy cells

### Utility
- Lockpicks
- Medicine
- Chems
