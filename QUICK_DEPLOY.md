# Quick Deployment Guide - Split Architecture

This is the simplified deployment guide for the current split architecture setup.

## Architecture Overview

```
Vercel (Frontend) → Render (Backend) → Redis (State)
```

- **Frontend**: Static files on Vercel CDN
- **Backend**: Node.js Express on Render (always-on)
- **API URL**: `https://api.atomicfizzcaps.xyz`

## Step 1: Deploy Backend to Render

### 1.1 Create Render Service

1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository

### 1.2 Configure Settings

```
Name: atomic-fizz-caps-api
Region: Oregon (or closest to users)
Branch: main
Root Directory: backend
Runtime: Node
Build Command: npm install
Start Command: node server.js
Instance Type: Free (dev) or Starter (production)
```

### 1.3 Set Environment Variables

Required variables:
```bash
NODE_ENV=production
SERVER_SECRET_KEY=your-secret-key-here
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-bcrypt-hash
FRONTEND_ORIGIN=https://www.atomicfizzcaps.xyz,https://atomicfizzcaps.xyz,https://*.vercel.app,http://localhost:3000
```

Optional (for full features):
```bash
REDIS_URL=your-redis-url
SOLANA_RPC=your-solana-rpc-endpoint
HUGGINGFACE_API_KEY=your-hf-key
```

### 1.4 Add Custom Domain (Optional)

1. Go to **Settings → Custom Domains**
2. Add: `api.atomicfizzcaps.xyz`
3. Configure DNS:
   ```
   CNAME api.atomicfizzcaps.xyz → your-service.onrender.com
   ```

### 1.5 Verify Backend

Check health endpoint:
```bash
curl https://api.atomicfizzcaps.xyz/api/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-02-22T...",
  "uptime": 123.45,
  "memory": {...},
  "env": {
    "node_env": "production",
    ...
  }
}
```

## Step 2: Deploy Frontend to Vercel

### 2.1 Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository

### 2.2 Project Settings

Vercel auto-detects from `vercel.json`:
```
Framework Preset: Other
Build Command: (none)
Output Directory: public
Install Command: (none)
Root Directory: ./
```

**No environment variables needed** - frontend auto-configures!

### 2.3 Deploy

Click **"Deploy"** - Vercel will:
- Serve static files from `public/` directory
- Configure CDN and SSL automatically
- Frontend will point to `https://api.atomicfizzcaps.xyz`

### 2.4 Add Custom Domains (Optional)

1. Go to **Settings → Domains**
2. Add:
   - `atomicfizzcaps.xyz`
   - `www.atomicfizzcaps.xyz`
3. Configure DNS as instructed by Vercel

### 2.5 Verify Frontend

1. Open your deployed URL
2. Open browser console
3. Should see:
   ```
   [Config] Frontend: your-domain.vercel.app
   [Config] Backend API: https://api.atomicfizzcaps.xyz
   [Config] Mode: Split architecture (Vercel + Render)
   ```

## Step 3: Test Mobile Map

1. Open app on mobile device
2. Navigate to map section
3. Verify:
   - Map loads without delays
   - Map state persists when switching tabs
   - No cold start delays on API calls
   - Smooth interactions

## Local Development

### Terminal 1: Start Backend
```bash
cd backend
npm install
npm start
# Backend runs on http://localhost:3000
```

### Terminal 2: Serve Frontend
```bash
npx serve public -p 8080
# Frontend runs on http://localhost:8080
```

The frontend automatically detects localhost and points to `http://localhost:3000` for API calls.

## Troubleshooting

### Backend not responding
```bash
# Check Render logs
# Verify environment variables are set
# Check DNS propagation: dig api.atomicfizzcaps.xyz
```

### Frontend can't reach backend
```bash
# Open browser console
# Check for CORS errors
# Verify window.API_BASE shows correct URL
# Check Network tab for failed requests
```

### Mobile map not working
```bash
# Test on WiFi first
# Check browser console for errors
# Verify localStorage is enabled
# Try different mobile browsers (Safari, Chrome)
```

## Key Files

- `vercel.json` - Vercel configuration (static hosting only)
- `public/js/config.js` - API endpoint configuration
- `backend/server.js` - Express backend (standalone server)
- `.vercelignore` - Excludes backend from Vercel deployment
- `docs/deployment/RENDER_VERCEL_DEPLOYMENT_GUIDE.md` - Detailed guide

## Why This Works for Mobile

1. **No Cold Starts**: Backend is always running on Render
2. **WebSocket Support**: Persistent connections for real-time features
3. **Fast Responses**: No serverless function initialization delays
4. **Consistent State**: Sessions maintained across requests
5. **Mobile Optimized**: Handles network switching gracefully

## Comparison: Before vs After

### Before (Full-Stack Vercel - Issues)
- ❌ Serverless functions with cold starts
- ❌ Limited WebSocket support
- ❌ Map state lost on mobile
- ❌ Delays when switching networks

### After (Split Architecture - Fixed)
- ✅ Persistent backend server
- ✅ Full WebSocket support
- ✅ Map state persists properly
- ✅ Fast, consistent responses

## Support

- **Detailed Deployment**: See `docs/deployment/RENDER_VERCEL_DEPLOYMENT_GUIDE.md`
- **Rollback Context**: See `ROLLBACK_SUMMARY.md`
- **Architecture Docs**: See `docs/deployment/DEPLOYMENT.md`
