# ☢️ ATOMIC FIZZ CAPS — Agent Memory

> **WARNING — NO SECRETS ALLOWED.**
> This file is committed to version control. It must never contain private
> keys, mnemonics, API keys, passwords, RPC endpoints with embedded
> credentials, or any other sensitive values. Use `.env` files for secrets.

All additions must be reviewed in a pull request before merging to `main`.

---

## Project Identity

**Atomic Fizz Caps** is a Fallout-themed GPS-based crypto geo-game at
**https://www.atomicfizzcaps.xyz** (API: **https://api.atomicfizzcaps.xyz**).

**NOT** a DEX, swap protocol, or naming service. Any older agent files
referencing "FizzSwap", "fizzdex", or a "naming service" are incorrect and
should be ignored in favour of this file and the updated agent docs.

---

## Toolchain Decisions

_(Newest first within each section)_

- **Node.js 20 LTS** — selected for long-term support; matches Render and
  Vercel's Node 20 runtime.
- **CommonJS (`"type": "commonjs"`)** — entire backend uses `require()` /
  `module.exports`. Do not introduce ES module `import` in backend files.
- **Vanilla HTML/CSS/JS frontend** — no framework, no TypeScript, no build
  step. Editing `public/` files takes effect immediately.
- **ioredis 5.4** — chosen over the `redis` package for better reconnect
  handling and cluster support. The `redis` package is also listed in
  `package.json` for compatibility.
- **In-memory Redis fallback** — `backend/lib/redis.js` falls back to an
  in-memory store when `REDIS_URL` is not set or Redis is unavailable.
  Data is lost on server restart. Never rely on fallback in production.
- **tweetnacl + bs58** — used for Solana wallet signature verification instead
  of `@solana/web3.js` alone, for a smaller backend dependency footprint.
- **express-rate-limit** — rate limiting applied globally and per-route.
  Redis store used in production; memory store in development.
- **Helmet** — applied as global middleware for security headers.
- **Leaflet 1.9.4** — vendored in `public/vendor/` for offline/CDN-free use.
- **Hugging Face Mixtral-8x7B-Instruct-v0.1** — chosen as Overseer AI model
  for good instruction-following and Fallout tone adaptability.

---

## Commands That Worked

| Date | Command | Notes |
|------|---------|-------|
| — | `npm run dev` | Dev server with nodemon auto-reload (port 3000) |
| — | `npm start` | Production server start |
| — | `npm run lint` | ESLint across the project |
| — | `npm run format` | Prettier formatting |
| — | `curl http://localhost:3000/api/health` | Health check endpoint |
| — | `redis-cli keys "afw:*"` | List all game Redis keys |
| — | `redis-cli ping` | Verify Redis connection |

---

## Architecture Notes

- **Frontend served from `public/`** — Vercel serves this directory as a CDN.
  `vercel.json` sets `outputDirectory: "public"` and `cleanUrls: true`.
  No build step required.
- **API at `api.atomicfizzcaps.xyz`** — Vercel rewrites `/api/*` requests to
  `https://api.atomicfizzcaps.xyz/api/*` via `vercel.json` rewrites config.
- **Backend at Render** — `render.yaml` configures the Render web service.
  Root dir: `backend/`, start: `node server.js`. Health check: `/api/health`.
- **Redis key prefix** — All Redis keys use `afw:` prefix (from `REDIS_PREFIX`
  env var). Format: `afw:<category>:<identifier>`.
- **CORS allowlist** — hardcoded critical origins: `https://www.atomicfizzcaps.xyz`,
  `https://atomicfizzcaps.xyz`. Permanent patterns: `*.vercel.app`,
  `*.onrender.com`. Additional origins via `FRONTEND_ORIGIN` env var.
- **Overseer AI** — Backend proxy at `/api/overseer-proxy` forwards requests
  to Hugging Face. 4-tone personality fallback works without `HF_API_KEY`.
- **GitHub Actions** — two workflows: (1) manual Vercel deploy, (2) API smoke
  test on push to `main` that checks `GET https://api.atomicfizzcaps.xyz/api/health`.
- **Wormhole bridge** — Cross-chain FIZZ token bridging integrated at
  `/bridge.html` and `/bridge-portal.html`. Supports 35+ chains.
