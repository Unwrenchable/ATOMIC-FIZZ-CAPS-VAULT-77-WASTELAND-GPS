---
applyTo: "programs/**,workers/**,solana/**,scripts/**"
---

# Solana / Web3 Standards — Vault-77 / Atomic Fizz Caps

## Packages
- `@solana/web3.js`, `@solana/spl-token`, `tweetnacl`, `bs58` — already in `package.json`.
- Anchor programs in `programs/` (Rust); follow existing `Anchor.toml` / `Cargo.toml`.

## Token Model
- **CAPS** = canonical currency name. On-chain: CAPS SPL token (AFC Token, fixed supply, `CAPS_MINT` env var).
- In-game CAPS: Redis integer on player profile — redeemable for real CAPS from `TREASURY_WALLET`.
- `priceCAPS` not `priceFizz`. "FIZZ" = brand name only.

## Auth
- All wallet-mutating backend routes call `walletVerify.verifySignature()` (tweetnacl + bs58).
- Never mutate player state without a verified Solana signature.
- Wallet sourced from `req.player.wallet` — never `req.body.wallet`.

## RPC Failures
- Frontend wallet operations degrade gracefully — show error banner, preserve local state.
- Surface clear Pip-Boy UI error on RPC failure; no silent failures.

## GPS Claims
- Claims require HMAC-signed GPS tokens (`GPS_SECRET` env var).
- Invalid token → `403` with Fallout-flavoured message; do not write to Redis.

## FizzFun (Token Launchpad)
- Lives at `backend/api/fizz-fun.js` + `public/fizz-fun.html`.
- Fees to `TREASURY_WALLET`. Bonding curve graduates to Raydium at 85 SOL.
- Keep in this repo (shares auth, Redis, player profiles).
