# 🤖 Overseer Terminal

The Overseer Terminal is an AI-powered assistant that provides real-time status reports, location intel, and quest guidance.

---

## Overview

The Overseer is your personal AI companion, watching over you from Vault-77. It processes game state data and provides contextual information, warnings, and guidance through a retro-style terminal interface.

---

## Features

- **Real-Time Status Reports**: Player health, rads, caps, and more
- **Location Scanning**: Intel on current and nearby locations
- **Quest Guidance**: Objective hints and progress tracking
- **Weather Forecasts**: Radiation storm warnings
- **Faction Assessments**: Threat levels and reputation status
- **Memory System**: Remembers your journey
- **Personality Engine**: Unique AI character with opinions

---

## Accessing the Terminal

### From Pip-Boy
Click the **OVERSEER** button in the sidebar to open the terminal in a popup window.

### Direct URL
Navigate to `/overseer.html` directly.

---

## Commands

### Status Commands

| Command | Description |
|---------|-------------|
| `STATUS` | Full player status report |
| `HEALTH` | Current HP and condition |
| `INVENTORY` | Inventory summary |
| `CAPS` | Current caps balance |
| `LEVEL` | XP and level progress |

### Location Commands

| Command | Description |
|---------|-------------|
| `LOCATION` | Current position info |
| `SCAN` | Scan nearby areas |
| `ZONES` | List known zones |
| `DISTANCE [poi]` | Distance to POI |

### Quest Commands

| Command | Description |
|---------|-------------|
| `QUESTS` | Active quest list |
| `OBJECTIVE` | Current quest objective |
| `QUEST [name]` | Specific quest details |

### Faction Commands

| Command | Description |
|---------|-------------|
| `FACTIONS` | Faction standings |
| `REP [faction]` | Reputation with faction |
| `THREATS` | Hostile faction warnings |

### World Commands

| Command | Description |
|---------|-------------|
| `WEATHER` | Current weather status |
| `TIME` | In-game time |
| `WORLD` | World state summary |
| `RADIO` | Radio station status |

### System Commands

| Command | Description |
|---------|-------------|
| `HELP` | List all commands |
| `MEMORY` | Overseer memory summary |
| `CLEAR` | Clear terminal output |
| `CLOSE` | Close terminal window |

---

## AI Personality

The Overseer has a distinct personality:

- **Tone**: Professional but occasionally sarcastic
- **Concern**: Genuinely cares about your survival
- **Opinions**: Has thoughts about your decisions
- **Humor**: Dry wasteland wit

### Example Responses

```
> STATUS
VITAL SIGNS DETECTED. BARELY.
HP: 45/100 — "This is concerning."
RADS: 120 — "You're glowing. Not a compliment."
CAPS: 847 — "Adequate. I've seen worse."
LOCATION: Mojave Outpost — "Stay vigilant."
```

```
> SCAN
SCANNING LOCAL AREA...
[!] Raider camp detected 500m NW
[?] Unknown structure 800m E
[✓] Water source 300m S
RECOMMENDATION: Avoid the raiders. Hydrate.
```

---

## Memory System

The Overseer remembers your journey:

### Tracked Events
- Regions visited
- POIs discovered
- Quests completed
- Encounters survived
- Radiation exposure events

### Memory Summary

```
> MEMORY
OVERSEER MEMORY SUMMARY
  Regions visited: 12
  POIs discovered: 47
  Quests tracked: 8
  Encounters survived: 156
  Radiation events: 23
NOTE: I remember everything. For your safety.
```

---

## Threat Assessment

The Overseer monitors threats:

### Threat Levels

| Level | Color | Description |
|-------|-------|-------------|
| NONE | Green | All clear |
| LOW | Blue | Minor threats |
| MODERATE | Yellow | Exercise caution |
| HIGH | Orange | Danger present |
| CRITICAL | Red | Immediate threat |

### Example Alert

```
⚠️ THREAT ASSESSMENT: HIGH
Hostile faction presence detected.
Super Mutant patrol 200m ahead.
Recommended action: EVADE or PREPARE FOR COMBAT
Estimated enemy count: 3-5
Average threat level: Dangerous
```

---

## Weather Reports

Real-time weather monitoring:

```
> WEATHER
CURRENT CONDITIONS:
  Type: Radiation Storm
  Severity: Moderate
  Duration: ~45 minutes
  Rads/min: 2

FORECAST:
  Next 2 hours: Storm continues
  Tomorrow: Clear skies expected

ADVISORY: Seek shelter. Your skin will thank you.
```

---

## Faction Intelligence

Track your standing with wastelanders:

```
> FACTIONS
FACTION STANDINGS:
  NCR .............. [+++++-----] LIKED
  Brotherhood ...... [+++-------] NEUTRAL  
  Raiders .......... [----------] HOSTILE
  Merchants ........ [+++++++---] FRIENDLY

NOTE: Your choices matter. Everyone's watching.
```

---

## Integration

### With Game State

```javascript
// Terminal reads from game state
const status = {
  player: gameState.player,
  location: gameState.currentLocation,
  weather: Game.modules.weather.current,
  quests: Game.modules.quests.active
};
```

### With Main Game

The terminal communicates via postMessage:

```javascript
// Parent window receives updates
window.addEventListener('message', (e) => {
  if (e.data.type === 'TERMINAL_COMMAND') {
    handleOverseerCommand(e.data.command);
  }
});
```

---

## Engine Architecture

The Overseer is powered by multiple AI engines:

```
┌─────────────────────────────────────────┐
│           OVERSEER BRAIN                │
├─────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────────────┐   │
│  │Personality│  │   Memory Engine   │   │
│  └───────────┘  └───────────────────┘   │
│  ┌───────────┐  ┌───────────────────┐   │
│  │   Lore    │  │  Faction Engine   │   │
│  └───────────┘  └───────────────────┘   │
│  ┌───────────┐  ┌───────────────────┐   │
│  │  Threat   │  │  Weather Engine   │   │
│  └───────────┘  └───────────────────┘   │
│  ┌─────────────────────────────────────┐│
│  │        World State Engine          ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

---

## Red Menace Mini-Game

The terminal includes a hidden mini-game:

```
> REDMENACE
LOADING RED MENACE v1.0...

   [COMMUNIST ALIENS INCOMING]
   
        ^
      <-|->
   
   [←] MOVE  [FIRE] SHOOT  [→] MOVE
```

---

## Configuration

Terminal behavior can be customized:

| Setting | Default | Description |
|---------|---------|-------------|
| Verbose mode | false | Extra detail in responses |
| Auto-alerts | true | Automatic threat warnings |
| Sound effects | true | Terminal beeps and boops |
| CRT effect | true | Retro screen filter |

---

## Troubleshooting

### "Terminal Not Responding"
Refresh the terminal window or restart from Pip-Boy.

### "Data Not Syncing"
Ensure main game window is still open.

### "Commands Not Recognized"
Type `HELP` for command list. Commands are case-insensitive.

---

*"The Overseer sees all. The Overseer judges all. The Overseer has opinions about your inventory management."* — VBOT-77 Initialization Sequence
