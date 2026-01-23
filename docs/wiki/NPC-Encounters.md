# 👤 NPC Encounters

The NPC Encounter system spawns interactive characters throughout the wasteland based on location and chance.

---

## Overview

The NPC spawn module (`npcSpawn.js`) manages NPC data loading and determines when NPCs appear at locations.

---

## Features

- **Location-Based Spawning**: NPCs appear at specific location types
- **Random Chance**: 30% base spawn probability
- **Dialog System**: NPCs have conversational dialog pools
- **Quest Integration**: NPCs can offer quests
- **Encounter Triggering**: NPCs approach the player

---

## Functions

### Initialization

#### `Game.modules.npcSpawn.init()`
Loads NPC data from JSON files.

```javascript
await Game.modules.npcSpawn.init();
```

---

### Encounter Checking

#### `checkForNPCEncounter(location)`
Determines if an NPC should spawn at a location.

```javascript
const encounter = Game.modules.npcSpawn.checkForNPCEncounter(location);
if (encounter) {
  // { type: "npc", npc: {...}, location: {...} }
}
```

**Returns:**
- `null` if no NPC spawns
- Encounter object with NPC and location data

**Spawn Logic:**
1. Find NPCs whose `spawnPool` matches location ID
2. Apply spawn chance (30%)
3. Pick random NPC from matches

#### `getNPCsForLocation(locationId)`
Gets all NPCs that can spawn at a location.

```javascript
const npcs = Game.modules.npcSpawn.getNPCsForLocation("vegas_strip");
```

---

### NPC Interaction

#### `triggerNPCApproach(npc, location)`
Makes an NPC approach the player.

```javascript
Game.modules.npcSpawn.triggerNPCApproach(npc, location);
```

Uses `npcEncounter` module if available, otherwise shows dialog directly.

#### `showNPCDialog(npc)`
Displays NPC dialog as a fallback.

```javascript
Game.modules.npcSpawn.showNPCDialog(npc);
```

Picks random dialog from NPC's `dialogPool`.

---

## NPC Data Structure

```javascript
{
  id: "trader_bob",
  name: "Trader Bob",
  faction: "independent",
  
  // Locations where NPC can appear
  spawnPool: ["settlement", "trading_post", "caravan"],
  
  // Dialog options (random selection)
  dialogPool: [
    "Got some good stuff for sale, wastelander.",
    "Looking to trade?",
    "Check out my wares!"
  ],
  
  // Alternative dialog structure
  dialog: [
    "Hello there, traveler."
  ]
}
```

---

## Spawn Pool Matching

The system uses flexible location matching:

```javascript
// NPC with spawnPool: ["vegas"]

// Matches:
// - "vegas" (exact)
// - "vegas_strip" (starts with)
// - "new_vegas" (contains)
// - "outer_vegas_ruins" (contains)
```

**Matching Rules:**
- Exact match: `locationId === spawnId`
- Word boundary: `locationId.split('_').includes(spawnId)`
- Prefix: `locationId.startsWith(spawnId + '_')`
- Suffix: `locationId.endsWith('_' + spawnId)`
- Contains: `locationId.includes('_' + spawnId + '_')`

---

## Spawn Chance

| Setting | Default | Description |
|---------|---------|-------------|
| `spawnChance` | 0.3 | 30% base encounter probability |

---

## Integration

### With Worldmap
```javascript
// Called when player visits a POI
const npcEncounter = Game.modules.npcSpawn.checkForNPCEncounter(loc);

if (npcEncounter) {
  Game.modules.worldmap.handleEncounterResult(npcEncounter, loc);
}
```

### With NPC Encounter Module
```javascript
// Full NPC approach and interaction
Game.modules.npcEncounter.triggerEncounter(npc.id, {
  spawnRadius: 40,
  onComplete: () => {
    console.log("Encounter finished");
  }
});
```

### With Narrative System
```javascript
// Open dialog for NPC
Game.modules.narrative.openForNpc(npc.id);
```

---

## Example: NPC Encounter Flow

```javascript
// 1. Player clicks on a location
const location = { id: "vegas_strip_casino", name: "Lucky 38" };

// 2. Check for NPC encounter
const encounter = Game.modules.npcSpawn.checkForNPCEncounter(location);

// 3. If NPC spawns
if (encounter) {
  console.log(`${encounter.npc.name} at ${location.name}`);
  
  // 4. Trigger approach
  Game.modules.npcSpawn.triggerNPCApproach(encounter.npc, location);
  
  // 5. Player sees dialog
  // "Trader Bob approaches you."
  // "Got some good stuff for sale, wastelander."
}
```

---

## NPC Types

### Traders
- Spawn at settlements, caravans, trading posts
- Offer goods for sale
- May have special items

### Quest Givers
- Spawn at specific story locations
- Offer quests when approached
- Track quest progress

### Signal Runners
- Spawn randomly in wilderness
- Deliver urgent messages
- Time-limited encounters

### Faction Representatives
- Spawn in faction territory
- Offer faction-specific interactions
- Reputation affects dialog

### Mysterious Strangers
- Rare spawn anywhere
- Cryptic warnings or tips
- May give valuable items

---

## Loading NPCs

NPCs are loaded from `/data/npc/index.json`:

```javascript
// index.json lists NPC files
["trader_bob.json", "signal_runner.json", "mysterious_stranger.json"]

// Each NPC is loaded individually
const npc = await fetch("/data/npc/trader_bob.json").then(r => r.json());
```
