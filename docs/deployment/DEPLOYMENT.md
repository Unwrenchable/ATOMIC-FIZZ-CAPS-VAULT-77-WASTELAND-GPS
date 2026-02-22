# Deployment Guide

> 📚 **Deployment Architecture**
> - **Split Architecture** (Vercel + Render) - **CURRENT/RECOMMENDED**: See [Render & Vercel Deployment Guide](RENDER_VERCEL_DEPLOYMENT_GUIDE.md)
> - **Full Stack Vercel** (Historical - not currently used): See [VERCEL_FULL_STACK_DEPLOYMENT.md](VERCEL_FULL_STACK_DEPLOYMENT.md)
> - **Moving to Organization?** See [ORGANIZATION_MIGRATION_GUIDE.md](ORGANIZATION_MIGRATION_GUIDE.md) 🔄

## Current Deployment Architecture

This application uses **Split Architecture** for optimal mobile performance and persistent map functionality:

### Split Architecture (Current - Recommended for Mobile)

**Separate deployments for frontend and backend**

- **Backend API** (Single Source of Truth): Deployed on Render
  - API domain: `https://api.atomicfizzcaps.xyz`
  - **All game state, quests, player data managed here**
  - **Single shared database** (Redis/PostgreSQL)
  
- **Frontend** (Multiple deployments all connect to same backend):
  - Primary domain: `https://www.atomicfizzcaps.xyz` (Vercel)
  - Also: `https://atomicfizzcaps.xyz` (Vercel)
  - Preview/testing (Vercel): `*.vercel.app`
  - Preview/testing (Render): `*.onrender.com`

**Best for**: Mobile gameplay with persistent map state, WebSocket support, and always-on backend

**Why Split Architecture for Mobile:**
- ✅ **Persistent backend server** (not serverless) eliminates cold starts that can break map state
- ✅ **WebSocket support** for real-time updates
- ✅ **Always-warm API** responses for better mobile experience
- ✅ **Consistent state management** across sessions

**See detailed guide**: [RENDER_VERCEL_DEPLOYMENT_GUIDE.md](RENDER_VERCEL_DEPLOYMENT_GUIDE.md)

### Historical: Full Stack Vercel (Not Currently Used)

The application previously used full-stack Vercel deployment with serverless functions, but this was rolled back due to mobile map persistence issues. Serverless functions have cold starts and limited WebSocket support, which caused problems with mobile map state.

**See historical documentation**: [VERCEL_FULL_STACK_DEPLOYMENT.md](VERCEL_FULL_STACK_DEPLOYMENT.md)

## ⚠️ Important: Single Game Instance

**All frontend deployments connect to the SAME backend API**, which means:
- ✅ `atomicfizzcaps.xyz` → connects to backend API
- ✅ `www.atomicfizzcaps.xyz` → connects to backend API
- ✅ `preview-xyz.vercel.app` → connects to backend API

This ensures:
- **One unified game world** - all players share the same game state
- **Consistent player progress** - your progress works across all frontend URLs
- **Centralized game logic** - quests, items, economy all managed in one place

## Domain Unification

Whether using full stack Vercel or split architecture, all frontend deployments connect to a central backend API. This ensures consistent behavior across:
- Main production site (`atomicfizzcaps.xyz`, `www.atomicfizzcaps.xyz`)
- Vercel preview deployments (`*.vercel.app`)
- Render deployments (`*.onrender.com`)

## Configuration

### Frontend (Vercel/Render)

The frontend automatically detects its environment and configures the backend URL:

**File**: `public/js/config.js`
```javascript
// Local development (localhost, Codespaces) -> http://localhost:3000
// All production/preview environments -> https://api.atomicfizzcaps.xyz
```

**Local development**: Points to `http://localhost:3000`  
**Production/Preview**: Points to `https://api.atomicfizzcaps.xyz`

### Backend (Render)

The backend is configured to accept requests from all frontend domains:

**File**: `backend/server.js`
```javascript
// Default CORS origins include:
// - https://www.atomicfizzcaps.xyz
// - https://atomicfizzcaps.xyz  
// - http://localhost:3000
// - https://*.vercel.app (Vercel previews)
// - https://*.onrender.com (Render previews)
```

The CORS configuration automatically allows any `*.vercel.app` and `*.onrender.com` domain for preview deployments.

### Environment Variables

**📋 For a complete alphabetical reference of all environment variables, see [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)**

