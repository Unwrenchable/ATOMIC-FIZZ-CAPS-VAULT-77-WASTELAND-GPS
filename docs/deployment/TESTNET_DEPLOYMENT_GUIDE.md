# 🎮 ATOMIC FIZZ CAPS - PUBLIC TESTNET GUIDE

## 📟 OVERSEER BRIEFING

Welcome, Vault Dwellers! This guide will help you deploy and test the Atomic Fizz Caps wasteland GPS game on Solana devnet (testnet) with **PUBLIC ACCESS** - open to all wallets.

---

## ☢️ DEVNET WALLET SETUP

### Deployer / Treasury Keypair

The active devnet deployer is the F1ZZ vanity wallet:

```
F1ZZtas4odhUyW1CytEzSjYr3DsQ8ymNimoeVpHGkw4L
```

**GitHub Actions secret** (`SOLANA_KEYPAIR`)  
The `deploy-devnet` workflow writes this secret to `~/.config/solana/id.json`.
Update it whenever you rotate the deployer keypair:

1. Open your keypair JSON file (the `[…]` byte-array): `cat ~/.config/solana/id.json`
2. Go to **GitHub → Settings → Secrets → Actions**
3. Set / update `SOLANA_KEYPAIR` to the full JSON array contents

### Create the CAPS Mint (vanity key)

```bash
# Grind a keypair whose address starts with "CAPS" (no --outfile flag)
solana-keygen grind --starts-with CAPS:1
# Output: saved to CAPS<rest_of_address>.json

# Confirm address
solana address -k CAPS<rest_of_address>.json

# Create the SPL token on devnet (9 decimals = 1 billion × 10⁹ lamports)
spl-token create-token --decimals 9 CAPS<rest_of_address>.json

# Set CAPS_MINT in .env to the printed token mint address
```

> **Note:** `solana-keygen grind` does **not** accept `--outfile`.  
> The keypair is written to `<address>.json` in the current directory automatically.

---

## 🚀 QUICK START (Public Testing)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy the testnet template
cp .env.testnet .env

# Edit .env and set these REQUIRED variables:
# - HELIUS_API_KEY (get free key from https://dev.helius.xyz/)
# - SERVER_SECRET_KEY (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

### 3. Start Redis (Required)
```bash
# Option A: Docker
docker run -d -p 6379:6379 redis:alpine

# Option B: Local installation
redis-server

# Option C: Use cloud Redis (update REDIS_URL in .env)
```

### 4. Start Server
```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 5. Open Game
```
http://localhost:3000
```

---

## 🧪 TESTING ALL FEATURES

### Core Game Functions

#### ✅ Player Initialization
- **Test**: Load game in browser
- **Expected**: 
  - Quest notification "Wake Up" appears
  - Player spawns with vault jumpsuit equipped
  - Starter gear added to inventory
- **Verify**: Check browser console for `[quests] Giving starter gear`

#### ✅ Wallet Connection
- **Test**: Click wallet connect button
- **Expected**: Any Phantom/Solana wallet can connect
- **No Restrictions**: All wallets accepted for testing
- **Verify**: Wallet address appears in UI

#### ✅ Quest System
- **Endpoints**:
  - `GET /api/quests` - List all quests
  - `GET /api/quests-store/placeholders` - Quest metadata
  - `POST /api/quests-store/prove` - Submit quest proof
- **Test**:
  ```bash
  curl http://localhost:3000/api/quests
  curl http://localhost:3000/api/quests-store/placeholders
  ```

#### ✅ Location System
- **Endpoints**:
  - `GET /api/locations` - All game locations
  - `POST /api/location-claim` - Claim location reward
- **Test**:
  ```bash
  curl http://localhost:3000/api/locations | jq '. | length'
  ```

#### ✅ Inventory & Items
- **Endpoints**:
  - `GET /api/mintables` - Available items
  - `POST /api/mint-item` - Mint/claim item (dev mode)
  - `GET /api/player-nfts?wallet=ADDRESS` - Player NFTs
- **Test**:
  ```bash
  # List all mintable items
  curl http://localhost:3000/api/mintables | jq '. | length'
  
  # Test minting (works in dev mode without restrictions)
  curl -X POST http://localhost:3000/api/mint-item \
    -H "Content-Type: application/json" \
    -d '{"wallet":"YOUR_WALLET_ADDRESS"}'
  ```

#### ✅ XP & Caps System
- **Endpoints**:
  - `POST /api/xp` - Award XP
  - `POST /api/caps` - Award caps
  - `GET /api/player?wallet=ADDRESS` - Player stats
- **Test**:
  ```bash
  # Check player profile
  curl "http://localhost:3000/api/player?wallet=YOUR_ADDRESS"
  ```

---

## 🔍 API ENDPOINT INDEX

### Public Endpoints (No Auth Required)

| Endpoint | Method | Purpose | Tested |
|----------|--------|---------|--------|
| `/api/health` | GET | Server status | ✅ |
| `/api/mintables` | GET | Available items (37 items) | ✅ |
| `/api/locations` | GET | Game locations (3 locations) | ✅ |
| `/api/quests` | GET | All quests (48 quests) | ✅ |
| `/api/quests-store/placeholders` | GET | Quest metadata | ✅ |
| `/api/scavenger` | GET | Scavenger hunt data | ✅ |
| `/api/settings` | GET | Game settings | ✅ |
| `/api/config/frontend` | GET | Frontend config | ✅ |

### Player Endpoints (Wallet-based)

| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/api/player` | GET | Player profile | 20/10s |
| `/api/player-nfts` | GET | Player NFTs | - |
| `/api/xp` | POST | Award XP | 20/10s |
| `/api/caps` | POST | Award caps | 20/10s |
| `/api/mint-item` | POST | Mint item | 8/10s |

