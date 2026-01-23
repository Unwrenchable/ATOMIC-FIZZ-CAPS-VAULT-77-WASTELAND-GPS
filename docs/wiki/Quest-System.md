# 📋 Quest System

The Quest System manages story progression, objectives, and rewards throughout the wasteland adventure.

---

## Overview

The quests module (`quests.js`) handles quest tracking, triggers, objectives, starter gear, and completion rewards.

---

## Features

- **Multiple Quest Types**: Objective-based and step-based
- **Trigger System**: NPC, location, item, auto triggers
- **Quest Acceptance**: Accept or decline offered quests
- **Starter Gear**: New players receive initial equipment
- **Persistence**: Quest state saved to localStorage
- **Rewards**: XP, caps, and items on completion

---

## Quest Types

### Objective-Based Quests
Player must complete a list of objectives in any order.

```javascript
{
  id: "wake_up",
  type: "objectives",
  objectives: {
    open_inventory: { text: "Open your inventory" },
    equip_weapon: { text: "Equip your Vault 77 Sidearm" },
    turn_on_radio: { text: "Tune into Atomic Fizz Radio" }
  },
  order: ["open_inventory", "equip_weapon", "turn_on_radio"]
}
```

### Step-Based Quests
Player progresses through sequential steps.

```javascript
{
  id: "quest_vault77_open",
  type: "steps",
  steps: [
    { id: "find_keycard", requires: { item: "vault77_keycard" } },
    { id: "go_to_vault", requires: { location: "vault77" } }
  ]
}
```

---

## Trigger Types

| Type | Description | Field |
|------|-------------|-------|
| `npc` | Delivered by an NPC | `triggerNpc` |
| `location` | Triggered at a location | `triggerLocation` |
| `item` | Triggered by picking up item | `triggerItem` |
| `auto` | Starts automatically | - |
| `manual` | Debug/admin only | - |

---

## Functions

### Initialization

#### `Game.modules.quests.init(gameState)`
Initializes quest system and gives starter gear.

```javascript
Game.modules.quests.init(window.gameState);
```

---

### Quest Triggers

#### `triggerNPCQuestDelivery(questId)`
Triggers a quest offered by an NPC.

```javascript
Game.modules.quests.triggerNPCQuestDelivery("wake_up");
```

#### `triggerLocationQuest(locationId)`
Checks for quests that trigger at a location.

```javascript
Game.modules.quests.triggerLocationQuest("vault77_entrance");
```

#### `triggerItemQuest(itemId)`
Checks for quests triggered by finding an item.

```javascript
Game.modules.quests.triggerItemQuest("broken_radio_beacon");
```

---

### Quest Acceptance

#### `acceptQuest(questId)`
Accepts an offered quest and starts it.

```javascript
Game.modules.quests.acceptQuest("quest_lost_signal");
```

#### `declineQuest(questId)`
Declines a quest offer (removes from available).

```javascript
Game.modules.quests.declineQuest("quest_lost_signal");
```

#### `getAvailableQuests()`
Returns all quests offered but not yet accepted.

```javascript
const available = Game.modules.quests.getAvailableQuests();
// Array of quest objects with offer details
```

---

### Quest Progress

#### `startQuest(questId)`
Starts a quest (sets state to active).

```javascript
Game.modules.quests.startQuest("wake_up");
```

#### `completeObjective(questId, objectiveId)`
Marks an objective as complete.

```javascript
Game.modules.quests.completeObjective("wake_up", "open_inventory");
```

#### `advanceQuest(questId)`
Advances to next step in step-based quests.

```javascript
Game.modules.quests.advanceQuest("quest_vault77_open");
```

#### `completeQuest(questId)`
Completes a quest and applies rewards.

```javascript
Game.modules.quests.completeQuest("wake_up");
```

---

### Quest Queries

#### `ensureQuestState(questId)`
Gets or creates quest state object.

