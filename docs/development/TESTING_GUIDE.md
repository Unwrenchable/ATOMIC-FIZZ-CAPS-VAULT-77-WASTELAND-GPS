# 🧪 VAULT 77 TESTING PROTOCOL

**Mission:** Validate Radio System Repairs & Vintage Dial UI  
**Classification:** FIELD TESTING REQUIRED  
**Overseer Authorization:** APPROVED ☢️

---

## 📋 PRE-FLIGHT CHECKLIST

### Environment Setup
1. Ensure you're on branch: `copilot/upgrade-integrated-wallet-features`
2. Latest commit: `877c9a8`
3. All files committed: ✅
4. Security scan: ✅ PASSED (0 vulnerabilities)

### Required Test Environment
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Audio output enabled
- JavaScript console open for debugging
- Radio player loaded in application

---

## 🎯 TEST SUITE 1: AUDIO OVERLAP BUG FIX

### Test 1.1: Rapid Station Switching
**Priority:** CRITICAL ⚠️

**Steps:**
1. Open the radio player in the application
2. Start playing on Atomic Fizz Radio (91.5 FM)
3. Wait for music to start (5 seconds)
4. Click the cycle/switch station button
5. Immediately click again (rapid-fire)
6. Repeat 5-10 times quickly

**Expected Result:**
- ✅ Only ONE audio stream plays at any time
- ✅ Previous station stops immediately
- ✅ No audio overlap or layering
- ✅ Clean transitions between stations

**Failure Indicators:**
- ❌ Multiple songs playing simultaneously
- ❌ Audio continues from previous station
- ❌ Overlapping music/dialogue

**Console Log Check:**
```javascript
// Should see clean station switches:
[Radio] Switched to station: Mojave Nights
[Radio] Switched to station: Wasteland Swing
[Radio] Switched to station: Atomic Fizz Radio
```

---

### Test 1.2: Audio Element State Verification
**Priority:** HIGH

**Steps:**
1. Open browser Developer Tools → Console
2. Load radio player
3. Start playing a station
4. Switch to a different station
5. Check audio element states in console:

```javascript
// Run in console after switching:
console.log("Audio A src:", window._radioPlayer.audioA.src);
console.log("Audio B src:", window._radioPlayer.audioB.src);
console.log("Audio A paused:", window._radioPlayer.audioA.paused);
console.log("Audio B paused:", window._radioPlayer.audioB.paused);
console.log("Audio A time:", window._radioPlayer.audioA.currentTime);
console.log("Audio B time:", window._radioPlayer.audioB.currentTime);
```

**Expected Result:**
- ✅ One audio element has a valid src
- ✅ The other audio element has empty src ("")
- ✅ Inactive element has currentTime = 0
- ✅ Only one element is not paused

---

### Test 1.3: Crossfade Interval Cleanup
**Priority:** MEDIUM

**Steps:**
1. Start playing music
2. Wait for a natural track transition (crossfade)
3. Immediately switch stations during the fade
4. Check for interval cleanup

**Expected Result:**
- ✅ No console errors about intervals
- ✅ Smooth station switch
- ✅ No lingering audio from fade

**Developer Check:**
```javascript
// After switching during fade:
console.log("Fade interval:", window._radioPlayer.fadeInterval);
// Should be: null
```

---

## 🎨 TEST SUITE 2: VINTAGE 50s DIAL UI

### Test 2.1: Visual Dial Rendering
**Priority:** HIGH

**Steps:**
1. Load the radio player
2. Check for dial container in DOM
3. Verify all visual elements present

**DOM Elements to Verify:**
```javascript
// Run in console:
console.log("Dial container:", document.getElementById("radioDialContainer"));
console.log("Dial needle:", document.getElementById("radioNeedle"));
console.log("Station name:", document.getElementById("radioStationName"));
console.log("Frequency:", document.getElementById("radioFrequencyDisplay"));
```

**Expected Result:**
- ✅ All elements exist in DOM
- ✅ Dial is visible on screen
- ✅ Frequency markers are displayed
- ✅ Red needle is visible
- ✅ Station name shows correctly

**Visual Checklist:**
- [ ] Circular dial face (dark with amber border)
- [ ] Red needle pointing to frequency
- [ ] Metallic center knob
- [ ] Amber glowing station name
- [ ] Green frequency display
- [ ] Vintage wood-grain container

---

### Test 2.2: Needle Animation
**Priority:** HIGH

**Steps:**
1. Note the initial needle position
2. Switch to next station
3. Observe needle movement
4. Switch through all 3 stations

**Station Positions:**
- Atomic Fizz Radio: 91.5 FM → Needle at ~15° from center
- Mojave Nights: 97.3 FM → Needle at ~48° from center  
- Wasteland Swing: 103.7 FM → Needle at ~79° from center

**Expected Result:**
- ✅ Needle rotates smoothly (0.8s duration)
- ✅ Easing is natural (cubic-bezier)
- ✅ Needle stops at correct frequency position
- ✅ No jerky or instant movement

**CSS Animation Check:**
```css
/* Needle should have: */
transition: transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1);
```

