# ☢️ ATOMIC FIZZ CAPS — Agent Context Pack

> **Vault-Tec Classification: UNCLASSIFIED / ALL AGENTS**
> This directory contains repo-local context files that orient AI coding
> assistants to the **Atomic Fizz Caps** wasteland GPS crypto game at
> **atomicfizzcaps.xyz**. Read this file first before making any changes.

---

## What Is This Repository?

**Atomic Fizz Caps** (codename: Vault-77 Wasteland GPS) is a Fallout-themed,
GPS-based crypto geo-game deployed at **https://www.atomicfizzcaps.xyz**.

Players explore real-world locations via GPS, claim Points of Interest on a
Pip-Boy–styled Leaflet map, earn **FIZZ** (an SPL token on Solana), battle
wasteland creatures, craft items, join factions, and interact with the Vault 77
Overseer AI. The game bridges Fallout universe lore with real Solana blockchain
mechanics.

**This is NOT a DEX. This is NOT FizzSwap. This is NOT a naming service.**
Those references in older agent files are wrong and must be ignored.

---

## Agent Files

| File | Role |
|------|------|
| `README.md` | **This file** — top-level orientation for all agents |
| `agent.md` | Repo structure, toolchain, conventions — read before every change |
| `bootstrap.md` | Step-by-step local setup guide |
| `fullstack-dev.md` | Full-stack master agent with complete project context |
| `web3-specialist.md` | Solana / Phantom wallet / FIZZ token expert |
| `wasteland-assistant.md` | Game mechanics, battle system, crafting, economy assistant |
| `my-agent.agent.md` | Vault 77 Overseer personality agent (used in AI chat) |
| `game-tester.md` | Master QA agent — simulates 1,000 worldwide players, finds bugs & exploits |
| `memory.md` | Persistent decisions, gotchas, verified commands |
| `tasks.md` | **Active task queue — check before starting work on shared files** |

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    ATOMIC FIZZ CAPS v1.0.1                     │
├──────────────────────────┬─────────────────────────────────────┤
│  FRONTEND (Vercel CDN)   │  BACKEND (Render / Vercel Fn)       │
│  • Vanilla HTML/CSS/JS   │  • Node.js 20 + Express             │
│  • public/ directory     │  • backend/server.js                │
│  • Leaflet GPS maps      │  • Redis state management           │
│  • Phantom wallet        │  • Solana signature verification    │
│  • Pip-Boy UI (green)    │  • Rate limiting + Helmet           │
│  • PWA manifest          │  • api.atomicfizzcaps.xyz           │
├──────────────────────────┴─────────────────────────────────────┤
│  BLOCKCHAIN (Solana)         AI (Hugging Face)                  │
│  • FIZZ SPL token            • Mixtral-8x7B Overseer           │
│  • Phantom wallet auth       • HF_API_KEY env var              │
│  • Metaplex NFT items        • Fallback personality mode       │
│  • Wormhole bridge (35+)     • overseer.html + Overseer JS     │
│  • Anchor programs           • /api/overseer-proxy endpoint    │
└────────────────────────────────────────────────────────────────┘
```

---

## Repository Layout (Quick Reference)

```
/
├── backend/               # Node.js Express API server
│   ├── server.js          # Entry point — starts Express, loads all routes
│   ├── api/               # API route handlers (one file per endpoint group)
│   │   ├── locations.js       # POI management
│   │   ├── location-claim.js  # GPS claim logic
│   │   ├── gps.js             # GPS verification
│   │   ├── player.js          # Player profile CRUD
│   │   ├── caps.js            # FIZZ/CAPS balance
│   │   ├── xp.js              # Experience points
│   │   ├── quests.js          # Quest system
│   │   ├── quests-store.js    # Quest persistence
│   │   ├── quest-endings.js   # Quest resolution
│   │   ├── quest-secrets.js   # Quest secret codes
│   │   ├── loot-voucher.js    # Loot voucher generation
│   │   ├── redeem-voucher.js  # Voucher redemption
│   │   ├── mint-item.js       # NFT item minting
│   │   ├── mintables.js       # Mintable item catalog
│   │   ├── scavenger.js       # Scavenger Exchange
│   │   ├── fuse.js            # NUKE/fusion system
│   │   ├── scrap-nft.js       # NFT scrapping
│   │   ├── player-nfts.js     # Player NFT inventory
│   │   ├── overseer-proxy.js  # HF AI proxy (mounted at /api/overseer)
│   │   ├── cooldowns.js       # Cooldown tracking
│   │   ├── rotation.js        # POI rotation
│   │   ├── settings.js        # Player settings
│   │   ├── fizz-fun.js        # Fizz.fun integration
│   │   ├── adminPlayer.js     # Admin player tools
│   │   ├── adminMintables.js  # Admin item tools
│   │   ├── keys-admin.js      # Key management admin
│   │   ├── frontend-config.js # Frontend config (mounted at /api/config/frontend)
│   │   ├── static-json-proxy.js # Static data proxy
│   │   └── wallet.js          # Wallet endpoints
│   ├── lib/               # Shared libraries
│   │   ├── redis.js           # Redis client + in-memory fallback
│   │   ├── walletVerify.js    # Solana sig verification (tweetnacl)
│   │   ├── auth.js            # Auth helpers
│   │   ├── adminAuth.js       # Admin auth helpers
│   │   ├── cooldowns.js       # Cooldown logic
│   │   ├── gps.js             # GPS distance calculation
│   │   ├── lootTable.js       # Loot table RNG
│   │   ├── caps.js            # CAPS balance helpers
│   │   ├── xp.js              # XP calculation
│   │   ├── locations.js       # Location data helpers
│   │   ├── quests.js          # Quest logic
│   │   ├── nfts.js            # NFT helpers
│   │   ├── kmsSigner.js       # AWS KMS signing (optional)
│   │   ├── safe-base58.js     # Base58 safety helpers
│   │   └── keys.js            # Key management
│   ├── middleware/
│   │   └── adminAuth.js       # Admin auth middleware
│   ├── api/               # Additional API modules
│   ├── data/              # Static data files
│   ├── docs/              # Backend-specific docs
│   ├── scripts/           # Backend utility scripts
│   └── tools/             # Backend tools
│
├── public/                # Static frontend (Vercel CDN)
│   ├── index.html         # Main Pip-Boy map interface
│   ├── overseer.html      # Vault 77 Overseer AI terminal
│   ├── exchange.html      # Scavenger Exchange
│   ├── nuke.html          # NUKE system
│   ├── nuke-portal.html   # NUKE portal
│   ├── bridge.html        # Wormhole bridge UI
│   ├── bridge-portal.html # Bridge portal
│   ├── donate.html        # Donation page
│   ├── sw.js              # Service worker (PWA)
│   ├── manifest.json      # PWA manifest
│   ├── admin/             # Admin panel UI
│   ├── wallet/            # Wallet management UI
│   ├── fizzfun/           # Fizz.fun standalone page
│   ├── css/               # Stylesheets (Pip-Boy green terminal)
│   ├── js/                # Frontend JavaScript
│   │   ├── main.js            # Main entry
│   │   ├── boot.js            # Boot sequence animation
│   │   ├── map/               # Map rendering (Leaflet POI markers)
│   │   ├── game/              # Game loop, inventory, player state
│   │   ├── overseer/          # Overseer AI terminal
│   │   │   ├── index.js           # Overseer entry
│   │   │   ├── overseer.js        # Core overseer logic
│   │   │   ├── core.personality.js
│   │   │   ├── core.weather.js
│   │   │   ├── core.lore.js
│   │   │   ├── core.memory.js
│   │   │   ├── core.faction.js
│   │   │   ├── core.threat.js
│   │   │   ├── core.commands.js
│   │   │   ├── game.redmenace.js  # Red Menace arcade game
│   │   │   └── game.tictactoe.js  # Tic-Tac-Toe mini-game
│   │   └── modules/           # Feature modules
│   │       ├── battles.js         # Battle system + V.A.T.S.
│   │       ├── crafting.js        # Crafting + recipes
│   │       ├── factions.js        # Faction system
│   │       ├── quests.js          # Quest UI
│   │       ├── inventory-ui.js    # Inventory UI
│   │       ├── fogOfWar.js        # Fog of war map layer
│   │       ├── npcEncounter.js    # NPC encounter system
│   │       ├── fo4-dialogue.js    # Fallout 4-style dialogue
│   │       ├── weatherOverlay.js  # Weather effects
│   │       ├── radiationZones.js  # Radiation zone overlay
│   │       ├── bridge-portal.js   # Wormhole bridge
│   │       ├── economy.js         # In-game economy
│   │       ├── vats.js            # V.A.T.S. targeting
│   │       ├── web3-wallet-adapter.js # Phantom wallet
│   │       └── ...more
│   ├── img/               # Images and assets
│   ├── audio/             # Audio files
│   ├── assets/            # Game assets
│   ├── data/              # Static JSON data
│   └── vendor/            # Third-party libraries
│
├── programs/              # Anchor / Solana program workspace
├── solana/                # Solana program tests
├── workers/               # Background workers (NFT minting)
├── scripts/               # Utility / deployment scripts
├── docs/                  # Project documentation
│   ├── DOCS_INDEX.md      # Documentation index
│   ├── features/          # Feature guides
│   └── deployment/        # Deployment guides
├── .github/
│   ├── agents/            # ← You are here
│   └── workflows/         # GitHub Actions
├── .env.example           # Env template (NO secrets)
├── package.json           # Root package (backend entry point)
├── vercel.json            # Vercel: static public/, rewrite /api/* → backend
├── render.yaml            # Render: backend API service
└── docker-compose.yml     # Docker setup (optional)
```

---

## Tech Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES6+) — NO React/Next.js |
| Maps | Leaflet.js 1.9.4 — custom Pip-Boy Fallout overlays |
| Backend | Node.js 20, Express 4.22, **CommonJS** modules |
| Database | Redis (ioredis 5.4) — in-memory fallback when Redis unavailable |
| Blockchain | Solana — FIZZ SPL Token, Phantom Wallet, Anchor programs |
| NFTs | Metaplex for item NFTs, Helius API (optional) |
| Cross-chain | Wormhole protocol (35+ chains) |
| AI | Hugging Face — mistralai/Mixtral-8x7B-Instruct-v0.1 |
| Auth | Solana wallet signature verification (tweetnacl + bs58) |
| Rate Limiting | express-rate-limit + Redis |
| Security | Helmet, CORS allowlist, constant-time admin password check |
| Deployment | Vercel (frontend CDN) + Render (backend API) |
| CI/CD | GitHub Actions — manual Vercel deploy + API smoke test |
| PWA | Service worker (`public/sw.js`) + `manifest.json` |

---

## Key URLs

| Service | URL |
|---------|-----|
| Main app | https://www.atomicfizzcaps.xyz |
| API server | https://api.atomicfizzcaps.xyz |
| Overseer terminal | https://www.atomicfizzcaps.xyz/overseer |
| Admin panel | https://www.atomicfizzcaps.xyz/admin |
| Bridge | https://www.atomicfizzcaps.xyz/bridge |
| Exchange | https://www.atomicfizzcaps.xyz/exchange |
| Nuke portal | https://www.atomicfizzcaps.xyz/nuke |

---

## Critical Conventions

1. **Frontend is VANILLA JS** — No React, no Vue, no TypeScript in `public/`.
   Plain `.html` files with `<script src="...">` tags.
2. **Backend is CommonJS** — Use `require()` not `import`. `package.json` has
   `"type": "commonjs"`.
3. **Pip-Boy UI theme** — All UI must use green terminal aesthetic. CRT
   scanline effects, radioactive glow animations, monospace fonts.
4. **Secure randomness** — All RNG must use `crypto.getRandomValues()` (browser)
   or Node's `crypto.randomInt()` / `crypto.randomBytes()`. **Never `Math.random()`**.
5. **localStorage encoding** — All localStorage data must be base64-encoded at
   minimum (Vault-Tec data integrity protocol).
6. **Wallet auth** — All player-mutating API endpoints verify Solana wallet
   signatures using tweetnacl + bs58 (`backend/lib/walletVerify.js`).
7. **Redis key prefix** — All Redis keys use prefix `afw:` (env: `REDIS_PREFIX`).
   Format: `afw:<category>:<identifier>`.
8. **No secrets in files** — Use `.env` files (git-ignored). Template:
   `.env.example`. Never commit keys, tokens, or passwords.
9. **CORS allowlist** — Managed in `backend/server.js`. Always includes
   `atomicfizzcaps.xyz`, `*.vercel.app`, `*.onrender.com`.
10. **Fallout universe authenticity** — All in-game text, NPC dialogue, item
    names, and lore must be consistent with Fallout universe conventions.

---

## Common API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (monitored by CI) |
| POST | `/api/location-claim` | Claim a GPS POI (requires wallet sig) |
| GET | `/api/locations` | Get all POIs |
| GET/POST | `/api/player` | Player profile |
| GET | `/api/caps` | FIZZ token balance |
| GET | `/api/xp` | XP balance |
| POST | `/api/gps` | GPS position verification |
| POST | `/api/overseer-proxy` | Hugging Face AI proxy |
| GET | `/api/mintables` | Mintable item catalog |
| POST | `/api/mint-item` | Mint an item NFT |
| POST | `/api/loot-voucher` | Generate loot voucher |
| POST | `/api/redeem-voucher` | Redeem loot voucher |
| POST | `/api/fuse` | NUKE/fuse items for FIZZ |
| GET | `/api/frontend-config` | Frontend configuration |
| GET | `/api/quests` | Quest list |
| POST | `/api/quests-store` | Save quest progress |
| GET | `/api/settings` | Player settings |
| GET | `/api/rotation` | POI rotation schedule |

---

## Safety Rules

1. **Never store secrets** — No private keys, mnemonics, API keys, passwords,
   or RPC credentials in any `.github/agents/` file.
2. **Use `.env` files** (git-ignored) for all runtime secrets. Template:
   `.env.example`.
3. **Human review required** for all `memory.md` additions before merging.
4. **No executable code** in these documentation files.
5. **Keep it factual** — only record what is currently true of the repo.

---

## Memory Loop

```
Code change ──► update tasks.md (mark complete) ──► propose memory.md update ──► PR review ──► merge
                                                                                       │
                                                                              Human verifies no secrets
                                                                              and content is accurate
```

Over time `memory.md` accumulates decisions, tested commands, and architecture
notes that make every subsequent AI interaction faster and more accurate.
`tasks.md` keeps in-flight work visible so agents don't step on each other.

---

*☢️ Per Vault-Tec Regulation 77-C: All agents must read this document before
modifying any file in the repository. Stay safe out there, Vault Dweller. ☢️*
