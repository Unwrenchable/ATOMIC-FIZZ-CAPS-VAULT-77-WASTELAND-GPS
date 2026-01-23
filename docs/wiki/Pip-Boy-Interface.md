# 📟 Pip-Boy Interface

The Pip-Boy is the main game interface, providing access to all game features through a tabbed navigation system.

---

## Overview

The Pip-Boy shell (`pipboy.js`) manages panel switching, tab navigation, and core UI interactions.

---

## Panels

| Panel | Key | Description |
|-------|-----|-------------|
| Map | `map` | World map and exploration |
| Stat | `stat` | Player statistics and perks |
| Items | `items` | Inventory management |
| Quests | `quests` | Quest log and objectives |
| Radio | `radio` | Wasteland radio stations |
| Exchange | `exchange` | Trading and marketplace |

---

## Functions

### `setActivePanel(panelKey)`
Switches to the specified panel and updates tab highlighting.

```javascript
setActivePanel("map");      // Show map panel
setActivePanel("items");    // Show inventory
setActivePanel("quests");   // Show quest log
```

### Panel-Specific Behaviors

When panels are activated, they trigger specific actions:

#### Map Panel
- Calls `Game.modules.worldmap.onOpen()`
- Invalidates map size for proper rendering
- Completes "Wake Up" quest objective: `open_map`

#### Items Panel
- Completes "Wake Up" quest objective: `open_inventory`

#### Quests Panel
- Calls `Game.ui.renderQuest()` to update quest display

#### Radio Panel
- Completes "Wake Up" quest objective: `turn_on_radio`

---

## Navigation

### Tab Click
Click any tab to switch panels.

```javascript
// Tabs have data-pipboy-tab attribute
<div class="pipboy-tab" data-pipboy-tab="panel-map">MAP</div>
```

### Swipe Navigation
Swipe left/right to navigate between tabs (mobile).

| Direction | Action |
|-----------|--------|
| Swipe Right | Previous tab |
| Swipe Left | Next tab |
| Threshold | 50px |

---

## Sidebar Actions

Quick action buttons in the sidebar:

| Button | ID | Action |
|--------|----|--------|
| Inventory | `openInventory` | Opens Items panel |
| Quests | `openQuests` | Opens Quests panel |
| Tutorial | `openTutorial` | Opens Stat panel |

---

## Claim System

Claim buttons trigger loot collection:

```javascript
// Multiple claim button IDs
- claimMintablesSidebar
- claimMintables  
- claimMintablesStat
```

Calls `window.claimMintables()` when clicked.

---

## Wallet Connection

Connect wallet buttons:

```javascript
// Button IDs
- connectWallet
- connectWalletStat
```

Calls `Game.connectWallet()` or `window.connectWallet()`.

After connection:
- Button text updates to truncated address
- Adds `connected` class for styling

---

## Events

### `pipboyReady`
Fired when Pip-Boy UI initialization is complete.

```javascript
window.dispatchEvent(new Event("pipboyReady"));

// Listen for it
window.addEventListener('pipboyReady', () => {
  // Pip-Boy is ready
});
```

---

## Boot Sequence

1. Pip-Boy initializes on page load
2. Sets active panel to `map` by default
3. Dispatches `pipboyReady` event
4. Worldmap initializes on receiving event

---

## Quest Integration

Panel switches can complete quest objectives:

```javascript
// Automatic quest hooks
Game.quests?.completeObjective("wake_up", "open_map");
Game.quests?.completeObjective("wake_up", "open_inventory");
Game.quests?.completeObjective("wake_up", "turn_on_radio");
Game.quests?.completeObjective("wake_up", "switch_tabs");
```

---

## Styling

Panels use CSS classes for visibility:

```css
.pipboy-panel.active { display: block; }
.pipboy-panel.hidden { display: none; }
.pipboy-tab.active { /* highlighted state */ }
```
