# 📟 VAULT-TEC DEPLOYMENT PROTOCOL: RENDER & VERCEL SETUP GUIDE

**☢️ ATOMIC FIZZ CAPS - Complete Deployment Walkthrough ☢️**

This guide provides step-by-step instructions for deploying the Atomic Fizz Caps application using **Render** (backend) and **Vercel** (frontend).

---

## 📋 TABLE OF CONTENTS

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Part 1: Backend Deployment (Render)](#part-1-backend-deployment-render)
4. [Part 2: Frontend Deployment (Vercel)](#part-2-frontend-deployment-vercel)
5. [Part 3: Domain Configuration](#part-3-domain-configuration)
6. [Part 4: Environment Variables Reference](#part-4-environment-variables-reference)
7. [Part 5: Verification & Testing](#part-5-verification--testing)
8. [Part 6: Troubleshooting](#part-6-troubleshooting)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT ARCHITECTURE                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────────────┐         ┌─────────────────────┐        │
│   │     VERCEL          │         │      RENDER         │        │
│   │    (Frontend)       │  ───→   │     (Backend)       │        │
│   │                     │  API    │                     │        │
│   │  atomicfizzcaps.xyz │ calls   │ api.atomicfizzcaps  │        │
│   │  *.vercel.app       │         │     .xyz            │        │
│   └─────────────────────┘         └─────────────────────┘        │
│                                            │                      │
│                                            │                      │
│                                   ┌────────▼────────┐            │
│                                   │     REDIS       │            │
│                                   │  (Player State) │            │
│                                   └─────────────────┘            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- **Vercel**: Serves static frontend files (`/public` directory)
- **Render**: Runs Node.js backend API (`/backend` directory)
- **Redis**: Stores player state, sessions, and game data (hosted on Render or external provider)
- All frontends connect to the **same** backend API

---

## ✅ Prerequisites

Before you begin, ensure you have:

1. **GitHub Account** with repository access
2. **Render Account** at [render.com](https://render.com) (free tier available)
3. **Vercel Account** at [vercel.com](https://vercel.com) (free tier available)
4. **Redis Instance** (either Render Redis or external like Upstash/Redis Cloud)
5. **Custom Domain** (optional, but recommended for production)

---

## 🖥️ Part 1: Backend Deployment (Render)

### Step 1.1: Create Render Account & Connect GitHub

1. Go to [render.com](https://render.com) and sign up/sign in
2. Click **"New +"** → **"Web Service"**
3. Select **"Build and deploy from a Git repository"**
4. Connect your GitHub account if not already connected
5. Find and select the `ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS` repository

### Step 1.2: Configure Web Service Settings

Fill in the following settings:

| Setting | Value |
|---------|-------|
| **Name** | `atomic-fizz-caps-api` (or your preferred name) |
| **Region** | Choose closest to your users (e.g., Oregon, Ohio, Frankfurt) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |

### Step 1.3: Select Instance Type

For **Free Tier** (development/testing):
- Select **"Free"** instance type
- Note: Free instances spin down after 15 minutes of inactivity

For **Production**:
- Select **"Starter"** ($7/month) or higher
- Provides always-on availability

### Step 1.4: Set Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add the following:

#### Required Environment Variables

```bash
# Node Environment
NODE_ENV=production
PORT=10000

# CORS Configuration (CRITICAL - Include all your frontend URLs)
FRONTEND_ORIGIN=https://www.atomicfizzcaps.xyz, https://atomicfizzcaps.xyz, https://*.vercel.app, https://*.onrender.com, http://localhost:3000

# Redis Connection (IMPORTANT: Must use redis:// or rediss:// protocol)
# ❌ WRONG: http://your-redis-host:6379
# ✅ CORRECT: redis://default:your_redis_password@your-redis-host:6379
REDIS_URL=redis://default:your_redis_password@your-redis-host:6379

# Security Keys (Generate unique 64-byte Base58 strings for each)
SERVER_SECRET_KEY=your-unique-64-byte-base58-secret
GAME_VAULT_SECRET=your-unique-game-vault-secret
GPS_SECRET=your-unique-gps-secret
VOUCHER_SECRET=your-unique-voucher-secret
XP_SECRET=your-unique-xp-secret

# Solana Configuration
SOLANA_RPC=https://api.mainnet-beta.solana.com
TOKEN_MINT=your-caps-token-mint-address

# Backend URL (your Render URL)
NEXT_PUBLIC_BACKEND_URL=https://your-service-name.onrender.com

# Admin Configuration
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-secure-admin-password
ADMIN_WALLETS=wallet1PublicKey,wallet2PublicKey
```

#### Optional Environment Variables

```bash
# Hugging Face AI (for Overseer AI feature)
HF_API_KEY=your-huggingface-api-key
HF_MODEL=mistralai/Mixtral-8x7B-Instruct-v0.1

# Helius API (for enhanced NFT features)
HELIUS_API_KEY=your-helius-api-key

# Cooldowns
COOLDOWN_SECONDS=60
LOOT_COOLDOWN_SECONDS=300

# Additional Security
STRICT_REPLAY_PROTECTION=true
```

### Step 1.5: Create the Web Service

1. Click **"Create Web Service"**
2. Wait for the initial build and deployment (typically 2-5 minutes)
3. Check the **Logs** tab for any errors
4. Once deployed, you'll see a URL like: `https://atomic-fizz-caps-api.onrender.com`

### Step 1.6: Set Up Redis on Render (Optional)

If you don't have an external Redis provider:

1. In Render Dashboard, click **"New +"** → **"Redis"**
2. Configure:
   - **Name**: `atomic-fizz-caps-redis`
   - **Region**: Same as your web service
   - **Plan**: Free (25MB) or paid for production
3. After creation, copy the **Internal URL** (faster) or **External URL**
4. Update `REDIS_URL` in your web service environment variables

---

## 🌐 Part 2: Frontend Deployment (Vercel)

### Step 2.1: Create Vercel Account & Connect GitHub

1. Go to [vercel.com](https://vercel.com) and sign up/sign in
2. Click **"Add New..."** → **"Project"**
3. Connect your GitHub account if not already connected
4. Find and select the `ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS` repository

### Step 2.2: Configure Project Settings

Fill in the following settings:

| Setting | Value |
|---------|-------|
| **Project Name** | `atomic-fizz-caps` (or your preferred name) |
| **Framework Preset** | `Other` |
| **Root Directory** | `.` (project root) |
| **Build Command** | Leave empty (or press "Override" and leave blank) |
| **Output Directory** | `public` |
| **Install Command** | Leave empty |

### Step 2.3: Environment Variables (Frontend)

The frontend auto-configures based on hostname, so **no environment variables are required** for basic deployment.

However, if you need custom configuration, you can add:

```bash
# Optional: Force a specific backend URL
VITE_API_URL=https://api.atomicfizzcaps.xyz
```

### Step 2.4: Verify vercel.json Configuration

The repository already includes a properly configured `vercel.json`:

```json
{
  "version": 2,
  "buildCommand": null,
  "devCommand": null,
  "installCommand": null,
  "framework": null,
  "outputDirectory": "public",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [...],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.atomicfizzcaps.xyz/api/:path*"
    }
  ]
}
```

**Important**: If you're using a different backend URL, update the `destination` in the rewrites section.

### Step 2.5: Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (typically 1-2 minutes)
3. Once deployed, you'll see a URL like: `https://atomic-fizz-caps.vercel.app`

---

## 🔗 Part 3: Domain Configuration

### Step 3.1: Custom Domain on Vercel (Frontend)

1. In Vercel dashboard, go to your project → **"Settings"** → **"Domains"**
2. Click **"Add"** and enter your domain (e.g., `atomicfizzcaps.xyz`)
3. Add both root domain and www subdomain:
   - `atomicfizzcaps.xyz`
   - `www.atomicfizzcaps.xyz`
4. Configure DNS records at your domain registrar:

   | Type | Name | Value |
   |------|------|-------|
   | A | @ | `76.76.21.21` |
   | CNAME | www | `cname.vercel-dns.com` |

5. Wait for DNS propagation (up to 48 hours, usually faster)
6. Vercel automatically provisions SSL certificates

### Step 3.2: Custom Domain on Render (Backend)

1. In Render dashboard, go to your web service → **"Settings"** → **"Custom Domains"**
2. Click **"Add Custom Domain"** and enter: `api.atomicfizzcaps.xyz`
3. Configure DNS record at your domain registrar:

   | Type | Name | Value |
   |------|------|-------|
   | CNAME | api | `your-service-name.onrender.com` |

4. Wait for DNS propagation and SSL certificate provisioning

### Step 3.3: Update CORS After Adding Domains

After setting up custom domains, update `FRONTEND_ORIGIN` on Render to include all domains:

```bash
FRONTEND_ORIGIN=https://www.atomicfizzcaps.xyz, https://atomicfizzcaps.xyz, https://api.atomicfizzcaps.xyz, https://*.vercel.app, https://*.onrender.com, http://localhost:3000
```

---

## 📝 Part 4: Environment Variables Reference

### Complete Backend Environment Variables

For a complete reference of all environment variables, see [ENVIRONMENT_VARIABLES.md](../ENVIRONMENT_VARIABLES.md).

### Quick Setup Checklist

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Render sets automatically (usually 10000) |
| `FRONTEND_ORIGIN` | Yes | Comma-separated list of allowed origins |
| `REDIS_URL` | Yes | Redis connection string |
| `SERVER_SECRET_KEY` | Yes | 64-byte Base58 secret for signing |
| `SOLANA_RPC` | Yes | Solana network endpoint |
| `TOKEN_MINT` | Yes | CAPS token mint address |
| `ADMIN_USERNAME` | Yes | Admin login username |
| `ADMIN_PASSWORD` | Yes | Admin login password |
| `ADMIN_WALLETS` | Yes | Comma-separated admin wallet addresses |

### Generating Secure Secrets

Use this Node.js script to generate secure Base58 secrets:

```javascript
const crypto = require('crypto');
const bs58 = require('bs58');

// Generate a 64-byte random secret
const secret = crypto.randomBytes(64);
console.log('Base58 Secret:', bs58.encode(secret));
```

Or use the command line:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

## ✔️ Part 5: Verification & Testing

### Step 5.1: Verify Backend is Running

1. Visit your Render URL: `https://your-service-name.onrender.com`
2. Test the health endpoint: `https://your-service-name.onrender.com/api/health`
3. Test the locations API: `https://your-service-name.onrender.com/api/locations`

Expected response from `/api/health`:
```json
{
  "status": "ok",
  "timestamp": "<current_timestamp>"
}
```

### Step 5.2: Verify Frontend is Running

1. Visit your Vercel URL: `https://your-project.vercel.app`
2. Open browser developer console (F12)
3. Check that API calls are successful

### Step 5.3: Test API Proxy

The `vercel.json` configuration proxies `/api/*` requests to the backend. Test this:

1. On your Vercel deployment, open the browser console
2. Run: `fetch('/api/locations').then(r => r.json()).then(console.log)`
3. You should see location data returned

### Step 5.4: Verify Configuration

Open browser console on your deployed site and run:

```javascript
console.log('API_BASE:', window.API_BASE);
console.log('BACKEND_URL:', window.BACKEND_URL);
```

Expected output:
```
API_BASE: https://api.atomicfizzcaps.xyz
BACKEND_URL: https://api.atomicfizzcaps.xyz
```

---

## 🔧 Part 6: Troubleshooting

### Common Issues

#### Issue: CORS Errors

**Symptom**: Browser console shows CORS errors like:
```
Access to fetch at 'https://api.atomicfizzcaps.xyz' from origin 'https://atomicfizzcaps.xyz' has been blocked by CORS policy
```

**Solution**:
1. Check `FRONTEND_ORIGIN` environment variable on Render
2. Ensure your frontend domain is included (exact match or wildcard)
3. Restart Render service after updating environment variables

#### Issue: 404 on API Endpoints

**Symptom**: API calls return 404 Not Found

**Solution**:
1. Verify backend is running (check Render logs)
2. Check if the endpoint path is correct (e.g., `/api/locations` not `/locations`)
3. Verify the Vercel rewrite is pointing to correct backend URL

#### Issue: Redis Connection Failed

**Symptom**: Backend logs show Redis connection errors, such as:
- `[redis] connection failed — falling back to in-memory store Invalid protocol`
- `[redis] INVALID REDIS_URL: must start with redis:// or rediss://`

**Common Causes**:
1. **Invalid Protocol**: REDIS_URL must start with `redis://` or `rediss://` (for TLS)
   - ❌ Wrong: `http://localhost:6379` or `https://redis.example.com`
   - ✅ Correct: `redis://default:password@localhost:6379`
   - ✅ Correct (TLS): `rediss://default:password@redis.example.com:6380`

2. **Whitespace in URL**: Environment variable contains leading/trailing spaces
   - The system now automatically trims whitespace, but check your `.env` file

3. **Missing URL Components**: Ensure the URL includes all required parts
   - Format: `redis://[username]:[password]@[host]:[port]`
   - Example: `redis://default:mypassword@redis-12345.render.com:6379`

**Solution**:
1. Verify `REDIS_URL` format matches `redis://` or `rediss://` protocol
2. Check the URL in the Render dashboard environment variables (not in code)
3. If using Render Redis internal URL, ensure both services are in same region
4. Check Redis instance is running and accessible
5. Try using external URL if internal URL fails
6. Review backend logs for detailed error messages (now shows masked URL format)

#### Issue: Free Tier Spin-up Delay

**Symptom**: First request to backend takes 30+ seconds

**Cause**: Render free tier instances spin down after 15 minutes of inactivity

**Solutions**:
1. Upgrade to paid tier for always-on availability
2. Use an external service like [Uptime Robot](https://uptimerobot.com/) to ping your backend every 14 minutes
3. Accept the delay for development/testing environments

#### Issue: Build Fails on Render

**Symptom**: Deployment fails during npm install

**Solution**:
1. Check `backend/package.json` has all dependencies listed
2. Verify Node.js version compatibility (check `engines` field)
3. Review build logs for specific error messages

#### Issue: Environment Variables Not Working

**Symptom**: Code doesn't see environment variables

**Solution**:
1. After adding/changing env vars, **manually trigger a redeploy**
2. On Render: Go to service → Manual Deploy → Deploy latest commit
3. On Vercel: Go to Deployments → Redeploy (not from cache)

### Checking Logs

#### Render Backend Logs

1. Go to Render dashboard → Your service → **"Logs"** tab
2. Check for startup errors, CORS warnings, Redis connection issues

#### Vercel Frontend Logs

1. Go to Vercel dashboard → Your project → **"Deployments"**
2. Click on a deployment → **"Functions"** tab (if using serverless functions)
3. For static files, check **"Build Logs"**

---

## 📚 Additional Resources

- [Main Deployment Guide](../DEPLOYMENT.md) - Architecture overview and quick reference
- [Environment Variables Reference](../ENVIRONMENT_VARIABLES.md) - Complete variable documentation
- [Testing Guide](../TESTING_GUIDE.md) - Testing instructions
- [Backend .env.example](../backend/.env.example) - Example environment file

---

## 🔄 Updating Deployments

### Automatic Deployments

Both Render and Vercel support automatic deployments on git push:

1. Push changes to your `main` branch
2. Both services will automatically detect changes and redeploy

### Manual Deployment

**Render**:
1. Dashboard → Your service → **"Manual Deploy"** → **"Deploy latest commit"**

**Vercel**:
1. Dashboard → Your project → **"Deployments"** → **"Redeploy"**

Or use the GitHub Actions workflow for [Manual Vercel Deployment](./MANUAL_VERCEL_DEPLOY.md).

---

## 🔒 Security Checklist

Before going to production, ensure:

- [ ] All secrets are unique and cryptographically secure
- [ ] `NODE_ENV` is set to `production`
- [ ] `FRONTEND_ORIGIN` only includes necessary domains
- [ ] `STRICT_REPLAY_PROTECTION` is `true`
- [ ] Admin credentials are strong and unique
- [ ] HTTPS is enforced (automatic on both platforms)
- [ ] Redis connection uses password authentication

---

**📟 OVERSEER MESSAGE:**

> "Deployment protocols have been verified, Vault Dweller.
> Your wasteland GPS system is ready to guide survivors to safety.
> Remember: Test in staging before production deployment.
> 
> Stay safe out there. ☢️"

---

*Document Version: 1.0*  
*Last Updated: 2026-02-01*  
*Classification: VAULT-TEC DEPLOYMENT PROTOCOL*
