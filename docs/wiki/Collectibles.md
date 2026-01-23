# 🏆 Collectibles System

The Collectibles System tracks special items like magazines, posters, and lore items that provide bonuses.

---

## Overview

The collectibles module (`collectables.js`) manages finding, tracking, and applying bonuses from collectible items.

---

## Features

- **Collection Tracking**: Remember what you've found
- **Stat Bonuses**: Magazines give permanent buffs
- **Set Completion**: Rewards for collecting full sets
- **Lore Integration**: Posters and trophies tell stories

---

## Collectible Types

| Type | Tag | Effect |
|------|-----|--------|
| Magazines | `magazine` | Permanent stat bonuses |
| Posters | `poster` | May reveal map markers |
| Trophies | `trophy` | Trigger special events |
| Vault Items | `vault` | Set completion bonuses |

---

## Functions

### Initialization

#### `Game.modules.collectibles.init(gameState)`
Initializes collectibles tracking.

```javascript
Game.modules.collectibles.init(window.gameState);
```

---

### Adding Collectibles

#### `add(item)`
Marks an item as collected.

```javascript
Game.modules.collectibles.add({
  id: "grognak_issue1",
  tags: ["magazine"],
  baseStats: { buffStrength: 1 }
});
```

**Process:**
1. Mark as collected
2. Apply item effects
3. Check for set completion

---

### Checking Collection

#### `has(itemId)`
Checks if item has been collected.

```javascript
if (Game.modules.collectibles.has("grognak_issue1")) {
  console.log("Already found this issue!");
}
```

---

### Listing Collection

#### `listCollected()`
Returns all collected items.

```javascript
const collection = Game.modules.collectibles.listCollected();
// Array of collected item objects
```

---

## Effect Application

#### `applyCollectibleEffects(item)`
Applies bonuses from collectible.

```javascript
// Magazine example
if (item.tags.includes("magazine")) {
  gameState.bonuses[item.id] = {
    buffPerception: item.baseStats.buffPerception || 0,
    buffEndurance: item.baseStats.buffEndurance || 0,
    buffLuck: item.baseStats.buffLuck || 0
  };
}
```

### Effect Types

**Magazines:**
- Permanent stat bonuses
- Added to `gameState.bonuses`

**Posters:**
- May reveal hidden POIs
- Unlocks map markers

**Trophies:**
- Triggers special events
- Fires `trophyFound` event

---

## Set Completion

#### `checkSetCompletion(item)`
Checks if collecting item completes a set.

```javascript
// Example: All Vault posters
if (item.tags.includes("vault")) {
  const allVaultPosters = mintables.filter(i => 
    i.tags && i.tags.includes("vault")
  );
  
  const allCollected = allVaultPosters.every(i => this.has(i.id));
  
  if (allCollected) {
    events.trigger("collectibleSetComplete", {
      set: "vault_posters",
      items: allVaultPosters
    });
  }
}
```

---

## Data Structure

### Collected Items
```javascript
gameState.collectibles = {
  "grognak_issue1": true,
  "vault77_poster": true,
  "deathclaw_trophy": true
};
```

### Bonuses
```javascript
gameState.bonuses = {
  "grognak_issue1": { buffStrength: 1 },
  "guns_ammo_mag": { buffPerception: 1 }
};
```

---

## Collectible Item Structure

```javascript
{
  "id": "grognak_issue1",
  "name": "Grognak the Barbarian #1",
  "type": "collectible",
  "rarity": "rare",
  "tags": ["magazine", "grognak_set"],
  "baseStats": {
    "buffStrength": 1
  },
  "lore": "The first issue of the legendary comic series."
}
```

---

## Events

### `trophyFound`
Triggered when finding a trophy item.

```javascript
events.trigger("trophyFound", { item: trophyItem });
```

### `collectibleSetComplete`
Triggered when completing a set.

```javascript
events.trigger("collectibleSetComplete", {
  set: "vault_posters",
  items: [/* all posters in set */]
});
```

---

## Example: Finding a Magazine

```javascript
// Player finds a magazine
const magazine = {
  id: "guns_and_ammo_12",
  name: "Guns and Ammo #12",
  tags: ["magazine"],
  baseStats: {
    buffPerception: 1
  }
};

// Add to collection
Game.modules.collectibles.add(magazine);

// Effect applied:
// gameState.bonuses["guns_and_ammo_12"] = { buffPerception: 1 }

// Check if already collected later
if (Game.modules.collectibles.has("guns_and_ammo_12")) {
  console.log("Already in collection!");
}
```

---

## Magazine Sets

| Set | Issues | Bonus |
|-----|--------|-------|
| Grognak | 10 | +2 Strength |
| Guns & Ammo | 12 | +2 Perception |
| Tales of the Wastes | 8 | +1 Luck |
| Vault-Tec Monthly | 6 | Various |

---

## Integration

### With Inventory
Collectibles appear in inventory but also tracked separately.

### With Mintables
Uses mintables for item data lookup.

### With World Map
Posters may reveal hidden locations.

### With Events
Trophies and set completion trigger events.
