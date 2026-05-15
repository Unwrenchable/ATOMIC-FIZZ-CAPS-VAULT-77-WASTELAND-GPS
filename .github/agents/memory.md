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

### [2026-05-15] Overseer now defaults to a backend-local RealAI brain
- **What**: `backend/api/overseer-proxy.js` now uses `backend/realai/local-overseer.js` as the default reply engine, controlled by `OVERSEER_REALAI_MODE` (`local` default, `auto`, or `cloud`), and only reaches external providers when cloud mode is explicitly enabled or chosen as a fallback.
- **Why**: The live backend needed a self-hosted Overseer path that keeps `/api/overseer/ask` functional without third-party model credentials, while still leaving an escape hatch for cloud providers later.
- **Verified**: `node --check backend/realai/local-overseer.js`, `node --check backend/api/overseer-proxy.js`, and `Set-Location backend; node -e "... /api/overseer/ask ..."` returning `{ ok: true, fallback: false, source: "local-realai", mode: "local" }`.

### [2026-05-15] Frontend Overseer status now advertises the self-hosted relay
- **What**: `backend/api/frontend-config.js` still defaults the browser to `linked-ai`, but the default status label now reports `LINKED TO SELF-HOSTED OVERSEER RELAY // LOCAL REALAI CORE ACTIVE` unless `OVERSEER_MODE=local-webllm` or cloud mode is explicitly selected.
- **Why**: The Overseer terminal was still presenting itself like a cloud uplink even after the backend moved local-first, which made the runtime mode confusing during rollout and troubleshooting.
- **Verified**: `Set-Location backend; node -e "... /api/config/frontend ..."` returning `{\"overseer\":{\"mode\":\"linked-ai\",\"statusLabel\":\"LINKED TO SELF-HOSTED OVERSEER RELAY // LOCAL REALAI CORE ACTIVE\"}}`.

### [2026-05-15] Overseer prompt context must guard non-array repoSnapshot app state
- **What**: `backend/api/overseer-proxy.js` must treat `req.app.get("repoSnapshot")` as optional and only call `.slice()` when it is actually an array, because `backend/server.js` currently stores the mounted repo-snapshot router there instead of a precomputed file list.
- **Why**: `/api/overseer/ask` builds its prompt before calling any upstream AI provider. If it assumes `repoSnapshot` is always an array, the route can throw before fallback logic runs and collapse into a gateway error instead of returning JSON.
- **Verified**: `node --check backend/api/overseer-proxy.js` and local `POST http://127.0.0.1:3000/api/overseer/ask` returning `{ ok: true, fallback: true, ... }` with the current `server.js` wiring.

### [2026-05-15] Overseer proxy must answer with fallback text on upstream failure
- **What**: `backend/api/overseer-proxy.js` now returns `{ ok: true, fallback: true, source: "fallback", reason, text }` when model credentials are missing, when Grok/OpenAI/Hugging Face return an empty payload, or when an upstream request fails.
- **Why**: The agent-network rules require a preserved Overseer fallback path; returning a fallback reply keeps the terminal responsive instead of surfacing a dead-end proxy failure whenever the AI uplink is degraded.
- **Verified**: `node --check backend/api/overseer-proxy.js`.

### [2026-05-14] RealAI utilities now default to OpenAI cloud mode
- **What**: `scripts/realai/realai-client.js` now calls `https://api.openai.com/v1/chat/completions` by default, reads `OPENAI_API_KEY` / `OPENAI_MODEL` (with `AI_API_KEY` / `AI_MODEL` fallback), and maps legacy local aliases like `local`, `realai-overseer`, and `llama-3.2-1b` onto the configured cloud model.
- **What**: `lib/realai.js` and `backend/tools/realai.js` now reuse that shared client instead of separate localhost-only RealAI endpoints, and `backend/api/overseer-proxy.js` also honors `OPENAI_API_KEY` / `OPENAI_MODEL`.
- **Why**: This removes the old localhost RealAI daemon assumption and lets local scripts plus the existing backend proxy share the same cloud-backed env configuration.
- **Verified**: `node --input-type=module -e "import('./scripts/realai/realai-client.js').then(() => console.log('scripts realai ok'))"` and matching import checks for `lib/realai.js` / `backend/tools/realai.js`.

