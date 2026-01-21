# Quick Start: Force Vercel Deploy

This guide provides a quick reference for forcing a Vercel deployment when automatic deployments are blocked due to credit/build minute limits.

## One-Time Setup (5 minutes)

### Step 1: Get Your Vercel Token
1. Visit https://vercel.com/account/tokens
2. Click "Create Token"
3. Give it a name (e.g., "GitHub Actions")
4. Copy the token

### Step 2: Get Your Project IDs
Run these commands in your local project directory:
```bash
npm install -g vercel
vercel link
cat .vercel/project.json
```

Copy the `orgId` and `projectId` values.

### Step 3: Add Secrets to GitHub
1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Click "New repository secret" and add these three secrets:
   - `VERCEL_TOKEN` = your token from Step 1
   - `VERCEL_ORG_ID` = the `orgId` from Step 2
   - `VERCEL_PROJECT_ID` = the `projectId` from Step 2

## Usage: Trigger a Deployment

### Via GitHub Actions (Recommended)
1. Go to your repo's **Actions** tab
2. Select **Manual Vercel Deployment** workflow
3. Click **Run workflow** button
4. Choose environment (production or preview)
5. Click **Run workflow**

### Via Local Command Line
```bash
# Install Vercel CLI (first time only)
npm install -g vercel

# Login (first time only)
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

## What This Solves

- ✅ Deploy when you've hit Vercel's build minute quota
- ✅ Deploy when automatic Git integration is paused
- ✅ Manual control over deployment timing
- ✅ Works from any branch

## Need Help?

See the full documentation: [MANUAL_VERCEL_DEPLOY.md](MANUAL_VERCEL_DEPLOY.md)
