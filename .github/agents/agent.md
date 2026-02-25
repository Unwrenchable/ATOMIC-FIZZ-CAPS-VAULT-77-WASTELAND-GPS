# FizzSwap — Agent Guidance

Use this file to orient yourself before suggesting changes to FizzSwap.

## Project overview

FizzSwap (`fizzdex`) is a multi-chain DEX that supports atomic swaps across
EVM-compatible chains, Solana, and XRP. It is the official DEX for the
ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS ecosystem.

## Repository layout

```
/                        # Root: Hardhat + TypeScript (EVM contracts & tests)
├── contracts/           # Solidity contracts (EVM)
├── programs/            # Anchor program workspace
│   └── fizzdex-solana/  # Rust/Anchor Solana program (Cargo.toml here)
├── scripts/             # Hardhat deploy scripts (deploy-evm.ts, etc.)
├── src/                 # TypeScript utilities / chain adapters
├── test/                # Hardhat/Mocha test files
├── relayer/             # Standalone Node.js relayer service
│   └── src/             # TypeScript source for relayer
└── web/                 # Vite + React frontend
    └── src/             # App.tsx (single-component DEX UI), styles.css
```

## Toolchain

| Layer | Tool |
|-------|------|
| EVM contracts | Solidity 0.8.20+, Hardhat 2.17, OpenZeppelin 5 |
| TypeScript compilation | `tsc` (root), `tsc -p tsconfig.json` (relayer) |
| Contract testing | Hardhat + Mocha + Chai |
| Linting | ESLint with `@typescript-eslint` |
| Frontend build | Vite 5 + React 18 |
| Solana program | Rust + `cargo build-bpf` |
| Containerisation | Docker + docker-compose |

## Root `package.json` scripts

```
build              tsc
test               hardhat test
lint               eslint . --ext .ts,.js
compile-contracts  hardhat compile
deploy-evm         hardhat run scripts/deploy-evm.ts
build-solana       cargo build-bpf --manifest-path=programs/fizzdex-solana/Cargo.toml
relayer:init-mappings  node relayer/init-mappings.js
```

## Relayer scripts (`relayer/package.json`)

```
start        ts-node src/index.ts
build        tsc -p tsconfig.json
start:prod   node dist/index.js
```

## Web scripts (`web/package.json`)

```
dev      vite
build    vite build
preview  vite preview
```

## Key conventions

- **Security**: All state-changing Solidity functions use reentrancy guards;
  Solidity 0.8.20+ for overflow protection. See `SECURITY.md`.
- **Chain adapter pattern**: `src/chain-adapter.ts` exports an `IChainAdapter`
  interface that every chain integration must implement.
- **Frontend env vars**: Vite convention — prefix with `VITE_`. Declared in
  `web/src/vite-env.d.ts`. Available vars: `VITE_SOLANA_RPC`,
  `VITE_SOLANA_PROGRAM_ID`, `VITE_RELAYER_URL`. Template: `web/.env.example`.
- **Browser polyfills**: `vite-plugin-node-polyfills` supplies Buffer/process/
  crypto shims. The web UI uses the Web Crypto API (not Node's `crypto`).
- **Single-component UI**: All state and logic lives in `web/src/App.tsx`.
  Four tabs: swap / pool / fizzcaps / bridge.
- **Secrets**: Never committed. Use `.env` files (git-ignored). Templates are
  `.env.example` files.

## Things to watch out for

- `minOut` is currently hardcoded to `0` in swap logic — slippage is not
  enforced on-chain even though the UI shows fee/slippage info.
- The web bundle will emit a large-chunk warning (>500 KB) from ethers +
  `@solana/web3.js` — this is expected.
- Vercel deployment is configured via `vercel.json` at the root; build command
  is `cd web && npm install && npm run build`; output dir is `web/dist`.
- `relayer-mappings.json` is git-ignored (generated at runtime by
  `relayer:init-mappings`).
