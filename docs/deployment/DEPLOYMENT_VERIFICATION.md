# 📡 Deployment Verification Checklist

## Purpose
This document helps verify that your Atomic Fizz Caps deployment is working correctly on Vercel (or other platforms). Use this checklist when troubleshooting "multiple instances" or "some routes work, some don't" issues.

---

## ✅ Pre-Deployment Checks

### 1. Server Architecture
- [ ] **Only ONE server file exists**: `backend/server.js` ✓
- [ ] **Legacy file removed**: `backend/index.js` deleted (renamed to `.legacy`) ✓
- [ ] **API wrapper exists**: `api/index.js` correctly requires `backend/server.js` ✓

### 2. Vercel Configuration
- [ ] **vercel.json present**: Configuration file exists
- [ ] **Install command correct**: `npm install && cd backend && npm install`
- [ ] **Output directory**: Set to `public`
- [ ] **API rewrite configured**: `/api/:path*` → `/api`

### 3. Package Configuration
- [ ] **Root package.json**: Points to `backend/server.js` as main
- [ ] **Backend package.json**: Start script runs `node server.js`
- [ ] **Dependencies installed**: Both root and backend `node_modules` present

---

## 🔍 Post-Deployment Verification

### Step 1: Check Health Endpoint
Open your deployment URL and test the health endpoint:

```
https://your-domain.vercel.app/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "env": "production",
  "time": "2026-02-05T00:00:00.000Z",
  "redis": true,
  "solana_rpc": true
}
```

✅ **If this works**: Your server is running and API routing is correct.
❌ **If this fails**: Check Vercel function logs for errors.

---

### Step 2: Test Static File Serving
Open the main page:

```
https://your-domain.vercel.app/
```

✅ **Expected**: Atomic Fizz Caps homepage loads
❌ **If 404**: Check that `public/index.html` exists and `outputDirectory` is set to `public`

---

### Step 3: Test API Routes
Test a few critical API endpoints:

**Mintables:**
```
https://your-domain.vercel.app/api/mintables
```

**Locations:**
```
https://your-domain.vercel.app/api/locations
```

**Player:**
```
https://your-domain.vercel.app/api/player
```

✅ **Expected**: JSON responses (may require auth for some)
❌ **If 404 or 500**: Check Vercel function logs to see which routes are mounting

---

### Step 4: Check Vercel Function Logs

1. Go to Vercel Dashboard → Your Project → Functions
2. Click on the `/api` function
3. View recent invocations and logs

**Look for:**
- `[server] mounted <route> at <path>` - Routes successfully loading
- `[server] skipping <route>` - Routes failing to load (check error message)
- Any errors during module loading

**Common Issues:**
- **"Cannot find module"**: Dependency not installed (check install command)
- **"Invalid public key"**: Missing environment variable (expected for some routes in dev)
- **CORS errors**: Origin not whitelisted in `backend/server.js`

---

### Step 5: Verify Environment Variables

In Vercel Dashboard → Settings → Environment Variables, verify:

**Required:**
- `NODE_ENV` = `production`
- `SERVER_SECRET_KEY` = (your secret key)
- `ADMIN_USERNAME` = (your admin username)
- `ADMIN_PASSWORD` = (bcrypt hash)

**Optional (depending on features):**
- `REDIS_URL` = (your Redis connection string)
- `SOLANA_RPC` = (your Solana RPC endpoint)
- `HUGGINGFACE_API_KEY` = (for AI features)

**After adding/changing variables**: Redeploy for changes to take effect!

---

## 🚨 Troubleshooting Common Issues

### Issue: "Multiple instances running"

**Symptom**: Inconsistent behavior, some requests work, some don't

**Causes:**
1. ✅ **FIXED**: Legacy `backend/index.js` file was causing confusion (now removed)
2. Multiple domains pointing to different deployments
3. Browser caching old deployment

