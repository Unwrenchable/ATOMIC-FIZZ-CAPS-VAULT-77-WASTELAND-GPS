# ☢️ ATOMIC FIZZ CAPS — Agent Guidance

Use this file to orient yourself before suggesting changes to the
Atomic Fizz Caps Vault-77 Wasteland GPS game.

## Project Overview

**Atomic Fizz Caps** is a Fallout-themed, GPS-based crypto geo-game at
**https://www.atomicfizzcaps.xyz**. Players explore real-world locations,
claim GPS Points of Interest (POIs) via Solana wallet signatures, earn FIZZ
SPL tokens, battle enemies, craft items, join factions, and chat with the
Vault 77 Overseer AI.

This is **NOT** a DEX, swap protocol, or naming service. Ignore any FizzSwap
or DEX-related context from other sources.

---

## Repository Layout

```
/
├── backend/               # Node.js 20 + Express 4 API server
│   ├── server.js          # Main entry point
│   ├── api/               # API route modules (CommonJS, primary location)
│   ├── routes/            # Legacy routes area (do not add new API files)
│   ├── lib/               # Shared utilities (redis, walletVerify, loot, etc.)
│   ├── middleware/        # Express middleware (auth, adminAuth)
│   ├── data/              # Static data files
│   └── tools/             # Backend tools
├── public/                # Vanilla HTML/CSS/JS frontend (Vercel CDN)
│   ├── index.html         # Main Pip-Boy map interface
│   ├── overseer.html      # Vault 77 Overseer AI terminal
│   ├── exchange.html      # Scavenger Exchange
│   ├── nuke.html / nuke-portal.html  # NUKE fusion system
│   ├── bridge.html / bridge-portal.html  # Wormhole bridge
│   ├── admin/             # Admin panel (password protected)
│   ├── wallet/            # Wallet management
│   ├── fizzfun/           # Fizz.fun standalone page
│   ├── css/               # Pip-Boy green terminal stylesheets
│   ├── js/                # Frontend JS modules
│   │   ├── main.js / boot.js     # Entry + boot sequence
│   │   ├── map/                  # Leaflet POI marker rendering
│   │   ├── game/                 # Game loop, inventory, player state
│   │   ├── overseer/             # Overseer AI terminal system
│   │   └── modules/              # Feature modules (battles, crafting, etc.)
│   └── vendor/            # Third-party libraries
├── programs/              # Anchor/Rust Solana programs
├── solana/                # Solana program tests
├── workers/               # Background workers (NFT minting)
├── scripts/               # Utility scripts
├── docs/                  # Project documentation
│   ├── DOCS_INDEX.md
│   ├── features/          # Feature-specific guides
│   └── deployment/        # Deployment guides
├── .env.example           # Environment variable template (no secrets)
├── package.json           # Root package (backend entry)
├── vercel.json            # Vercel: serves public/, rewrites /api/* → backend
├── render.yaml            # Render: backend API service config
└── docker-compose.yml     # Docker (optional)
```

---

## Toolchain

| Layer | Tool |
|-------|------|
| Runtime | Node.js 20 LTS |
| Backend framework | Express 4.22 (CommonJS — use `require()`, not `import`) |
| Frontend | Vanilla HTML5/CSS3/JavaScript — NO React, NO TypeScript |
| Maps | Leaflet.js 1.9.4 |
| Database | Redis (ioredis 5.4) — falls back to in-memory store |
| Blockchain | Solana via `@solana/web3.js` 1.98, `@solana/spl-token` |
| Wallet auth | tweetnacl + bs58 (signature verification) |
| NFTs | Metaplex, Helius API (optional) |
| Cross-chain | Wormhole bridge |
| AI | Hugging Face Inference API (Mixtral-8x7B-Instruct-v0.1) |
| Security | Helmet, express-rate-limit, CORS allowlist |
| Process manager | nodemon (dev), node (prod) |
| Linting | ESLint 9 + eslint-config-prettier |
| Formatting | Prettier |

---

## Root `package.json` Scripts

```bash
npm start          # node backend/server.js  (production)
npm run dev        # nodemon backend/server.js  (development, auto-reload)
npm run lint       # eslint .
npm run format     # prettier --write .
npm test           # node tests/security.test.js
npm run test:load  # concurrent load test
npm run test:playtest
```

For broader test procedures and manual verification flows, see [docs/development/TESTING_GUIDE.md](../../docs/development/TESTING_GUIDE.md).

---

## Package Manager & Lockfile Policy

- Package manager is **npm** (`packageManager: npm@10`).
- This repo intentionally contains two npm lockfiles: [package-lock.json](../../package-lock.json) and [backend/package-lock.json](../../backend/package-lock.json).
- Do not add or commit `yarn.lock`, `pnpm-lock.yaml`, or Bun lockfiles.
- If editors show a "multiple lockfiles" warning while `npm.packageManager` is `auto`, keep npm as the only package manager and treat the warning as expected for this nested workspace layout.
- Do not remove either npm lockfile without explicit user approval.

---

## Key Conventions

### Backend (Node.js/Express)
- **CommonJS only** — `require()` / `module.exports`. No ES module `import`.
- **Entry point**: `backend/server.js`. All routes are registered here.
- **Route files** live in `backend/api/`. Each exports an Express Router.
  (Exception: `backend/routes/wallet.js` is a legacy stub — avoid adding new files there.)