### [2026-05-14] CORS + preview domains + absolute API routing
- **What**: Updated CORS wildcard hostname matching in `backend/server.js` so `https://*.vercel.app` and similar patterns can match nested preview host labels (for example, `atomic-fizz-caps-zj3obwe9g-vault777.vercel.app`) while still restricting wildcard segments to valid hostname characters.
- **What**: Added a frontend fetch shim in `public/js/config.js` that rewrites relative `/api/*` requests to `${window.API_BASE}/api/*` so legacy modules no longer hit the Vercel origin by mistake.
- **What**: Updated `public/overseer.html` worldstate polling to call `${API_BASE}/api/worldstate` explicitly.
- **Verified**: Diagnostics clean in `backend/server.js`, `public/js/config.js`, and `public/overseer.html`.

### [2026-04-28] Pip-Boy panel render system — two tiers exist
- **What**: Fixed `public/js/pipboy.js` to use the full-featured module renderers instead of the legacy main.js stubs.
  - ITEMS tab: now calls `Game.ui.renderInventory()` (inventory-ui.js — category tabs + paperdoll) with fallback to `window.renderInventoryPanel()`
  - QUESTS tab: now calls `Game.ui.renderQuest()` (quest-ui.js — objectives, accept/decline) with fallback to `window.renderQuestsPanel()`
  - EXCHANGE tab: consolidated two duplicate `if (panelKey==="exchange")` blocks into one that calls all three exchange renderers
  - STAT portrait: now generates at size=150 (frame height) and clips to 120×150 with `overflow:hidden` to fill the frame correctly
- **Why**: pipboy.js was calling the simple main.js versions (`renderInventoryPanel`, `renderQuestsPanel`) which don't populate the `#inventoryTabs` category bar or show quest objectives.
- **Verified**: 105 security tests pass; playtest agent 35/35 pass, 0 warnings.

### [2026-04-28] NFT loot items need `nft_eligible: true` flag
- **What**: Added `"nft_eligible": true` to all 8 items in the `nft_items` tier of `public/data/items/loot_tables.json`. Also copied `public/data/factions/factions.json` → `public/data/factions.json` so the playtest agent finds it at `/data/factions.json`.
- **Why**: Playtest agent checks `item.nft_eligible` to confirm NFT drops can occur. Factions file was in a subdirectory but agent expected it at the data root.
- **Verified**: Playtest agent went from 32 passed / 2 warnings → 35 passed / 0 warnings.

### [2026-04-28] backend/api/ module exports must expose a router
- **What**: `safeMount()` in `backend/server.js` uses `mod.router || mod.default || mod`. API modules must export a router directly or via a `.router` property — plain objects with method names are silently ignored.
- **Why**: `backend/api/ai-character.js` exported `{ setupAICharacterRoutes, GrokAICharacterService }` causing "Router.use() requires a middleware function but got a Object" on startup.
- **Fix pattern**: Add a `.router` property built by calling the setup function on a fresh `express.Router()` in an IIFE at the bottom of the file.
- **Verified**: `node -e "require('./backend/api/ai-character.js')"` → OK.

### [2026-04-28] Never call `new PublicKey(placeholder)` at module scope
- **What**: `backend/api/buy-stimpak.js` crashed on load with "Non-base58 character" because `new PublicKey(process.env.CAPS_MINT || "your-caps-token-mint-address")` ran at module scope.
- **Fix**: Lazy-initialize Solana objects in a `getSolanaConfig()` function called at request time. Return HTTP 503 if env vars are missing.
- **Verified**: `node -e "require('./backend/api/buy-stimpak.js')"` → OK even without `CAPS_MINT` env var.


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

## Mainnet Readiness Audit — 2026-04-06

### 🔴 CRITICAL Bugs Fixed (BUG-031 through BUG-039 + SEC-AUDIT)

#### [2026-04-06] BUG-031: Cooldowns TTL double-prefix fix
- **What**: `backend/api/cooldowns.js` was calling `redis.ttl()` without the `key()` wrapper, so TTL always returned -2 (key not found). Countdown timers were permanently broken.
- **Fix**: Added `key()` wrapper: `redis.ttl(key(\`player:${wallet}:cooldown:${poi}\`))`.
- **Verified**: `backend/api/cooldowns.js:44`

