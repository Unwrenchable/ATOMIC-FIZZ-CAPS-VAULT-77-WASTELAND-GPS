# Claim loot voucher v1 — pause, rotate, verify

Do not deploy this program until security signs off. This document is the runbook. It does not send transactions.

This repository (`ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS`) is the proposed canonical home of `fizzcaps_onchain`.

## Duplicate copies (do not patch from here)

These trees were not modified. Archiving them needs Travis's OK.

| Repo | Program id | Problem |
| --- | --- | --- |
| `atomicfizzcaps` | `DXxzKfZh6aJCff7sEusMU1E9w4ZDwgJkYGgKStRRGRyP` | Duplicate source. Parser reads the signature offset as the pubkey offset. No replay account. No player binding. |
| `GPS-main` | same `DXxz…` id | Same duplicate. |
| test repo | `GDGex…` (full id not recorded here; do not invent it) | Variant build. Treat as untrusted until Travis identifies the tree. |

`declare_id!` in this repo must keep matching `Anchor.toml`. `node scripts/check-cluster-ids.js` is the CI check. Do not run `anchor keys sync`; it rewrites the id.

## Ids

| Cluster | Program id | Feature |
| --- | --- | --- |
| devnet | `GvTeKyGiFqtpJn2cJQxFb2iPVCYotvnMjMZKGAnPgZkc` | `--features devnet` |
| localnet | `HnWTnCKuKhJa6cXj4ZocW2D8Jtf4f5QFb6f6UnkF27FB` | `--features localnet` |
| mainnet | `DXxzKfZh6aJCff7sEusMU1E9w4ZDwgJkYGgKStRRGRyP` | `--features mainnet` |

Exactly one cluster feature. There is no default. `compile_error!` fires if zero or more than one is set.

## Keys

One Ed25519 key per cluster. Env names:

- `SERVER_SECRET_KEY_DEVNET` / `SERVER_SECRET_KEY_LOCALNET` / `SERVER_SECRET_KEY_MAINNET`
- `KMS_SIGNING_KEY_ID_DEVNET` / `KMS_SIGNING_KEY_ID_LOCALNET` / `KMS_SIGNING_KEY_ID_MAINNET`

Legacy unsuffixed `SERVER_SECRET_KEY` and `KMS_SIGNING_KEY_ID` are ignored for v1. The process refuses to boot if two clusters share a secret or KMS id. `KMS_SIGNING_ALGORITHM` must be `ED25519_SHA_512` when KMS is used. Voucher TTL is 300 seconds (`VOUCHER_TTL_SECONDS` is capped there). Voucher ids are 16 bytes from `crypto.randomBytes`.

Print the pubkey that must be stored on-chain (no transaction is sent):

```bash
SOLANA_CLUSTER=devnet \
FIZZCAPS_PROGRAM_ID=GvTeKyGiFqtpJn2cJQxFb2iPVCYotvnMjMZKGAnPgZkc \
SERVER_SECRET_KEY_DEVNET='<base58 64-byte secret>' \
node backend/scripts/print-server-pubkey.js
```

## Init

`fizz_init` loads the program account and its `ProgramData`. The signer must be the upgrade authority recorded there. That signer becomes `config.authority` and is the only key that can pause or rotate. On mainnet, transfer the upgrade authority to the multisig before announcing the program, then init (or rotate) so `config.authority` is that multisig.

The upgrade authority also passes an existing SPL mint. `fizz_init` stores that address and rejects the instruction unless `decimals == 9` (`InvalidCapsMint`). This is the caps mint gate: the program does not create a second mint, and a 0-decimal stand-in cannot be installed. Create that mint (9 decimals) before init, then confirm `config.caps_mint` is the mint you created.

`FizzConfig` gained a trailing `paused` byte (`FIZZ_CONFIG_SPACE` = 170). An old config account will not deserialize. Close it and init again. Claims start unpaused.

## Pause, then rotate

1. `fizz_set_paused(true)` as `config.authority`. `claim_loot` then returns `ClaimsPaused`.
2. `fizz_set_server_key(new_pubkey)`. This instruction fails with `MustPauseBeforeRotate` while claims are live.
3. Deploy the new `SERVER_SECRET_KEY_<CLUSTER>` or KMS id and confirm `print-server-pubkey.js` prints `new_pubkey`.
4. `fizz_set_paused(false)`.
5. A voucher signed by the old key fails `WrongVoucherSigner`. In-flight vouchers die with the pause. TTL is 300 seconds, so the pause window is short on purpose.

## Post-deploy checks

Run these after any deploy. Do not treat a deploy as finished until all three match.

```bash
solana program show <PROGRAM_ID> --url <CLUSTER_URL>
```

- Upgrade authority is the expected wallet, and on mainnet that wallet is the multisig.
- `config.authority` equals that upgrade authority. Read the `fizz-config` PDA (`seeds = ["fizz-config"]`).
- `config.server_key` equals `print-server-pubkey.js` for that cluster.
- `config.caps_mint` is the 9-decimal mint supplied at init. `spl-token display <MINT>` shows decimals 9.
- `config.paused` is false only after the backend is signing with that same key.
- `solana program show` program id equals the pinned id in `Anchor.toml` for that cluster.

## Players

Each claim creates two PDAs (`voucher-claim` and `loot-claim`). Budget about 0.0015 SOL of rent for each, plus the mint, metadata, and master-edition accounts. The loot mint is created with mint and freeze authority set to the `loot-mint-auth` PDA. `CreateV1` uses `PrintSupply::Zero` and moves freeze authority to the master edition. The same `loot_id` cannot mint a second NFT. The same `voucher_id` cannot be replayed.

## Claim voucher (SIWS)

`POST /api/claim-voucher/nonce` stores a 32-byte nonce in Redis for 120 seconds. `POST /api/claim-voucher` accepts a signed message and ignores any `wallet` field in the JSON body. The signed text includes the domain `atomicfizzcaps.xyz`, the wallet, the `locations.json` id, the nonce, issued-at, and the player's latitude and longitude. The signature is checked with `nacl.sign.detached.verify`. The nonce is consumed with `GETDEL`. Coordinates and the location hint written into the on-chain voucher come from `frontend/data/locations.json`, and the signed GPS must fall inside that site's `triggerRadius`. A second claim for the same wallet and site inside the cooldown window is rejected by `SET NX EX`. The route also has a per-IP limit.

## CI

The job name `claim-loot-t1` (workflow `.github/workflows/claim-loot-t1.yml`) is the merge gate for Metaplex create order, `PrintSupply::Zero`, and the freeze-authority handoff (loot-mint-auth PDA before `CreateV1`, master edition after). An admin has to mark that check required in branch protection. This change set cannot flip that setting.

`deploy-devnet.yml` is `workflow_dispatch` only, with the `devnet-deploy` environment, and builds `--features devnet`. It does not run on push to main.
