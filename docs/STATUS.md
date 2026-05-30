# ☢️ ATOMIC FIZZ CAPS — Project Status & Mainnet Readiness

> **Last Updated**: March 2026 | **Version**: 1.0.2 | **Network**: Devnet (mainnet pending)

---

## 📡 TL;DR — Overseer Situation Report

The game has strong bones. Frontend gameplay loop is **functionally complete**. Backend API is **production-grade**. Blockchain on-chain layer is **not yet deployed**. Mainnet is **not ready** — but the path is clearly mapped below.

---

## 🗺️ SYSTEM STATUS OVERVIEW

| System | Status | Readiness |
|--------|--------|-----------|
| 🎮 Frontend UI (Pip-Boy / Leaflet maps) | ✅ Complete | Production |
| 🧠 Game Logic (battles, quests, crafting, dungeon) | ✅ Complete | Production |
| 👻 Phantom Wallet Integration | ✅ Complete | Production |
| 🔐 Auth (wallet sig + sessions) | ✅ Complete | Production |
| 🖥️ Express API (50+ endpoints) | ✅ Complete | Production |
| 🗄️ Redis (with in-memory fallback) | ✅ Complete | Production |
| 🤖 Overseer AI (Grok / HF / OpenAI cascade) | ✅ Complete | Production (needs key) |
| 🎭 NPC / Narrative system | ✅ Complete | Production |
| 🌍 GPS location claiming | ✅ Complete | Production |
| 🚀 Vercel + Render deployment | ✅ Complete | Production |
| ⛓️ Solana program (Anchor/Rust) | ⚠️ Source only | NOT deployed |
| 🪙 NFT minting (on-chain) | ✅ Implemented | Requires signer + RPC envs |
| 👷 Mint workers | ✅ Implemented | Deployable via Render worker |
| 🔑 Key management (KMS) | ❌ Stub | NOT implemented |
| 🎲 Loot table randomization | ✅ Fixed | Weighted crypto-RNG (6 tiers, 54 items) |

---

## 🎮 FRONTEND — What's Built

### Core Gameplay (All ✅ Implemented)

**Battle System** (`battles.js` — 452 lines)
- Turn-based combat with multi-enemy tracking
- SPECIAL stat integration (STR bonus damage, END damage reduction)
- Armor damage reduction (DR from chest/head/arms/legs gear)
- Flee mechanic scaled by Agility
- Respawn penalty (30% HP loss, 10% caps tax on death)
- V.A.T.S. targeting system with Action Points (`vats.js` — 335 lines)
- Secure RNG throughout (`crypto.getRandomValues()`)

**Quest System** (`quests.js` — 1,624 lines)
- 100+ quests in the database (`quests.json` — 27K)
- Starter gear package (Vault 77 Jumpsuit, sidearm, stimpaks, bobby pins)
- Quest types: auto, NPC-triggered, location, item, manual
- Full objective tracking, checkpoint saves, XP/caps/item rewards
- XSS-safe rendering throughout

**Crafting System** (`crafting.js` — 157 lines)
- Recipe-based crafting with ingredient validation and consumption
- Stat rolling for crafted gear
- Integrated with PlayerState inventory

**Faction System** (`factions.js` — 135 lines)
- Reputation tracking with real consequences
- Merchant discount scaling (±30% at rep extremes)
- Encounter bias: ambush or backup chance based on standing

**Dungeon System** (`dungeon.js` — 1,787 lines)
- Procedurally generated ASCII dungeon layouts
- Vault, wasteland, and underground themes
- Lockpick mechanic, terminal hacking, keycard doors
- Enemy spawning, boss rooms, loot generation
- Secure RNG via `cryptoRandInt / cryptoRandFloat / cryptoRandBool`

**Narrative/Dialogue System** (`narrative.js` — 1,207 lines)
- Fallout 4-style branching dialogue with flags and stat checks
- Lazy-loaded dialog JSON files (23 NPCs with lore overrides)
- Dragonbones portrait animation support
- XSS-safe dialog rendering

