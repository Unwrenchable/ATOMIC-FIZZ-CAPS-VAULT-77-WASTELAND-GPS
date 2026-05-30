# Render Minting Environment Setup

This runbook provisions the minimum environment required for on-chain NFT minting.

## Services

Set these variables on both Render services:
- `atomic-fizz-caps-api` (web)
- `atomic-fizz-caps-mint-worker` (worker)

## Required Variables

- `NODE_ENV=production`
- `SOLANA_NETWORK=mainnet-beta`
- `SOLANA_RPC=<your mainnet RPC endpoint>`
- `SERVER_SECRET_KEY=<base58 64-byte ed25519 secret>`
- `ADMIN_MINT_SECRET=<strong random secret>`
- `CAPS_MINT=<mainnet SPL token mint>`
- `TOKEN_MINT=<same as CAPS_MINT unless split>`
- `TREASURY_WALLET=<mainnet treasury pubkey>`
- `METAPLEX_COLLECTION_ADDRESS=<collection mint, optional but recommended>`
- `HELIUS_API_KEY=<helius key for player NFT reads>`

Optional IPFS metadata upload providers (set one):
- `NFT_STORAGE_API_KEY=<token>`
- `PINATA_JWT=<jwt>`

## Generate Mint Signer Secret

Run locally once and store output securely:

```bash
node -e "const nacl=require('tweetnacl');const bs58=require('bs58');const kp=nacl.sign.keyPair();console.log(bs58.encode(Buffer.from(kp.secretKey)));"
```

Use the resulting base58 string as `SERVER_SECRET_KEY`.

## Verification Checklist

1. Restart both services after env updates.
2. Call `POST /api/mint-item` as an authenticated player.
3. Poll `GET /api/mint-item/status/:jobId` until `status` becomes `minted`.
4. Confirm `mintAddress`, `signature`, and `metadataUri` are present.
5. Check `/api/player-nfts` for the minted asset after indexer delay.

## Notes

- If no IPFS provider env var is set, metadata falls back to the API-hosted metadata endpoint.
- Keep `SERVER_SECRET_KEY` and `ADMIN_MINT_SECRET` only in Render secret env vars (never in git).
