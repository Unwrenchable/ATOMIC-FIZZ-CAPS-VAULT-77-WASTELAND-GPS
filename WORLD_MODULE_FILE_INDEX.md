# 📟 WINDOW.WORLD - COMPLETE FILE INDEX

## Investigation Results: All Files Related to World Module

---

## 📂 FILES CURRENTLY LOADED

### Core Shim
- **`/public/js/game.overseer-bridge.js`**
  - Provides `window.world` shim
  - Methods: `getCurrentRegion()`, `getNearbyPOIs()`, `getPlayerLocation()`
  - Status: ✅ Working minimal implementation

### World Weather System
- **`/public/js/modules/worldWeather.js`**
  - Creates `Game.modules.world.weather`
  - Biome-specific weather patterns
  - Radiation storms
  - Status: ✅ Partially integrated

### World Map
- **`/public/js/modules/worldmap.js`**
  - Main GPS/map system
  - Calls `Game.modules.world.encounters.roll()` (fails)
  - Calls `Game.modules.world.state` (fails)
  - Status: ⚠️ Depends on missing world module

### DragonBones System (NPC Animations)
- **`/public/js/modules/dragonbones-npc.js`**
  - Main DragonBones loader
  - Creates `Game.modules.Dragon`
  - Status: ✅ Fully working

- **`/public/js/modules/npc-portraits.js`**
  - Portrait preloading/caching
  - Creates `window.NPCPortraits`
  - Status: ✅ Fully working

- **`/public/js/modules/fo4-dialogue.js`**
  - Fallout 4 dialogue system
  - Integrates DragonBones for NPC portraits
  - Status: ✅ Fully working

- **`/public/js/modules/character-creator.js`**
  - Character appearance system
  - DragonBones toggle support
  - Status: ✅ Fully working

### NPC Spawning
- **`/public/js/modules/npcSpawn.js`**
  - NPC encounter system
  - Preloads DragonBones for NPCs
  - Status: ✅ Working

- **`/public/js/modules/npcEncounter.js`**
  - NPC encounter management
  - Status: ✅ Working

- **`/public/js/modules/npc-registry.js`**
  - Global NPC registry
  - Status: ✅ Working

---

## 📂 FILES NOT LOADED (But Exist!)

### World Subsystems (`/public/js/world/`)

All these scripts exist but are **NOT** included in index.html:

1. **`/public/js/world/state.js`**
   - Exposes: `window.overseerWorldState`
   - Purpose: Central world state engine
   - Features:
     - Region tracking
     - Weather state
     - Faction control
     - Anomaly levels
     - Timeline distortions
     - World flags
     - Player state (hp, caps, inventory, reputation)
     - Event queue

2. **`/public/js/world/regions.js`**
   - Exposes: `window.overseerRegions`
   - Purpose: Region definitions and behaviors
   - Features:
     - Region personalities
     - Encounter weights
     - Threat levels
     - Quest chances
     - Anomaly levels
     - Quantity/rarity multipliers

3. **`/public/js/world/encounters.js`**
   - Exposes: `window.overseerEncounters`
   - Purpose: Procedural encounter generation
   - Features:
     - Timeline distortion checks
     - Anomaly encounters
     - Micro-quests
     - Faction patrols
     - Regional encounters
     - Combat/loot generation

4. **`/public/js/world/factions.js`**
   - Exposes: `window.overseerFaction`
   - Purpose: Faction control and reputation
   - Features:
     - Faction territory control
     - Reputation tracking
     - Reputation labels (HOSTILE, UNFRIENDLY, etc.)

5. **`/public/js/world/weather.js`**
   - Exposes: `window.overseerWeather`
   - Purpose: Weather pattern generation
   - Features:
     - Global weather
     - Biome-specific weather
     - Weather transitions

6. **`/public/js/world/loot.js`**
   - Exposes: `window.overseerLoot`
   - Purpose: Loot generation system
   - Features:
     - Region-based loot
     - Faction-based loot
     - NPC trait-based loot

7. **`/public/js/world/anomalies.js`**
   - Exposes: `window.overseerAnomalies`
   - Purpose: Wasteland anomaly encounters
   - Features:
     - Anomaly types
     - Effects and consequences

8. **`/public/js/world/timeline.js`**
   - Exposes: `window.overseerTimeline`
   - Purpose: Timeline distortion events
   - Features:
     - Unstable regions
     - Temporal echoes
     - Distortion chances

