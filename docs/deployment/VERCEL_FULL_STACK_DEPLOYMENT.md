# Full Stack Vercel Deployment Guide

This guide explains how to deploy the entire Atomic Fizz Caps application (frontend + backend) on Vercel as a unified full-stack application.

## Quick Start (TL;DR)

1. **Connect Repository**: Link your GitHub repo to Vercel
2. **Set Environment Variables**: Add required env vars in Vercel dashboard
   - `NODE_ENV=production`
   - `SERVER_SECRET_KEY=<your-key>`
   - `ADMIN_USERNAME=<username>`
   - `ADMIN_PASSWORD=<bcrypt-hash>`
3. **Deploy**: Click deploy - Vercel auto-configures from `vercel.json`
4. **Done**: Your app is live with both frontend and backend!

See below for detailed instructions and troubleshooting.

---

## Architecture Overview

### Full Stack Vercel Deployment
- **Frontend**: Static files from `public/` directory served by Vercel
- **Backend**: Node.js Express app converted to Vercel Serverless Functions via `api/index.js`
- **Benefits**:
  - Single deployment platform
  - Automatic HTTPS
  - Global CDN for frontend
  - Serverless auto-scaling for backend
  - Simplified configuration
  - Built-in environment variables management

## Prerequisites

- GitHub repository connected to Vercel
- Vercel account (free tier works)
- Environment variables ready (see below)

## Deployment Steps

### 1. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository: `Unwrenchable/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS`
4. Vercel will auto-detect the configuration from `vercel.json`

### 2. Configure Project Settings

Vercel should automatically detect:
- **Framework Preset**: Other (detected from vercel.json)
- **Root Directory**: `./` (root of repository)
- **Build Command**: Will install dependencies for both root and backend
- **Output Directory**: `public`
- **Install Command**: `npm install && cd backend && npm install`

If these aren't auto-configured, you can set them manually in the project settings.

### 3. Set Environment Variables

In your Vercel project dashboard, go to **Settings → Environment Variables** and add:

#### Required Variables

```
NODE_ENV=production
SERVER_SECRET_KEY=<your-secret-key>
ADMIN_USERNAME=<admin-username>
ADMIN_PASSWORD=<admin-password-bcrypt-hash>
```

#### Optional Variables (if using external services)

```
REDIS_URL=<your-redis-url>
SOLANA_RPC=<your-solana-rpc-endpoint>
HUGGINGFACE_API_KEY=<your-hf-api-key>
```

**Important**: For each variable, set the environment scope:
- Check "Production" for production deployments
- Check "Preview" if you want preview deployments to use these values
- Check "Development" for local development with `vercel dev`

### 4. Deploy

1. Click "Deploy"
2. Vercel will:
   - Install dependencies (both root and backend)
   - Build the serverless functions from `api/index.js`
   - Deploy static files from `public/`
   - Set up routing and rewrites per `vercel.json`

### 5. Configure Custom Domain (Optional)

1. Go to **Settings → Domains**
2. Add your custom domain (e.g., `atomicfizzcaps.xyz`, `www.atomicfizzcaps.xyz`)
3. Configure DNS as instructed by Vercel
4. Vercel will automatically provision SSL certificates

## How It Works

### Frontend Routing
- Static HTML/CSS/JS files are served from the `public/` directory
- Single Page Application (SPA) routing handled by `public/index.html`

### Backend API Routing
- All `/api/*` requests are routed to the Vercel serverless function at `api/index.js`
- The serverless function loads the Express app from `backend/server.js`
- Express routes handle the API logic (player data, quests, locations, etc.)

### Request Flow
```
User Browser
    ↓
Vercel CDN (serves static files)
    ↓
GET /index.html → public/index.html
GET /js/main.js → public/js/main.js
POST /api/player → api/index.js (serverless function)
    ↓
Express App (backend/server.js)
    ↓
API Route Handlers (backend/api/*)
    ↓
Response to User
```

## Local Development

### Run Full Stack Locally

**Option 1: Traditional approach (separate frontend and backend)**

```bash
# Terminal 1: Start backend server
cd backend
npm install
npm start
# Backend runs on http://localhost:3000

# Terminal 2: Serve frontend
npx serve public -p 8080
# Frontend runs on http://localhost:8080
```

The frontend will automatically detect `localhost` and point API calls to `http://localhost:3000`.

**Option 2: Test with Vercel CLI (simulates serverless environment)**

```bash
# Install Vercel CLI globally
npm i -g vercel

# Install dependencies
npm install && cd backend && npm install && cd ..

# Run with Vercel dev server
vercel dev
# Runs full stack on http://localhost:3000
```