- **Shared logic** lives in `backend/lib/`. Import from there, not inline.
- **Redis key prefix**: All keys use `afw:` prefix (e.g., `afw:player:wallet123`).
  Set via `REDIS_PREFIX` env var.
- **Redis fallback**: `backend/lib/redis.js` falls back to in-memory store if
  Redis is unavailable. Do not assume Redis is always available.
- **CORS**: Managed in `backend/server.js`. Always includes `atomicfizzcaps.xyz`,
  `*.vercel.app`, `*.onrender.com`.
- **Wallet verification**: All player-mutating endpoints MUST verify a Solana
  wallet signature using `backend/lib/walletVerify.js` (tweetnacl + bs58).
- **Admin auth**: Admin routes use constant-time password comparison to prevent
  timing attacks. See `backend/middleware/adminAuth.js`.
- **Rate limiting**: Applied globally and per-route via `express-rate-limit`.

### Frontend (Vanilla JS)
- **No framework** — plain HTML, CSS, JavaScript. No build step needed.
- **Pip-Boy theme** — all UI must maintain green terminal aesthetic (CRT effects,
  scanlines, radioactive glow, monospace fonts).
- **Secure randomness** — use `crypto.getRandomValues()`, never `Math.random()`.
- **localStorage** — all stored data must be base64-encoded at minimum.
- **Phantom wallet** — wallet integration via `public/js/modules/web3-wallet-adapter.js`.
- **API calls** — use `fetch('/api/...')`. Vercel rewrites `/api/*` to the
  backend API at `api.atomicfizzcaps.xyz`.
- **Map** — Leaflet.js with custom Fallout-themed tile overlays.
- **PWA** — service worker (`sw.js`) and `manifest.json` enable offline support.

### Security
- **No secrets in code** — all secrets in `.env` (git-ignored). Template: `.env.example`.
- **Timing-safe comparisons** — admin passwords use `crypto.timingSafeEqual`.
- **Input validation** — use `express-validator` on all API inputs.
- **HMAC signing** — vouchers, GPS claims, and XP use HMAC-signed tokens.
- **Fallout authenticity** — all game content must be lore-consistent with
  the Fallout universe.

---

## Deployment

### Frontend (Vercel)
- `vercel.json` at repo root configures static serving.
- `outputDirectory: "public"` — entire `public/` dir is served as CDN.
- `cleanUrls: true` — `.html` extension stripped from URLs.
- `/api/*` rewrites to `https://api.atomicfizzcaps.xyz/api/*` (backend).
- No build command — pure static files, no compilation needed.

### Backend (Render)
- `render.yaml` configures the Render web service.
- Root dir: `backend/`, build: `npm install`, start: `node server.js`.
- Health check: `GET /api/health`.
- API available at `https://api.atomicfizzcaps.xyz`.

### CI/CD (GitHub Actions)
- **Manual Vercel deploy**: `.github/workflows/` — deploys to Vercel on demand.
- **API smoke test**: Runs on push to `main`, checks `GET /api/health`.

---

## Environment Variables (Key Ones)

See `.env.example` for the full list. Never commit `.env` files.

| Variable | Purpose |
|----------|---------|
| `PORT` | Backend port (default: 3000) |
| `NODE_ENV` | `development` or `production` |
| `REDIS_URL` | Redis connection (must start with `redis://` or `rediss://`) |
| `ADMIN_USERNAME` | Admin panel username |
| `ADMIN_PASSWORD` | Admin panel password (timing-safe comparison) |
| `ADMIN_WALLETS` | Comma-separated admin wallet addresses |
| `HF_API_KEY` | Hugging Face API key for Overseer AI |
| `HF_MODEL` | HF model (default: `mistralai/Mixtral-8x7B-Instruct-v0.1`) |
| `HELIUS_API_KEY` | Helius API key (optional, for NFT features) |
| `FRONTEND_ORIGIN` | Allowed CORS origins (comma-separated) |
| `GAME_VAULT_SECRET` | Base58 secret for game HMAC signing |
| `GPS_SECRET` | Base58 secret for GPS claim signing |
| `VOUCHER_SECRET` | Base58 secret for loot vouchers |
| `XP_SECRET` | Base58 secret for XP signing |
| `COOLDOWN_SECONDS` | Default cooldown (seconds) between claims |
| `GPS_DISTANCE_LIMIT` | Max distance (meters) for GPS claim |

---

## Things to Watch Out For

- **Redis URL format**: Must use `redis://` or `rediss://` protocol. The server
  rejects HTTP/HTTPS URLs for Redis (common misconfiguration).
- **No build step for frontend**: `public/` is served as-is by Vercel. Do not
  introduce a build process without updating `vercel.json`.
- **CommonJS only in backend**: Adding `import` statements will break the server.
- **Wallet verification is required**: Skipping signature verification on
  player-mutating routes is a security vulnerability.
- **Admin password comparison**: Must use `crypto.timingSafeEqual` — never
  use `===` for password comparisons.
- **Overseer AI fallback**: If `HF_API_KEY` is not set, the Overseer uses
  pre-programmed fallback responses (still functional).
- **Redis prefix**: Always use `afw:` prefix for Redis keys to avoid namespace
  collisions.
- **CORS wildcard**: The CORS wildcard matching for `*.vercel.app` only allows
  valid hostname characters (alphanumeric + hyphens). This is intentional
  (security fix).