**Solutions:**
- Clear browser cache and cookies
- Check which domains are pointing to your Vercel deployment
- Verify only one deployment is serving your domain (not both Vercel and Render)

---

### Issue: "Some routes work, some don't"

**Symptom**: `/api/health` works but `/api/player` returns 404

**Causes:**
1. Route not mounted in `backend/server.js`
2. Route file has syntax error (check function logs)
3. Missing environment variable causing route to fail loading

**Solutions:**
- Check Vercel function logs for `[server] skipping` messages
- Verify route file exists: `backend/api/<route-name>.js`
- Add route mounting in `backend/server.js`:
  ```javascript
  safeMount("/api/<route-name>", api("<route-name>"));
  ```

---

### Issue: CORS Errors

**Symptom**: Browser console shows CORS policy errors

**Causes:**
1. Origin not in allowed list
2. Wildcard pattern not matching your domain

**Solutions:**
- Add your domain to `allowedOrigins` in `backend/server.js`:
  ```javascript
  const criticalOrigins = [
    "https://www.atomicfizzcaps.xyz",
    "https://atomicfizzcaps.xyz",
    "https://your-new-domain.com"  // Add here
  ];
  ```
- Or set `FRONTEND_ORIGIN` environment variable in Vercel:
  ```
  FRONTEND_ORIGIN=https://your-domain.com,https://www.your-domain.com
  ```
- Redeploy after changes

---

### Issue: Function Size Limit Exceeded

**Symptom**: Build fails with "Function size exceeds 50MB"

**Causes:**
1. Too many dependencies included
2. Build artifacts not excluded

**Solutions:**
- Check `.vercelignore` excludes unnecessary files:
  - `programs/`, `target/` (Rust)
  - `docs/`, `tests/`
  - `node_modules/` (will be rebuilt)
- Remove unused dependencies from `package.json`
- Consider splitting large routes into separate functions

---

### Issue: 504 Gateway Timeout

**Symptom**: API calls timeout after 10 seconds

**Causes:**
1. Route handler takes too long
2. Database/Redis connection hanging
3. External API call not responding

**Solutions:**
- Vercel free tier has 10s timeout, Pro has 60s
- Add timeouts to external calls:
  ```javascript
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const response = await fetch(url, { signal: controller.signal });
  ```
- Use async patterns, don't block the event loop
- Check Redis connection timeout (default 5s)

---

## 📊 Quick Health Check Commands

Use these to quickly verify your deployment:

### Check all API routes are accessible:
```bash
curl https://your-domain.vercel.app/api/health
curl https://your-domain.vercel.app/api/mintables
curl https://your-domain.vercel.app/api/locations
curl https://your-domain.vercel.app/api/settings
```

### Check CORS headers:
```bash
curl -I -X OPTIONS \
  -H "Origin: https://your-domain.com" \
  -H "Access-Control-Request-Method: GET" \
  https://your-domain.vercel.app/api/health
```

Look for `access-control-allow-origin` header in response.

---

## 🎯 Success Criteria

Your deployment is healthy when:

- ✅ Health endpoint returns `{"status":"ok"}`
- ✅ All critical API routes return 200 or expected auth errors
- ✅ Static files (index.html, CSS, JS) load correctly
- ✅ No CORS errors in browser console
- ✅ Vercel function logs show all routes mounting successfully
- ✅ No "multiple instances" or inconsistent behavior

---

## 📞 Need Help?

If issues persist after following this checklist:

1. **Check Vercel function logs** for specific error messages
2. **Review `backend/README_SERVER_ARCHITECTURE.md`** for architecture details
3. **Verify environment variables** are set correctly in Vercel dashboard
4. **Clear browser cache** and test in incognito mode
5. **Check GitHub Actions** for any failed deployments

---

**Last Updated**: 2026-02-05
**Maintained by**: Vault 77 Overseer AI ☢️

*Per Vault-Tec regulations, all deployment anomalies must be reported and resolved within 24 hours for optimal vault performance.*