```javascript
const state = Game.modules.quests.ensureQuestState("wake_up");
// { state: "active", currentStepIndex: 0, objectives: {...} }
```

#### `getCurrentStep(questId)`
Gets current step for step-based quests.

```javascript
const step = Game.modules.quests.getCurrentStep("quest_vault77_open");
// { id: "find_keycard", description: "...", requires: {...} }
```

#### `checkStepCompletion(questId)`
Checks if current step requirements are met.

```javascript
if (Game.modules.quests.checkStepCompletion("quest_vault77_open")) {
  // Can advance to next step
}
```

---

### Starter Gear

#### `giveStarterGear()`
Gives new players starting equipment (once per account).

```javascript
// Automatically called on init
```

**Starter Gear:**
- Vault 77 Security Sidearm (weapon)
- Vault 77 Jumpsuit (armor)
- 3× Stimpak (consumable)
- 2× Dirty Water (consumable)
- 5× Bobby Pin (tool)
- 24× 9mm Rounds (ammo)

#### `getStarterGear()`
Returns the starter gear list.

```javascript
const gear = Game.modules.quests.getStarterGear();
```

#### `hasStarterGear()`
Checks if starter gear was already given.

```javascript
if (!Game.modules.quests.hasStarterGear()) {
  // First time player
}
```

---

## Quest State

| State | Description |
|-------|-------------|
| `not_started` | Quest not yet triggered |
| `active` | Quest in progress |
| `completed` | Quest finished |

---

## Quest Structure

```javascript
{
  id: "quest_id",
  name: "Quest Name",
  type: "objectives" | "steps",
  triggerType: "npc" | "location" | "item" | "auto" | "manual",
  triggerNpc: "npc_id",        // For NPC triggers
  triggerLocation: "loc_id",   // For location triggers
  triggerItem: "item_id",      // For item triggers
  description: "Quest description",
  npcMessage: "Dialog from NPC offering quest",
  
  // For objective-based
  objectives: {
    obj_id: { text: "Objective text" }
  },
  order: ["obj_id", ...],
  
  // For step-based
  steps: [
    { id: "step_id", description: "...", requires: { item: "..." } }
  ],
  
  rewards: {
    xp: 100,
    caps: 50,
    items: ["item_id"]
  }
}
```

---

## Notifications

Quest events dispatch custom events:

### `questOffered`
```javascript
window.addEventListener("questOffered", (e) => {
  console.log(`New quest: ${e.detail.questName}`);
  console.log(`Message: ${e.detail.message}`);
});
```

### `questAccepted`
```javascript
window.addEventListener("questAccepted", (e) => {
  console.log(`Started: ${e.detail.questName}`);
});
```

### `inventoryUpdated`
```javascript
window.addEventListener("inventoryUpdated", (e) => {
  if (e.detail.reason === "starter_gear") {
    console.log("Received starter gear!");
  }
});
```

---

## UI Integration

#### `onOpen()`
Renders quest UI when quest panel is opened.

Displays:
- Available quests (can accept/decline)
- Active quests with current objectives
- Completed quests

---

## Example: Tutorial Quest Flow

```javascript
// 1. Quest offered when player first loads
Game.modules.quests.triggerNPCQuestDelivery("wake_up");

// 2. Player accepts quest
Game.modules.quests.acceptQuest("wake_up");

// 3. Player opens inventory (Pip-Boy hook)
Game.modules.quests.completeObjective("wake_up", "open_inventory");

// 4. Player equips weapon
Game.modules.quests.completeObjective("wake_up", "equip_weapon");

// 5. Player equips armor
Game.modules.quests.completeObjective("wake_up", "equip_armor");

// 6. Player turns on radio
Game.modules.quests.completeObjective("wake_up", "turn_on_radio");

// 7. Player opens map
Game.modules.quests.completeObjective("wake_up", "open_map");

// 8. Quest auto-completes, rewards applied
// +50 XP, +25 caps
```