9. **`/public/js/world/microquests.js`**
   - Exposes: `window.overseerMicroquests`
   - Purpose: Mini-quest generation
   - Features:
     - Procedural objectives
     - Rewards
     - Context-aware generation

10. **`/public/js/world/npc_traits.js`**
    - Exposes: `window.overseerNpcTraits`
    - Purpose: NPC personality and behavior traits
    - Features:
      - Trait application
      - Group trait modifiers
      - Weather/region-based modifications

---

## 📂 OVERSEER CORE SCRIPTS

These are part of the Overseer AI system:

- **`/public/js/overseer/core.worldstate.js`**
  - Creates `window.overseerWorldState` (different from world/state.js)
  - Basic player/world state for Overseer AI
  - Status: Loaded but limited

- **`/public/js/overseer/core.faction.js`**
  - Faction scanning for Overseer AI
  - References `window.world.getCurrentRegion()`

- **`/public/js/overseer/core.weather.js`**
  - Weather information for Overseer AI

- **`/public/js/overseer/core.threat.js`**
  - Threat assessment for Overseer AI

---

## 📂 FILES THAT CALL WINDOW.WORLD

### window.world APIs

1. **`/public/js/encounters.js:48`**
   ```javascript
   const region = window.world.getCurrentRegion();
   ```

2. **`/public/js/quests.js:130`**
   ```javascript
   const nearby = window.world.getNearbyPOIs(500);
   ```

3. **`/public/js/overseer/core.faction.js:97`**
   ```javascript
   const world = window.world;
   const region = world.getCurrentRegion?.();
   ```

---

## 📂 FILES THAT CALL GAME.MODULES.WORLD

### Economy Module
**`/public/js/modules/economy.js`**
- Line 41: `const world = Game.modules.world;`
- Line 42: `world.state.economy.scarcity`
- Line 58: `world.state` (reputation lookup)
- Line 77: `world.weather.current.type`
- Line 92: `world.timeOfDay`

### Worldmap Module
**`/public/js/modules/worldmap.js`**
- Line 1027: `Game.modules.world.state`
- Line 1028: `Game.modules.world.encounters.roll()`

### Encounter Heatmap
**`/public/js/modules/encounterHeatmap.js`**
- Line 63: `const world = Game.modules.world;`
- Line 64: `world.encounters.getDangerLevel()`

### Weather Overlay
**`/public/js/modules/weatherOverlay.js`**
- Line 120: `Game.modules.world.weather`
- Line 131: `Game.modules.world.weather.at()`

### Factions Module
**`/public/js/modules/factions.js`**
- Line 49: `Game.modules.world.reputation.status()`
- Line 57: `Game.modules.world.reputation.adjust()`

### Collectables Module
**`/public/js/modules/collectables.js`**
- Line 47: `const world = Game.modules.world;`

---

## 📂 DRAGONBONES INTEGRATION FILES

All these files are **LOADED and WORKING**:

1. **`/public/js/modules/dragonbones-npc.js`**
   - Core DragonBones + Pixi.js loader
   - Creates `Game.modules.Dragon`
   - Features:
     - `init(stageContainerId)` - Initialize Pixi app
     - `loadArmatureJSON(pathBase)` - Load skeleton and textures
     - `createArmatureDisplay(name, anim, npcId)` - Create character
     - `getRandomVariation(npcId)` - Generate consistent variations

2. **`/public/js/modules/npc-portraits.js`**
   - Portrait management layer
   - Creates `window.NPCPortraits`
   - Features:
     - `preloadSVG(npc)` - Preload SVG portrait
     - `preloadDragonbones(npc, armatureBase)` - Preload animation
     - `showInDialog(npc, opts)` - Display in dialogue
     - `swapSkin(npcId, skin)` - Runtime skin changes

3. **`/public/js/modules/fo4-dialogue.js`**
   - Fallout 4 dialogue system
   - Features:
     - DragonBones NPC portraits in dialogue
     - Lip-sync support
     - SVG fallback
     - Line 727-761: DragonBones integration
     - Line 927-965: Lip-sync animations

4. **`/public/js/modules/npcSpawn.js`**
   - NPC encounter spawning
   - Line 57-63: DragonBones preloading
   - Randomly assigns armatures to NPCs

---

## 📂 DATA FILES