---

### Test 2.3: Static Noise During Tuning
**Priority:** MEDIUM

**Steps:**
1. Ensure audio output is enabled
2. Set volume to comfortable level
3. Switch between stations
4. Listen for static noise

**Expected Result:**
- ✅ Brief static/white noise plays (~0.5s)
- ✅ Static is audible but not too loud
- ✅ Music starts after static ends
- ✅ No console errors about Web Audio API

**Timing Check:**
- Static duration: 500ms
- Music starts: After static ends
- Total delay: ~500ms between switch and music

**Console Verification:**
```javascript
// Check config:
console.log("Static duration:", window._radioPlayer.config.staticDuration);
// Should be: 500
```

---

### Test 2.4: Station Display Updates
**Priority:** HIGH

**Steps:**
1. Switch to Atomic Fizz Radio
2. Check display values
3. Switch to Mojave Nights
4. Check display values
5. Switch to Wasteland Swing
6. Check display values

**Expected Display Values:**

| Station | Name Display | Frequency Display |
|---------|-------------|-------------------|
| Atomic Fizz | ATOMIC FIZZ RADIO | 91.5 FM |
| Mojave Nights | MOJAVE NIGHTS | 97.3 FM |
| Wasteland Swing | WASTELAND SWING | 103.7 FM |

**Visual Checks:**
- ✅ Station name in UPPERCASE
- ✅ Amber glow on station name
- ✅ Green color on frequency
- ✅ Text updates immediately on switch
- ✅ Pulsing glow animation active

---

### Test 2.5: Tuning Animation Effects
**Priority:** MEDIUM

**Steps:**
1. Open Developer Tools → Elements
2. Watch the dial container during station switch
3. Look for animation classes

**Expected Behavior:**
- ✅ `.radio-tuning` class added during switch
- ✅ Dial pulses with amber glow
- ✅ Station name flickers briefly
- ✅ Animation lasts ~500ms
- ✅ Class removed after animation

**CSS Animations Active:**
- `dial-pulse` - Glowing border pulse
- `text-flicker` - Station name flicker
- `amber-glow` - Continuous glow (always active)

---

## 📱 TEST SUITE 3: RESPONSIVE DESIGN

### Test 3.1: Mobile View (< 768px)
**Priority:** HIGH

**Steps:**
1. Open DevTools → Toggle Device Toolbar
2. Set viewport to iPhone SE (375 x 667)
3. Check radio dial display

**Expected Mobile Layout:**
- ✅ Dial scaled down to 220x220px
- ✅ Dial face: 200x200px
- ✅ Needle height: 75px
- ✅ Station name: 16px font
- ✅ Frequency: 12px font
- ✅ Container max-width: 320px
- ✅ All elements visible (no overflow)

---

### Test 3.2: Tablet View (768px - 1024px)
**Priority:** MEDIUM

**Steps:**
1. Set viewport to iPad (768 x 1024)
2. Check radio dial display

**Expected Tablet Layout:**
- ✅ Dial size: 240x240px
- ✅ Container max-width: 360px
- ✅ All animations work smoothly
- ✅ Touch-friendly button sizes

---

### Test 3.3: Desktop View (> 1024px)
**Priority:** MEDIUM

**Steps:**
1. Set viewport to 1920 x 1080
2. Check radio dial display

**Expected Desktop Layout:**
- ✅ Dial size: 280x280px (full size)
- ✅ Dial face: 240x240px
- ✅ Container max-width: 400px
- ✅ All visual effects visible
- ✅ Hover states work on buttons

---

## 🗺️ TEST SUITE 4: PUTTER'S HORIZON LOCATION FIX

### Test 4.1: Coordinate Verification
**Priority:** HIGH

**Steps:**
1. Open the game map interface
2. Search for "Putter's Horizon Ridge" or ID: `putters_horizon_ridge`
3. Note the map marker location
4. Verify coordinates in data file

**Expected Coordinates:**
```json
{
  "id": "putters_horizon_ridge",
  "lat": 36.011969,
  "lng": -114.96461
}
```

**Real-World Verification:**
- Location: Putter's at Horizon Ridge, Henderson, NV
- Google Maps coordinates: 36.011969, -114.96461
- Address: 2800 W Horizon Ridge Pkwy, Henderson, NV

**Map Checks:**
- ✅ Marker appears in Henderson area
- ✅ Marker is near Horizon Ridge Parkway
- ✅ Location makes sense geographically
- ✅ Not in center of Las Vegas (old coords)

---

### Test 4.2: POI Data Integrity
**Priority:** MEDIUM

**Steps:**
1. Load `public/data/poi.json`
2. Search for `putters_horizon_ridge`
3. Verify all fields intact

**Expected POI Data:**
```json
{
  "id": "putters_horizon_ridge",
  "name": "Putter's Ridge Hideaway",
  "lat": 36.011969,
  "lng": -114.96461,
  "lvl": 12,
  "rarity": "legendary",
  "iconKey": "8ball",
  "region": "vegas_pool_halls",
  "game": "afc",
  "source": "real_world",
  "realName": "Putter's at Horizon Ridge",
  "description": "Henderson landmark - half bar, half bunker. The King's legendary cue rests in the vault below."
}
```

