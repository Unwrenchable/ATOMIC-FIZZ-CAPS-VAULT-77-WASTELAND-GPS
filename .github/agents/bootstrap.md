# ☢️ ATOMIC FIZZ CAPS — Local Bootstrap Guide

Follow these steps to run the Atomic Fizz Caps Vault-77 Wasteland GPS game
locally. Commands run from the **repo root** unless noted otherwise.

> **No secrets in this file.** Copy `.env.example` to `.env` and fill in your
> own values. Never commit `.env` files.

---

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Node.js | 20 LTS | https://nodejs.org or `nvm install 20` |
| npm | 9+ | Bundled with Node 20 |
| Git | any recent | https://git-scm.com |
| Redis | 6+ | https://redis.io or use Upstash cloud |
| Rust + Cargo | stable | https://rustup.rs (Solana program builds only) |
| Solana CLI | 1.18+ | https://docs.solana.com/cli/install (optional) |

---

## 1 — Backend (Node.js/Express API)

The backend is the Express API server at `backend/server.js`.

```bash
# 1. Install dependencies (from repo root)
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your values — NEVER commit this file
# Minimum required for local dev:
#   PORT=3000
#   NODE_ENV=development
#   REDIS_URL=redis://localhost:6379  (or leave blank for in-memory fallback)
#   ADMIN_USERNAME=admin
#   ADMIN_PASSWORD=yourpassword

# 3. Start the development server (auto-reload via nodemon)
npm run dev
# Server starts at http://localhost:3000
# API available at http://localhost:3000/api/

# 4. Start the production server (no auto-reload)
npm start
# Server starts at http://localhost:3000
```

### Health Check
```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok", ...}
```

### Environment Variables
See `.env.example` for the full list. Key variables:

```bash
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379        # redis:// or rediss:// protocol ONLY
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
HF_API_KEY=your_huggingface_api_key    # Optional — Overseer AI
HF_MODEL=mistralai/Mixtral-8x7B-Instruct-v0.1
HELIUS_API_KEY=your_helius_key          # Optional — NFT features
GPS_SECRET=your_base58_secret
GAME_VAULT_SECRET=your_base58_secret
VOUCHER_SECRET=your_base58_secret
XP_SECRET=your_base58_secret
FRONTEND_ORIGIN=http://localhost:3000
```

---

## 2 — Frontend (Vanilla HTML/CSS/JS)

The frontend lives in `public/` and requires **no build step**. It is pure
static HTML, CSS, and JavaScript served directly by Vercel in production or
by the Express backend in development.

```bash
# The Express backend serves public/ as static files in development.
# After starting the backend (step 1), open:
open http://localhost:3000
# Pages:
# http://localhost:3000/index.html      Main Pip-Boy map
# http://localhost:3000/overseer.html   Vault 77 Overseer AI terminal
# http://localhost:3000/exchange.html   Scavenger Exchange
# http://localhost:3000/bridge.html     Wormhole bridge
# http://localhost:3000/nuke.html       NUKE system
# http://localhost:3000/admin/          Admin panel (requires credentials)
# http://localhost:3000/wallet/         Wallet management
```

> **No build command needed.** Editing files in `public/` takes effect
> immediately on browser refresh.

---

## 3 — Redis (Database)

```bash
# Option A: Local Redis (install via Homebrew on Mac)
brew install redis
brew services start redis
# Default: redis://localhost:6379

# Option B: Local Redis via Docker
docker run -d -p 6379:6379 redis:7-alpine

# Option C: Skip Redis (in-memory fallback)
# Leave REDIS_URL blank in .env. The backend will use an in-memory store.
# WARNING: Data is lost on server restart. Fine for testing, NOT production.

# Option D: Cloud Redis (Upstash, Redis Cloud, etc.)
# Use the provided rediss:// connection string in REDIS_URL
```

---

## 4 — Linting and Formatting

```bash
# Lint JavaScript
npm run lint

# Format all files with Prettier
npm run format
```

---

## 5 — Solana Program (Optional)

The Anchor/Rust Solana programs live in `programs/`. Building requires Rust
and the Solana BPF toolchain.

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Install Solana CLI and BPF toolchain
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
# Ensure solana is on your PATH

# Build (from repo root)
cargo build-bpf --manifest-path=programs/<program-name>/Cargo.toml
```

---

## 6 — Workers (Optional)

Background workers for NFT minting live in `workers/`.

```bash
# Run the mint worker
node workers/mint_worker.js

# Run the streaming mint worker
node workers/mint_worker_stream.js
```

---

## Quick-Reference Cheat Sheet

```bash
npm run dev             # Backend dev server (http://localhost:3000)
npm start               # Backend production server
npm run lint            # ESLint
npm run format          # Prettier

# Open frontend pages (backend must be running)
# http://localhost:3000                  Main map
# http://localhost:3000/overseer.html    Overseer AI
# http://localhost:3000/admin/           Admin panel

# Health check
curl http://localhost:3000/api/health | jq .

# Redis CLI (if running locally)
redis-cli ping          # Should return: PONG
redis-cli keys "afw:*"  # List all game keys
```

---

## Common Gotchas

| Problem | Solution |
|---------|---------|
| `REDIS_URL` rejected on start | Must use `redis://` or `rediss://` protocol |
| Frontend changes not visible | Hard refresh (Ctrl+Shift+R / Cmd+Shift+R) |
| Wallet sign fails | Ensure Phantom is on Solana mainnet/devnet |
| Overseer AI not responding | Set `HF_API_KEY` in `.env`, or use fallback mode |
| Admin login fails | Check `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env` |
| CORS error in browser | Add your local URL to `FRONTEND_ORIGIN` in `.env` |
| Port 3000 in use | Change `PORT` in `.env` or stop the conflicting process |
