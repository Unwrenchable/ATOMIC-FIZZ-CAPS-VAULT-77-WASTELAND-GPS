# 🗺️ World Map System

The World Map is the heart of the Atomic Fizz Caps experience, powered by Leaflet.js with custom Fallout-themed overlays.

---

## Overview

The worldmap module (`worldmap.js`) provides an interactive, satellite-imagery map with POI markers, player tracking, and exploration features.

---

## Features

### Interactive Map
- **Satellite imagery** tiles from ArcGIS
- **Custom POI markers** with SVG icons
- **Player marker** with rotation based on heading
- **World labels** for regions and landmarks
- **Highway overlays** via TopoJSON

### Exploration Modes
- **Auto-Follow Mode**: Map automatically centers on player
- **Exploration Mode**: Free map browsing without snap-back
- **Manual Center**: Button to return to player position

### POI System
- Locations loaded from API or static JSON fallback
- Rarity-based coloring (Common → Legendary)
- Clickable markers for interaction
- Tooltips with location info

---

## Functions

### Initialization

#### `Game.modules.worldmap.init(gameState)`
Initializes the worldmap with game state.

```javascript
Game.modules.worldmap.init(window.DATA);
```

#### `Game.modules.worldmap.onOpen()`
Called when the map panel is opened. Initializes map if needed and centers on player.

---

### Player Position

#### `setPlayerPosition(lat, lng, opts)`
Updates the player's position on the map.

**Options:**
- `fromGPS`: Boolean - Triggers center on player
- `heading`: Number - Rotation angle in degrees

```javascript
Game.modules.worldmap.setPlayerPosition(36.11274, -115.174301, { fromGPS: true });
```

#### `updatePlayerPosition(lat, lng, opts)`
Alias for `setPlayerPosition()`.

#### `centerOnPlayer(fromGPS)`
Pans the map to the player's current position.

```javascript
Game.modules.worldmap.centerOnPlayer(true);
```

#### `manualCenterOnPlayer()`
Forces center on player regardless of exploration mode.

---

### Navigation

#### `toggleExplorationMode()`
Toggles between auto-follow and free exploration.

```javascript
const isExploring = Game.modules.worldmap.toggleExplorationMode();
// Returns: true if exploration mode is now active
```

#### `setPlayerHeading(deg)`
Sets the rotation of the player marker.

```javascript
Game.modules.worldmap.setPlayerHeading(45); // Face northeast
```

#### `computeHeading(lat1, lon1, lat2, lon2)`
Calculates compass heading between two points.

```javascript
const heading = Game.modules.worldmap.computeHeading(36.11, -115.17, 36.12, -115.16);
// Returns: degrees (0-360)
```

---

### Locations & POIs

#### `loadLocations()`
Loads location data from API or static fallback.

```javascript
await Game.modules.worldmap.loadLocations();
```

#### `renderPOIMarkers()`
Creates map markers for all loaded locations.

#### `createPOIMarker(loc, idx)`
Creates a single POI marker with:
- SVG icon based on location type
- Rarity-based styling
- Tooltip with name
- Popup with details
- Click handler for interaction

#### `onLocationClick(loc, idx)`
Handles player interaction with a POI:
1. Moves player to location
2. Checks for NPC encounters
3. Checks for world encounters
4. Triggers combat, merchant, or event as appropriate

---

### Messages & UI

#### `showMapMessage(text)`
Displays a message in the map log.

```javascript
Game.modules.worldmap.showMapMessage("You arrive at the settlement.");
```

#### `updateMapStatus(text)`
Updates the map status indicator.

```javascript
Game.modules.worldmap.updateMapStatus("Map online - Ready");
```

---

### Overlays

#### `loadWorldOverlays()`
Loads world labels from JSON.

#### `renderWorldLabels()`
Renders region and landmark labels on the map.

#### `updateOverlayVisibility(zoom)`
Adjusts overlay visibility based on zoom level.

---

### Offline Mode

#### `switchToOfflineMode()`
Activates canvas-based offline tiles when internet is unavailable.

```javascript
// Automatically triggered on tile load errors
Game.modules.worldmap.switchToOfflineMode();
```

---

### Cleanup

#### `destroy()`
Removes the map and cleans up resources.

```javascript
Game.modules.worldmap.destroy();
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `minZoom` | 3 | Minimum zoom level |
| `maxZoom` | 14 | Maximum zoom level |
| `followDelay` | 5000ms | Delay before auto-centering |
| `revealRadius` | 500m | Fog of war reveal radius |

---

## Map Bounds

The map covers:
- Northwest corner: `[70, -180]` (Alaska)
- Southeast corner: `[20, 180]` (All game locations)

---

## Events

### `map-ready`
Fired when map initialization is complete.

```javascript
window.addEventListener("map-ready", () => {
  // Map is ready for interaction
});
```

### `pipboyReady`
Triggers map initialization after boot screen.

---

## Encounter Handling

When a player clicks a POI, the map checks for:

1. **NPC Dialog** - If location has `npcId` or `dialogId`
2. **NPC Encounters** - Random NPC spawn based on location
3. **World Encounters** - Combat, merchant, boss, or event

### Encounter Types

| Type | Description |
|------|-------------|
| `none` | No encounter - simple arrival |
| `npc` | NPC approaches the player |
| `combat` | Hostile enemies attack |
| `merchant` | Trader caravan nearby |
| `boss` | Powerful enemy lurks |
| `event` | Special scripted event |
