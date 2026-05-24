<<<<<<< HEAD
# Copilot Instructions — Atomic Fizz Caps / Vault-77 Wasteland GPS

## Agent Network / Hive Mind

**Read `.github/agents-instructions.md` first** before making any changes.
That document is the primary coordination file for all AI agents (Copilot included) operating on this repository. It defines:
- Agent peer discovery and task routing
- Inter-agent communication format (JSON event schema)
- Shared memory protocol via `.github/agents/memory.md`
- Convergence rules for shared systems (Redis, auth, CORS)
- GitHub Copilot integration workflow and security invariants

After reading `agents-instructions.md`, check `.github/agents/memory.md` for verified facts and recent decisions, then `.github/agents/agent.md` for conventions before writing any code.

---

## Project Identity
This repo is **Atomic Fizz Caps** (`atomicfizzcaps.xyz`) — a Fallout-themed GPS crypto geo-game built on Solana. Players explore real-world GPS locations, claim POIs, earn FIZZ tokens, battle creatures, craft gear, and chat with an Overseer AI. This is **not** a DEX, swap protocol, or naming service. Any FizzSwap/fizzdex references in code are outdated.

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20, CommonJS only (`require`/`module.exports` — no ESM `import`)
- **Framework**: Express 4.22
- **Database**: Redis via `ioredis` with in-memory fallback
- **Blockchain**: Solana (`@solana/web3.js`, `@solana/spl-token`, `tweetnacl`, `bs58`)
- **Auth**: Wallet-signature-based auth via `backend/lib/walletVerify.js`

### Frontend
- **Pure vanilla HTML/CSS/JS** in `public/` — **no React, no TypeScript, no build step**
- Scripts loaded directly as `<script src="...">` tags
- `bs58` loaded as a CDN global: `https://unpkg.com/bs58@6.0.0/dist/index.min.js`
- Leaflet maps for GPS; Pip-Boy themed UI

### Deployment
- **Frontend**: Vercel serves `public/` as CDN; rewrites `/api/*` → `api.atomicfizzcaps.xyz`
- **Backend**: Render runs `backend/server.js` on port 3000
- Config: `vercel.json`, `render.yaml`

---

## Repository Layout

```
backend/
  api/          # Express route handlers (one file per endpoint group)
  lib/          # Shared utilities: redis.js, walletVerify.js, admin.js, …
  server.js     # Entry point — mounts routes via safeMount("/api/path", api("filename"))
public/
  js/
    modules/    # Game modules: narrative.js, quests.js, vats.js, battles.js, …
    game/       # player-state.js, inventory, etc.
    overseer/   # Overseer AI: overseer.full.js, core.personality.js
    boot.js     # App bootstrap / game-ready init
  data/         # Static JSON: items/, narrative/ dialog files, locations, etc.
  *.html        # Game pages
docs/           # Markdown documentation
tests/          # Test files
```

---

## Build & Run Commands

```bash
npm start        # Production: node backend/server.js
npm run dev      # Dev: nodemon backend/server.js
npm run lint     # ESLint
npm run format   # Prettier
npm test         # (no tests configured yet — exits 0)
```

`REDIS_URL` must use `redis://` or `rediss://` protocol.

---

## Code Conventions

### General
- **CommonJS everywhere** on the backend — never use `import`/`export`
- Keep API route handlers in `backend/api/`; shared logic goes in `backend/lib/`
- New API routes are mounted in `backend/server.js` via `safeMount("/api/<path>", api("<filename>"))`

### Redis
- All Redis wrapper functions (`get`/`set`/`hget`/`hset`/`del`, etc.) in `backend/lib/redis.js` call `key()` internally — **do not pre-call `key()` before passing to a wrapper** or you'll double-prefix to `afw:afw:`.
- `key()` is imported standalone: `const { key } = require('../lib/redis')` and called with a template string: `` key(`category:${id}`) ``
- `set(k, v, opts)` takes opts as an **object** `{ EX: 300 }` — not positional ioredis syntax
- Player profiles: `key(`player:${wallet}`)` → `redis.hget/hset(playerKey, "profile", data)`

### Authentication & Authorization
- All player-mutating routes **must** use `authMiddleware` AND source the wallet from `req.player.wallet` — **never from `req.body`** (IDOR risk)
- Wallet signatures verified via `walletVerify.verifySignature()` (tweetnacl + bs58)
- Admin passwords compared with `crypto.timingSafeEqual()`

### Security — Random Numbers
- **Never use `Math.random()`** for game-critical logic
- Browser: `crypto.getRandomValues()` with `Uint32Array`
- Node.js: `crypto.randomBytes()`

