# 🌤️ Weather System

The Weather System provides dynamic, region-aware weather effects that impact gameplay and atmosphere.

---

## Overview

The weather module (`weather.js`) generates weather conditions based on region, faction control, anomaly levels, and timeline stability.

---

## Features

- **Region-Specific Weather**: Different biomes have different weather patterns
- **Faction Influence**: Faction-controlled areas have unique weather
- **Anomaly Effects**: High anomaly regions spawn strange weather
- **Timeline Distortions**: Unstable timelines affect weather
- **Gameplay Modifiers**: Weather affects economy and encounters

---

## Weather Types

### Standard Weather
| Type | Description |
|------|-------------|
| `clear` | Normal conditions |
| `cloudy` | Overcast skies |
| `storm` | Standard thunderstorm |
| `rad_storm` | Radioactive storm |
| `heatwave` | Extreme heat |
| `cold_snap` | Freezing cold |

### Anomaly Weather
| Type | Description |
|------|-------------|
| `anomaly_surge` | Reality distortion |
| `distortion_fog` | Strange visibility effects |
| `static_haze` | Electronic interference |
| `gamma_lightning` | Irradiated lightning |

### Faction Weather
| Type | Faction | Description |
|------|---------|-------------|
| `emp_storm` | The Circuit | Electronic disruption |
| `ritual_fog` | Hollow Choir | Mystical fog |
| `chemical_smog` | FizzCo Remnants | Industrial pollution |

---

## Functions

### Weather Generation

#### `overseerWeather.rollWeather()`
Generates new weather based on current conditions.

```javascript
const weather = overseerWeather.rollWeather();
// { type: "rad_storm", anomaly: 0.4, faction: "ncr", region: "mojave", timestamp: ... }
```

#### `overseerWeather.getCurrent()`
Gets current weather or generates new if none.

```javascript
const weather = overseerWeather.getCurrent();
```

#### `overseerWeather.updateWeather()`
Forces weather update and dispatches events.

```javascript
const newWeather = overseerWeather.updateWeather();
```

---

## Weather Probabilities

### Base Weights
```javascript
const BASE_WEATHER = {
  clear: 1,
  cloudy: 1,
  storm: 0.5,
  rad_storm: 0.1,
  heatwave: 0.3,
  cold_snap: 0.3
};
```

### Anomaly Weather (when anomaly > 0.3)
```javascript
const ANOMALY_WEATHER = {
  anomaly_surge: 0.4,
  distortion_fog: 0.3,
  static_haze: 0.2,
  gamma_lightning: 0.1
};
```

### Faction Weather
```javascript
const FACTION_WEATHER = {
  "the_circuit": { emp_storm: 0.4, static_haze: 0.3 },
  "hollow_choir": { ritual_fog: 0.5 },
  "fizzco_remnants": { chemical_smog: 0.5 }
};
```

---

## Weather Calculation

Weather is determined by combining multiple factors:

```javascript
function rollWeather() {
  let table = { ...BASE_WEATHER };
  
  // 1. Region bias
  if (region.weatherBias) {
    table[region.weatherBias] += 1.5;
  }
  
  // 2. Anomaly influence (if anomalyLevel > 0.3)
  for (const [type, weight] of ANOMALY_WEATHER) {
    table[type] += weight * anomalyLevel;
  }
  
  // 3. Faction influence
  if (FACTION_WEATHER[faction]) {
    for (const [type, weight] of FACTION_WEATHER[faction]) {
      table[type] += weight;
    }
  }
  
  // 4. Timeline instability
  if (Timeline.isUnstable(regionId)) {
    table["distortion_fog"] += 0.5;
    table["static_haze"] += 0.5;
  }
  
  return weightedPick(table);
}
```

---

## Weather Object

```javascript
{
  type: "rad_storm",      // Weather type ID
  anomaly: 0.4,           // Current anomaly level
  faction: "ncr",         // Controlling faction
  region: "mojave",       // Current region
  timestamp: 1705123456   // When weather was generated
}
```

---

## Visual Overlay

The weather overlay module (`weatherOverlay.js`) renders visual effects:

### CSS Classes
| Weather | Class | Effect |
|---------|-------|--------|
| Rad Storm | `weather-radstorm` | Green pulsing glow |
| Fog | `weather-fog` | Blur + dim overlay |
| Dust | `weather-dust` | Tan-colored overlay |
| Rain | `weather-rain` | Static texture animation |
| Gamma Lightning | `weather-gamma` | Flash animation |

### Overlay Functions

#### `weatherOverlay.init()`
Creates weather pane and hooks into map movement.

#### `weatherOverlay.updateWeather()`
Fetches current weather and applies visual effect.

#### `weatherOverlay.applyWeather(type)`
Applies CSS class for weather type.

---

## Gameplay Effects

### Economy
Weather affects prices in the economy module:

```javascript
Game.modules.economy.getWeatherModifier();
// rad_storm: 1.15 (15% price increase)
// acid_rain: 1.10 (10% price increase)
// other: 1.0 (no change)
```

### Encounters
Weather can modify encounter types and difficulty.

### Visibility
Fog and storms may reduce detection range.

---

## Integration

### With Overseer
Weather changes trigger Overseer events:

```javascript
window.overseer.handleGameEvent({
  type: "weather_change",
  payload: { id: weather.type }
});
```

### With World State
Weather stored in `WorldState.currentWeather`.

### With Map
Weather overlay renders on custom Leaflet pane.

---

## Example Usage

```javascript
// Get current weather
const weather = overseerWeather.getCurrent();
console.log(`Current weather: ${weather.type}`);

// Force weather update
const newWeather = overseerWeather.updateWeather();

// Check for hazardous conditions
if (weather.type === "rad_storm") {
  console.log("Warning: Radiation storm incoming!");
  // Increase rad accumulation rate
}

// Check faction weather
if (weather.type === "emp_storm") {
  console.log("The Circuit's influence disrupts electronics!");
  // May disable certain equipment
}
```

---

## Weather Events

### Rad Storm
- Increased radiation exposure
- Price increases
- Visibility reduction
- Strange encounters

### Anomaly Surge
- Reality distortions
- Unusual NPC behavior
- Rare item spawns
- Timeline echoes

### Faction Weather
- Faction-specific effects
- Territory control indicators
- Lore-relevant atmosphere
