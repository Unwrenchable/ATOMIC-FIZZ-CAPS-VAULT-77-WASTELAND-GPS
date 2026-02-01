# 📟 WINDOW.WORLD QUICK REFERENCE

## TL;DR - The Situation

**What exists:**
- ✅ Minimal `window.world` shim (2 methods)
- ✅ Full DragonBones NPC animation system
- ✅ Complete world subsystems in `/js/world/` (NOT LOADED)
- ✅ Weather system partially connected

**What's broken:**
- ❌ `Game.modules.world.encounters` - Expected but missing
- ❌ `Game.modules.world.reputation` - Expected but missing  
- ❌ `Game.modules.world.state` - Expected but missing
- ❌ World subsystem scripts not loaded in index.html

---

## Current window.world API

### Location: `/public/js/game.overseer-bridge.js`

```javascript
window.world.getCurrentRegion()   // Returns region object or fallback
window.world.getNearbyPOIs(500)   // Returns array of POIs
window.world.getPlayerLocation()  // Returns player location object
```

---

## What Modules Expect

### Expected by Economy Module:
```javascript
Game.modules.world.state.economy.scarcity  // "normal" | "high" | "low"
Game.modules.world.weather.current.type    // "clear" | "radstorm" | etc.
Game.modules.world.timeOfDay              // "day" | "night"
```

### Expected by Encounter Heatmap:
```javascript
Game.modules.world.encounters.getDangerLevel({ lat, lng, biome, region })
// Returns: 0-1 danger level
```

### Expected by Worldmap:
```javascript
Game.modules.world.state              // WorldState object
Game.modules.world.encounters.roll(worldState, locationData)
// Returns: encounter object
```

### Expected by Factions:
```javascript
Game.modules.world.reputation.status(worldState, factionId)
Game.modules.world.reputation.adjust(worldState, factionId, delta)
```

---

## DragonBones NPC System (WORKING)

### Usage:
```javascript
// NPC with DragonBones animation
const npc = {
  id: "merchant_01",
  name: "Marcus",
  armatureBase: "/assets/dragonbones/demo/hero",
  armatureName: "hero",
  appearance: { /* SVG fallback */ }
};

// Load and display
await Game.modules.Dragon.init('dragonbonesStage');
await Game.modules.Dragon.loadArmatureJSON(npc.armatureBase);
const display = await Game.modules.Dragon.createArmatureDisplay(
  npc.armatureName, 
  'idle', 
  npc.id
);
```

### Features:
- Automatic per-NPC variations (tint, speed, scale)
- SVG fallback if DragonBones fails
- Idle bobbing animations
- Lip-sync support
- Preloading and caching

---

## Unused World Subsystems

### Directory: `/public/js/world/` (NOT LOADED)

These scripts exist but are **not included in index.html**:

```
state.js          → window.overseerWorldState
regions.js        → window.overseerRegions
weather.js        → window.overseerWeather
factions.js       → window.overseerFaction
encounters.js     → window.overseerEncounters
loot.js           → window.overseerLoot
anomalies.js      → window.overseerAnomalies
timeline.js       → window.overseerTimeline
microquests.js    → window.overseerMicroquests
npc_traits.js     → window.overseerNpcTraits
```

---

## Quick Fix Options

### Option 1: Expand Shim (2-3 hours)
Add stub methods to prevent errors:

```javascript
Game.modules.world = {
  state: { economy: { scarcity: "normal" } },
  encounters: {
    roll: () => ({ type: "none" }),
    getDangerLevel: () => 0.5
  },
  reputation: {
    status: () => "NEUTRAL",
    adjust: () => {}
  }
};
```

### Option 2: Load Subsystems (4-6 hours)
Add to `index.html`:

```html
<!-- Before game modules -->
<script src="/js/world/state.js" defer></script>
<script src="/js/world/regions.js" defer></script>
<script src="/js/world/encounters.js" defer></script>
<script src="/js/world/factions.js" defer></script>

<!-- Bridge module -->
<script src="/js/modules/world-bridge.js" defer></script>
```

Create `/js/modules/world-bridge.js`:
```javascript
Game.modules.world = {
  state: window.overseerWorldState,
  encounters: {
    roll: (s, l) => window.overseerEncounters.rollEncounter(),
    getDangerLevel: (l) => {
      const region = window.overseerRegions.get(l.regionId);
      return region ? region.threat : 0.5;
    }
  },
  reputation: {
    status: (s, f) => window.overseerFaction.getReputation(f),
    adjust: (s, f, d) => window.overseerFaction.adjustReputation(f, d)
  }
};
```

---

## Files That Call window.world

1. `/public/js/encounters.js:48` - `getCurrentRegion()`
2. `/public/js/quests.js:130` - `getNearbyPOIs(500)`
3. `/public/js/overseer/core.faction.js:97` - Reference check

## Files That Call Game.modules.world

1. `/public/js/modules/economy.js` - `state.economy`, `weather`
2. `/public/js/modules/worldmap.js` - `state`, `encounters.roll()`
3. `/public/js/modules/encounterHeatmap.js` - `encounters.getDangerLevel()`
4. `/public/js/modules/weatherOverlay.js` - `weather.at()`
5. `/public/js/modules/factions.js` - `reputation.status()`, `reputation.adjust()`
6. `/public/js/modules/collectables.js` - Reference check

---

## NPC Visual System (WORKING)

### Three-Tier Fallback:

1. **DragonBones** (preferred)
   - Animated armature
   - Skinnable
   - Lip-sync capable

2. **SVG Composition** (fallback)
   - Static layered portrait
   - From `appearance.parts` or `parts` object

3. **Generic SVG** (last resort)
   - Simple icon

### Managed By:
- `Game.modules.Dragon` - DragonBones runtime
- `window.NPCPortraits` - Preloading/caching
- `Game.modules.FO4Dialogue` - Dialogue integration

---

## Key Takeaways

1. **DragonBones NPC animations are FULLY WORKING** ✅
2. **World subsystems EXIST but are DISCONNECTED** ⚠️
3. **Current shim is MINIMAL but FUNCTIONAL** ✅
4. **Multiple modules EXPECT full world module** ❌
5. **Fix required to prevent errors** ⚠️

---

## Recommended Action

**Implement Hybrid Approach (4-6 hours):**
1. Load core world scripts (state, regions, encounters, factions)
2. Create bridge module connecting them to Game.modules.world
3. Update consumer modules to use consistent API
4. Test encounter generation and faction system
5. Document for future expansion

This restores critical functionality while leaving door open for full feature set.

---

📟 **Overseer Out.** ☢️
