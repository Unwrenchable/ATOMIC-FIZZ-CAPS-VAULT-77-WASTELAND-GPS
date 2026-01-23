# 🏛️ Faction System

The Faction System tracks player reputation with wasteland factions, affecting interactions, prices, and encounters.

---

## Overview

The factions module (`factions.js`) loads faction data and provides reputation-based mechanics for gameplay interactions.

---

## Features

- **Multiple Factions**: Various wasteland groups
- **Reputation Tracking**: Score-based standing
- **Dynamic Relationships**: Standing affects encounters
- **Merchant Discounts**: Better prices with allies
- **Encounter Bias**: Ambush/backup chances
- **Integration**: Works with world state and economy

---

## Functions

### Initialization

#### `Game.modules.factions.init()`
Loads faction data from JSON.

```javascript
await Game.modules.factions.init();
```

---

### Faction Queries

#### `getFaction(id)`
Gets faction data by ID.

```javascript
const ncr = Game.modules.factions.getFaction("ncr");
// { id: "ncr", name: "New California Republic", ... }
```

#### `getAll()`
Returns all factions.

```javascript
const allFactions = Game.modules.factions.getAll();
```

---

### Reputation

#### `getReputation(worldState, factionId)`
Gets current reputation status with a faction.

```javascript
const rep = Game.modules.factions.getReputation(worldState, "ncr");
// { standing: "friendly", score: 65 }
```

**Standing Values:**
| Score Range | Standing |
|-------------|----------|
| ≥ 75 | `ally` |
| ≥ 50 | `friendly` |
| ≥ 0 | `neutral` |
| ≥ -50 | `unfriendly` |
| < -50 | `hostile` |

#### `adjustReputation(worldState, factionId, delta)`
Modifies reputation score.

```javascript
// Gain reputation
Game.modules.factions.adjustReputation(worldState, "ncr", 10);

// Lose reputation
Game.modules.factions.adjustReputation(worldState, "legion", -25);
```

---

### Status Checks

#### `isHostile(worldState, factionId)`
Checks if faction is hostile to player.

```javascript
if (Game.modules.factions.isHostile(worldState, "raiders")) {
  // Faction will attack on sight
}
```

**Hostile Conditions:**
- Standing is `hostile`
- Score ≤ -50

#### `isFriendly(worldState, factionId)`
Checks if faction is friendly to player.

```javascript
if (Game.modules.factions.isFriendly(worldState, "ncr")) {
  // Faction welcomes player
}
```

**Friendly Conditions:**
- Standing is `ally` or `friendly`
- Score ≥ 50

---

### Economic Effects

#### `getMerchantDiscount(worldState, factionId)`
Calculates price modifier based on reputation.

```javascript
const discount = Game.modules.factions.getMerchantDiscount(worldState, "ncr");
// 0.25 = 25% discount (ally)
// 0.15 = 15% discount (friendly)
// -0.15 = 15% markup (unfriendly)
```

| Score | Discount |
|-------|----------|
| ≥ 75 | +25% (+baseDiscount) |
| ≥ 50 | +15% (+baseDiscount) |
| ≥ 25 | +5% (+baseDiscount) |
| ≤ -25 | -5% |
| ≤ -50 | -15% |
| ≤ -75 | -25% |

---

### Encounter Effects

#### `getEncounterBias(worldState, factionId)`
Gets combat encounter modifiers.

```javascript
const bias = Game.modules.factions.getEncounterBias(worldState, "ncr");
// { ambushChance: 0.025, backupChance: 0.2 }
```

**Reputation Effects:**

| Score | Ambush Chance | Backup Chance |
|-------|---------------|---------------|
| ≥ 75 | 25% of base | 200% of base |
| ≥ 50 | 50% of base | 150% of base |
| ≤ -50 | 150% of base | 50% of base |
| ≤ -75 | 200% of base | 25% of base |

**Ambush**: Chance faction attacks unexpectedly
**Backup**: Chance faction reinforcements help in combat

---

## Faction Data Structure

```javascript
{
  id: "ncr",
  name: "New California Republic",
  description: "Democratic federation...",
  baseDiscount: 0.05,        // Base merchant discount
  baseAmbushChance: 0.1,     // Base ambush probability
  baseBackupChance: 0.1,     // Base backup probability
  territories: ["mojave_south", "dam"],
  allies: ["followers"],
  enemies: ["legion", "fiends"]
}
```

---

## Integration

### With World State
Reputation stored in `worldState.factions[id].score`

### With Economy
```javascript
const repMod = Game.modules.factions.getReputationModifier(factionId);
// Used in price calculations
```

### With Encounters
```javascript
// Check for hostile patrol
if (Game.modules.factions.isHostile(worldState, factionId)) {
  // Roll for combat encounter
}
```

### With Quests
Some quests affect faction reputation:
```javascript
// Quest completion reward
adjustReputation(worldState, "ncr", +20);
adjustReputation(worldState, "legion", -10);
```

---

## Reputation Consequences

### Ally Status (≥75)
- 25% merchant discount
- Backup patrols may help in combat
- Access to faction-exclusive quests
- Safe passage through territory

### Friendly Status (≥50)
- 15% merchant discount
- Neutral encounter chance
- Basic faction services available

### Neutral Status (0-49)
- No price modifiers
- Normal encounter rates
- Limited faction interaction

### Unfriendly Status (-1 to -49)
- 5-15% price markup
- Refused faction services
- Hostile dialogue options

### Hostile Status (≤-50)
- 15-25% price markup
- Attacked on sight
- Faction quests unavailable
- High ambush chance in territory

---

## Example: Faction Interaction

```javascript
// Player helped NCR in a quest
Game.modules.factions.adjustReputation(worldState, "ncr", 25);

// Check new standing
const rep = Game.modules.factions.getReputation(worldState, "ncr");
console.log(`NCR standing: ${rep.standing} (${rep.score})`);
// "NCR standing: friendly (65)"

// Get merchant discount
const discount = Game.modules.factions.getMerchantDiscount(worldState, "ncr");
console.log(`Merchant discount: ${discount * 100}%`);
// "Merchant discount: 15%"

// Helping NCR may anger Legion
Game.modules.factions.adjustReputation(worldState, "legion", -15);
```
