# 🎯 V.A.T.S. System

The Vault-Tec Assisted Targeting System (V.A.T.S.) provides tactical combat assistance with body-part targeting.

---

## Overview

The VATS module (`vats.js`) implements a turn-based targeting system inspired by Fallout's V.A.T.S., allowing precise body-part targeting with hit chance calculations.

---

## Features

- **Action Point System**: Limited actions per combat round
- **Body Part Targeting**: Head, torso, arms, legs
- **Hit Chance Calculation**: Based on perception, distance, weapon accuracy
- **Damage Multipliers**: Higher risk = higher reward
- **Limb Crippling**: Disable enemy limbs
- **Queued Shots**: Plan multiple attacks before execution

---

## Body Parts

| Part | Base Hit Chance | Damage Multiplier | AP Cost |
|------|-----------------|-------------------|---------|
| Head | 35% | 2.5x | 35 |
| Torso | 75% | 1.0x | 20 |
| Left Arm | 55% | 0.8x | 25 |
| Right Arm | 55% | 0.8x | 25 |
| Left Leg | 60% | 0.7x | 20 |
| Right Leg | 60% | 0.7x | 20 |

---

## Functions

### Combat Flow

#### `Game.modules.vats.enter(nearbyEnemies)`
Enters V.A.T.S. targeting mode.

```javascript
const enemies = [
  { id: "raider_1", name: "Raider", health: 50, distance: 15 }
];
const success = Game.modules.vats.enter(enemies);
```

- Returns `false` if no targets available
- Pauses game time
- Shows targeting interface

#### `Game.modules.vats.exit()`
Exits V.A.T.S. mode without executing.

```javascript
Game.modules.vats.exit();
```

- Resumes game time
- Hides interface

---

### Targeting

#### `Game.modules.vats.queueShot(enemy, bodyPart)`
Queues a shot at a specific body part.

```javascript
const bodyPart = { id: 'head', name: 'Head', hitChance: 0.35, damageMultiplier: 2.5, apCost: 35 };
Game.modules.vats.queueShot(enemy, bodyPart);
```

- Returns `false` if not enough AP
- Deducts AP cost immediately
- Calculates hit chance based on modifiers

---

### Execution

#### `Game.modules.vats.execute()`
Executes all queued shots.

```javascript
await Game.modules.vats.execute();
```

- Plays dramatic camera animation
- Resolves each shot with hit/miss roll
- Applies damage to enemies
- May cripple limbs (30% chance on limb hits)
- Regenerates 20 AP after execution
- Exits V.A.T.S. automatically

---

### State Queries

#### `Game.modules.vats.isActive()`
Returns whether V.A.T.S. is currently active.

```javascript
if (Game.modules.vats.isActive()) {
  // In targeting mode
}
```

#### `Game.modules.vats.getTargets()`
Returns the current list of targets.

```javascript
const targets = Game.modules.vats.getTargets();
```

---

## Hit Chance Calculation

Hit chance is calculated from multiple factors:

```javascript
function calculateHitChance(bodyPart, distance, playerPerception, weaponAccuracy) {
  let baseChance = bodyPart.hitChance;
  
  // Distance modifier
  if (distance > 50) baseChance *= 0.7;    // Long range
  else if (distance > 20) baseChance *= 0.85; // Medium range
  
  // Perception bonus (-5 to +5 stat modifier)
  const perceptionBonus = (perception - 5) * 0.05;
  baseChance += perceptionBonus;
  
  // Weapon accuracy multiplier
  baseChance *= weaponAccuracy;
  
  // Clamp to 5%-95%
  return Math.min(0.95, Math.max(0.05, baseChance));
}
```

### Modifiers

| Factor | Effect |
|--------|--------|
| Distance > 50m | -30% hit chance |
| Distance > 20m | -15% hit chance |
| Perception > 5 | +5% per point above 5 |
| Perception < 5 | -5% per point below 5 |
| Weapon Accuracy | Multiplier (1.0 = baseline) |

---

## Damage System

### Base Damage
Weapon damage × Body part multiplier

### Critical Hits
Head shots deal 2.5x damage

### Limb Crippling
- 30% chance to cripple on limb hits
- Crippled limbs affect enemy capabilities
- Tracked in `enemy.crippledLimbs`

---

## Action Points

| Stat | Value |
|------|-------|
| Maximum AP | 100 |
| Starting AP | 100 |
| Regen after execution | +20 |

AP costs vary by body part (20-35 AP).

---

## UI Interface

The V.A.T.S. overlay includes:

```html
┌─────────────────────────────────┐
│  V.A.T.S.           AP: 65/100  │
├─────────────────────────────────┤
│  Enemy: Raider                  │
│  ┌─────────────────────────────┐│
│  │ Head:      35%  (35 AP)     ││
│  │ Torso:     75%  (20 AP)     ││
│  │ Left Arm:  55%  (25 AP)     ││
│  │ Right Arm: 55%  (25 AP)     ││
│  │ Left Leg:  60%  (20 AP)     ││
│  │ Right Leg: 60%  (20 AP)     ││
│  └─────────────────────────────┘│
├─────────────────────────────────┤
│  Queued: Torso (75%), Head (35%)│
├─────────────────────────────────┤
│  [EXECUTE]        [CANCEL]      │
└─────────────────────────────────┘
```

---

## Example Usage

```javascript
// Enter V.A.T.S. with nearby enemies
const enemies = getNearbyEnemies();
if (Game.modules.vats.enter(enemies)) {
  
  // Queue shots at first enemy
  const target = enemies[0];
  Game.modules.vats.queueShot(target, BODY_PARTS.torso);
  Game.modules.vats.queueShot(target, BODY_PARTS.head);
  
  // Execute all queued shots
  await Game.modules.vats.execute();
  
  // V.A.T.S. automatically exits after execution
}
```

---

## Integration

### With Battle System
V.A.T.S. can be used during active battles as an alternative to standard attacks.

### With NPC Encounter
Hostile NPCs within range become valid targets.

```javascript
if (Game.modules.npcEncounter) {
  Game.modules.npcEncounter.removeEnemy(enemy.id);
}
```
