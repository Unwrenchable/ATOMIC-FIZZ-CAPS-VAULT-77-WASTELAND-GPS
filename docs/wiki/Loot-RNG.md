# 🎰 Loot RNG System

The Loot RNG System provides procedural item generation with rarity tiers, stat rolling, and variants.

---

## Overview

The loot roller (`lootRNG/index.js`) generates unique items from base templates with randomized stats and potential upgrades.

---

## Features

- **Rarity-Weighted Selection**: Common to Legendary tiers
- **Stat Rolling**: Randomized values within ranges
- **Rarity Upgrades**: Chance to upgrade item tier
- **Variant System**: Special item modifiers
- **God-Tier Items**: Ultra-rare legendary upgrades

---

## Rarity Tiers

| Rarity | Base Weight | Chance |
|--------|-------------|--------|
| Common | 0.80 | 80% |
| Rare | 0.15 | 15% |
| Epic | 0.045 | 4.5% |
| Legendary | 0.005 | 0.5% |

---

## Functions

### Main API

#### `rollRandomLoot(mintables)`
Generates a random item from the mintables pool.

```javascript
const item = rollRandomLoot(mintables);
// Returns fully rolled item with stats
```

---

### Internal Functions

#### `pickRarityBucket(weights)`
Selects a rarity tier based on weighted probability.

```javascript
const rarity = pickRarityBucket(BASE_RARITY_WEIGHTS);
// "common", "rare", "epic", or "legendary"
```

#### `pickBaseItem(mintables)`
Selects a base item from the rarity bucket.

```javascript
const baseItem = pickBaseItem(mintables);
```

**Logic:**
1. Pick rarity bucket
2. Filter items by rarity
3. Pick random item from matches
4. Fall back to any item if no matches

---

### Variants

#### `maybeApplyVariant(baseItem)`
30% chance to apply a variant modifier.

```javascript
const { variant, variantLabel } = maybeApplyVariant(baseItem);
// variant: { modifier: "Sharpened", effect: "+2 damage", rarityBoost: "rare" }
// variantLabel: "Sharpened"
```

**Variant Properties:**
| Property | Description |
|----------|-------------|
| `modifier` | Name prefix (e.g., "Sharpened") |
| `effect` | Gameplay effect description |
| `rarityBoost` | Minimum rarity guarantee |

---

### Rarity Upgrades

#### `rollRarityUpgrade(baseRarity, variant)`
Chance to upgrade item rarity tier.

```javascript
const { finalRarity, isGodTier } = rollRarityUpgrade("rare", variant);
```

**Upgrade Chances:**
| Base Rarity | Upgrade Chance |
|-------------|----------------|
| Common | 10% → Rare |
| Rare | 5% → Epic |
| Epic | 1% → Legendary |
| Legendary | 0.1% → God-Tier |

**Variant Rarity Boost:**
Variants can enforce minimum rarity:
```javascript
if (variant.rarityBoost === "epic") {
  // Item is at least Epic
}
```

---

### Stat Rolling

#### `rollItemStats(baseItem, variant, rarity)`
Generates final item stats.

```javascript
const stats = rollItemStats(baseItem, variant, "rare");
// { damage: 15, range: 12, durability: 45 }
```

**Process:**
1. Start with base stats
2. Roll bonus within ranges
3. Apply rarity multiplier

**Rarity Multipliers:**
| Rarity | Multiplier |
|--------|------------|
| Common | 1.0x |
| Rare | 1.1x |
| Epic | 1.25x |
| Legendary | 1.5x |

---

### Item Building

#### `buildRolledItem(baseItem)`
Assembles the final rolled item.

```javascript
const item = buildRolledItem(baseItem);
```

**Returns:**
```javascript
{
  // Identity
  baseId: "hunting_rifle",
  baseName: "Hunting Rifle",
  name: "Sharpened Hunting Rifle",  // With variant prefix
  
  // Rarity
  rarity: "rare",
  isGodTier: false,
  
  // Variant
  variant: { modifier: "Sharpened", effect: "+2 damage" },
  effect: "+2 damage",
  
  // Stats
  stats: {
    damage: 18,
    accuracy: 85,
    range: 150
  },
  
  // Metadata
  meta: {
    type: "weapon",
    priceCAPS: 150,
    spawnPOI: "military_base",
    levelRequirement: 5,
    tags: ["rifle", "ballistic"]
  }
}
```

---

## Base Item Structure

Items in `mintables.json`:

```javascript
{
  "id": "hunting_rifle",
  "name": "Hunting Rifle",
  "rarity": "common",
  "type": "weapon",
  
  "baseStats": {
    "damage": 15,
    "accuracy": 80,
    "range": 100
  },
  
  "rollRanges": {
    "damage": [0, 5],      // +0 to +5
    "accuracy": [-5, 10],  // -5 to +10
    "range": [0, 50]       // +0 to +50
  },
  
  "variants": [
    {
      "modifier": "Sharpened",
      "effect": "+2 damage",
      "rarityBoost": "rare"
    },
    {
      "modifier": "Scoped",
      "effect": "+10 accuracy"
    }
  ],
  
  "priceCAPS": 150,
  "spawnPOI": "military_base",
  "levelRequirement": 5,
  "tags": ["rifle", "ballistic"]
}
```

---

## Example: Rolling a Weapon

```javascript
// Load mintables
const mintables = await fetch("/data/mintables.json").then(r => r.json());

// Roll an item
const item = rollRandomLoot(mintables);

console.log(`Got: ${item.name}`);
console.log(`Rarity: ${item.rarity}`);
console.log(`Damage: ${item.stats.damage}`);

if (item.isGodTier) {
  console.log("🌟 GOD-TIER DROP!");
}

if (item.variant) {
  console.log(`Variant: ${item.variant.modifier}`);
  console.log(`Effect: ${item.variant.effect}`);
}
```

---

## Stat Rolling Example

```javascript
// Base item
baseStats: { damage: 10 }
rollRanges: { damage: [0, 5] }

// Roll: random 0-5 = 3
// After base roll: 10 + 3 = 13

// Rarity: rare (1.1x multiplier)
// Final: 13 × 1.1 = 14.3 → 14 (rounded)
```

---

## God-Tier Items

Ultra-rare legendary items with "God-Tier" prefix:

- Only possible on already-Legendary items
- 0.1% chance (1 in 1000)
- Maximum stat rolls
- Special visual effects
- Display name: "God-Tier [Item Name]"

```javascript
if (item.isGodTier) {
  item.name = `God-Tier ${item.name}`;
  // Apply god-tier bonuses
}
```
