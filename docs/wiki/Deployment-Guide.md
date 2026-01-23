# 🚀 Deployment Guide

This guide covers deploying the Atomic Fizz Caps application to production.

---

## Architecture Overview

The application uses a split deployment architecture:

| Component | Platform | Domain |
|-----------|----------|--------|
| Frontend | Vercel | `www.atomicfizzcaps.xyz` |
| Backend API | Render | `api.atomicfizzcaps.xyz` |
| Blockchain | Solana | Mainnet |

```
┌─────────────────────────────────────────────────────────────────┐
│                     ATOMIC FIZZ CAPS v1.0.1                     │
├─────────────────────────────────────────────────────────────────┤
│  FRONTEND (Vercel)          │  BACKEND (Render)                 │
│  • Static HTML/CSS/JS       │  • Node.js/Express API            │
│  • Leaflet Maps             │  • Redis State Management         │
│  • Phantom Wallet           │  • Solana Integration             │
│  • PWA Support              │  • Rate Limiting & Auth           │
├─────────────────────────────────────────────────────────────────┤
│                        BLOCKCHAIN (Solana)                      │
│  • FIZZ SPL Token           │  • Metaplex NFT Integration       │
│  • Wormhole Bridge          │  • On-chain Programs (Anchor)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Deployment (Vercel)

### Automatic Deployment

Vercel automatically deploys on Git push:

1. Connect GitHub repository to Vercel
2. Set build settings:
   - **Framework Preset**: Other
   - **Build Command**: (leave empty)
   - **Output Directory**: `public`
   - **Install Command**: (leave empty)
3. Deploy

### Manual Deployment

When automatic deployments are blocked (quota limits):

#### Via GitHub Actions

1. Go to **Actions** tab
2. Select **Manual Vercel Deployment**
3. Click **Run workflow**
4. Choose environment (production/preview)

#### Via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project (first time)
vercel link

# Deploy preview
vercel

# Deploy production
vercel --prod
```

### Environment Configuration

Frontend auto-configures based on hostname:

```javascript
window.API_BASE = (location.hostname === 'localhost')
  ? 'http://localhost:3001'
  : 'https://api.atomicfizzcaps.xyz';
```

### Custom Domain

Configure `www.atomicfizzcaps.xyz` in Vercel dashboard.

---

## Backend Deployment (Render)

### Setup

1. Connect GitHub repository to Render
2. Create Web Service:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
3. Configure environment variables
4. Deploy

### Environment Variables

Required variables in Render dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | `production` |
| `FRONTEND_ORIGIN` | Yes | Allowed origins (comma-separated) |
| `REDIS_URL` | Yes | Redis connection string |
| `PLAYER_AUTH_SECRET` | Yes | Auth token secret |

Example `FRONTEND_ORIGIN`:
```
https://www.atomicfizzcaps.xyz, https://atomicfizzcaps.xyz, https://*.vercel.app, http://localhost:3000
```

### Custom Domain

Configure `api.atomicfizzcaps.xyz` in Render dashboard.

---

## GitHub Actions Setup

### Required Secrets

Add these to your GitHub repository settings:

| Secret | Where to Get |
|--------|--------------|
| `VERCEL_TOKEN` | Vercel Account → Settings → Tokens |
| `VERCEL_ORG_ID` | Run `vercel link`, check `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Same as above |

### Getting Vercel IDs

```bash
npm install -g vercel
vercel link
cat .vercel/project.json
```

Output:
```json
{
  "orgId": "team_xxxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxxx"
}
```

---

## Local Development

### Start Backend

```bash
cd backend
npm install
npm start
# Runs on http://localhost:3001
```

### Start Frontend

```bash
npx serve public -p 3000
# Runs on http://localhost:3000
```

Frontend automatically connects to local backend.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/locations` | GET | All locations |
| `/api/quests` | GET | All quests |
| `/api/player` | GET | Player data (auth) |
| `/api/location-claim` | POST | Claim location (auth) |
| `/api/settings` | GET | App settings |

If API fails, frontend falls back to static `/data/` files.

---

## CORS Configuration

Backend CORS settings:

```javascript
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ||
  "https://www.atomicfizzcaps.xyz, http://localhost:3000";

// Also allows *.vercel.app for previews
```

---

## Troubleshooting

### API 404 Errors

1. Check `window.API_BASE` in browser console
2. Verify CORS settings on backend
3. Check backend deployment status

### CORS Errors

1. Ensure `FRONTEND_ORIGIN` includes your domain
2. Check for Cloudflare proxy issues
3. Verify backend is deployed correctly

### Build Failed

1. Check workflow logs in GitHub Actions
2. Verify `vercel.json` configuration
3. Check environment variables

### Deployment Paused

If Vercel pauses automatic deployments:
1. Use Manual Deployment workflow
2. Or use CLI: `vercel --prod`

---

## Monitoring

| Platform | What to Check |
|----------|---------------|
| Vercel | Deployment logs, analytics |
| Render | Service logs, API errors |
| Browser | DevTools Network tab |

---

## Quick Reference

### Force Deploy (Vercel)

```bash
# Via CLI
vercel --prod

# Via GitHub Actions
# Actions → Manual Vercel Deployment → Run workflow
```

### Check API Status

```bash
curl https://api.atomicfizzcaps.xyz/api/settings
```

### Verify Frontend Config

In browser console:
```javascript
console.log('API_BASE:', window.API_BASE);
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `vercel.json` | Vercel configuration |
| `render.yaml` | Render configuration |
| `backend/server.js` | API server |
| `public/index.html` | Frontend entry |

---

*"Deployment is like launching a rocket. Lots can go wrong, but when it works, it's beautiful."* — Vault-Tec DevOps
