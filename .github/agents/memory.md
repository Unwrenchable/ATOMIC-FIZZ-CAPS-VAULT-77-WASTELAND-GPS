# FizzSwap — Agent Memory

> **WARNING — NO SECRETS ALLOWED.**
> This file is committed to version control. It must never contain private
> keys, mnemonics, API keys, passwords, RPC endpoints with embedded
> credentials, or any other sensitive values. Use `.env` files for secrets.

All additions must be reviewed in a pull request before merging to `main`.

---

## Template sections

Use the sections below as a starting point. Add entries in reverse-chronological
order (newest first) within each section.

---

## Toolchain decisions

<!-- Record why specific tools/versions were chosen or pinned. -->

- Hardhat pinned to `2.17.4` to match the `@nomicfoundation/hardhat-toolbox`
  `3.0.0` peer dependency range.
- Solidity `^0.8.20` chosen for built-in overflow checks and `PUSH0` opcode
  support on mainnet.
- Vite 5 chosen for the web frontend for fast HMR and native ESM support.
- `vite-plugin-node-polyfills` added because `@solana/web3.js` and `ethers`
  depend on Node built-ins (Buffer, crypto) that are absent in the browser.

---

## Commands that worked

<!-- Copy-paste the exact command and note the date / context. -->

| Date | Command | Notes |
|------|---------|-------|
| — | `npm run compile-contracts` | Compiles all Solidity contracts via Hardhat |
| — | `npm run test` | Runs Hardhat/Mocha test suite |
| — | `npm run build` | Compiles root TypeScript |
| — | `cd relayer && npm run build` | Compiles relayer TypeScript |
| — | `cd web && npm run build` | Produces `web/dist/` via Vite |
| — | `npm run build-solana` | Requires Rust + BPF toolchain installed |

---

## Architecture notes

<!-- High-level decisions that affect multiple files. -->

- Universal chain adapter pattern: every chain integration implements the
  `IChainAdapter` interface in `src/chain-adapter.ts`.
- Relayer is a standalone Express service (`relayer/src/index.ts`); it bridges
  EVM and Solana swap events.
- Web UI is intentionally a single-component app (`web/src/App.tsx`) for
  simplicity; no component splitting or custom hooks at this time.
- Vercel hosts the frontend; `vercel.json` at the repo root configures the
  build and SPA rewrites.

---

## Gotchas

<!-- Things that tripped up a developer or AI assistant. -->

- `relayer-mappings.json` is generated at runtime and is git-ignored. Run
  `npm run relayer:init-mappings` before starting the relayer for the first
  time.
- The large-chunk Vite warning (>500 KB) is expected and benign.
- `minOut = 0` in swap logic means slippage is not enforced on-chain; do not
  assume the UI's fee/slippage display has any on-chain effect.
- Solana program source lives under `programs/fizzdex-solana/` (not `contracts/solana/`).
  `cargo build-bpf` targets `programs/fizzdex-solana/Cargo.toml`.

---

_Add new entries above the relevant section. Keep entries concise._
