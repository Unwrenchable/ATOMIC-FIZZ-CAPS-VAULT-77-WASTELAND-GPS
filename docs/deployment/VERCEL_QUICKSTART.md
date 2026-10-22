# Vercel Full Stack Deployment - Quick Reference

## 🚀 Fastest Way to Deploy

```bash
# 1. Push your code to GitHub
git push origin main

# 2. Go to vercel.com and import your repo

# 3. Set these environment variables in Vercel dashboard:
NODE_ENV=production
SERVER_SECRET_KEY=your-secret-key-here
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-bcrypt-hashed-password

# 4. Click "Deploy"
# Done! ✅
```

## 📁 What Gets Deployed

```
Your Vercel Deployment:
├── Frontend (Static Files)
│   └── public/ → served at yourdomain.com
├── Backend (Serverless Functions)
│   └── api/index.js → handles /api/* requests
└── Configuration
    └── vercel.json → tells Vercel how to build & route
```

## 🔧 Configuration Files

### vercel.json
- Tells Vercel to install dependencies: `npm install && cd backend && npm install`
- Routes `/api/*` requests to serverless function
- Serves static files from `public/` directory

### api/index.js
- Entry point for serverless function
- Wraps the Express app from `backend/server.js`
- Handles all API requests

### backend/server.js
- Your Express application
- Skips `app.listen()` when running in Vercel (serverless mode)
- All routes work the same as before

## 🌐 How Requests Work

```
User visits yourdomain.com
    ↓
GET /index.html → Vercel CDN → public/index.html
    ↓
GET /js/main.js → Vercel CDN → public/js/main.js
    ↓
POST /api/player → Vercel Function → api/index.js → backend/server.js → Response
```

## ⚙️ Environment Variables

### Required for Production
```bash
NODE_ENV=production              # Run in production mode
SERVER_SECRET_KEY=abc123...      # Secret key for JWT/sessions
ADMIN_USERNAME=admin             # Admin panel username
ADMIN_PASSWORD=$2b$12$xyz...     # Bcrypt-hashed password
```

### Optional (for external services)
```bash
REDIS_URL=redis://...            # Redis for state management
SOLANA_RPC=https://...           # Solana RPC endpoint
HUGGINGFACE_API_KEY=hf_...       # For AI features
```

**How to generate bcrypt password hash:**
```bash
cd backend
node -e "const bcrypt=require('bcrypt'); bcrypt.hash('your-password', 12).then(h => console.log(h))"
```

## 🧪 Testing Locally

### Option 1: Traditional (separate processes)
```bash
# Terminal 1: Backend
cd backend && npm install && npm start

# Terminal 2: Frontend
npx serve public -p 8080
```

### Option 2: Vercel CLI (simulates production)
```bash
# Install Vercel CLI
npm i -g vercel

# Install dependencies
npm install && cd backend && npm install && cd ..

# Run Vercel dev server
vercel dev
```

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **API returns 404** | Check that API_BASE is empty string in browser console |
| **CORS errors** | Verify CORS origins in backend/server.js include your domain |
| **Build fails** | Ensure vercel.json has correct install command |
| **Function too large** | Add files to .vercelignore |
| **Missing modules** | Add to backend/package.json dependencies |
| **Cold starts slow** | Normal for serverless (500ms-1s) - consider Vercel Pro |

## 📊 Vercel vs Split Deployment

| Feature | Full Stack Vercel | Split (Vercel + Render) |
|---------|------------------|------------------------|
| Setup | ⭐⭐⭐ Easy | ⭐⭐ Moderate |
| Cost | Pay per request | Pay per hour |
| Scaling | ⭐⭐⭐ Auto | ⭐⭐ Manual/Auto |
| Cold starts | Yes (~500ms) | No (always warm) |
| WebSockets | ❌ Limited | ✅ Full support |
| Long tasks | ❌ 10s limit | ✅ No limit |
| Best for | Most apps | Heavy backend needs |

## 📚 Full Documentation

- **Complete Guide**: [VERCEL_FULL_STACK_DEPLOYMENT.md](VERCEL_FULL_STACK_DEPLOYMENT.md)
- **All Options**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Architecture**: [README.md](README.md#technical-specifications)

## 🆘 Need Help?

1. Check the troubleshooting section in [VERCEL_FULL_STACK_DEPLOYMENT.md](VERCEL_FULL_STACK_DEPLOYMENT.md)
2. Check Vercel deployment logs in your dashboard
3. Check browser console for API_BASE configuration
4. Open an issue on GitHub with logs and error messages

---

**Pro Tip**: Use `vercel --prod` from CLI to deploy manually, or push to GitHub for automatic deployments!