#### [2026-04-06] BUG-032: FizzFun bonding curve JS Number overflow → BigInt
- **What**: `virtualSol (30e9) * tokenReserve (800e15) = 2.4e28` exceeds `Number.MAX_SAFE_INTEGER`, causing `~0.02-0.1%` arithmetic error on large trades.
- **Fix**: `calculateBuyReturn` and `calculateSellReturn` now use `BigInt()` for intermediate computations.
- **Verified**: `backend/api/fizz-fun.js:387-415`

#### [2026-04-06] BUG-033: Dungeon /clear TOCTOU race → atomic NX set
- **What**: `POST /api/dungeon/clear` used GET-then-SET. Two concurrent tabs could both pass the cleared check and each receive the full completion bonus (up to 180 caps + 120 XP).
- **Fix**: Replaced with `redis.set(key(clearKey), ..., { NX: true, EX: ... })` — same pattern as `/loot`.
- **Verified**: `backend/api/dungeon.js:291-300`

#### [2026-04-06] BUG-034: battles.js dead enemy deals damage after all enemies defeated
- **What**: After killing the last enemy, `activeEnemyIndex` still pointed at the dead enemy. If `enemyAttack()` ran before `checkBattleEnd()`, the dead enemy dealt damage, potentially flipping WIN→LOSE.
- **Fix**: Guard at top of `enemyAttack()`: `if (enemyHp[idx] <= 0) return { success: false, reason: 'ENEMY_DEAD' }`.
- **Verified**: `public/js/modules/battles.js:175-188`

#### [2026-04-06] BUG-035/036: Loot voucher protocol mismatch (100% redemption failure)
- **What**: `loot-voucher.js` hardcoded `lootId = 1n` and returned a flat payload missing `voucherId`/`keyId`. `redeem-voucher.js` required a nested `{ voucher, signature }` structure with those fields. Zero vouchers were ever redeemable.
- **Fix**: `loot-voucher.js` now returns `{ voucher: { voucherId, keyId, lootId, ... }, signature: [...] }`. `voucherId` is `crypto.randomBytes(16).toString('hex')`. Server key registered in keys service on startup.
- **Verified**: `backend/api/loot-voucher.js`

#### [2026-04-06] BUG-037: Game loop ENCOUNTER_CHANCE 55% → 7% for production
- **What**: `ENCOUNTER_CHANCE = 0.55` meant battle every ~9 seconds, making normal GPS exploration impossible.
- **Fix**: Reduced to `0.07` (7% per tick ≈ 1 encounter per ~71 seconds average).
- **Verified**: `public/js/game/loop.js:22`

#### [2026-04-06] SEC-AUDIT-001: Solana bonding curve u64 overflow → u128
- **What**: `virtual_sol (30e9) * token_reserve (800e15) = 2.4e28 > u64::MAX (1.84e19)`. Every `fizz_buy`/`fizz_sell` transaction panicked at the `.unwrap()`. The entire FizzFun launchpad was dead on arrival.
- **Fix**: All intermediate bonding curve calculations now cast to `u128` before multiplication.
- **Verified**: `programs/fizzcaps-onchain/src/lib.rs:310-322`

#### [2026-04-06] SEC-AUDIT-002: Solana ClaimLoot server_key was unconstrained → forge vouchers
- **What**: `server_key` in `ClaimLoot` had no address constraint. Any attacker could pass their own keypair as `server_key` and generate unlimited loot NFTs.
- **Fix**: Added `server_key` field to `FizzConfig`. `fizz_init` stores it. `ClaimLoot` now requires `address = config.server_key`.
- **Verified**: `programs/fizzcaps-onchain/src/lib.rs:650-690`

#### [2026-04-06] SEC-AUDIT-003: FizzBondingCurve missing graduated_at + curve.symbol compile error
- **What**: `fizz_graduate` set `curve.graduated_at` and used `curve.symbol` but neither field existed in `FizzBondingCurve` — compile error, program could never deploy. Space allocation also too small.
- **Fix**: Added `graduated_at: Option<i64>` to struct. Fixed space to 108 bytes. Replaced `curve.symbol` with `curve.token_mint` in `msg!`.
- **Verified**: `programs/fizzcaps-onchain/src/lib.rs:571-586, 507-510`