- **Twitter Gamemaker bot** — Python/Flask + Tweepy, runs on Render, uses
  shared Redis infrastructure. Separate from the main JS codebase.
- **PWA support** — `public/sw.js` service worker + `public/manifest.json`.
  Enables offline gameplay and mobile home screen install.

---

## Gotchas

_(Things that tripped up a developer or AI assistant)_

- **Redis URL protocol**: `REDIS_URL` is validated on startup. Any URL not
  starting with `redis://` or `rediss://` is rejected with an error log.
  A common mistake is using `http://` or `https://` for Redis URLs.
- **No build step for frontend**: `public/` is pure static files. Do not add
  webpack, Vite, or any bundler without also updating `vercel.json`.
- **CommonJS in backend**: Adding `import` statements to backend files causes
  a runtime error since `package.json` uses `"type": "commonjs"`.
- **Wallet verification is mandatory**: Skipping `walletVerify.verifySignature()`
  on player-mutating endpoints is a critical security vulnerability.
- **Admin password timing attack**: Must use `crypto.timingSafeEqual()` for
  password comparison. Never use `===` for secret comparison.
- **Overseer fallback**: If `HF_API_KEY` is missing or the HF API is down,
  the Overseer uses pre-programmed fallback responses — still functional.
- **Redis in-memory fallback**: The fallback store loses all data on server
  restart. Fine for development, catastrophic for production.
- **CORS wildcard security fix**: The `*.vercel.app` wildcard only allows
  valid hostname characters (alphanumeric + hyphens). The regex was
  intentionally tightened to prevent subdomain injection attacks.
- **Cooldown keys**: POI claim cooldowns stored as `afw:cooldown:<wallet>:<poi_id>`.
  Check `COOLDOWN_SECONDS` env var for the default cooldown duration.
- **GPS distance**: The maximum claim distance is controlled by
  `GPS_DISTANCE_LIMIT` env var (in meters). Default is 1000m.
- **localStorage encoding**: All game state in localStorage must be
  base64-encoded. Raw JSON storage is a security anti-pattern here.

---

## Verified Facts from Agent Sessions

_(Confirmed by agent runs — newest first)_

