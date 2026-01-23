# 🌫️ Fog of War

The Fog of War system darkens unexplored map areas and reveals terrain as the player explores.

---

## Overview

The fog of war module (`fogOfWar.js`) creates an exploration mechanic where undiscovered areas remain hidden until visited.

---

## Features

- **Darkened Unexplored Areas**: 75% opacity overlay
- **Circular Reveal**: 500m radius around player
- **Persistent Exploration**: Progress saved to localStorage
- **Map Integration**: Custom Leaflet pane above tiles

---

## Functions

### Initialization

#### `Game.modules.fogOfWar.init()`
Sets up fog overlay and hooks into movement.

```javascript
Game.modules.fogOfWar.init();
```

Creates:
- Custom Leaflet pane (`fogPane`) at z-index 600
- Full-map dark rectangle overlay
- GeoJSON layer for reveal masks

---

### Exploration

#### `reveal(lat, lng)`
Reveals area around specified coordinates.

```javascript
Game.modules.fogOfWar.reveal(36.11274, -115.174301);
```

- Creates 500m radius circle using Turf.js
- Adds to reveal layer with blend mode
- Saves exploration progress

**Movement Threshold:** Only reveals if moved > 10m from last position.

---

### Persistence

#### `saveState()`
Saves revealed areas to localStorage.

```javascript
Game.modules.fogOfWar.saveState();
// Saved to "fow_revealed_v1"
```

#### `loadState()`
Loads previously revealed areas.

```javascript
const revealed = Game.modules.fogOfWar.loadState();
// Array of GeoJSON circle features
```

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `revealRadius` | 500 | Reveal radius in meters |
| `fogOpacity` | 0.75 | Darkness of unexplored areas |
| `minMoveThreshold` | 10 | Min meters to trigger reveal |

---

## Technical Implementation

### Fog Layer
```javascript
// Full map dark overlay
this.fogLayer = L.rectangle(worldmap.map.getBounds(), {
  pane: "fogPane",
  color: "#000",
  weight: 0,
  fillOpacity: 0.75
});
```

### Reveal Masking
Uses CSS blend mode to cut holes in fog:

```css
.fog-reveal {
  mix-blend-mode: destination-out;
}
```

### Circle Generation
Uses Turf.js for accurate geographic circles:

```javascript
const circle = turf.circle([lng, lat], this.revealRadius / 1000, {
  steps: 32,
  units: "kilometers"
});
```

---

## Movement Hook

The fog module patches worldmap's `setPlayerPosition`:

```javascript
patchMovement(worldmap) {
  const originalSetPos = worldmap.setPlayerPosition.bind(worldmap);

  worldmap.setPlayerPosition = (lat, lng, opts = {}) => {
    originalSetPos(lat, lng, opts);
    this.reveal(lat, lng);  // Auto-reveal on movement
  };
}
```

---

## Layer Structure

```
┌─────────────────────────────────────┐
│         POI Markers (z: 700)        │
├─────────────────────────────────────┤
│         Fog Layer (z: 600)          │
│  ┌─────────────────────────────────┐│
│  │     Dark Overlay (75% opacity)  ││
│  │  ┌───────────────────────────┐  ││
│  │  │ Reveal Circles (blend-out)│  ││
│  │  └───────────────────────────┘  ││
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│      Weather Overlay (z: 450)       │
├─────────────────────────────────────┤
│        Base Map Tiles (z: 0)        │
└─────────────────────────────────────┘
```

---

## Styling

CSS injected by module:

```css
.fog-reveal {
  mix-blend-mode: destination-out;
}
```

The `destination-out` blend mode creates transparent cutouts in the fog layer.

---

## Data Format

Revealed areas stored as GeoJSON features:

```javascript
{
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      // 32-point circle approximation
      [[-115.17, 36.12], [-115.16, 36.11], ...]
    ]
  }
}
```

---

## Integration

### With GPS
Player movement automatically reveals fog:

```javascript
// GPS position update triggers reveal
gameState.player.position = { lat, lng };
worldmap.setPlayerPosition(lat, lng);
// ↓ patched to call
fogModule.reveal(lat, lng);
```

### With Worldmap
Uses worldmap's map instance and pane system.

---

## Exploration Progress

Progress persists across sessions:

1. **New Player**: Map starts fully fogged
2. **First Movement**: 500m circle revealed
3. **Continued Play**: More areas uncovered
4. **Reload**: Previously explored areas restored

---

## Example

```javascript
// Initialize fog system
Game.modules.fogOfWar.init();

// Player moves to new location
Game.modules.worldmap.setPlayerPosition(36.12, -115.18, { fromGPS: true });
// Fog automatically reveals around new position

// Check explored areas
const explored = Game.modules.fogOfWar.revealed;
console.log(`Explored ${explored.length} locations`);
```

---

## Performance Notes

- Reveal circles use 32 vertices (good balance)
- Only reveals on significant movement (>10m)
- GeoJSON layering efficient for rendering
- localStorage has ~5MB limit (plenty for exploration data)
