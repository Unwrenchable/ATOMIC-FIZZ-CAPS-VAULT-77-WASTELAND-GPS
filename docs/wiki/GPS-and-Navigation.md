# 🛰️ GPS and Navigation System

The GPS system provides real-time location tracking that powers the wasteland exploration experience.

---

## Overview

The GPS module (`gps.js`) integrates your device's geolocation with the game world, making your real-world movements translate to in-game exploration.

---

## Features

### Real-Time Position Tracking
- Uses `navigator.geolocation.watchPosition()` for continuous tracking
- High accuracy mode enabled for precise positioning
- Automatic updates every 2 seconds (maximum age)

### GPS Status Indicators
| Status | Badge | Description |
|--------|-------|-------------|
| `LOCKED` | 🟢 Green | High accuracy (< 50m) |
| `TRACKING` | 🟡 Yellow | Fair accuracy (> 50m) |
| `ACQUIRING...` | 🟡 Yellow | Searching for signal |
| `ERROR` | 🔴 Red | GPS error occurred |
| `UNAVAILABLE` | 🔴 Red | Device doesn't support GPS |
| `OFFLINE` | 🔴 Red | GPS not initialized |

### Snap-to-Player
- Automatically centers map on your current position
- Can be toggled on/off with `setSnapToPlayer(enabled)`
- Works with the worldmap's auto-follow system

---

## Functions

### `Game.gps.init()`
Initializes the GPS system. Called automatically when map is ready.

```javascript
// Automatically triggered by map-ready event
window.addEventListener("map-ready", () => {
  Game.gps.init();
});
```

### `Game.gps.startWatch()`
Starts the geolocation watcher for continuous tracking.

### `Game.gps.handlePosition(pos)`
Processes incoming GPS coordinates and updates:
- Internal coordinates state
- Game state player position
- Worldmap player marker
- GPS badge status

### `Game.gps.updateGPSBadge(status)`
Updates the visual GPS indicator with current status.

```javascript
Game.gps.updateGPSBadge('good');   // Green - locked
Game.gps.updateGPSBadge('fair');   // Yellow - tracking
Game.gps.updateGPSBadge('error');  // Red - error
```

### `Game.gps.ensurePlayerPosition()`
Returns the current GPS coordinates.

```javascript
const coords = Game.gps.ensurePlayerPosition();
// { lat: 36.11274, lng: -115.174301 }
```

### `Game.gps.setSnapToPlayer(enabled)`
Toggle automatic map centering on player position.

```javascript
Game.gps.setSnapToPlayer(true);  // Enable auto-center
Game.gps.setSnapToPlayer(false); // Allow free map browsing
```

---

## Integration with Worldmap

The GPS system integrates directly with the worldmap module:

1. GPS position updates trigger `worldmap.updatePlayerPosition()`
2. Player marker moves to new coordinates
3. Map pans to follow player (if auto-follow enabled)
4. Fog of War reveals around new position
5. Location encounters may trigger at POIs

---

## Events

### `map-ready`
Triggers GPS initialization when the worldmap is fully loaded.

```javascript
window.addEventListener("map-ready", () => {
  // GPS starts watching position
});
```

---

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `enableHighAccuracy` | `true` | Requests best possible accuracy |
| `maximumAge` | `2000` | Max age of cached position (ms) |
| `timeout` | `15000` | How long to wait for position (ms) |

---

## Privacy Note

GPS data is only used locally for gameplay. Your position is not stored on servers unless you explicitly claim a location for rewards.