#### Backend (Render)

Set these environment variables in your Render service dashboard:

- `NODE_ENV=production`
- `FRONTEND_ORIGIN` (recommended: `https://www.atomicfizzcaps.xyz, https://atomicfizzcaps.xyz, https://*.vercel.app, https://*.onrender.com, http://localhost:3000`)
  - The backend supports wildcard patterns like `https://*.vercel.app` and `https://*.onrender.com` for preview deployments
  - Multiple origins can be comma-separated
- `REDIS_URL` (required for player state)
- `SERVER_SECRET_KEY` (required for authentication)
- Other service-specific variables (see `backend/.env.example` or [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md))

**Note**: If using Cloudflare proxy, temporarily disable it during CORS verification to ensure proper origin headers are sent.

#### Frontend (Vercel)

No environment variables needed - the frontend auto-configures based on hostname.

The `vercel.json` configuration includes an API proxy that forwards `/api/*` requests to the backend at `https://api.atomicfizzcaps.xyz`. This allows the frontend to use relative paths and avoid CORS issues.

## Troubleshooting

### API 404 Errors

If you see errors like:
```
main.js:46  API /api/locations responded with 404
```

**Common causes**:

1. **Wrong backend URL**: Check that `window.API_BASE` in browser console points to `https://api.atomicfizzcaps.xyz`
   - Fix: Update `public/index.html` with correct backend URL

2. **CORS errors**: Check browser console for CORS-related errors
   - Fix: Ensure `FRONTEND_ORIGIN` environment variable on Render includes your frontend domain
   - Fix: Backend automatically allows `*.vercel.app` domains

3. **Backend not deployed**: Verify backend is running at `https://api.atomicfizzcaps.xyz`
   - Check Render dashboard for deployment status
   - Check backend logs for startup errors

### Verifying Configuration

Open browser console on your deployed site and run:
```javascript
console.log('API_BASE:', window.API_BASE);
console.log('BACKEND_URL:', window.BACKEND_URL);
```

Should output:
```
API_BASE: https://api.atomicfizzcaps.xyz
BACKEND_URL: https://api.atomicfizzcaps.xyz
```

## Deployment Steps

### Frontend (Vercel)

1. Connect your GitHub repository to Vercel
2. Set build settings:
   - Framework Preset: Other
   - Build Command: (leave empty)
   - Output Directory: `public`
   - Install Command: (leave empty)
3. Deploy
4. Configure custom domain `www.atomicfizzcaps.xyz` (optional)

#### Manual Deployment

If you need to force a deployment (e.g., when automatic deployments are paused or build minutes are limited), you can use the manual deployment workflow:

- **Quick Start**: See [Quick Start Guide](docs/QUICK_START_FORCE_DEPLOY.md) for a condensed setup and usage guide
- **Full Documentation**: See [Manual Vercel Deployment Guide](docs/MANUAL_VERCEL_DEPLOY.md) for complete instructions on triggering manual deployments via GitHub Actions
- **Local CLI**: Use `vercel --prod` from your local machine (requires Vercel CLI)

### Backend (Render)

1. Connect your GitHub repository to Render
2. Create a new Web Service:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node server.js`
3. Set environment variables (see above)
4. Deploy
5. Configure custom domain `api.atomicfizzcaps.xyz` (optional)

## API Endpoints

The backend provides these API endpoints:

- `GET /api/locations` - Get all locations
- `GET /api/quests` - Get all quests
- `GET /api/mintables` - Get all mintable items
- `GET /api/scavenger` - Get scavenger data
- `GET /api/settings` - Get app settings
- `GET /api/player` - Get player data (authenticated)
- `POST /api/location-claim` - Claim a location (authenticated)
- And more...

If an API endpoint fails, the frontend automatically falls back to static JSON files in `/data/` directory.

## Local Development

1. Start backend:
   ```bash
   cd backend
   npm install
   npm start
   ```
   Backend runs on `http://localhost:3001`

2. Start frontend:
   ```bash
   # Serve public directory with any static server, e.g.:
   npx serve public -p 3000
   ```
   Frontend runs on `http://localhost:3000`

3. The frontend will automatically connect to `http://localhost:3001` for API calls.

## Monitoring

- **Frontend**: Check Vercel deployment logs and analytics
- **Backend**: Check Render service logs for API errors
- **CORS**: Check browser console for CORS errors
- **Network**: Use browser DevTools Network tab to see failed API requests
