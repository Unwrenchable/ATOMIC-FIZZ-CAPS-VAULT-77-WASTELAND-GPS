# 🎲 Encounters System

The Encounters System generates procedural world events including combat, merchants, quests, and anomalies.

---

## Overview

The encounters module (`encounters.js`) orchestrates random events based on region, weather, faction control, and world state.

---

## Features

- **Region-Aware**: Different areas have different encounter types
- **Weather Effects**: Conditions modify encounter chances
- **Faction Integration**: Reputation affects hostile encounters
- **Anomaly Events**: Strange occurrences in unstable areas
- **Micro-Quests**: Short procedural objectives
- **Timeline Distortions**: Echoes from the past

---

## Encounter Types

| Type | Description |
|------|-------------|
| `none` | No encounter |
| `ambient` | Flavor text, no interaction |
| `combat` | Hostile enemies attack |
| `traveler` | Friendly NPC met |
| `merchant` | Trading opportunity |
| `microquest` | Small procedural quest |
| `anomaly` | Strange occurrence |
| `ally_patrol` | Friendly faction backup |
| `event` | Scripted world event |

---

## Functions

### Main Roll

#### `overseerEncounters.rollEncounter()`
Generates an encounter based on current conditions.

```javascript
const encounter = overseerEncounters.rollEncounter();
// { type: "combat", enemies: [...], loot: {...} }
```

---

## Encounter Priority

Encounters are checked in this order:

### 1. Timeline Distortions
```javascript
if (Timeline.isUnstable(regionId)) {
  if (Math.random() < Timeline.distortionChance(regionId)) {
    return Timeline.rollEcho(regionId);
  }
}
```

### 2. Anomaly Encounters
```javascript
if (anomalyLevel > 0.3) {
  if (Math.random() < anomalyLevel * 0.25) {
    return Anomalies.roll(regionId, weather);
  }
}
```

### 3. Micro-Quest Check
```javascript
if (Math.random() < region.questChance) {
  return {
    type: "microquest",
    quest: Microquests.generate(regionId, weather, factionId)
  };
}
```

### 4. Faction Hostility
```javascript
if (repStatus === "HOSTILE" && Math.random() < region.threat * 0.6) {
  return {
    type: "combat",
    faction: factionId,
    enemies: [...],
    modifier: "hostile_faction"
  };
}
```

### 5. Ally Patrol
```javascript
if (repStatus === "ALLY" && Math.random() < 0.25) {
  return {
    type: "ally_patrol",
    faction: factionId,
    message: "An allied patrol waves as they pass by."
  };
}
```

### 6. Region Encounter Weights
Based on region's encounter table:
- Raiders
- Mutants
- Scavengers
- Wildlife
- Travelers
- Merchants
- Anomalies
- Events

### 7. Ambient Encounter
```javascript
if (Math.random() < 0.2) {
  return {
    type: "ambient",
    description: "You notice fresh tracks..."
  };
}
```

### 8. No Encounter
```javascript
return { type: "none" };
```

---

## Encounter Objects

### Combat Encounter
```javascript
{
  type: "combat",
  faction: "raiders",        // Optional faction
  enemies: [
    { id: "raider", hp: 30, damage: 5, traits: [...] }
  ],
  loot: {
    caps: 50,
    items: [...]
  },
  modifier: "hostile_faction"  // What triggered it
}
```

### Traveler Encounter
```javascript
{
  type: "traveler",
  npc: {
    id: "wanderer",
    name: "Dusty Traveler",
    traits: ["cautious", "helpful"]
  },
  message: "A traveler approaches."
}
```

### Merchant Encounter
```javascript
{
  type: "merchant",
  merchant: {
    id: "caravan_trader",
    inventory: [...],
    factionId: "independent"
  },
  message: "A merchant flags you down."
}
```

### Micro-Quest
```javascript
{
  type: "microquest",
  quest: {
    id: "find_lost_item",
    description: "Search for a lost heirloom",
    objective: { item: "family_locket" },
    rewards: { caps: 75, xp: 50 }
  }
}
```

### Anomaly
```javascript
{
  type: "anomaly",
  anomaly: {
    id: "reality_tear",
    effect: "vision",
    description: "Reality flickers around you..."
  }
}
```

---

## Region Encounter Weights

Each region defines encounter probabilities:

```javascript
{
  id: "mojave_desert",
  encounters: {
    raiders: 0.3,
    wildlife: 0.25,
    scavengers: 0.15,
    travelers: 0.1,
    merchant: 0.05,
    anomaly: 0.1,
    event: 0.05
  },
  threat: 0.4,      // Base danger level
  questChance: 0.1  // Micro-quest probability
}
```

---

## NPC Traits

Enemies and NPCs receive procedural traits:

```javascript
const enemies = Traits.applyToGroup(
  Regions.pickEnemies(regionId),
  region,
  weather
);
```

Traits modify:
- Stats (HP, damage)
- Behavior
- Loot quality

---

## Loot Generation

Loot is generated based on context:

```javascript
const loot = Loot.generateLoot({
  regionId: "mojave",
  factionId: "raiders",
  npcTraits: enemies.map(e => e.traits)
});
```

---

## Ambient Flavor

Random atmospheric text:

```javascript
const lines = [
  `You notice fresh tracks left by ${faction} in ${region.name}.`,
  `${region.name} carries distant echoes of ${faction} activity.`,
  `Discarded gear bearing ${faction} colors lies half-buried.`,
  `A cairn marked with ${faction} sigils watches over the wastes.`
];
```

---

## Integration

### With Worldmap
```javascript
// Location click triggers encounter check
const encounter = Game.modules.world.encounters.roll(worldState, location);
Game.modules.worldmap.handleEncounterResult(encounter, location);
```

### With Battle System
```javascript
if (encounter.type === "combat") {
  Game.modules.battle.start({
    id: `enc_${Date.now()}`,
    enemies: encounter.enemies,
    rewards: encounter.loot
  });
}
```

### With Quest System
Micro-quests integrate with the main quest tracker.

---

## Example Flow

```javascript
// Player visits a new location
const location = { id: "mojave_ruins", lvl: 5 };

// Roll for encounter
const encounter = overseerEncounters.rollEncounter();

switch (encounter.type) {
  case "combat":
    console.log(`${encounter.enemies.length} enemies attack!`);
    Game.modules.battle.start(encounter);
    break;
    
  case "merchant":
    console.log("A trader appears!");
    // Open trade interface
    break;
    
  case "microquest":
    console.log(`New objective: ${encounter.quest.description}`);
    // Add to quest log
    break;
    
  case "ambient":
    console.log(encounter.description);
    break;
    
  case "none":
    console.log("The area is quiet...");
    break;
}
```
