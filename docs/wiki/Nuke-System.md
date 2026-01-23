# 💣 Nuke System (Fusion Chamber)

The Nuke System allows you to permanently destroy unwanted gear in exchange for CAPS.

---

## Overview

The Gear Fusion Chamber (aka "Nuke System") is a recycling mechanism that converts equipment into FIZZ tokens. Feed it your unwanted items, and receive caps in return.

---

## Features

- **Permanent Destruction**: Items are gone forever
- **CAPS Rewards**: Receive FIZZ tokens based on item value
- **Rarity Bonuses**: Higher rarity items yield more caps
- **Batch Processing**: Nuke multiple items at once
- **Wallet Integration**: Tokens sent directly to your wallet

---

## How It Works

### Step 1: Open the Fusion Chamber
Navigate to the Nuke System from the Exchange panel or direct link.

### Step 2: Select Gear
Choose items from your inventory to destroy. Selected items are marked for fusion.

### Step 3: Review Value
The system displays the total CAPS you'll receive:

| Rarity | Base Value Multiplier |
|--------|----------------------|
| Common | 1.0x |
| Uncommon | 1.5x |
| Rare | 2.5x |
| Epic | 4.0x |
| Legendary | 8.0x |

### Step 4: Confirm Destruction
Click the **NUKE** button to permanently destroy selected items.

### Step 5: Receive CAPS
FIZZ tokens are transferred to your connected wallet.

---

## Value Calculation

```
finalCaps = baseValue × rarityMultiplier × conditionModifier
```

### Condition Modifiers

| Condition | Modifier |
|-----------|----------|
| Pristine | 1.0x |
| Good | 0.9x |
| Worn | 0.75x |
| Damaged | 0.5x |
| Broken | 0.25x |

---

## Example Values

| Item | Base | Rarity | Condition | Final CAPS |
|------|------|--------|-----------|------------|
| Leather Armor | 50 | Common (1.0x) | Good (0.9x) | 45 |
| Combat Rifle | 150 | Rare (2.5x) | Pristine (1.0x) | 375 |
| Power Armor Leg | 300 | Epic (4.0x) | Worn (0.75x) | 900 |
| Alien Blaster | 500 | Legendary (8.0x) | Good (0.9x) | 3,600 |

---

## Safety Features

### Confirmation Required
A confirmation dialog prevents accidental destruction:

```
⚠️ WARNING: PERMANENT DESTRUCTION
You are about to destroy:
- Combat Rifle (Rare)
- 10mm Pistol (Common)

Total CAPS: 425

This action CANNOT be undone.
[CANCEL] [CONFIRM NUKE]
```

### Equipped Item Protection
Items currently equipped cannot be nuked directly. Unequip first.

### Wallet Requirement
You must have a connected wallet to receive CAPS rewards.

---

## UI Integration

### Access Points

1. **Exchange Panel**: "NUKE GEAR" button
2. **Inventory**: Right-click → "Nuke Item"
3. **Direct URL**: `/nuke.html`

### Interface Elements

```
┌─────────────────────────────────────────┐
│        GEAR FUSION CHAMBER              │
├─────────────────────────────────────────┤
│  ⚠️ WARNING: PERMANENT DESTRUCTION      │
├─────────────────────────────────────────┤
│  YOUR GEAR:                             │
│  ☐ Leather Armor (Common)       45 CAPS │
│  ☐ Combat Rifle (Rare)         375 CAPS │
│  ☐ Stimpak x5 (Common)          50 CAPS │
├─────────────────────────────────────────┤
│  SELECTED: 0 items                      │
│  TOTAL VALUE: 0 CAPS                    │
├─────────────────────────────────────────┤
│  [RETURN TO PIP-BOY]  [🔥 NUKE GEAR]   │
└─────────────────────────────────────────┘
```

---

## Blockchain Integration

### FIZZ Token Transfer

When you nuke gear, the backend:

1. Validates item ownership
2. Calculates total CAPS value
3. Initiates FIZZ token transfer
4. Removes items from inventory
5. Confirms transaction

### Transaction Flow

```
Player selects items → Backend validates → 
Smart contract executes → FIZZ tokens sent → 
Inventory updated → Confirmation displayed
```

---

## Best Practices

### When to Nuke

✅ **Good Candidates:**
- Duplicate items you'll never use
- Low-level gear you've outgrown
- Damaged items not worth repairing
- Excess consumables

❌ **Think Twice:**
- High-rarity items (trade instead?)
- Quest-related items (might need later)
- Limited-edition collectibles
- Your only weapon

### Maximize Value

1. **Wait for events**: Sometimes bonus multipliers apply
2. **Check market first**: Rare items might sell for more
3. **Repair first**: Better condition = more caps
4. **Batch nuke**: Process multiple items at once

---

## Troubleshooting

### "Wallet Not Connected"
Connect your Phantom wallet before nuking.

### "Item Cannot Be Nuked"
Item is equipped or quest-locked. Check inventory.

### "Transaction Failed"
Network issue. Try again or check Solana status.

### "Value Shows 0"
Item has no salvage value (quest items, special items).

---

## Legal Disclaimer

*Vault-Tec Corporation reminds all vault dwellers that destroyed items are PERMANENTLY REMOVED from existence. No refunds. No returns. No exceptions. The Fusion Chamber is not a daycare for your gear.*

*By clicking "NUKE," you acknowledge that Vault-Tec has no liability for:*
- *Accidental destruction of valuable items*
- *Buyer's remorse*
- *Emotional attachment to inanimate objects*
- *Any resulting existential crises*

---

*"Recycling: It's not just for the environment anymore."* — Vault-Tec Sustainability Division
