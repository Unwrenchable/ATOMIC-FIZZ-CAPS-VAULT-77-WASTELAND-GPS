# Deployment Guide

## Architecture Overview

This application uses a split deployment architecture:

- **Frontend**: Deployed on Vercel (or Render)
  - Primary domain: `https://www.atomicfizzcaps.xyz`
  - Preview/testing (Vercel): `*.vercel.app`
  - Preview/testing (Render): `*.onrender.com`
- **Backend API**: Deployed on Render
  - API domain: `https://api.atomicfizzcaps.xyz`

## Domain Unification

All frontend deployments (Vercel, Render, or custom domains) automatically connect to the centralized API at `https://api.atomicfizzcaps.xyz`. This ensures consistent behavior across:
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

#### Backend (Render)

Set these environment variables in your Render service dashboard:

- `NODE_ENV=production`
- `FRONTEND_ORIGIN` (recommended: `https://www.atomicfizzcaps.xyz, https://atomicfizzcaps.xyz, https://*.vercel.app, https://*.onrender.com, http://localhost:3000`)
  - The backend supports wildcard patterns like `https://*.vercel.app` and `https://*.onrender.com` for preview deployments
  - Multiple origins can be comma-separated
- `REDIS_URL` (required for player state)
- `PLAYER_AUTH_SECRET` (required for authentication)
- Other service-specific variables (see `backend/.env.example`)

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
