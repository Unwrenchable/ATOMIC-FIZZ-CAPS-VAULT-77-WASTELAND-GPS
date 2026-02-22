# 🧪 QUICK TESTING GUIDE

## How to Test the Map Fixes

### Option 1: Automated Test Page (Recommended)

1. **Open the test page in your browser:**
   ```
   http://your-game-url/test-map-fixes.html
   ```

2. **Verify all tests pass:**
   - ✅ Icon Fallback System (auto-runs)
   - ✅ Fallback Mapping (auto-runs)
   - 🔘 Click "TEST EXPLORE BUTTON" manually

3. **Expected Results:**
   - All tests show green checkmarks (✓)
   - Icons load or fallback to poi.svg
   - Button click changes text and style

---

### Option 2: Manual Testing in Game

#### Test 1: Explore Button

1. Launch the game
2. Open Developer Console (F12)
3. Navigate to the Map tab in Pip-Boy
4. Look for these console messages:
   ```
   [worldmap] Initializing exploration controls...
   [worldmap] Explore button found, attaching event listener
   ```
5. Click the "🔍 EXPLORE MAP" button
6. Verify console shows:
   ```
   [worldmap] Explore button clicked, toggling mode
   [worldmap] Exploration mode ENABLED
   [worldmap] Button text updated to: 📍 RETURN TO PLAYER
   ```
7. Click again to verify it toggles back

**✅ PASS:** Button text changes and console logs appear  
**❌ FAIL:** Button doesn't respond or no console logs

---

#### Test 2: POI Icon Display

1. Load the game map
2. Zoom in to see POI markers around the map
3. Verify markers show proper SVG icons (not blue pins)
4. Open Network tab in DevTools (F12)
5. Filter by `/img/icons/`
6. Check for 404 errors

**✅ PASS:** All markers have proper icons, no 404 errors  
**❌ FAIL:** See blue default markers or broken images

---

### Option 3: Console Test (Quick Check)

Open browser console and paste:

```javascript
// Test fallback mapping
const testFallback = () => {
  const ICON_FALLBACK_MAP = {
    'marker': 'poi',
    'building': 'facility',
    'trader': 'trading'
  };
  
  const getValidIcon = (key) => {
    if (!key || key === 'null' || key === 'undefined') return 'poi';
    return ICON_FALLBACK_MAP[key] || key;
  };
  
  console.log('Testing fallback system:');
  console.log('marker →', getValidIcon('marker'));  // Should be 'poi'
  console.log('vault →', getValidIcon('vault'));    // Should be 'vault'
  console.log('null →', getValidIcon(null));        // Should be 'poi'
  console.log('✅ Fallback test complete');
};

testFallback();
```

---

## Common Issues & Solutions

### Issue: Button doesn't work
**Check:**
- Is the button visible on the map screen?
- Are there console errors?
- Does `document.getElementById('exploreToggleBtn')` return an element?

**Solution:**
- Check if map has fully initialized
- Look for JavaScript errors in console

---

### Issue: Icons still showing as blue pins
**Check:**
- Network tab for 404 errors
- Console for error messages
- If poi.svg itself is missing

**Solution:**
- Verify `/img/icons/poi.svg` exists
- Clear browser cache
- Check file permissions

---

### Issue: No console logs appearing
**Check:**
- Console filter settings (should show all levels)
- Console is open before loading the map
- Browser doesn't block console output

**Solution:**
- Refresh page with console open
- Check console filter settings
- Try different browser

---

## What to Look For

### ✅ GOOD SIGNS:
- Console shows initialization messages
- Button text changes when clicked
- All POIs have proper icons
- No 404 errors in Network tab
- Test page shows all green ✓

### ❌ WARNING SIGNS:
- Missing console logs
- Button not responding
- Blue default markers
- 404 errors on icon requests
- Test page shows red ✗

---

## Report Issues

If you encounter problems:

1. **Open browser console**
2. **Copy all error messages**
3. **Take screenshot of failing test**
4. **Note browser and version**
5. **Report with steps to reproduce**

---

## Quick Verification Commands

```bash
# Check if files exist
ls -la public/img/icons/poi.svg
ls -la public/js/modules/worldmap.js
ls -la test-map-fixes.html

# Check for syntax errors
node -c public/js/modules/worldmap.js
node -c public/js/map/poi-markers.js

# View recent changes
git diff HEAD~1 public/js/modules/worldmap.js
```

---

**📟 OVERSEER NOTE:** The test page (`test-map-fixes.html`) is the fastest way to verify all fixes are working correctly. If it passes, the production code should work fine.

Stay safe out there, Vault Dweller. ☢️