**Economy System** (`economy.js`)
- 5-modifier pricing pipeline: rarity × scarcity × faction rep × weather × time-of-day
- Rarity tier multipliers: common 1.0 → legendary 7.5 → ghost 10.0

**World Systems (all active)**
- Weather & anomalies, fog of war, radiation zones
- World map with Leaflet + TopoJSON highways overlay
- GPS location claiming with cooldowns and HMAC-signed tokens
- Character creator with SPECIAL stat assignment
- Wasteland radio live streaming

### Data Assets

| File | Size | Contents |
|------|------|----------|
| `world_locations.json` | 1.1 MB | All map POIs |
| `poi.json` | 170 KB | Points of Interest |
| `quests.json` | 27 KB | Quest definitions |
| `perks.json` | 21 KB | Character perks |
| `mutations.json` | 22 KB | Mutation effects |
| `factions_expanded.json` | — | Faction data |
| `survival_mechanics.json` | 4.9 KB | Survival rules |
| `nft_categories.json` | 12 KB | NFT categories |
| `mintables.json` | — | Mintable items |

### Player State (`player-state.js`)
- Unified persistent state: XP, level, caps, SPECIAL, inventory, equipped gear
- Auto-save every 15 seconds; backend sync every 30 seconds
- localStorage key: `afc_unified_player_state_v2`
- Backward-compatible legacy import from `afc_player_state_v1`

---

## 🖥️ BACKEND — What's Built

### API Surface (50+ endpoints)

**Authentication** — nonce generation, Ed25519 signature verify, session create/destroy/validate  
**Player** — create, read, update, XP award, caps award, perk unlock  
**World** — GPS location claiming, geofencing, POI listing, camp creation  
**Quests** — accept, complete, track, quest store, secrets, endings  
**Economy** — loot vouchers, redeem voucher, scavenger exchange, loot rotation  
**NFT/Inventory** — mint item (dev stub), player NFTs, scrap NFT, item fusion  
**AI** — Overseer proxy (Grok/HF/OpenAI cascade), NPC context, NPC video generation  
**Admin** — player admin, mintables admin, key management  
**Game** — companions, mutations, nukes, cooldowns, fizz-fun launchpad  
**Config** — frontend config endpoint, settings, health check

### Security Posture ✅

- **Rate limiting**: global 50 req/10s; auth endpoints tighter (10–20 req/10s); admin 5 req/15min
- **Helmet** with comprehensive Content Security Policy (script, connect, style, media policies)
- **CORS**: hardcoded for `atomicfizzcaps.xyz`; allowlist patterns for Vercel/Render previews
- **Ed25519 sig verify**: tweetnacl on every wallet-mutating endpoint
- **Timing-safe comparisons**: `crypto.timingSafeEqual()` for admin password checks
- **Crypto RNG**: `crypto.randomBytes()` — no `Math.random()` in game-critical paths
- **Input validation**: `express-validator` on all API routes
- **IDOR protection**: wallet sourced from `req.player.wallet` (session), never from request body
- **Replay protection**: Redis NX atomics on nonce consumption
- **Race condition guards**: per-wallet distributed locks on fuse/claim operations

### Infrastructure ✅

- **Redis** with full in-memory fallback — all keys prefixed `afw:`
- **Session management** — 24-hour TTL, Redis-backed, base58 session IDs
- **Deployment**: Render (backend, `node server.js`), Vercel CDN (frontend static)
- **Health check**: `GET /api/health` monitors Redis + Solana RPC
- **Logging**: `morgan` request logs, structured `console.log('[route]', ...)` style

---

## ⛓️ BLOCKCHAIN — Current State

### Solana Program (`programs/fizzcaps-onchain/src/lib.rs`)

**Status: Source complete, NOT deployed**

