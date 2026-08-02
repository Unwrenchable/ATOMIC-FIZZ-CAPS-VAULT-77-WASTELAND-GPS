---
name: solana-dev
description: >
  Develop, build, test, and deploy the on-chain programs (Anchor + Rust) for Fizz Caps,
  player NFTs, rewards, minting, claims, etc. Covers the Cargo workspace, programs/fizzcaps_onchain/,
  atomic_fizz_players/, workers that interact with chain, KMS signing, and using the solana MCP.
  Use for "add a new program instruction", "debug a failed mint", "update Anchor IDL", "deploy to devnet".
metadata:
  short-description: "Solana / Anchor / Rust on-chain development for Atomic Fizz Caps"
---

# Solana On-Chain Development for Wasteland Economy

The glowing caps and many core economy actions live on Solana.

## Layout
- `programs/fizzcaps_onchain/` — main Anchor workspace member (Rust).
- `atomic_fizz_players/` — another Cargo crate (player data?).
- Root `Cargo.toml` defines the workspace.
- Interaction from backend: `backend/solana/`, `backend/lib/solana-rewards.js`, `backend/lib/nft-minting.js`, KMS signer, workers/mint_worker*.js.
- Config: `Anchor.toml`.

## Typical Flow
1. Make Rust changes in the program(s).
2. `anchor build` (or cargo build inside the program dir).
3. Update IDL / types if needed for TS/JS callers.
4. Test on devnet (scripts like `scripts/devnet-smoke.js`, `scripts/send-0.01-sol.js`).
5. Use the `solana` MCP (configured in this repo's .grok/config.toml) to inspect accounts, program state, recent transactions without leaving the AI session.
6. Backend changes to call the new instruction or handle new events.
7. Update mint/claim/reward workers and any admin scripts.
8. Full test: security + playtest + on-chain smoke.

## Commands
```bash
# From repo root or program dir
anchor build
anchor deploy --provider.cluster devnet
# Or direct cargo
cargo build -p fizzcaps_onchain

# Example smoke / funding scripts
node scripts/send-0.01-sol.js
node scripts/devnet-smoke.js

# Mint worker (stream)
npm run worker:mint
```

See `install_solana.sh`, docs/deployment/TESTNET_*, and the various `scripts/realai/` or `scripts/` that touch chain.

## MCP Synergy
Use `search_tool` for "solana" then `use_tool` with the qualified names to:
- Read program accounts for a player wallet.
- Check recent reward or mint txs.
- Verify PDA derivations or token balances during debugging.

This is often faster and more accurate than running `solana` CLI by hand inside the agent.

## Safety
- Never hardcode private keys. Use the KMS path or local signer only for dev.
- Devnet vs mainnet: be explicit in scripts and docs.
- After program changes that affect accounts, you may need migration or data reset stories for test players.

Coordinate with backend/lib changes and any frontend wallet UI updates (frontend/wallet/).