### Quest Endpoints

| Endpoint | Method | Purpose | Rate Limit |
|----------|--------|---------|------------|
| `/api/quests-store/prove` | POST | Submit quest proof | 5/min |
| `/api/quests-store/reveal` | POST | Reveal quest details | 30/10s |
| `/api/quest-secrets/check` | POST | Check secret objective | - |

### Admin Endpoints (Requires Admin Auth)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/player` | GET/POST | Manage players |
| `/api/admin/mintables` | GET/POST | Manage items |
| `/api/admin/keys` | GET | Key management |

---

## 🌐 HTML INTERFACE INDEX

### Main Interfaces

| File | Purpose | Tested |
|------|---------|--------|
| `index.html` | Main game UI | ✅ |
| `wallet/index.html` | Wallet integration | ✅ |
| `overseer.html` | Overseer AI interface | - |

### Feature Pages

| File | Purpose | Wallet Required |
|------|---------|-----------------|
| `exchange.html` | Token exchange | Yes |
| `bridge.html` | Cross-chain bridge | Yes |
| `nuke.html` | Nuclear launch | Yes |
| `donate.html` | Support page | Optional |

### Admin Pages

| File | Purpose | Requires Admin |
|------|---------|----------------|
| `admin/index.html` | Admin panel | Yes |
| `admin/dashboard.html` | Admin dashboard | Yes |

---

## 🎯 TEST SCENARIOS

### Scenario 1: New Player Experience
1. Open game in incognito window
2. Observe boot sequence
3. Click to proceed
4. Verify "Wake Up" quest appears
5. Check inventory has starter gear
6. **Expected**: 6 starter items (jumpsuit, sidearm, stimpak, water, bobby pins, ammo)

### Scenario 2: Wallet Connection (Any Wallet)
1. Click "Connect Wallet" button
2. Connect with ANY Solana wallet
3. Verify wallet address displays
4. **Expected**: Connection successful, no restrictions

### Scenario 3: Quest Completion
1. Connect wallet
2. Navigate to QUESTS tab
3. Accept "Wake Up" quest
4. Complete objectives
5. **Expected**: XP and caps awarded

### Scenario 4: Location Discovery
1. Allow GPS permission
2. Move around map
3. Approach a location
4. **Expected**: Location discovered notification

### Scenario 5: Item Minting (Testnet)
1. Connect wallet
2. Find mintable item
3. Click claim/mint
4. **Expected**: Item added to inventory (dev mode)

---

## 🐛 TROUBLESHOOTING

### Issue: "Failed to connect to server"
**Solution**: 
- Check server is running: `curl http://localhost:3000/api/health`
- Verify PORT in .env matches

### Issue: "Redis connection failed"
**Solution**:
- Start Redis: `redis-server` or `docker run -d -p 6379:6379 redis`
- Check REDIS_URL in .env

### Issue: "NFT fetching failed"
**Solution**:
- Set HELIUS_API_KEY in .env
- Get free key: https://dev.helius.xyz/

### Issue: "Rate limit exceeded (429)"
**Solution**:
- Wait 10-60 seconds
- Adjust rate limits in server.js if needed

### Issue: "Map not loading"
**Solution**:
- Disable ad blockers (they block Leaflet CDN)
- Check browser console for errors

---

## 🔐 SECURITY FOR PUBLIC TESTING

### ✅ What's Enabled
- All wallets can connect
- All players can mint items (dev mode)
- All players can complete quests
- All players can claim locations

### ⚠️ What's Disabled
- Admin endpoints (require ADMIN_WALLETS)
- Production minting (requires ADMIN_MINT_SECRET)
- Mainnet transactions

### 🛡️ Rate Limiting
- Global: 50 requests/10s
- Mint: 8 requests/10s
- Quest proof: 5 requests/minute
- Player actions: 20 requests/10s

---

## 📊 MONITORING & LOGS

### Check Logs
```bash
# Server logs show:
# - API requests
# - Quest triggers
# - Player actions
# - Errors and warnings

# Watch logs:
tail -f server.log
```

### Health Check
```bash
curl http://localhost:3000/api/health | jq
```

### Test All Endpoints
```bash
# Run comprehensive API test
./scripts/test-all-endpoints.sh
```

---

## 🚢 DEPLOYMENT TO PRODUCTION TESTNET

### 1. Update Environment
```bash
NODE_ENV=production
SOLANA_RPC_URL=https://api.devnet.solana.com
```

### 2. Set Up Cloud Redis
- Use Redis Cloud, Upstash, or AWS ElastiCache
- Update REDIS_URL

### 3. Deploy to Hosting
- Vercel: `vercel deploy`
- Render: Push to GitHub (auto-deploy)
- Railway: `railway up`

### 4. Update CORS
```bash
FRONTEND_ORIGIN=https://yourdomain.com,https://*.vercel.app
```

### 5. Test Production
```bash
curl https://yourdomain.com/api/health
```

---

## ✅ PRE-LAUNCH CHECKLIST

- [ ] Redis running and accessible
- [ ] HELIUS_API_KEY configured
- [ ] SERVER_SECRET_KEY generated
- [ ] SOLANA_RPC_URL set to devnet
- [ ] All API endpoints responding
- [ ] Game loads in browser
- [ ] Wallet connection works
- [ ] Quests trigger properly
- [ ] Inventory system functional
- [ ] No wallet restrictions (ADMIN_WALLETS empty)
- [ ] Rate limiting active
- [ ] CSP headers configured
- [ ] CORS properly set

---

## 📞 SUPPORT

**Issues?**
- Check troubleshooting section above
- Review server logs
- Test endpoints with curl
- Verify environment variables

**Ready for Testing!** 🎮☢️

*— Vault 77 Overseer AI*