#### [2026-04-06] SEC-AUDIT-004/005: Token vault + treasury unconstrained in Buy/Sell
- **What**: `curve_token_vault` in `FizzBuyTokens` had no ATA constraints (token theft possible). `FizzSellTokens` had no `config` account and `treasury` was unconstrained (100% fee redirection possible).
- **Fix**: Added `associated_token::mint = token_mint, associated_token::authority = bonding_curve` to `curve_token_vault` in both structs. Added `config` to `FizzSellTokens` with `treasury address = config.treasury @ FizzError::InvalidTreasury`.
- **Verified**: `programs/fizzcaps-onchain/src/lib.rs`

#### [2026-04-06] SEC-AUDIT-006: GPS not validated before voucher signing → couch farming
- **What**: `loot-voucher.js` accepted client-supplied GPS coordinates without checking proximity to any known POI. Players could claim loot from any location on Earth without physically visiting.
- **Fix**: Added `findNearbyPOI(lat, lng)` haversine check against `poi.json` data before signing. Returns `403 not_near_poi` if no POI within claim radius.
- **Verified**: `backend/api/loot-voucher.js:75-100`

#### [2026-04-06] SEC-AUDIT-008: Loot voucher timestamp not validated on-chain
- **What**: `claim_loot` accepted vouchers of any age. Old/leaked vouchers remained valid indefinitely.
- **Fix**: Added `voucher_age <= 3600s` check using `Clock::get()` before burn and mint.
- **Verified**: `programs/fizzcaps-onchain/src/lib.rs:55-63`

### Security Test Coverage
- **Total security tests**: 105 (was 94) — additional tests added for Pip-Boy panel fixes and inventory/quest/exchange regressions.
- **Run with**: `node tests/security.test.js`
- **Playtest suite**: `node tests/playtest-agent.js` → 35/35 pass, 0 warnings.

---

### [2025-07-02] CharacterCreator.appearanceOptions — private closure exposed via getter
- **What**: `let appearanceOptions` in `character-creator.js` is a private closure variable (line 13). Both `pipboy.js:renderCharacterPortrait()` and `index.html:updateStatDisplay()` checked `cc.appearanceOptions` — always `undefined` — causing portrait/stat display to never render.
- **Fix**: Added `Object.defineProperty(CharacterCreator, 'appearanceOptions', { get: () => appearanceOptions })` before the module registration line in `character-creator.js`.
- **Verified**: `public/js/modules/character-creator.js` — portrait and STAT panel now render correctly.

### [2025-07-02] recipes.json was missing — crafting panel showed "No recipes available"
- **What**: `public/js/modules/recipes.js` fetches `/recipes.json` at init. File did not exist in `public/`. The crafting section of the Exchange panel always showed "No recipes available."
- **Fix**: Created `public/recipes.json` with 5 recipes (stimpak, repair_kit, turret_part, molotov, medkit) using the `{ id, name, description, inputs:[{id,amount}], outputId, levelRequired }` format expected by `recipes.js` and `renderExchangeCraftingSection`.
- **Verified**: JSON valid, all 5 recipes have required fields.

### [2025-07-02] Loot economy verified balanced
- **Drop rates** (meta): nft=1%, legendary=2.5%, epic=6%, rare=15%, uncommon=30%, common=45%.
- **Caps values by tier**: common 1-15, uncommon 8-45, rare 45-220, epic 180-750, legendary 400-5000.
- **NFT items**: all 8 `nft_items` tier entries have `nft_eligible: true`.
- **Demo shop**: stimpak 20 caps, radaway 30, nuka-cola 10, bobby_pin×5 15, scrap_metal 5.
- **Quest rewards**: tutorial 25 caps / 50 XP; main quests 200-400 caps; arc finale up to 1000 caps.

### [2026-04-28] NFT DESIGN DECISION: ALL non-common drops are NFT-eligible
- **Rule**: `uncommon`, `rare`, `epic`, `legendary`, and `nft_items` tiers all have `nft_eligible: true`. `common` tier always `nft_eligible: false`.
- **Meaning**: Every non-common item a player finds is mintable as an on-chain NFT. Players are responsible for initiating the mint and paying the Solana gas fee. The game never auto-mints.
- **Verified**: `public/data/items/loot_tables.json` — 77 items nft_eligible (uncommon:20, rare:20, epic:15, legendary:14, nft_items:8), common:12 items NOT eligible.

---

_Add new entries above the relevant section. Keep entries concise._
_This file is version-controlled — never add secrets or credentials._
