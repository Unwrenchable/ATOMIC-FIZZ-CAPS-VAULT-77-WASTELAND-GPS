# Runbook: Redis Failure / Data Loss Recovery

**Classification: VAULT-77 INTERNAL**  
Last updated: 2025-07-01

---

## 1. Trigger Conditions

- `GET /api/admin/health-detailed` returns `redis.status: "unavailable"` or `"degraded"`
- Backend logs show `ECONNREFUSED` or `ETIMEDOUT` for Redis connection
- Player data not persisting between requests
- In-memory fallback mode activated (backend logs: "Redis unavailable — using in-memory store")

---

## 2. Impact Assessment

Atomic Fizz Caps uses Redis as the primary datastore. In-memory fallback is activated automatically, which means:

- **GPS gameplay continues** (in-memory state only — progress lost on restart)
- **Data is NOT persisted** in fallback mode — player caps, XP, and inventory updates vanish on server restart
- **Auth sessions still work** (if SESSION_SECRET is stable) but nonce state is in-memory only
- **Cooldowns are not enforced** in fallback — players could claim locations repeatedly

**Immediate priority**: Restore Redis connection to prevent progress loss and cooldown bypass.

---

## 3. Diagnosis

```bash
# Check Redis connection from Render shell:
redis-cli -u $REDIS_URL ping
# Expected: PONG

# Check Redis info:
redis-cli -u $REDIS_URL info server | grep -E "redis_version|uptime_in_seconds"

# Check key count:
redis-cli -u $REDIS_URL dbsize

# Check memory usage:
redis-cli -u $REDIS_URL info memory | grep used_memory_human
```

### Common Causes

| Cause | Indicator | Fix |
|-------|-----------|-----|
| Redis service restarted | Key count = 0, uptime low | Wait for persistence reload; check `appendonly.aof` |
| Connection string changed | ECONNREFUSED | Verify `REDIS_URL` in Render env vars |
| Redis OOM (out of memory) | `maxmemory-policy` evictions | Increase Redis plan or reduce TTLs |
| TLS cert expired (rediss://) | SSL handshake error | Renew cert or switch to `redis://` temporarily |
| Render Redis plan limit | Free tier 25MB limit hit | Upgrade Redis plan |

---

## 4. Recovery Steps

### Scenario A: Redis restarted but data persisted (AOF/RDB intact)

1. Verify keys exist: `redis-cli -u $REDIS_URL dbsize` returns > 0
2. Restart Render service to re-establish connection pool
3. Verify via health-detailed endpoint: `redis.status: "ok"`
4. **Done** — in-memory fallback was never needed.

### Scenario B: Redis data lost (no persistence, service wiped)

1. Check if RDB backup exists in Redis provider dashboard (Render Redis, Upstash, Redis Cloud)
2. If backup exists: restore via provider dashboard, then restart Render service
3. If no backup:
   - Accept data loss — players will start fresh
   - Optionally: set all players to a "compensation" starting state (e.g. 1000 caps)
   - Post announcement: "Vault maintenance complete — thanks for your patience, Wanderers. 500 bonus caps have been added to your account."

### Scenario C: Redis intermittent (high latency, occasional failures)

1. Check Redis provider status page
2. If provider incident: wait for resolution, monitor health-detailed
3. If no provider incident: check for memory pressure, connection count limits
4. Temporarily reduce connection pool size in `backend/lib/redis.js` if needed

---

## 5. Data Integrity Verification Post-Recovery

After Redis is restored:

```bash
# Spot-check player profiles are readable:
node -e "
const { redis, key } = require('./backend/lib/redis');
redis.hget(key('player:TEST_WALLET'), 'profile').then(v => { console.log(v ? 'OK' : 'EMPTY'); process.exit(); });
"

# Verify cooldown keys have proper TTLs (no immortal locks):
redis-cli -u $REDIS_URL KEYS 'afw:player:*:cooldown:*' | head -5 | xargs -I{} redis-cli -u $REDIS_URL TTL {}
# Each should return 1-3600 (not -1 = no expiry)

# Check for any double-prefix keys (BUG-044):
redis-cli -u $REDIS_URL KEYS 'afw:afw:*' | wc -l
# Should return 0
```

---

## 6. Prevention

- Enable Redis persistence (AOF + RDB) on your Redis provider
- Set up daily Redis backup to S3/Render object storage
- Configure UptimeRobot to monitor `GET /api/health` and alert on `redis: false`
- Use Render's managed Redis (not free tier in production) for guaranteed uptime
- Consider Redis replica / read replica for read-heavy operations