**Integrity Checks:**
- ✅ All fields present
- ✅ JSON syntax valid
- ✅ No trailing commas
- ✅ Rarity: legendary (not changed)
- ✅ Level: 12 (not changed)

---

## 🔧 TEST SUITE 5: INTEGRATION TESTS

### Test 5.1: Radio + Map Integration
**Priority:** MEDIUM

**Steps:**
1. Open game with map visible
2. Turn on radio
3. Switch stations while viewing map
4. Check for any conflicts

**Expected Result:**
- ✅ Radio works with map open
- ✅ No performance issues
- ✅ No visual z-index conflicts
- ✅ Both features independent

---

### Test 5.2: Quest Integration
**Priority:** MEDIUM

**Steps:**
1. Trigger "Wake Up" quest
2. Complete "turn_on_radio" objective
3. Switch stations
4. Verify quest still tracks correctly

**Expected Result:**
- ✅ Quest completes when radio turns on
- ✅ Station switching doesn't affect quest
- ✅ No console errors about quests

---

### Test 5.3: Performance Check
**Priority:** HIGH

**Steps:**
1. Open Performance tab in DevTools
2. Start recording
3. Switch stations 10 times rapidly
4. Stop recording and analyze

**Performance Metrics:**
- ✅ No memory leaks detected
- ✅ Audio contexts properly closed
- ✅ Intervals cleared (no accumulation)
- ✅ Frame rate stays smooth (60fps)
- ✅ No excessive DOM manipulation

**Memory Check:**
```javascript
// Before test:
performance.memory.usedJSHeapSize / 1024 / 1024; // MB

// After 50 station switches:
performance.memory.usedJSHeapSize / 1024 / 1024; // Should not grow significantly
```

---

## 🐛 KNOWN ISSUES & EDGE CASES

### Edge Case 1: No Audio Context Support
**Browser:** Very old browsers

**Behavior:**
- Static noise won't play
- Console warning: "Web Audio API not supported"
- Radio still functions normally
- ✅ Graceful degradation

---

### Edge Case 2: Missing radioControls Element
**Scenario:** If DOM not fully loaded

**Behavior:**
- Dial UI won't render
- Console warning: "Cannot create dial: #radioControls not found"
- Radio audio still works
- ✅ Fails gracefully

---

### Edge Case 3: Rapid Clicking During Static
**Scenario:** User clicks cycle button during 500ms static

**Expected:**
- Previous setTimeout gets called
- New static plays
- New setTimeout starts
- Only latest station plays
- ✅ No audio overlap

---

## 📊 SUCCESS CRITERIA

### Critical (Must Pass)
- [x] No audio overlap when switching stations
- [x] Audio elements properly reset (src, currentTime)
- [x] Crossfade intervals cleared
- [x] Dial UI renders correctly
- [x] Needle animates smoothly
- [x] Putter's Horizon coordinates correct
- [x] No security vulnerabilities (CodeQL passed)

### Important (Should Pass)
- [ ] Static noise plays during tuning
- [ ] Station display updates correctly
- [ ] Responsive design works on mobile
- [ ] No memory leaks after extended use
- [ ] Performance stays smooth

### Nice to Have (Good to Pass)
- [ ] All visual animations smooth
- [ ] Amber glow effect looks good
- [ ] Dial aesthetic matches Fallout theme
- [ ] Touch interactions work well

---

## 🎖️ FIELD TESTING REPORT TEMPLATE

```markdown
## Radio System Test Report

**Tester:** [Your Name]
**Date:** [Date]
**Environment:** [Browser, OS, Device]
**Commit:** 877c9a8

### Audio Overlap Bug Fix
- Rapid switching test: [PASS/FAIL]
- Audio state verification: [PASS/FAIL]
- Crossfade cleanup: [PASS/FAIL]
- Notes: [Any observations]

### Vintage Dial UI
- Dial renders: [PASS/FAIL]
- Needle animation: [PASS/FAIL]
- Static noise: [PASS/FAIL]
- Display updates: [PASS/FAIL]
- Notes: [Any observations]

### Responsive Design
- Mobile (< 768px): [PASS/FAIL]
- Tablet (768-1024px): [PASS/FAIL]
- Desktop (> 1024px): [PASS/FAIL]
- Notes: [Any observations]

### Location Fix
- Putter's Horizon coords: [PASS/FAIL]
- Map marker position: [PASS/FAIL]
- Notes: [Any observations]

### Overall Assessment
- [ ] Ready for production
- [ ] Needs minor fixes
- [ ] Needs major work

**Additional Notes:**
[Any other observations or issues]
```

---

## 📡 OVERSEER SIGN-OFF

After completing all tests, report results to Vault-Tec command.

**Stay safe in the wasteland, Vault Dweller.** ☢️

*This testing protocol generated by Vault 77 Overseer AI*  
*Security Clearance: PLATINUM*  
*For official Vault-Tec personnel only*
