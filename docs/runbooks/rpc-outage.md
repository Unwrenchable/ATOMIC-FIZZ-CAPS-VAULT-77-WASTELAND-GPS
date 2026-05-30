# ☢️ Runbook: Solana RPC Outage
**Classification: VAULT-77 INTERNAL**  
_Last updated: 2025-07-01_

---

## 1. Trigger Conditions

Activate when ANY of the following occur:

- `GET /api/admin/health-detailed` returns `solana.status: "unreachable"` or `"timeout"`
- NFT mint requests returning 500 with `RPC` in the error message
- FIZZ token transfer failures reported by players
- Solana status page shows degraded: https://status.solana.com

---

## 2. Severity Assessment

| Symptom | Severity |
|---------|----------|
| All Solana RPCs unreachable (network partition) | P1 |
| Primary RPC down, fallback RPCs working | P2 |
| Intermittent RPC errors (< 10% failure rate) | P3 |
| Non-Solana game systems (GPS, quests, battles) unaffected | Severity reduced by one level |

**Key insight**: Atomic Fizz Caps GPS gameplay (claiming, battles, quests, XP) runs entirely on Redis — it does NOT require Solana. Only NFT minting and FIZZ token transfers are blocked during an RPC outage. Communicate this clearly to players.

---

## 3. Immediate Actions

### Step 1 — Confirm the outage

```bash
# Test primary RPC directly:
curl -X POST https://api.mainnet-beta.solana.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
# Expected: {"jsonrpc":"2.0","result":"ok","id":1}

# Test health-detailed endpoint:
curl -H "X-Admin-Key: <ADMIN_SECRET>" \
  https://api.atomicfizzcaps.xyz/api/admin/health-detailed
```

### Step 2 — Switch to fallback RPC

Update `SOLANA_RPC` in Render environment variables to a fallback:

| Provider | Endpoint |
|----------|----------|
| Helius | `https://mainnet.helius-rpc.com/?api-key=<KEY>` |
| QuickNode | `https://<slug>.solana-mainnet.quiknode.pro/<TOKEN>/` |
| Alchemy | `https://solana-mainnet.g.alchemy.com/v2/<KEY>` |
| Public backup | `https://solana-api.projectserum.com` |

Render will hot-restart the service on env var change — no downtime for Redis-backed gameplay.

### Step 3 — Enable graceful degradation mode (if all RPCs are down)

If no fallback RPC is reachable:

1. In Render env vars, set: `SOLANA_FEATURES_DISABLED=true`
2. In `backend/api/mint-item.js` and `backend/api/transfer-fizz.js`, add at the top of the handler:
   ```javascript
   if (process.env.SOLANA_FEATURES_DISABLED === "true") {
     return res.status(503).json({
       ok: false,
       error: "Solana network disruption — NFT minting temporarily unavailable. GPS gameplay continues normally.",
       retryAfter: 900
     });
   }
   ```
3. Queue mint requests: store in Redis `afw:mint:queue:<wallet>` for processing when RPC recovers.

---

## 4. Player Communication

Post to Discord and X/Twitter:

> **⚠️ Vault 77 Status Update**  
> The Solana network is experiencing disruptions. NFT minting and FIZZ token transfers are temporarily unavailable.  
> **GPS exploration, battles, quests, and cap rewards are fully operational.**  
> Your items and caps are safe. Mint queue will process automatically when the network recovers. 🎮☢️

---

## 5. Recovery

Once the RPC is reachable again:

1. Verify via health-detailed endpoint: `solana.status: "ok"`
2. Remove `SOLANA_FEATURES_DISABLED` env var (or set to `false`)
3. Process queued mints: drain `afw:mint:queue:*` keys
4. Notify players via Discord/X that full functionality is restored

---

## 6. Prevention

- Configure at least **2 fallback RPC endpoints** in environment
- Set up uptime monitor on `api.mainnet-beta.solana.com/health` (e.g. UptimeRobot, BetterUptime)
- Subscribe to https://status.solana.com RSS/email alerts
- Run `node tests/exploit-simulation.test.js` post-recovery to verify no exploit window was opened during degraded mode