- **969 lines** of Anchor 0.32 program code
- **Hardcoded Program ID**: `DXxzKfZh6aJCff7sEusMU1E9w4ZDwgJkYGgKStRRGRyP`
- Implemented features in source:
  - Loot claim with NFT minting via Metaplex
  - FIZZ.fun bonding curve launchpad (30 SOL virtual, 85 SOL graduation → Raydium)
  - CAPS token burn for fees
  - Ed25519 signature verification (anti-replay)
  - Metadata creation
- ❌ No compiled BPF bytecode (`*.so`) in repository
- ❌ Not deployed to devnet or mainnet
- ❌ No IDL file generated

### NFT Minting Pipeline

Status: Implemented, environment-dependent.

- `backend/api/mint-item.js` — queues authenticated or admin-authorized mint jobs and exposes status/metadata endpoints
- `backend/lib/nft-minting.js` — creates real 0-decimal SPL mints, Metaplex metadata, and master editions
- `workers/mint_worker.js` — list-queue worker fallback for direct queue processing
- `workers/mint_worker_stream.js` — Redis Stream worker used for production deployment
- `render.yaml` — includes `atomic-fizz-caps-mint-worker` background worker service
- `workers/kms_stub.js` — AWS KMS signing is still optional and not yet wired in
- ✅ On-chain Solana mint transactions occur when signer and RPC env vars are configured

### Fizz.fun Token Launchpad

**Status: Backend logic complete, on-chain execution pending**

- Full bonding curve logic implemented server-side
- Token creation, trading, graduation to Raydium at 85 SOL
- Admin launch with USDC (pre-mainnet bootstrap path)
- Requires deployed Anchor program to execute on-chain

### Environment (Current Defaults)

```
SOLANA_NETWORK=devnet
SOLANA_RPC=https://api.devnet.solana.com
CAPS_MINT=<not set — env var required>
TREASURY_WALLET=<not set — env var required>
```

---

## 🚀 MAINNET READINESS VERDICT

**Current status: NOT ready for mainnet. Estimated readiness: 60–70%.**

The game client and server infrastructure are production-quality. The blocking items are all in the on-chain layer.

### 🔴 HARD BLOCKERS (must fix before mainnet)

| # | Blocker | Effort |
|---|---------|--------|
| 1 | **Anchor program not compiled/deployed** — source exists, no BPF bytecode, not on-chain | Medium |
| 2 | **NFT minting requires signer env** — minting is implemented, but `SERVER_SECRET_KEY` or `SERVER_KEYPAIR_PATH` plus RPC config must be present in production | High |
| 3 | **Key management not implemented** — `kms_stub.js` is a placeholder; no real wallet signing for mint authority | High |
| 4 | **No IDL file** — required for frontend/client to call the deployed program | Low (auto-gen after anchor build) |

### 🟡 IMPORTANT (fix before launch, not hard blockers)

| # | Item | Effort |
|---|------|--------|
| 5 | Set `SOLANA_NETWORK=mainnet-beta` + funded mainnet RPC (Helius/QuickNode recommended) | Low |
| 6 | Set `CAPS_MINT` to real SPL token mint on mainnet | Low |
| 7 | Set `TREASURY_WALLET` to funded mainnet wallet with mint authority | Low |
| 8 | Loot table randomization — ✅ **FIXED**: weighted crypto-RNG across 6 tiers, 54 items (`backend/lib/lootTable.js`) | Done |
| 9 | VATS visual polish — camera animation and hit feedback are TODOs | Low |

### 🟢 ALREADY PRODUCTION-READY (no changes needed)

- ✅ Phantom wallet integration and auth flow
- ✅ All 50+ API endpoints and security middleware
- ✅ CORS, Helmet, rate limiting, input validation
- ✅ Redis with in-memory fallback
- ✅ Vercel + Render deployment config (pointing to production URLs)
- ✅ Overseer AI with multi-provider cascade fallback
- ✅ All frontend game systems (battles, quests, crafting, dungeon, narrative)
- ✅ Full GPS location claiming pipeline
- ✅ Session management and admin panel
- ✅ Fizz.fun launchpad backend logic

