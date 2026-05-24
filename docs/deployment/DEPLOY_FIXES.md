# 🚀 Deploy Game Integration Fixes

Your fixes are currently **only in your local codebase**. To test them on **atomicfizzcaps.xyz**, you need to deploy them.

## 📱 Quick Deploy for Mobile Testing

### Option 1: Git Push (Automatic Deployment) ⭐ RECOMMENDED

If you have auto-deploy configured:

```bash
# Commit the changes
git add .
git commit -m "Fix: Game integration - location claims, quest persistence, item distribution"

# Push to main branch
git push origin main
```

**Vercel/Render will auto-deploy** within 2-3 minutes.

### Option 2: Manual Vercel Deploy

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Deploy from project root
vercel --prod
```

## 🎯 Files That Were Changed (Need Deployment)

### Backend Changes (Render):
- ✅ `backend/api/location-claim.js` - Full reward system
- ✅ `backend/api/quests.js` - Quest tracking endpoints

### Frontend Changes (Vercel):
- ✅ `public/js/game/api-client.js` - API integration
- ✅ `public/js/modules/quests.js` - Quest backend sync

## ⚠️ Critical: Backend Environment Variables

Make sure your **Render backend** has these environment variables set:

```bash
NODE_ENV=production
REDIS_URL=redis://your-redis-url:6379
SERVER_SECRET_KEY=your-secret-key
SOLANA_RPC=https://api.devnet.solana.com  # or mainnet

# Optional but recommended
HF_API_KEY=your-huggingface-key
HF_MODEL=mistralai/Mixtral-8x7B-Instruct-v0.1
```

Check in your Render dashboard: Settings → Environment

## 📱 Mobile Testing Guide

### 1. Wait for Deployment ⏱️
- **Vercel**: Check https://vercel.com/dashboard
- **Render**: Check https://dashboard.render.com
- Wait for "Deployment Successful" (2-5 minutes)

### 2. Clear Mobile Browser Cache 🧹

**iOS Safari:**
- Settings → Safari → Clear History and Website Data

**Android Chrome:**
- Menu (⋮) → Settings → Privacy → Clear browsing data
- Check "Cached images and files"
- Click "Clear data"

**Or use Private/Incognito mode** to test fresh

### 3. Test on Mobile 📱

#### A. Test Location Claiming:
1. Open **https://atomicfizzcaps.xyz** on mobile
2. Allow location access when prompted
3. Connect your Phantom wallet
4. Walk/navigate to a nearby POI on the map
5. Tap the POI marker
6. Tap **"CLAIM"** button

**Expected Result:**
```
✅ Notification: "LOCATION CLAIMED! +25 XP, +10 CAPS + stimpak"
✅ Items appear in ITEMS tab
✅ XP/Caps increase in STAT tab
✅ Second claim shows cooldown timer
```

#### B. Test Quest System:
1. On first load, you should see quest notification
2. Go to **QUESTS** tab
3. Tap **"ACCEPT"** on "Wake Up" quest
4. Complete objectives:
   - Open **ITEMS** tab (✓)
   - Equip your sidearm (✓)
   - Open **RADIO** tab (✓)
   - Open **MAP** tab (✓)
5. Quest should auto-complete

**Expected Result:**
```
✅ Quest shows in "Active" section
✅ Can check off objectives
✅ Quest completes automatically
✅ Rewards notification appears
✅ Quest moves to "Completed" section
```

#### C. Test Item Persistence:
1. Claim a location → receive items
2. Check ITEMS tab → items visible
3. **Close browser completely**
4. Reopen **atomicfizzcaps.xyz**
5. Check ITEMS tab again

**Expected Result:**
```
✅ Items still in inventory
✅ XP/Caps/Level preserved
✅ Quest progress saved
```

## 🔍 Troubleshooting on Mobile

### "Location claims not giving rewards"
**Cause**: Backend not deployed or Redis connection issue
**Fix**: 
- Check Render backend logs: https://dashboard.render.com
- Verify REDIS_URL is set
- Check backend health: https://api.atomicfizzcaps.xyz/api/health

### "Quests not persisting"
**Cause**: Frontend deployed but backend not deployed
**Fix**: Deploy backend to Render (it auto-deploys on git push)

### "Items disappear on reload"
**Cause**: Browser storage disabled or incognito mode
**Fix**: 
- Use normal (non-incognito) browser
- Allow storage/cookies for the site

### "Can't claim - 'Too far from location'"
**Cause**: GPS accuracy or you're actually too far
**Fix**:
- Make sure GPS is enabled
- Get within 100 meters of the POI
- Try a different POI that's closer

### "Network error" on claims
**Cause**: Backend not running or CORS issue
**Fix**:
- Check backend is online: https://api.atomicfizzcaps.xyz/api/health
- Check browser console for CORS errors
- Verify backend FRONTEND_ORIGIN env var includes your domain

## 📊 Check Deployment Status

### Vercel (Frontend):
```bash
# Check latest deployment
vercel ls

# Or visit dashboard
https://vercel.com/dashboard
```

### Render (Backend):
```bash
# Visit dashboard
https://dashboard.render.com

# Or check API health
curl https://api.atomicfizzcaps.xyz/api/health
```

## 🐛 Debugging on Mobile

### View Console Logs:
**iOS Safari:**
- Connect iPhone to Mac
- Safari → Develop → [Your iPhone] → atomicfizzcaps.xyz
- View console in desktop Safari

**Android Chrome:**
- Open **chrome://inspect** on desktop Chrome
- Connect phone via USB
- Click "Inspect" on atomicfizzcaps.xyz

### Check Network Requests:
Look for these successful requests in Network tab:
- `POST /api/location-claim/claim` → Status 200
- `POST /api/quests/accept` → Status 200
- `POST /api/quests/complete` → Status 200

## 🎮 Mobile-Specific Tips

1. **GPS must be enabled** - Location claims require real GPS
2. **Wallet on mobile** - Use Phantom mobile app, not desktop extension
3. **Battery saver** - May affect GPS accuracy, disable for testing
4. **Data connection** - Wifi or good cellular signal needed
5. **Screen rotation** - Game works best in portrait mode

## 🚨 If Nothing Works After Deploy

1. **Hard refresh** mobile browser:
   - iOS: Close tab, clear cache, reopen
   - Android: Force stop Chrome, clear cache, reopen

2. **Check backend is live**:
   ```bash
   curl https://api.atomicfizzcaps.xyz/api/health
   # Should return: {"status":"ok", "redis":true}
   ```

3. **Check frontend deployed**:
   - View source on atomicfizzcaps.xyz
   - Search for "claimLocation" in api-client.js
   - Should see new code with reward handling

4. **Verify Redis connection**:
   - Backend needs Redis to persist data
   - Check Render logs for "Redis connection OK"

## 📝 Deployment Checklist

- [ ] Git commit all changes
- [ ] Git push to main branch
- [ ] Wait for Vercel deploy (frontend)
- [ ] Wait for Render deploy (backend)
- [ ] Check /api/health endpoint
- [ ] Clear mobile browser cache
- [ ] Test location claim with wallet connected
- [ ] Test quest acceptance
- [ ] Test item persistence after reload

---

## 🎉 Once Deployed Successfully:

Your mobile players will be able to:
- ✅ Claim locations and receive XP, caps, items
- ✅ Accept and complete quests
- ✅ Keep items and progress across sessions
- ✅ Experience the game as a unified, persistent world

The game will finally work as intended! 🎮