### NPC Data
- **`/public/data/npc/index.json`**
  - List of NPC JSON files
  
- **`/public/data/npc/*.json`**
  - Individual NPC definitions
  - Format includes:
    - `id`, `name`, `type`, `faction`
    - `appearance` object (SVG parts)
    - `armatureBase` (optional DragonBones path)
    - `dialogue` trees

### Character Appearance
- **`/public/data/character_creator/appearance_options.json`**
  - SVG part definitions for character creator

### DragonBones Assets
- **`/public/assets/dragonbones/`**
  - Directory for animation assets
  - **`README.txt`** - Setup instructions
  - Format: `name.json`, `name_tex.json`, `name_tex.png`

---

## 📂 EXTERNAL DEPENDENCIES (CDN)

### PixiJS + DragonBones
From `/public/index.html`:

```html
Line 73: <script src="https://cdn.jsdelivr.net/npm/pixi.js@6.5.8/dist/browser/pixi.min.js" defer></script>
Line 78: <script src="https://cdn.jsdelivr.net/npm/pixi5-dragonbones@5.7.0-2b/dragonBones.js" defer></script>
```

### Leaflet (Maps)
```html
Line 62: <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
Line 63: <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
```

---

## 📂 DOCUMENTATION

### Primary Docs
1. **`WORLD_MODULE_INVESTIGATION_REPORT.md`** (this report)
   - Complete investigation findings
   - Architecture analysis
   - Recommendations

2. **`WORLD_MODULE_QUICK_REFERENCE.md`**
   - Quick reference guide
   - API summaries
   - Fix options

3. **`WORLD_MODULE_VISUAL_SUMMARY.txt`**
   - ASCII art diagram
   - Visual architecture overview

4. **`WORLD_MODULE_FILE_INDEX.md`** (this file)
   - Complete file listing

### Existing Docs
5. **`/docs/DIALOGUE_FEATURES.md`**
   - Dialogue system documentation
   - DragonBones integration guide
   - Lines 188-209: DragonBones section

6. **`/public/assets/dragonbones/README.txt`**
   - DragonBones asset setup
   - Export instructions
   - Download links for DragonBones Pro

---

## 📂 SUMMARY BY STATUS

### ✅ WORKING (Loaded and Functional)
- `/public/js/game.overseer-bridge.js` (window.world shim)
- `/public/js/modules/worldWeather.js` (partial)
- `/public/js/modules/dragonbones-npc.js` (DragonBones runtime)
- `/public/js/modules/npc-portraits.js` (portrait system)
- `/public/js/modules/fo4-dialogue.js` (dialogue + animations)
- `/public/js/modules/character-creator.js` (appearance system)
- `/public/js/modules/npcSpawn.js` (NPC encounters)
- `/public/js/modules/npc-registry.js` (NPC tracking)

### ⚠️ PARTIAL (Loaded but with Dependencies on Missing Modules)
- `/public/js/modules/worldmap.js` (needs world.encounters, world.state)
- `/public/js/modules/economy.js` (needs world.state, world.reputation)
- `/public/js/modules/encounterHeatmap.js` (needs world.encounters)
- `/public/js/modules/weatherOverlay.js` (needs world.weather.at())
- `/public/js/modules/factions.js` (needs world.reputation)

### ❌ NOT LOADED (Exist But Not Included)
- `/public/js/world/state.js`
- `/public/js/world/regions.js`
- `/public/js/world/encounters.js`
- `/public/js/world/factions.js`
- `/public/js/world/weather.js`
- `/public/js/world/loot.js`
- `/public/js/world/anomalies.js`
- `/public/js/world/timeline.js`
- `/public/js/world/microquests.js`
- `/public/js/world/npc_traits.js`

### 🔧 NEEDS TO BE CREATED
- `/public/js/modules/world-bridge.js` (bridge between overseer* and Game.modules.world)

---

## 📊 FILE COUNT SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| Loaded & Working | 8 | ✅ |
| Loaded & Partial | 5 | ⚠️ |
| Exists But Not Loaded | 10 | ❌ |
| Needs Creation | 1 | 🔧 |
| **TOTAL** | **24** | |

---

📟 **Per Vault-Tec Protocol 77, all files accounted for.**  
**Next step: Load the world subsystems and create the bridge module.**

**Stay safe out there, Vault Dweller.** ☢️