---

## 📋 MAINNET LAUNCH CHECKLIST

```
PHASE 1: ON-CHAIN PROGRAM (weeks 1–2)
  [ ] Run `anchor build` to compile program to BPF
  [ ] Deploy to devnet first: anchor deploy --provider.cluster devnet
  [ ] Run integration tests against devnet program
  [ ] Deploy to mainnet: anchor deploy --provider.cluster mainnet
  [ ] Update PROGRAM_ID env var if address changes from hardcoded value
  [ ] Generate IDL: anchor idl init --filepath target/idl/fizzcaps_onchain.json <PROGRAM_ID>

PHASE 2: REAL NFT MINTING (weeks 2–3)
  [x] Implement real Solana transaction builder in mint worker
  [ ] Replace kms_stub.js with real key management (AWS KMS or secure vault)
  [ ] Test end-to-end mint flow on devnet/mainnet with production signer
  [x] Implement proper error handling and retry logic for failed txns
  [x] Add transaction status polling endpoint for frontend/ops visibility

PHASE 3: PRODUCTION ENVIRONMENT (week 3)
  [ ] Set SOLANA_NETWORK=mainnet-beta in Render dashboard
  [ ] Set SOLANA_RPC to Helius/QuickNode mainnet endpoint
  [ ] Set CAPS_MINT to real SPL token mint address
  [ ] Set TREASURY_WALLET to funded mainnet wallet
  [ ] Set HELIUS_API_KEY for NFT lookups
  [ ] Set HF_API_KEY or XAI_API_KEY for Overseer AI

PHASE 4: TESTING & MONITORING (week 4)
  [ ] End-to-end test: wallet connect → claim location → earn FIZZ → mint NFT
  [ ] Load test: 1000 concurrent players (npm run test:load:full)
  [ ] Add transaction failure alerts
  [ ] Add worker queue depth monitoring
  [ ] Add Solana RPC error rate monitoring
  [ ] Fix static loot table (backend/lib/lootTable.js) with weighted crypto RNG ✅ DONE

PHASE 5: LAUNCH
  [ ] Smoke test on mainnet with small wallet
  [ ] Open to closed beta (whitelist)
  [ ] Gradual public rollout
```

---

## 📊 CODEBASE METRICS

| Metric | Count |
|--------|-------|
| Backend API files | 36 |
| Backend library files | 20 |
| Frontend JS modules | 48 |
| Frontend game files | 5 |
| Overseer AI files | 17 |
| Data JSON files | 31 |
| NPC dialog files | 23 |
| Documentation files | 66+ |
| Total API endpoints | 50+ |
| Lines in quest system | 1,624 |
| Lines in dungeon system | 1,787 |
| Lines in narrative system | 1,207 |
| Lines in Solana program | 969 |
| World locations data | 1.1 MB |

---

## 🔗 RELATED DOCS

- [Environment Variables](setup/ENVIRONMENT_VARIABLES.md) — Configuration reference
- [Deployment Guide](deployment/DEPLOYMENT.md) — Render + Vercel setup
- [Testnet Deployment](deployment/TESTNET_DEPLOYMENT_GUIDE.md) — Testnet guide
- [NFT Integration](features/NFT_INTEGRATION_GUIDE.md) — NFT system docs
- [Quest Reference](features/QUEST_QUICK_REFERENCE.md) — Quest system
- [Overseer Guide](features/VAULT_77_OVERSEER_COMPLETE_GUIDE.md) — AI terminal
- [Security Fixes](development/SECURITY_FIXES.md) — Security audit trail

---

*"The Pip-Boy doesn't lie, smoothskin. Strong bones, hollow wallet. Fix the chain before you talk mainnet."*  
*— Vault 77 Overseer Terminal, March 2026*
