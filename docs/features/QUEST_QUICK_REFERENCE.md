# 🎮 Quest System Quick Reference

## For Developers

### The Problem (Fixed)
Quest progress was lost on page reload because state was never saved to localStorage.

### The Solution
Added automatic state persistence after every quest state change.

## Using the Quest System

### Starting a Quest
```javascript
const quests = Game.modules.quests;
quests.startQuest('wake_up');
// ✅ State automatically saved
```

### Completing an Objective
```javascript
quests.completeObjective('wake_up', 'open_inventory');
// ✅ State automatically saved
```

### Quest Completion
```javascript
// Happens automatically when all objectives complete
// ✅ Rewards distributed
// ✅ State saved
```

## Storage Keys

### Primary Storage
- `afc_quest_state` - Quest state backup

### Unified Player State
- `afc_unified_player_state_v2`
  - `.questObjectives` - Full quest state
  - `.questsActive` - Active quest IDs
  - `.questsCompleted` - Completed quest IDs

## Testing

### Quick Test (Browser)
```bash
open http://localhost:3000/test-quest-system.html
```

### Integration Test (Node.js)
```bash
node test-quest-persistence.js
```

## Common Issues

### Quest progress lost on reload?
**Fixed!** State now persists automatically.

### Rewards not being awarded?
**Fixed!** Syntax error in reward distribution corrected.

### How to clear test data?
```javascript
localStorage.removeItem('afc_quest_state');
localStorage.removeItem('afc_unified_player_state_v2');
localStorage.removeItem('afc_player_state_v1');
```

## Console Debugging

All quest operations log with `[quests]` prefix:
```
[quests] Quest started: wake_up
[quests] Quest state saved to localStorage
[quests] Objective complete: wake_up → open_inventory
[quests] Quest completed: wake_up
```

## API Reference

### Key Functions
- `startQuest(questId)` - Start a quest (auto-saves)
- `completeObjective(questId, objectiveId)` - Complete objective (auto-saves)
- `saveQuestState()` - Manual save (called automatically)
- `loadQuestState()` - Load saved state (called on init)

### Quest State Structure
```javascript
{
  state: "not_started" | "active" | "completed",
  currentStepIndex: 0,
  objectives: {
    objective_id: true/false
  }
}
```

## More Info
- Technical details: `QUEST_SYSTEM_FIXES.md`
- Full report: `QUEST_SYSTEM_FINAL_REPORT.md`
- Code: `public/js/modules/quests.js` (lines ~730-780)
