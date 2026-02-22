# Mobile Map Persistence Rollback - Summary

## Problem Statement

The persistent map issue on mobile appeared after attempting to deploy the application as a full-stack Vercel deployment with serverless functions. Mobile gameplay is the primary use case, and the map functionality needs to work reliably.

## Root Cause

The full-stack Vercel deployment used serverless functions (`api/index.js`) to handle backend requests. This caused mobile map persistence issues due to:

1. **Cold starts**: Serverless functions spin down after inactivity, causing delays and state loss
2. **Limited WebSocket support**: Serverless functions don't support persistent WebSocket connections well
3. **Request isolation**: Each serverless function invocation is isolated, making state management difficult
4. **Mobile network conditions**: Mobile devices with intermittent connectivity struggle with cold start delays

## Solution: Rollback to Split Architecture

We rolled back to the **split architecture** that worked before:

- **Frontend (Vercel)**: Static hosting for HTML/CSS/JS files from `public/` directory
- **Backend (Render)**: Persistent Node.js Express server always running at `https://api.atomicfizzcaps.xyz`

## Changes Made

### 1. Removed Full-Stack Vercel Serverless Setup
- ❌ Deleted `api/index.js` (serverless function wrapper)
- ❌ Deleted `api/package.json` (API dependencies)
- ❌ Deleted `api/tsconfig.json` (TypeScript config)

### 2. Restored Simple Static Frontend Configuration
**File**: `vercel.json`
- Removed `installCommand` for backend dependencies
- Removed API rewrites that routed to serverless functions
- Removed API-specific cache headers
- Kept security headers (X-Content-Type-Options, X-Frame-Options, etc.)

### 3. Updated Frontend to Point to External Backend
**File**: `public/js/config.js`
- Changed from relative paths (`window.API_BASE = ''`) to absolute URL
- Production now points to: `https://api.atomicfizzcaps.xyz`
- Local dev still points to: `http://localhost:3000`
- Updated comments to clarify split architecture

### 4. Excluded Backend from Vercel Deployment
**File**: `.vercelignore`
- Added `backend/` directory to ignore list
- Backend will be deployed separately on Render
- Keeps Vercel deployment size minimal and fast

### 5. Updated Deployment Documentation
**File**: `docs/deployment/DEPLOYMENT.md`
- Marked split architecture as "CURRENT/RECOMMENDED"
- Marked full-stack Vercel as "Historical - not currently used"
- Added explanation of why split architecture is better for mobile
- Documented benefits: no cold starts, WebSocket support, consistent state

## Benefits of Split Architecture

✅ **Persistent backend server** - No cold starts that break map state
✅ **WebSocket support** - Real-time updates work properly
✅ **Always-warm API** - Better mobile user experience
✅ **Consistent state** - Session management works across requests
✅ **Mobile-optimized** - Handles intermittent connectivity better

## Next Steps for Deployment

### 1. Verify Backend is Running on Render

The backend needs to be deployed on Render (or similar persistent hosting):

1. Go to [render.com](https://render.com)
2. Create/verify Web Service for the backend
3. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment Variables**: Set required env vars (see `backend/.env.example`)

4. Custom domain: `api.atomicfizzcaps.xyz`

### 2. Deploy Frontend to Vercel

The frontend should be deployed on Vercel:

1. Connect repository to Vercel
2. Vercel auto-detects settings from `vercel.json`:
   - **Output Directory**: `public`
   - **Build Command**: (none needed - static files)
   - **Install Command**: (none needed)

3. Deploy and verify frontend loads
4. Custom domain: `atomicfizzcaps.xyz` and `www.atomicfizzcaps.xyz`

### 3. Test Mobile Map Functionality

After both deployments are live:

1. Open the app on a mobile device
2. Test map loading and interaction
3. Verify persistent state across sessions
4. Test with mobile network conditions (WiFi, 4G, switching networks)
5. Verify no cold start delays on API calls

## Architecture Diagram

```
┌─────────────────────┐         ┌─────────────────────┐
│     VERCEL          │         │      RENDER         │
│    (Frontend)       │  ───→   │     (Backend)       │
│                     │  HTTPS  │                     │
│  atomicfizzcaps.xyz │  API    │ api.atomicfizzcaps  │
│  *.vercel.app       │  calls  │     .xyz            │
└─────────────────────┘         └─────────────────────┘
                                        │
                               ┌────────▼────────┐
                               │     REDIS       │
                               │  (Player State) │
                               └─────────────────┘
```

## Files Changed

- `vercel.json` - Removed serverless function configuration
- `public/js/config.js` - Points to external backend API
- `.vercelignore` - Excludes backend from deployment
- `docs/deployment/DEPLOYMENT.md` - Updated documentation
- `api/` directory - Completely removed

## Verification Checklist

After deploying, verify the following:

- [ ] Frontend loads on Vercel
- [ ] Backend is running on Render at `https://api.atomicfizzcaps.xyz`
- [ ] Backend health check works: `https://api.atomicfizzcaps.xyz/api/health`
- [ ] Frontend console shows: `[Config] Backend API: https://api.atomicfizzcaps.xyz`
- [ ] Mobile map loads and persists state
- [ ] No CORS errors in browser console
- [ ] API calls complete without cold start delays
- [ ] Map interactions work smoothly on mobile

## Troubleshooting

### If backend API calls fail:
1. Check backend is running: `https://api.atomicfizzcaps.xyz/api/health`
2. Check CORS configuration in `backend/server.js` includes frontend domains
3. Verify `FRONTEND_ORIGIN` env var on Render includes all Vercel domains

### If map doesn't persist on mobile:
1. Check browser console for errors
2. Verify localStorage is enabled on mobile browser
3. Check network tab for failed API calls
4. Test on WiFi vs mobile data

### If seeing CORS errors:
1. Verify `api.atomicfizzcaps.xyz` DNS points to Render
2. Check backend logs on Render for CORS warnings
3. Ensure Cloudflare proxy is disabled (if using Cloudflare)

## Historical Context

The full-stack Vercel deployment was attempted to simplify deployment to a single platform. While this works well for many applications, it wasn't suitable for this game because:

- Mobile is the primary gameplay platform
- Map state needs to persist across sessions
- Real-time features benefit from WebSocket support
- Users expect fast, consistent responses

The split architecture, while requiring two platforms, provides a better user experience for mobile gameplay.
