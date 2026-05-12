# Backend Server Architecture

## 🏗️ Server File Structure

### Active Server Files (Production)

1. **`backend/server.js`** - Main production server
   - Full-featured Express application
   - Handles all API routes, static files, and middleware
   - Used by both standalone Node.js deployment and Vercel serverless
   - Exports the Express app for use by `api/index.js`

2. **`api/index.js`** - Vercel Serverless Function Entry Point
   - Minimal wrapper that loads `backend/server.js`
   - Routes all `/api/*` requests to the Express app
   - Required for Vercel serverless deployment

### Legacy Files (Not Used)

- **`backend/index.js.legacy`** - Old server configuration (renamed from `backend/index.js`)
  - This file was causing confusion as it appeared to be an alternative server
  - It is NOT used by the application
  - Kept for historical reference but renamed to prevent accidental use

## 📡 Deployment Architecture

### Vercel Deployment (Current Production)

```
Client Request
    ↓
Vercel CDN (static files from /public)
    ↓
/api/* requests → api/index.js (serverless function)
    ↓
backend/server.js (Express app)
    ↓
API Route Handlers (backend/api/*)
    ↓
Response
```

**Configuration:**
- `vercel.json` defines routing and rewrites
- `api/index.js` acts as serverless function entry point
- `backend/server.js` contains the full Express application
- Environment variables set in Vercel dashboard

### Render Deployment (Alternative/Backup)

```
Client Request
    ↓
Render Load Balancer
    ↓
backend/server.js (Node.js process)
    ↓
API Route Handlers + Static Files
    ↓
Response
```

**Configuration:**
- `render.yaml` defines service configuration
- Runs `node server.js` directly in `backend/` directory
- Environment variables set in Render dashboard

## 🔧 Local Development

### Option 1: Full Stack (Recommended)

```bash
# From project root
npm start
# or
npm run dev

# Server runs on http://localhost:3000
# Serves both API and static files
```

### Option 2: Vercel CLI (Test Serverless Environment)

```bash
# Install Vercel CLI
npm i -g vercel

# Run development server
vercel dev

# Simulates Vercel serverless environment
```

## 🎯 Key Points

1. **Only ONE server file is active**: `backend/server.js`
2. **`api/index.js`** is NOT a server - it's a Vercel wrapper
3. **`backend/index.js.legacy`** is NOT used - renamed to prevent confusion
4. All API routes are defined in `backend/server.js` and mounted there
5. The same codebase works for both Vercel serverless and traditional Node.js hosting

## 🚨 Common Issues

### "Multiple instances running"
- **Cause**: Confusion between `backend/index.js` and `backend/server.js`
- **Fix**: Only `backend/server.js` should be used. Legacy file has been renamed.

### "Some routes work, some don't"
- **Cause**: Routes not properly mounted in `backend/server.js`
- **Fix**: Check that all routes are mounted using `safeMount()` function

### "CORS errors"
- **Cause**: Origin not in allowed list in `backend/server.js`
- **Fix**: Add origin to `allowedOrigins` or set `FRONTEND_ORIGIN` env var

## 📝 Adding New API Routes

1. Create route file in `backend/api/<route-name>.js`
2. Export an Express router
3. Mount in `backend/server.js` using:
   ```javascript
   safeMount("/api/<route-name>", api("<route-name>"));
   ```

Example:
```javascript
// In backend/api/example.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Example route' });
});

module.exports = router;
```

```javascript
// In backend/server.js (add this line with other safeMount calls)
safeMount("/api/example", api("example"));
```

---

**Last Updated**: 2026-02-05
**Maintained by**: Vault 77 Overseer AI ☢️
