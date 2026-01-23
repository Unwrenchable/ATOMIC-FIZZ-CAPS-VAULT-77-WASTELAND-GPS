# 💬 Narrative System

The Narrative System handles NPC dialogs, branching conversations, and story-driven interactions.

---

## Overview

The narrative module (`narrative.js`) manages dynamic dialog loading, condition checking, and conversation flow.

---

## Features

- **Lazy Loading**: Dialogs loaded on demand
- **Condition System**: Flags and stats control dialog branches
- **Priority-Based Selection**: Best matching node shown
- **Quest Integration**: Dialogs can offer quests
- **State Management**: Flags persist across conversations

---

## Functions

### Dialog Opening

#### `Game.modules.narrative.openForNpc(npcId)`
Opens dialog for an NPC by ID.

```javascript
Game.modules.narrative.openForNpc("rex");
// Loads dialog_rex.json and shows best node
```

#### `Game.modules.narrative.openByDialogId(dialogId)`
Opens dialog directly by dialog file ID.

```javascript
Game.modules.narrative.openByDialogId("dialog_rex");
```

---

### Dialog Resolution

#### `resolveDialogIdFromNpc(npcId)`
Converts NPC ID to dialog file ID.

```javascript
Game.modules.narrative.resolveDialogIdFromNpc("rex");
// Returns: "dialog_rex"

Game.modules.narrative.resolveDialogIdFromNpc("dialog_rex");
// Returns: "dialog_rex" (unchanged)
```

---

### Dialog Loading

#### `ensureDialogLoaded(dialogId)`
Loads dialog JSON if not already cached.

```javascript
const dialog = await Game.modules.narrative.ensureDialogLoaded("dialog_rex");
```

Loads from `/data/dialog_<id>.json`.

---

### Node Selection

#### `pickBestNode(dialog)`
Selects the most appropriate dialog node.

**Priority Order:**
1. **Intro** - First meeting dialog
2. **Quest Nodes** - Quest-related dialog
3. **Emotional Nodes** - Mood-based dialog
4. **Knowledge Nodes** - Information-based dialog
5. **Fallback** - Default dialog

```javascript
const node = Game.modules.narrative.pickBestNode(dialog);
```

---

### Condition Checking

#### `checkConditions(conditions, ctx)`
Checks if all conditions are met.

```javascript
const ctx = { flags: { met_rex: true }, stats: { hp: 50 } };
const ok = Game.modules.narrative.checkConditions(
  ["flag:met_rex", "stat:hp>=30"],
  ctx
);
// Returns: true
```

#### `checkSingleCondition(cond, ctx)`
Checks a single condition.

**Flag Conditions:**
```javascript
"flag:met_rex"   // Flag must be set
"!flag:met_rex"  // Flag must NOT be set
```

**Stat Conditions:**
```javascript
"stat:hp<=30"    // HP <= 30
"stat:hp>=100"   // HP >= 100
"stat:rads>50"   // Rads > 50
```

**Operators:** `<=`, `>=`, `==`, `!=`, `<`, `>`

---

### UI Functions

#### `showDialogPanel()`
Shows the dialog panel and hides others.

```javascript
Game.modules.narrative.showDialogPanel();
```

#### `closeDialog()`
Closes dialog and returns to previous panel.

```javascript
Game.modules.narrative.closeDialog();
```

#### `renderNode(node, dialog)`
Renders a dialog node to the UI.

```javascript
Game.modules.narrative.renderNode(node, dialog);
```

---

## Dialog Structure

### Full Dialog File
```javascript
{
  "id": "dialog_rex",
  "npc": "Fizzmaster Rex",
  
  "intro": {
    "id": "first_meeting",
    "text": "Hey there, wastelander! First time at the station?",
    "conditions": ["!flag:met_rex"],
    "set_flags": ["met_rex"]
  },
  
  "quest_nodes": [
    {
      "id": "quest_offer",
      "text": "Got a job for you, if you're interested.",
      "conditions": ["flag:met_rex", "!flag:accepted_rex_quest"],
      "offers_quest": "rex_radio_tower"
    }
  ],
  
  "emotional_nodes": [
    {
      "id": "low_health",
      "text": "You look rough. Need a stimpak?",
      "conditions": ["stat:hp<=30"]
    }
  ],
  
  "knowledge_nodes": [
    {
      "id": "info_wastes",
      "text": "The wastes are dangerous, but you know that.",
      "conditions": ["flag:met_rex"]
    }
  ],
  
  "fallback": {
    "id": "generic",
    "text": "Stay tuned to Atomic Fizz Radio!"
  }
}
```

### Dialog Node
```javascript
{
  "id": "node_id",
  "text": "Dialog text shown to player",
  "conditions": ["flag:X", "stat:hp>=50"],
  "set_flags": ["new_flag"],
  "offers_quest": "quest_id"
}
```

---

## State Management

### Flags
Binary true/false states:

```javascript
// Access via
GAME_STATE.flags.met_rex = true;
GAME_STATE.flags.completed_quest = true;
```

### Stats
Numeric values:

```javascript
// Access via
GAME_STATE.stats.hp = 75;
GAME_STATE.stats.rads = 25;
```

---

## Quest Integration

Dialogs can offer quests:

```javascript
{
  "id": "quest_offer",
  "text": "I need someone to fix the radio tower.",
  "offers_quest": "rex_radio_tower"
}
```

When shown, calls:
```javascript
Game.modules.main.activateQuest("rex_radio_tower");
```

---

## Flag Setting

Dialogs can set flags when shown:

```javascript
{
  "id": "first_meeting",
  "set_flags": ["met_rex", "knows_about_radio"]
}
```

Flags are set before rendering.

---

## Panel Management

Remembers previous panel for restoration:

```javascript
// Store current panel before showing dialog
this.lastPanelId = activePanel.id;

// Restore when dialog closes
closeDialog() {
  const restoreId = this.lastPanelId || "panel-map";
  // Restore previous panel
}
```

---

## Example: Conversation Flow

```javascript
// 1. Player interacts with NPC
Game.modules.narrative.openForNpc("rex");

// 2. Dialog loads from /data/dialog_rex.json

// 3. System checks conditions for each node
const ctx = {
  flags: { met_rex: false },  // First meeting
  stats: { hp: 100 }
};

// 4. Intro matches (no met_rex flag)
// Shows: "Hey there, wastelander! First time at the station?"

// 5. Sets flag: met_rex = true

// 6. Player closes dialog
Game.modules.narrative.closeDialog();

// 7. Next interaction:
Game.modules.narrative.openForNpc("rex");

// 8. Intro no longer matches (has met_rex flag)
// Quest node or knowledge node shown instead
```

---

## UI Elements

### Dialog Panel
```html
<div id="panel-dialog" class="pipboy-panel">
  <div id="dialogBody">
    <div class="dialog-header-row">
      <span class="dialog-npc-name">NPC Name</span>
    </div>
    <div class="dialog-text">
      Dialog text here...
    </div>
  </div>
  <button id="dialogCloseBtn">CLOSE</button>
</div>
```