### Frontend — XSS Prevention
- Always use `escapeHtml()` before inserting any user-supplied text into `innerHTML`
- `escapeHtml` pattern: create a temp div, set `.textContent`, return `.innerHTML`

### Inventory / Item System
- `PlayerState.addItem()` in `player-state.js`: weapons and armor are non-stackable/non-duplicable (unique-item guard). Consumables/ammo/tools stack.
- Dialog nodes support `grant_items: [itemObj|"id"]` and `grant_from: "NPC Name"`, handled by `_grantDialogItems()` in `narrative.js`
- `items.json` must be **comment-free valid JSON**

### NPC / Narrative System
- Dialog files live in `public/data/narrative/dialog_*.json`
- Format: `{ intro, nodes, quest_nodes }` processed by `public/js/modules/narrative.js`
- Node branching: `_goToNode(nodeId, dialog)` looks up `dialog.nodes[nodeId]`
- Tone colours: question=`#7fd4f5`, kind=`#a0e890`, sarcastic=`#ffcc55`, direct=`#ff9966`

### Overseer AI
- Pipeline: `generateResponse()` returns `null` for fallbacks → `handleInput` calls `overseerPersonality.speak()`
- Uses backend proxy `/api/overseer/ask` — **not** direct Hugging Face calls
- `getPlayerContext()` reads `window.opener.Game`

---

## Key Security Rules (must follow for every PR)
1. All RNG → `crypto.getRandomValues()` (browser) or `crypto.randomBytes()` (Node)
2. All wallet-mutating API endpoints → call `walletVerify.verifySignature()`
3. All player-mutating routes → `authMiddleware` + `req.player.wallet`
4. All user text inserted into DOM → `escapeHtml()` before `innerHTML`
5. Admin passwords → `crypto.timingSafeEqual()`
6. Never commit secrets or `.env` files

---

## Fallout Thematic Context
When naming things, writing error messages, or adding log output, lean into the Fallout / Vault-Tec aesthetic. Prefer wasteland terminology (caps, rads, stimpaks, vaults, Pip-Boy) over generic tech jargon where it fits naturally without obscuring meaning.
=======
# Copilot Instructions — Atomic Fizz Caps / Vault-77 Wasteland GPS

## Agent Network / Hive Mind

**Read `.github/agents-instructions.md` first** before making any changes.
That document is the primary coordination file for all AI agents (Copilot included) operating on this repository. It defines:
- Agent peer discovery and task routing
- Inter-agent communication format (JSON event schema)
- Shared memory protocol via `.github/agents/memory.md`
- Convergence rules for shared systems (Redis, auth, CORS)
- GitHub Copilot integration workflow and security invariants

After reading `agents-instructions.md`, check `.github/agents/memory.md` for verified facts and recent decisions, then `.github/agents/agent.md` for conventions before writing any code.

---

## Project Identity
This repo is **Atomic Fizz Caps** (`atomicfizzcaps.xyz`) — a Fallout-themed GPS crypto geo-game built on Solana. Players explore real-world GPS locations, claim POIs, earn FIZZ tokens, battle creatures, craft gear, and chat with an Overseer AI. This is **not** a DEX, swap protocol, or naming service. Any FizzSwap/fizzdex references in code are outdated.

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20, CommonJS only (`require`/`module.exports` — no ESM `import`)
- **Framework**: Express 4.22
- **Database**: Redis via `ioredis` with in-memory fallback
- **Blockchain**: Solana (`@solana/web3.js`, `@solana/spl-token`, `tweetnacl`, `bs58`)
- **Auth**: Wallet-signature-based auth via `backend/lib/walletVerify.js`

### Frontend
- **Pure vanilla HTML/CSS/JS** in `public/` — **no React, no TypeScript, no build step**
- Scripts loaded directly as `<script src="...">` tags
- `bs58` loaded as a CDN global: `https://unpkg.com/bs58@6.0.0/dist/index.min.js`
- Leaflet maps for GPS; Pip-Boy themed UI

### Deployment
- **Frontend**: Vercel serves `public/` as CDN; rewrites `/api/*` → `api.atomicfizzcaps.xyz`
- **Backend**: Render runs `backend/server.js` on port 3000
- Config: `vercel.json`, `render.yaml`

---

## Repository Layout

```
backend/
  api/          # Express route handlers (one file per endpoint group)
  lib/          # Shared utilities: redis.js, walletVerify.js, admin.js, …
  server.js     # Entry point — mounts routes via safeMount("/api/path", api("filename"))
public/
  js/
    modules/    # Game modules: narrative.js, quests.js, vats.js, battles.js, …
    game/       # player-state.js, inventory, etc.
    overseer/   # Overseer AI: overseer.full.js, core.personality.js
    boot.js     # App bootstrap / game-ready init
  data/         # Static JSON: items/, narrative/ dialog files, locations, etc.
  *.html        # Game pages
docs/           # Markdown documentation
tests/          # Test files
```

