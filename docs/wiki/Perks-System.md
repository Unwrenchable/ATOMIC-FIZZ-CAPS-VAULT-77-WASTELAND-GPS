# 🎖️ Perks System

The Perks System unlocks powerful abilities as you level up in the wasteland.

---

## Overview

Perks provide permanent bonuses and special abilities that enhance your survival capabilities. They are unlocked through leveling up and can dramatically change your gameplay experience.

---

## Features

- **Level-Based Unlocks**: Earn new perks as you gain XP
- **Combat Bonuses**: Damage multipliers and combat advantages
- **Economy Boosts**: Increased loot and caps earnings
- **Survival Enhancements**: Health regeneration and damage resistance
- **Exploration Perks**: Faster travel and discovery bonuses

---

## Available Perks

### Combat Perks

| Perk | Effect | Description |
|------|--------|-------------|
| **Bloody Mess** | +5% damage, +100% gore | *Enemies explode into a satisfying mess* |
| **Gunslinger** | +10% pistol damage | *One shot, one kill* |
| **Rifleman** | +10% rifle damage | *Long-range precision* |
| **Heavy Gunner** | +10% heavy weapon damage | *More dakka* |
| **Commando** | +10% automatic damage | *Spray and pray* |

### Economy Perks

| Perk | Effect | Description |
|------|--------|-------------|
| **Caps Collector** | +10% caps from all sources | *Every cap counts* |
| **Scavenger** | +20% loot bonus | *Find more in the rubble* |
| **Fortune Finder** | +15% rare item chance | *Luck favors the prepared* |
| **Merchant** | 15% better buy/sell prices | *A born negotiator* |

### Survival Perks

| Perk | Effect | Description |
|------|--------|-------------|
| **Rad Child** | Regenerate HP while irradiated | *Radiation is your friend* |
| **Toughness** | +10 damage resistance | *Built like a deathclaw* |
| **Life Giver** | +20 max HP | *More time to make mistakes* |
| **Chem Resistant** | -50% addiction chance | *For recreational use only* |

### Exploration Perks

| Perk | Effect | Description |
|------|--------|-------------|
| **Road Warrior** | 25% faster map movement | *Born to roam* |
| **Explorer** | +50% fog of war reveal radius | *See further into the unknown* |
| **Pathfinder** | Reduced encounter rate while traveling | *Avoid unwanted attention* |
| **Treasure Hunter** | Hidden locations appear on map | *X marks the spot* |

---

## Unlocking Perks

### Level Requirements

Perks unlock at specific player levels:

| Level | Perks Available |
|-------|-----------------|
| 5 | Basic combat and survival perks |
| 10 | Economy perks unlock |
| 15 | Advanced combat perks |
| 20 | Exploration perks |
| 25+ | Legendary perks |

### Perk Points

- Gain 1 perk point per level
- Spend points to unlock available perks
- Some perks have multiple ranks

---

## Perk Stacking

Some perks can stack with equipment and other modifiers:

```javascript
// Example: Caps calculation with Caps Collector perk
const baseCaps = 100;
const perkBonus = player.perks.includes("caps_collector") ? 1.10 : 1.0;
const finalCaps = Math.floor(baseCaps * perkBonus);
// Result: 110 caps
```

---

## Integration

### With Combat
```javascript
// Bloody Mess damage calculation
let damage = weapon.baseDamage;
if (player.perks.includes("bloody_mess")) {
  damage *= 1.05;  // +5% damage
}
```

### With Loot
```javascript
// Scavenger loot bonus
let lootBonus = 1.0;
if (player.perks.includes("scavenger")) {
  lootBonus = 1.20;  // +20% loot
}
```

### With Economy
```javascript
// Merchant price modifier
const priceModifier = player.perks.includes("merchant") ? 0.85 : 1.0;
```

---

## UI Display

Perks are displayed in the **Stat** panel of the Pip-Boy:

- Active perks shown with icons
- Locked perks grayed out with level requirements
- Perk descriptions on hover/tap

---

## Example Build

### "Wasteland Merchant" Build

Focus on economy and exploration:

1. Level 5: **Caps Collector** (+10% caps)
2. Level 10: **Scavenger** (+20% loot)
3. Level 15: **Merchant** (15% better prices)
4. Level 20: **Road Warrior** (faster travel)
5. Level 25: **Treasure Hunter** (find hidden locations)

This build maximizes earning potential while minimizing time between profitable locations.

---

## Notes

- Perks are permanent once selected
- Some perks require specific stats or reputation
- Perk effects stack multiplicatively with equipment
- Legendary perks have unique unlock conditions

---

*"A perk a day keeps the deathclaw away."* — Vault-Tec Self-Help Guide