### [2026-04-04] Frontend config must never return HF_API_KEY
- **What**: Removed `overseer.hfApiKey` from [backend/api/frontend-config.js](backend/api/frontend-config.js#L1). Endpoint now returns only non-secret fields (`hfModel`, `proxyEnabled`).
- **Why**: Production probe showed `/api/config/frontend` returning a backend API key field to public clients.
- **Verified**: Static diagnostics clean on [backend/api/frontend-config.js](backend/api/frontend-config.js).

### [2026-04-04] Global limiter excludes health and frontend config
- **What**: Updated the coarse global rate limiter in [backend/server.js](backend/server.js#L95) to skip `/api/health` and `/api/config/frontend`.
- **Why**: Concurrent load tests were repeatedly receiving HTTP 429 on liveness/config checks, creating false high/medium findings and masking real regressions.
- **Verified**: Change compiled cleanly (no diagnostics in [backend/server.js](backend/server.js)). Restart required for runtime validation.

### [2026-03-17] MCP Server bug fixes + new backend endpoints
- **What**: Fixed 4 broken MCP tools in `mcp/vault77-server.js`:
  1. `get_player_profile` — URL was `?wallet=` query param; fixed to `/api/player/:wallet` path param.
  2. `get_quest_definitions` — Backend ignores `?id=` filter; MCP now filters client-side after fetching all quests.
  3. `get_cooldown_status` — Backend had no GET route; MCP now calls new `GET /api/cooldowns/status?wallet=&poi=`.
  4. `get_leaderboard` — Backend had no leaderboard endpoint; MCP calls new `GET /api/caps/leaderboard?metric=&limit=`.
- **New endpoints added**:
  - `GET /api/caps/leaderboard` — scans `player:*` Redis keys, returns top N players sorted by caps/xp/claims.
  - `GET /api/cooldowns/status` — public (no-auth) cooldown check for POI claims; reads `player:{wallet}:cooldown:{poi}` key.
- **redis.js** — Added `keys(pattern)` wrapper (with fallback in-memory support) and exported it.
- **Verified**: Tests pass. All files load cleanly with Node.

### [2026-03-17] .agentx/agents.json upgraded with Vault-77 agents
- **What**: Added 5 Vault-77 specific agents to `.agentx/agents.json`:
  `vault77-fullstack-dev`, `vault77-game-tester`, `vault77-wasteland-assistant`,
  `vault77-web3-specialist`, `vault77-mcp-server`. Updated `vault77-overseer` tags.
- **Why**: These agents existed in `.github/agents/` markdown files but were missing from the
  agent registry used by the `agentx` CLI (https://github.com/Unwrenchable/agent-tools).
- **Verified**: JSON validates cleanly.

### [2026-03-02] Hive mind infrastructure upgrade
- **What**: Renamed `SwapAssistant.md` → `wasteland-assistant.md`; added `tasks.md`
  active task queue; fixed API endpoint table in `agents-instructions.md` §8 (wrong
  paths for overseer and frontend-config); fixed `backend/routes/` → `backend/api/`
  in README.md, agent.md, fullstack-dev.md, web3-specialist.md, my-agent.agent.md,
  wasteland-assistant.md; added agent priority matrix (§6.4) to agents-instructions.md.
- **Why**: Multiple agent files pointed to wrong route directory; API table had stale
  paths that would send agents to dead endpoints; filename `SwapAssistant.md` directly
  contradicts "NOT a swap/DEX" identity; no active task log meant agents could
  silently collide on shared files.
- **Verified**: Route directory confirmed `backend/api/` from `backend/server.js:251`.
  Overseer at `/api/overseer/ask` (`overseer-proxy.js:25`). Frontend config at
  `/api/config/frontend` (`server.js:259`). `SwapAssistant.md` file confirmed removed.

### [2026-03-02] Route directory is backend/api/ (not backend/routes/)
- **What**: All live API route files are in `backend/api/` — NOT `backend/routes/`.
  Exception: `backend/routes/wallet.js` (legacy stub, avoid adding new files there).
  `server.js` mounts via `safeMount("/api/<path>", api("<filename>"))` where `api()`
  resolves to `backend/api/`.
- **Why**: Multiple agent files incorrectly stated `backend/routes/` causing agents
  to look for files in the wrong directory.
- **Verified**: `backend/server.js:251` shows `api()` helper resolves `backend/api/`.

### [2026-03-02] Overseer ask endpoint is POST /api/overseer/ask
- **What**: Overseer proxy is mounted at `/api/overseer` (server.js:290). Route
  handler defines `router.post('/ask', ...)` (overseer-proxy.js:25). Full path:
  `POST /api/overseer/ask`.
- **Why**: Multiple agent files incorrectly stated `/api/overseer-proxy`.
- **Verified**: `backend/server.js:290`, `backend/api/overseer-proxy.js:25`

### [2026-03-02] Frontend config endpoint is GET /api/config/frontend
- **What**: Frontend config is mounted at `/api/config/frontend` (server.js:259),
  NOT `/api/frontend-config` as some agent files stated.
- **Why**: Stale references in multiple agent files and the API table.
- **Verified**: `backend/server.js:259`

### [2026-03-02] Redis wrapper double-prefix gotcha
- **What**: `backend/lib/redis.js` wrapper functions (`get`/`set`/`hget`/`hset`/`del`) call `key()` internally. Callers must NOT pre-call `key()` before passing to a wrapper or the result is double-prefixed to `afw:afw:`.
- **Why**: `location-claim.js` consistently double-prefixes all keys (legacy, do not change there). `quest-secrets.js` was fixed to use bare strings.
- **Verified**: `backend/lib/redis.js:361-455`, `backend/api/location-claim.js:211,237,288`, `backend/api/quest-secrets.js:27,57`

### [2026-03-02] Redis set() opts format
- **What**: `set(k, v, opts)` takes opts as an **object** `{ EX: 300 }`. Positional ioredis syntax `set(k, v, 'EX', 300)` silently drops the 4th arg through the wrapper.
- **Why**: The wrapper signature differs from raw ioredis.
- **Verified**: `backend/lib/redis.js:369-380`, `backend/lib/admin.js:27-31`

### [2026-03-02] Player profile Redis format
- **What**: Player profiles stored as hash: `key(`player:${wallet}`)` with `redis.hget/hset(playerKey, "profile", data)`.
- **Why**: hget/hset for profile field, not plain get/set.
- **Verified**: `backend/api/fuse.js:44-46,99`, `backend/api/quests.js:31-32,89-90,179-180`

### [2026-03-02] authMiddleware + wallet source (IDOR prevention)
- **What**: All player-mutating routes MUST use `authMiddleware` AND source wallet from `req.player.wallet` — **never** from `req.body`. Using `req.body.wallet` without a session check is an IDOR vulnerability.
- **Why**: Session-bound wallet prevents a player forging another's wallet address in the request body.
- **Verified**: `backend/api/fuse.js:31-34`, `backend/api/scrap-nft.js:24-27`, `backend/api/quest-endings.js:31-32`, `backend/api/location-claim.js:136-139`

### [2026-03-02] API routes location
- **What**: Actual route files for the game live in `backend/api/` (not `backend/routes/`). `server.js` mounts them via `safeMount("/api/<path>", api("<filename>"))` where `api()` resolves to `backend/api/`.
- **Why**: Older docs and agent files reference `backend/routes/`; that dir may have stubs but the live files are in `backend/api/`.
- **Verified**: `backend/server.js:251`, `backend/api/` directory listing

### [2026-03-02] NPC dialog grant_items system
- **What**: Dialog nodes support `grant_items: [itemObj|"id"]` and `grant_from: "NPC Name"` — handled by `_grantDialogItems()` in `narrative.js` which calls `PlayerState.receiveItemFromNPC()`.
- **Why**: Pattern used in Courier and Siren NPC dialogs.
- **Verified**: `public/js/modules/narrative.js:390-415`, `public/data/narrative/dialog_courier.json:node_give_message`

### [2026-03-02] PlayerState.addItem() unique-item guard
- **What**: Weapons and armor are non-stackable/non-duplicable in `addItem()`. Consumables/ammo/tools stack. This prevents duplicate sidearms from STARTER_GEAR + NPC `grant_items`.
- **Verified**: `public/js/game/player-state.js:308-332`

### [2026-03-02] Siren NPC is first in chain
- **What**: Siren (Signal Runner, radio contact) is the first NPC. `dialog_siren.json` uses `narrative.js` intro/nodes/quest_nodes format. Auto-triggers at `gameReady` via `boot.js` poll-retry. Chains to Courier dialog on close.
- **Verified**: `public/data/narrative/dialog_siren.json`, `public/js/boot.js:131-153`

### [2026-03-02] Overseer AI routing pipeline
- **What**: `generateResponse()` returns `null` for fallbacks → `handleInput` calls `overseerPersonality.speak(line, conversationHistory)`. Uses backend proxy `/api/overseer/ask` (not direct HF). `getPlayerContext()` reads `window.opener.Game`.
- **Verified**: `public/js/overseer/overseer.full.js:232-354`, `public/js/overseer/core.personality.js:168-400`

### [2026-03-02] Secure RNG convention
- **What**: `Math.random()` is forbidden for any game-critical logic. Browser: `crypto.getRandomValues()` with `Uint32Array`. Node: `crypto.randomBytes()`.
- **Verified**: `public/js/modules/vats.js:128-131`, `public/js/modules/battles.js:256-259`, `public/js/boot.js:81-83`

### [2026-03-02] XSS prevention with escapeHtml()
- **What**: All user-supplied text must pass through `escapeHtml()` before being inserted into `innerHTML`. Pattern: create temp div → set `.textContent` → return `.innerHTML`.
- **Verified**: `public/js/modules/narrative.js:20-24`, `public/js/overseer/overseer.full.js:186-188`

### [2026-03-02] bs58 CDN global pattern
- **What**: Frontend pages that need bs58 load it as a global via `https://unpkg.com/bs58@6.0.0/dist/index.min.js`. No npm install for frontend.
- **Verified**: `public/index.html:63-81`, `public/exchange.html:119-122`

---

_Add new entries above the relevant section. Keep entries concise._
_This file is version-controlled — never add secrets or credentials._
