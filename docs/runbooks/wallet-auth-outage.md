# Runbook: Wallet Auth System Outage

**Classification: VAULT-77 INTERNAL**  
Last updated: 2025-07-01

---

## 1. Trigger Conditions

- Players unable to sign in with Phantom / Solflare wallet
- `POST /api/auth/login` returning 500 or timing out
- `GET /api/auth/nonce/:publicKey` returning errors
- Session tokens being rejected despite valid signatures
- tweetnacl or bs58 dependency errors in backend logs

---

## 2. Anatomy of the Auth System

The auth flow is: `GET /nonce` → player signs nonce with wallet → `POST /login` → session token issued.

**Key components:**
- `backend/lib/auth.js` — nonce generation, signature verification, session creation
- Redis keys: `afw:nonce:<publicKey>` (TTL 300s, one-time use), `afw:session:<token>` (TTL 86400s)
- Libraries: `tweetnacl` (Ed25519 verify), `bs58` (base58 decode)
- `backend/middleware/authMiddleware.js` — validates `Authorization: Bearer <token>` header

---

## 3. Diagnosis

### Is the server reachable?

```bash
curl https://api.atomicfizzcaps.xyz/api/health
# Expected: {"status":"ok","redis":true,...}
```

### Is the nonce endpoint responding?

```bash
curl https://api.atomicfizzcaps.xyz/api/auth/nonce/TESTPUBKEY123
# Expected: {"ok":true,"nonce":"<32-byte-hex>"}
# 429 = rate limited, 500 = server error
```

### Are sessions being stored in Redis?

```bash
redis-cli -u $REDIS_URL KEYS 'afw:session:*' | wc -l
# Should be > 0 if any players are logged in
```

### Is SESSION_SECRET set?

```bash
# Render dashboard → Environment → verify SESSION_SECRET is non-empty
# If empty, all session verification will fail
```

---

## 4. Common Failures and Fixes

### A: SESSION_SECRET missing or changed

**Symptom**: All existing sessions invalid; players logged out.

**Fix**:
1. In Render env vars, verify `SESSION_SECRET` is set to a stable value
2. If it was accidentally rotated: set it back (if known) or accept all players need to re-auth
3. Never rotate `SESSION_SECRET` during active play sessions — schedule for maintenance windows

### B: Redis unavailable (nonce/session storage broken)

**Symptom**: Auth works intermittently or not at all; nonce keys not persisting.

**Fix**: Follow `docs/runbooks/redis-failure.md` first. Auth will recover automatically once Redis is restored.

### C: tweetnacl signature verification failing

**Symptom**: Valid wallet signatures rejected with "Invalid signature" 400 error.

**Diagnosis**:
```bash
# Check tweetnacl is installed:
node -e "require('tweetnacl'); console.log('ok')"
# Check bs58 is installed:
node -e "require('bs58'); console.log('ok')"
```

**Fix**: `npm install` in `backend/` to restore dependencies. Redeploy on Render.

### D: Rate limiter blocking auth endpoint

**Symptom**: Legitimate users getting 429 on `/api/auth/nonce/:publicKey`.

**Fix**: The auth rate limiter (`12 nonce requests / 60s per IP`) is intentional. If players behind a shared NAT are being blocked:
1. Temporarily increase the rate limit in `backend/lib/auth.js`
2. Add `X-Forwarded-For` awareness to the rate limiter key function

### E: Wallet adapter not connecting (frontend issue)

**Symptom**: Phantom popup never appears or rejects connection.

**Fix** (frontend, not backend):
1. Check browser console for CSP violations — ensure `https://*.phantom.app` is in `connect-src`
2. Verify `window.solana` is available (Phantom extension installed)
3. Check that `bs58` CDN is loading: `https://unpkg.com/bs58@6.0.0/dist/index.min.js`

---

## 5. Emergency: Maintenance Mode

If auth is completely broken and you need to prevent player data corruption during the outage:

1. Add to Render env vars: `MAINTENANCE_MODE=true`
2. Add to `backend/server.js` (before route mounting):
   ```javascript
   if (process.env.MAINTENANCE_MODE === "true") {
     app.use("/api", (req, res) => {
       res.status(503).json({
         ok: false,
         error: "Vault 77 is under emergency maintenance. Your progress is safe. Back online soon."
       });
     });
   }
   ```
3. Post player communication (see template below)
4. Fix the auth issue
5. Remove `MAINTENANCE_MODE` and redeploy

**Player communication template:**
> **Vault 77 Maintenance Notice**  
> Authentication is temporarily offline for emergency repairs. The Overseer is on it.  
> Your caps, items, and XP are safe in the Vault. We'll be back online within [ETA].  
> Wanderers who were mid-session: your progress before the outage is preserved. ☢️

---

## 6. Session Invalidation (Forced Logout All Players)

If you need to invalidate ALL active sessions (e.g. after a security incident):

```bash
# Delete all session keys from Redis:
redis-cli -u $REDIS_URL KEYS 'afw:session:*' | xargs redis-cli -u $REDIS_URL DEL

# OR rotate SESSION_SECRET in Render env vars — all tokens become invalid immediately
```

Players will be logged out and need to re-authenticate with their wallet.

---

## 7. Recovery Verification

After fixing the auth system:

```bash
# Run security tests (includes auth tests):
node tests/security.test.js
# All 105 tests must pass

# Run exploit simulation (tests auth forgery, nonce replay):
node tests/exploit-simulation.test.js
```
