# ⚔️ Battle System

The Battle System handles real-time combat encounters with enemies in the wasteland.

---

## Overview

The battle module (`battles.js`) manages combat state, player attacks, enemy attacks, and victory/defeat conditions.

---

## Features

- Real-time turn-based combat
- Weapon damage and ammo tracking
- Enemy health management
- Victory rewards (XP, caps, items)
- Integration with inventory system

---

## Functions

### Initialization

#### `Game.modules.battle.init(gameState)`
Initializes the battle module with game state reference.

```javascript
Game.modules.battle.init(window.gameState);
```

---

### Combat Flow

#### `start(encounter)`
Starts a new battle with the given encounter.

```javascript
Game.modules.battle.start({
  id: "enc_123",
  enemies: [{ id: "raider", hp: 20, damage: 5 }],
  rewards: { xp: 50, caps: 25, items: ["stimpak"] }
});
```

**Encounter Object:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique encounter ID |
| `enemies` | array | List of enemies |
| `rewards` | object | Victory rewards |

**Enemy Object:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | - | Enemy identifier |
| `hp` | number | 20 | Health points |
| `damage` | number | 3 | Damage per attack |

---

### Player Actions

#### `playerAttack()`
Executes a player attack against the current enemy.

```javascript
const result = Game.modules.battle.playerAttack();
// { success: true, damage: 15 }
// { success: false, reason: "NO_WEAPON" }
// { success: false, reason: "NO_AMMO" }
```

**Returns:**
| Field | Description |
|-------|-------------|
| `success` | Whether attack succeeded |
| `damage` | Damage dealt (if successful) |
| `reason` | Failure reason (if unsuccessful) |

#### `fireEquippedWeapon()`
Checks weapon availability and consumes ammo.

```javascript
const result = Game.modules.battle.fireEquippedWeapon();
```

- Returns `{ success: false, reason: "NO_WEAPON" }` if no weapon equipped
- Returns `{ success: false, reason: "NO_AMMO" }` if out of ammo
- Returns `{ success: true, damage: X }` on success
- Melee weapons don't consume ammo

---

### Enemy Actions

#### `enemyAttack()`
Executes an enemy attack against the player.

```javascript
const result = Game.modules.battle.enemyAttack();
// { success: true, damage: 5 }
```

- Reduces player HP by enemy damage
- Clamps player HP at 0 minimum

---

### Battle Resolution

#### `checkBattleEnd()`
Checks if battle should end.

```javascript
const result = Game.modules.battle.checkBattleEnd();
// "WIN"  - Enemy HP <= 0
// "LOSE" - Player HP <= 0
// null   - Battle continues
```

#### `applyRewards(encounter)`
Applies victory rewards to the player.

```javascript
Game.modules.battle.applyRewards(encounter);
```

Rewards:
- **XP**: Added to `player.xp`
- **Caps**: Added to `player.caps`
- **Items**: Added to inventory

---

### UI

#### `onOpen()`
Called when battle tab is opened. Updates UI.

#### `updateUI()`
Refreshes the battle interface with current state.

Displays:
- Enemy name and HP
- Player HP
- Attack button

---

## Battle Flow

```
┌─────────────────────┐
│  Encounter Starts   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   start(encounter)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Player Attacks    │◄───────┐
│   playerAttack()    │        │
└──────────┬──────────┘        │
           │                   │
           ▼                   │
    ┌──────────────┐           │
    │ checkBattleEnd │         │
    └──────┬───────┘           │
           │                   │
     ┌─────┴─────┐             │
     │           │             │
   WIN?        null            │
     │           │             │
     ▼           ▼             │
┌─────────┐ ┌─────────────┐    │
│ Rewards │ │ Enemy Attack│    │
│ Applied │ │enemyAttack()│    │
└─────────┘ └──────┬──────┘    │
                   │           │
                   ▼           │
            ┌──────────────┐   │
            │ checkBattleEnd│  │
            └──────┬───────┘   │
                   │           │
             ┌─────┴─────┐     │
             │           │     │
           LOSE?       null────┘
             │
             ▼
      ┌──────────────┐
      │  Game Over   │
      └──────────────┘
```

---

## Integration

### With Inventory
```javascript
// Ammo consumption
Game.modules.inventory.spendAmmo(weapon.ammoType, weapon.ammoPerShot);

// Item rewards
Game.modules.inventory.addItem(item, quantity);
```

### With Worldmap
```javascript
// Triggered from encounter
Game.modules.worldmap.handleEncounterResult({
  type: "combat",
  enemies: [...],
  rewards: {...}
});
```

---

## Example Combat

```javascript
// Start battle
Game.modules.battle.start({
  enemies: [{ id: "raider", hp: 30, damage: 5 }],
  rewards: { xp: 75, caps: 50 }
});

// Player turn
const attack = Game.modules.battle.playerAttack();
if (!attack.success) {
  console.log("Attack failed:", attack.reason);
}

// Check for win
if (Game.modules.battle.checkBattleEnd() === "WIN") {
  Game.modules.battle.applyRewards(encounter);
  return;
}

// Enemy turn
Game.modules.battle.enemyAttack();

// Check for loss
if (Game.modules.battle.checkBattleEnd() === "LOSE") {
  console.log("You died!");
}
```
