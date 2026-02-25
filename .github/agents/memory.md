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

_Add new entries above the relevant section. Keep entries concise._
_This file is version-controlled — never add secrets or credentials._
