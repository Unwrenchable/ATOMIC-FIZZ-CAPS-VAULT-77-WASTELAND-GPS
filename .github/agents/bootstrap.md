# FizzSwap — Local Bootstrap Guide

Follow the steps for whichever sub-project you want to run. Unless noted
otherwise, all commands are run from the repo root.

> **No secrets in this file.** Copy `.env.example` files to `.env` and fill in
> your own values locally. Never commit `.env` files.

---

## Prerequisites

| Tool | Minimum version | Install hint |
|------|----------------|--------------|
| Node.js | 18 LTS | https://nodejs.org or `nvm install 18` |
| npm | 9+ | Bundled with Node 18 |
| Git | any recent | https://git-scm.com |
| Rust + Cargo | stable | https://rustup.rs (Solana build only) |
| Solana BPF toolchain | 1.18+ | `solana-install init` (Solana build only) |

---

## 1 — Root (Hardhat / TypeScript)

This covers EVM contract compilation, testing, linting, and TypeScript builds.

```bash
# 1. Install dependencies
npm install

# 2. Compile Solidity contracts
npm run compile-contracts
# Output: artifacts/ and typechain-types/

# 3. Run EVM tests
npm run test
# Uses: Hardhat + Mocha + Chai

# 4. Compile TypeScript utilities (src/)
npm run build
# Output: dist/

# 5. Lint TypeScript and JavaScript files
npm run lint

# 6. (Optional) Deploy to a local Hardhat network
#    Start Hardhat node in another terminal:
npx hardhat node
#    Then deploy:
npm run deploy-evm
```

### Environment variables (root)

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
# Edit .env — never commit this file
```

Typical variables (see `.env.example` for the full list):

- `PRIVATE_KEY` — deployer wallet private key (local dev only)
- `RPC_URL` — EVM RPC endpoint

---

## 2 — Relayer (`relayer/`)

The relayer is a standalone Express service that bridges EVM ↔ Solana swap events.

```bash
# 1. Enter the relayer directory
cd relayer

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env 2>/dev/null || echo "Create relayer/.env manually"
# Edit relayer/.env — never commit this file

# 4. Generate the initial chain mappings (required on first run)
#    Run from the repo root:
cd ..
npm run relayer:init-mappings
cd relayer

# 5. Run in development mode (ts-node)
npm run start

# 6. Build for production
npm run build
# Output: relayer/dist/

# 7. Run the compiled output
npm run start:prod
```

The relayer listens on the port defined in `relayer/.env` (default: `4001`).

---

## 3 — Web frontend (`web/`)

The UI is a Vite + React 18 single-page app.

```bash
# 1. Enter the web directory
cd web

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit web/.env — never commit this file
```

Required Vite env vars (declared in `web/src/vite-env.d.ts`):

```
VITE_SOLANA_RPC=        # e.g. https://api.devnet.solana.com
VITE_SOLANA_PROGRAM_ID= # deployed Solana program public key
VITE_RELAYER_URL=       # e.g. http://localhost:3001
```

```bash
# 4. Start the dev server (hot-module replacement)
npm run dev
# Opens at http://localhost:5173 by default

# 5. Production build
npm run build
# Output: web/dist/

# 6. Preview the production build locally
npm run preview
```

> **Note:** The build will emit a large-chunk warning (>500 KB) from
> `ethers` + `@solana/web3.js`. This is expected and does not affect
> functionality.

---

## 4 — Solana program (optional)

The Solana program source lives under `programs/fizzdex-solana/`. Building it requires
Rust and the Solana BPF toolchain.

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Install the Solana CLI and BPF toolchain
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
# Ensure `solana` is on your PATH, then:
solana-install init

# Build the program (from repo root)
npm run build-solana
# Equivalent: cargo build-bpf --manifest-path=programs/fizzdex-solana/Cargo.toml
# Output: target/deploy/*.so
```

---

## Quick-reference cheat sheet

```
npm run compile-contracts   # Solidity → artifacts/
npm run build               # TypeScript (root) → dist/
npm run test                # Hardhat tests
npm run lint                # ESLint
npm run deploy-evm          # Deploy EVM contracts (needs .env)
npm run build-solana        # Rust BPF build (needs toolchain)
npm run relayer:init-mappings

cd relayer && npm start     # Relayer dev server
cd web && npm run dev       # Frontend dev server (port 5173)
cd web && npm run build     # Frontend production build
```