This simulates the Vercel serverless environment locally, including serverless functions.

**Note**: For the Vercel CLI approach, you may need to set environment variables in a `.env` file at the root of the project, or use `vercel env pull` to download environment variables from your Vercel project.

## Troubleshooting

### Build Failures

**Error**: `Cannot find module 'express'`
- **Solution**: Make sure `vercel.json` includes the install command: `npm install && cd backend && npm install`

**Error**: `Function size exceeds limit`
- **Solution**: Add unnecessary files to `.vercelignore` (programs, target, docs, etc.)
- **Note**: Vercel has size limits for serverless functions:
  - Free tier: 50MB compressed
  - Pro tier: 50MB compressed (can request increase)
  - The `.vercelignore` file excludes unnecessary files (Rust programs, docs, test files)
  - If you still hit the limit, consider:
    - Moving large dependencies to external services
    - Splitting into multiple serverless functions
    - Using Vercel Edge Functions for lighter endpoints

**Error**: `Module not found` during build
- **Solution**: Ensure all dependencies are listed in `backend/package.json`
- **Check**: The install command in `vercel.json` installs both root and backend dependencies

### Runtime Errors

**Error**: API calls return 404
- **Check**: Open browser console and verify `window.API_BASE` is empty string or relative path
- **Check**: Verify `/api/health` endpoint works: visit `https://your-domain.vercel.app/api/health`

**Error**: CORS errors
- **Check**: Backend CORS configuration in `backend/server.js` includes Vercel domains
- **Check**: Wildcard patterns like `https://*.vercel.app` are in the allowed origins list

**Error**: Environment variables not working
- **Check**: Variables are set in Vercel dashboard for the correct environment (Production/Preview)
- **Check**: Variable names match exactly (case-sensitive)
- **Check**: Redeploy after adding new environment variables

### Performance Issues

**Issue**: API responses are slow
- **Solution**: Serverless functions have cold start time (~500ms). Consider:
  - Upgrading to Vercel Pro for faster cold starts
  - Implementing caching in frontend code
  - Using Vercel's Edge Functions for critical paths (requires refactoring)

**Issue**: Function timeout
- **Solution**: Vercel serverless functions have a 10s timeout (free tier) or 60s (pro). For long-running tasks:
  - Move to background jobs with external service (e.g., Render, AWS Lambda)
  - Implement async webhooks pattern
  - Break into smaller API calls

## Monitoring

- **Logs**: View in Vercel dashboard under Functions → Logs
- **Analytics**: Enable in Vercel dashboard under Analytics
- **Error Tracking**: Consider integrating Sentry or similar

## Comparison: Vercel Full Stack vs Split Architecture

| Feature | Full Stack Vercel | Split (Vercel + Render) |
|---------|-------------------|------------------------|
| **Deployment** | Single platform | Two platforms |
| **Configuration** | One vercel.json | vercel.json + render.yaml |
| **Cold Starts** | Yes (~500ms) | No (always running) |
| **Scaling** | Automatic serverless | Manual/auto scaling |
| **Cost** | Pay per request | Pay per instance hour |
| **Database** | Need external | Can use Render DB |
| **WebSockets** | Limited support | Full support |
| **Long Tasks** | 10s limit (60s pro) | No time limit |

## Recommendations

### Use Full Stack Vercel If:
- ✅ You want simple, single-platform deployment
- ✅ Your API calls are fast (< 5 seconds)
- ✅ You don't need persistent WebSocket connections
- ✅ You're okay with serverless cold starts
- ✅ You want to minimize costs for low traffic

### Use Split Architecture If:
- ✅ You need long-running background tasks
- ✅ You need persistent WebSocket connections
- ✅ You need always-warm API responses
- ✅ You have high sustained traffic (serverless can be expensive)
- ✅ You need advanced database features (Redis persistence, PostgreSQL)

## Migration

### From Split Architecture to Full Stack

1. Deploy to Vercel with the new configuration (this PR)
2. Test thoroughly on preview deployment
3. Update DNS to point to Vercel deployment
4. Optionally keep Render backend as backup

### From Full Stack to Split Architecture

1. Revert `vercel.json` to proxy configuration
2. Update `public/js/config.js` to point to external backend URL
3. Deploy backend separately to Render/Fly.io/Railway
4. Update CORS configuration on backend

## Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Serverless Functions**: [vercel.com/docs/serverless-functions](https://vercel.com/docs/serverless-functions/introduction)
- **Environment Variables**: [vercel.com/docs/environment-variables](https://vercel.com/docs/environment-variables)

---

**Note**: This guide assumes you're using the configuration from this PR which sets up full stack deployment on Vercel.
