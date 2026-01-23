# 💰 Economy System

The Economy System provides dynamic pricing logic used across all trading interactions in the wasteland.

---

## Overview

The economy module (`economy.js`) calculates buy and sell prices based on rarity, reputation, weather, time, and world conditions.

---

## Features

- **Rarity-Based Pricing**: Higher rarity = higher value
- **Scarcity Modifiers**: World-state affects supply/demand
- **Reputation Discounts**: Faction standing affects prices
- **Weather Modifiers**: Hazardous conditions increase prices
- **Time-of-Day**: Night markets offer slight discounts
- **Merchant-Specific**: Each merchant has custom modifiers

---

## Price Calculation

### Buy Price Formula
```
finalPrice = base × rarity × scarcity × reputation × weather × time × merchant
```

### Sell Price Formula
```
finalPrice = base × rarity × scarcity × reputation × weather × time × merchant × 0.5
```
(Merchants buy at 50% of calculated value)

---

## Rarity Multipliers

| Rarity | Multiplier |
|--------|------------|
| Common | 1.0x |
| Uncommon | 1.6x |
| Rare | 2.4x |
| Epic | 4.0x |
| Legendary | 7.5x |
| Ghost | 10.0x |

---

## Functions

### Initialization

#### `Game.modules.economy.init(gameState)`
Initializes economy with game state reference.

```javascript
Game.modules.economy.init(window.gameState);
```

---

### Price Calculation

#### `calculateBuyPrice(item, merchant)`
Calculates what player pays to buy an item.

```javascript
const item = { baseValue: 100, rarity: "rare" };
const merchant = { factionId: "ncr", priceModifiers: { buy: 1.1 } };

const price = Game.modules.economy.calculateBuyPrice(item, merchant);
// Returns: final cap price
```

#### `calculateSellPrice(item, merchant)`
Calculates what player receives when selling.

```javascript
const price = Game.modules.economy.calculateSellPrice(item, merchant);
// Returns: caps received (typically ~50% of buy price)
```

---

### Modifiers

#### `getScarcityModifier()`
Returns current world scarcity modifier.

```javascript
const mod = Game.modules.economy.getScarcityModifier();
// 1.25 = high scarcity (expensive)
// 1.00 = normal
// 0.85 = low scarcity (cheap)
```

| Scarcity Level | Modifier |
|----------------|----------|
| High | 1.25 |
| Normal | 1.00 |
| Low | 0.85 |

#### `getReputationModifier(factionId)`
Returns faction-based price modifier.

```javascript
const mod = Game.modules.economy.getReputationModifier("ncr");
```

| Reputation Score | Modifier | Effect |
|------------------|----------|--------|
| ≥ 75 | 0.80 | 20% discount |
| ≥ 40 | 0.90 | 10% discount |
| ≤ -40 | 1.15 | 15% markup |
| ≤ -75 | 1.30 | 30% markup |
| Otherwise | 1.00 | No change |

#### `getWeatherModifier()`
Returns weather-based price modifier.

```javascript
const mod = Game.modules.economy.getWeatherModifier();
```

| Weather Type | Modifier |
|--------------|----------|
| Rad Storm | 1.15 |
| Acid Rain | 1.10 |
| Other | 1.00 |

#### `getTimeModifier()`
Returns time-of-day modifier.

```javascript
const mod = Game.modules.economy.getTimeModifier();
```

| Time | Modifier | Note |
|------|----------|------|
| Night | 0.95 | 5% discount |
| Day | 1.00 | No change |

---

## Merchant Configuration

Merchants can have custom price modifiers:

```javascript
const merchant = {
  id: "trader_jacks",
  factionId: "independent",
  priceModifiers: {
    buy: 1.10,   // 10% markup on purchases
    sell: 0.90   // 10% less when selling
  }
};
```

---

## Example Calculations

### Buying a Rare Weapon

```javascript
const item = {
  id: "hunting_rifle",
  baseValue: 200,
  rarity: "rare"
};

const merchant = {
  factionId: "ncr",
  priceModifiers: { buy: 1.0 }
};

// Assume:
// - Player has 50 rep with NCR (0.90 modifier)
// - Normal scarcity (1.0)
// - Clear weather (1.0)
// - Daytime (1.0)

// Calculation:
// 200 × 2.4 (rare) × 1.0 × 0.90 × 1.0 × 1.0 × 1.0
// = 432 caps
```

### Selling a Common Armor

```javascript
const item = {
  id: "leather_armor",
  baseValue: 50,
  rarity: "common"
};

// Calculation:
// 50 × 1.0 (common) × 1.0 × 1.0 × 1.0 × 1.0 × 1.0 × 0.5
// = 25 caps
```

---

## Integration Points

### Merchant System
```javascript
// Standard merchant pricing
const buyPrice = Game.modules.economy.calculateBuyPrice(item, merchant);
const sellPrice = Game.modules.economy.calculateSellPrice(item, merchant);
```

### Scavenger Exchange
```javascript
// Exchange uses economy for listing prices
```

### Ghost Merchants
```javascript
// Special ghost items use 10.0x rarity multiplier
```

### Faction Shops
```javascript
// Faction reputation affects all prices
```

---

## World State Integration

The economy reads from `Game.modules.world.state`:

```javascript
// Scarcity level
world.state.economy.scarcity  // "high", "normal", "low"

// Current weather
world.weather.current.type    // "rad_storm", "clear", etc.

// Time of day
world.timeOfDay               // "day", "night"
```
