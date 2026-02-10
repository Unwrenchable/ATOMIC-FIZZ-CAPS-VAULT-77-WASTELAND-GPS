# Repository Organization Migration Guide

## ✅ YES - Your Site Will Continue to Work!

When you move your repository to an organization, **your site will continue to be served** as long as you follow the configuration steps below. The deployment is based on Vercel and Render services, not on the GitHub repository location.

---

## 🎯 What You Need to Know

### The Good News 🎉

Your deployment infrastructure is **already organization-ready**:

- ✅ **Domain stays the same**: `atomicfizzcaps.xyz` and `www.atomicfizzcaps.xyz` will continue to work
- ✅ **Vercel deployment**: Uses project secrets (`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`), not repository path
- ✅ **Render backend**: Configured by service name, not repository owner
- ✅ **Environment variables**: All configuration is in Vercel/Render dashboards, not hardcoded
- ✅ **GitHub Actions**: Already uses proper secret references

### What Changes

- ❗ **Repository URL**: Changes from `github.com/username/repo` to `github.com/organization/repo`
- ❗ **Vercel connection**: Needs to be reconnected to the new repository location
- ❗ **Render connection**: Needs to be reconnected to the new repository location (if using split architecture)

---

## 📋 Migration Checklist

### Before Moving the Repository

- [ ] **Document your current setup**:
  - [ ] Note your Vercel project name and domain
  - [ ] Note your Render service names (if applicable)
  - [ ] Export/backup your environment variables from both services
  - [ ] List all custom domains configured

- [ ] **Backup critical data**:
  - [ ] Environment variables from Vercel dashboard
  - [ ] Environment variables from Render dashboard
  - [ ] Any Redis or database connection strings
  - [ ] API keys (SOLANA, HuggingFace, etc.)

### During the Move

1. **Transfer the repository** to the organization:
   - Go to repository Settings → General → Danger Zone → Transfer ownership
   - Follow GitHub's transfer process
   - The repository URL will change from `github.com/old-owner/your-repo-name` to `github.com/new-org/your-repo-name`

### After Moving the Repository

#### For Vercel Deployment (Frontend + Serverless Backend)

1. **Reconnect Vercel to the new repository**:
   ```
   Option A: Update existing project
   - Go to your Vercel project → Settings → Git
   - Disconnect and reconnect to the new organization repository
   
   Option B: Create new project (if update fails)
   - Import the repository from the new organization location
   - Vercel will auto-detect the configuration from vercel.json
   ```

2. **Verify Vercel environment variables** (no changes needed, but confirm):
   - `NODE_ENV=production`
   - `SERVER_SECRET_KEY` - your secret key
   - `ADMIN_USERNAME` - your admin username
   - `ADMIN_PASSWORD` - your bcrypt hashed password
   - `REDIS_URL` - your Redis connection (if applicable)
   - `HF_API_KEY` - HuggingFace API key (if applicable)
   - Any other custom environment variables

3. **Update GitHub Secrets** (for GitHub Actions workflow):
   - Go to organization repository → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `VERCEL_TOKEN` - Your Vercel API token
     - `VERCEL_ORG_ID` - Your Vercel organization/user ID
     - `VERCEL_PROJECT_ID` - Your Vercel project ID
   - Get these values from your Vercel dashboard or run `vercel whoami` and `vercel project ls`

4. **Trigger a deployment**:
   ```bash
   # Push a commit to trigger automatic deployment
   git commit --allow-empty -m "Test deployment after migration"
   git push
   
   # OR use the manual GitHub Actions workflow
   # Go to Actions → Manual Vercel Deployment → Run workflow
   ```

#### For Render Deployment (Backend API - if using split architecture)

1. **Reconnect Render to the new repository**:
   - Go to your Render service dashboard
   - Navigate to Settings → Build & Deploy
   - Update the connected repository to the new organization location
   - OR create a new service and import from the new repository

2. **Verify Render environment variables** (no changes needed):
   - `NODE_ENV=production`
   - `FRONTEND_ORIGIN` - allowed CORS origins
   - `SERVER_SECRET_KEY` - your secret key
   - `REDIS_URL` - Redis connection
   - All other environment variables from your backup

3. **Verify the service starts correctly**:
   - Check the Render logs for any errors
   - Test the health endpoint: `https://api.atomicfizzcaps.xyz/api/health`

---

## 🔍 Verification Steps

After migration, verify everything works:

### 1. Test the Frontend
```bash
# Visit your main site
https://www.atomicfizzcaps.xyz
# or
https://atomicfizzcaps.xyz

# Check browser console for errors
# Verify wallet connection works
# Test map loading
```

### 2. Test the Backend API
```bash
# Health check
curl https://api.atomicfizzcaps.xyz/api/health

# Or if using full stack Vercel:
curl https://www.atomicfizzcaps.xyz/api/health
```

### 3. Test GitHub Actions
```bash
# Push a commit and verify automatic deployment
git commit --allow-empty -m "Test CI/CD after migration"
git push

# Check the Actions tab to see if workflow runs successfully
```

### 4. Test Core Features
- [ ] Player creation and authentication
- [ ] Map loads correctly
- [ ] Location claiming works
- [ ] Wallet integration functions
- [ ] Admin panel accessible (if configured)
- [ ] Overseer terminal responds (if configured)

---

## 🚨 Troubleshooting

### Issue: Vercel deployment fails after migration

**Solution**: 
1. Check that `vercel.json` is present in the repository
2. Verify build command in Vercel dashboard matches: `npm install && cd backend && npm install`
3. Check environment variables are all set
4. Review deployment logs in Vercel dashboard

### Issue: GitHub Actions workflow fails

**Cause**: Missing or incorrect secrets

**Solution**:
1. Verify `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are set in repository secrets
2. Generate new Vercel token if needed: https://vercel.com/account/tokens
3. Get correct project IDs: `vercel project ls` or from Vercel project settings

### Issue: CORS errors in browser

**Cause**: Frontend and backend configurations may be misaligned

**Solution**:
1. Check `public/js/config.js` - it should auto-detect the environment
2. For split architecture: Verify `FRONTEND_ORIGIN` environment variable in Render includes all necessary origins
3. Check browser console for the blocked origin and add it to backend CORS configuration

### Issue: 404 errors for API calls

**Cause**: API routing may not be configured correctly

**Solution**:
1. For full stack Vercel: Ensure `api/index.js` exists and `vercel.json` has correct rewrites
2. For split architecture: Verify `public/js/config.js` points to the correct API base URL
3. Check that backend is running and accessible

---

## 📚 Additional Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Render Documentation**: https://render.com/docs
- **GitHub Repository Transfer**: https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository

### Related Files in This Repository

- `VERCEL_QUICKSTART.md` - Quick Vercel deployment guide
- `VERCEL_FULL_STACK_DEPLOYMENT.md` - Full stack Vercel setup
- `DEPLOYMENT.md` - General deployment overview
- `ENVIRONMENT_VARIABLES.md` - All environment variable documentation
- `docs/RENDER_VERCEL_DEPLOYMENT_GUIDE.md` - Split architecture guide

---

## 💡 Key Takeaway

**Your site deployment is decoupled from the GitHub repository location.** The site is served by:
- **Vercel** (for frontend and/or backend)
- **Render** (for backend, if using split architecture)
- **Custom domains** (atomicfizzcaps.xyz)

These services connect to your repository but **don't depend on the owner/organization name**. As long as you reconnect the services to the new repository location and maintain your environment variables, everything will continue to work exactly as before.

**The migration is safe!** ✅