---

## Build & Run Commands

```bash
npm start        # Production: node backend/server.js
npm run dev      # Dev: nodemon backend/server.js
npm run lint     # ESLint
npm run format   # Prettier
npm test         # Security regression tests (tests/security.test.js)
npm run test:load
npm run test:playtest
```

`REDIS_URL` must use `redis://` or `rediss://` protocol.

## Package Manager & Lockfiles

- Use **npm only** in this repository.
- Expected lockfiles are `package-lock.json` and `backend/package-lock.json`.
- Do not add `yarn.lock`, `pnpm-lock.yaml`, or Bun lockfiles.
- Run npm commands from the repository root unless a change is intentionally backend-only.
- If VS Code warns about multiple lockfiles while `npm.packageManager` is `auto`, treat this as a workspace-structure warning (root + nested backend package), not a yarn/pnpm migration signal.
- Do not delete either npm lockfile unless the user explicitly asks for a package-structure cleanup.

---

## Code Conventions

### General
- **CommonJS everywhere** on the backend — never use `import`/`export`
- Keep API route handlers in `backend/api/`; shared logic goes in `backend/lib/`
- New API routes are mounted in `backend/server.js` via `safeMount("/api/<path>", api("<filename>"))`

### Redis
- All Redis wrapper functions (`get`/`set`/`hget`/`hset`/`del`, etc.) in `backend/lib/redis.js` call `key()` internally — **do not pre-call `key()` before passing to a wrapper** or you'll double-prefix to `afw:afw:`.
- `key()` is imported standalone: `const { key } = require('../lib/redis')` and called with a template string: `` key(`category:${id}`) ``
- `set(k, v, opts)` takes opts as an **object** `{ EX: 300 }` — not positional ioredis syntax
- Player profiles: `key(`player:${wallet}`)` → `redis.hget/hset(playerKey, "profile", data)`

### Authentication & Authorization
- All player-mutating routes **must** use `authMiddleware` AND source the wallet from `req.player.wallet` — **never from `req.body`** (IDOR risk)
- Wallet signatures verified via `walletVerify.verifySignature()` (tweetnacl + bs58)
- Admin passwords compared with `crypto.timingSafeEqual()`

### Security — Random Numbers
- **Never use `Math.random()`** for game-critical logic
- Browser: `crypto.getRandomValues()` with `Uint32Array`
- Node.js: `crypto.randomBytes()`

### Frontend — XSS Prevention
- Always use `escapeHtml()` before inserting any user-supplied text into `innerHTML`
- `escapeHtml` pattern: create a temp div, set `.textContent`, return `.innerHTML`

### Inventory / Item System
- `PlayerState.addItem()` in `player-state.js`: weapons and armor are non-stackable/non-duplicable (unique-item guard). Consumables/ammo/tools stack.
- Dialog nodes support `grant_items: [itemObj|"id"]` and `grant_from: "NPC Name"`, handled by `_grantDialogItems()` in `narrative.js`
- `items.json` must be **comment-free valid JSON**

### NPC / Narrative System
- Dialog files live in `public/data/narrative/dialog_*.json`
- Format: `{ intro, nodes, quest_nodes }` processed by `public/js/modules/narrative.js`
- Node branching: `_goToNode(nodeId, dialog)` looks up `dialog.nodes[nodeId]`
- Tone colours: question=`#7fd4f5`, kind=`#a0e890`, sarcastic=`#ffcc55`, direct=`#ff9966`

### Overseer AI
- Pipeline: `generateResponse()` returns `null` for fallbacks → `handleInput` calls `overseerPersonality.speak()`
- Uses backend proxy `/api/overseer/ask` — **not** direct Hugging Face calls
- `getPlayerContext()` reads `window.opener.Game`

---

## Key Security Rules (must follow for every PR)
1. All RNG → `crypto.getRandomValues()` (browser) or `crypto.randomBytes()` (Node)
2. All wallet-mutating API endpoints → call `walletVerify.verifySignature()`
3. All player-mutating routes → `authMiddleware` + `req.player.wallet`
4. All user text inserted into DOM → `escapeHtml()` before `innerHTML`
5. Admin passwords → `crypto.timingSafeEqual()`
6. Never commit secrets or `.env` files

---

## Fallout Thematic Context
When naming things, writing error messages, or adding log output, lean into the Fallout / Vault-Tec aesthetic. Prefer wasteland terminology (caps, rads, stimpaks, vaults, Pip-Boy) over generic tech jargon where it fits naturally without obscuring meaning.
>>>>>>> sync/main-reconcile-20260524-081701
