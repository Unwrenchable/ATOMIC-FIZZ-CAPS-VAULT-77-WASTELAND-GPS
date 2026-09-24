# Unique gold vs twins — Atomic Fizz Caps

Date: 2026-09-24  
Same method as RealAI unique-gold: content SHA decides uniqueness, path decides the winner.

## What is broken

Three public trees exist for the same game:

| Repo | Default SHA / last push | Role |
|---|---|---|
| `Unwrenchable/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS` | `3468b582` (pushed 2026-09-24) | **canonical** |
| `Unwrenchable/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS-main` | stale May–Sep fork | twin checkout |
| `Unwrenchable/atomicfizzcaps` | last push 2026-05-14 | older name, do not keep writing here |

Local checkout the hygiene pass targets:

`C:\Users\tsmit\ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS`

GitHub `main` currently has **0 gitlinks** (mode 160000) and **2150** tracked objects. Nested repos are a **local** problem: extra `.git` folders under frontend/backend/scripts/realai clones. Those become gitlinks on the next sloppy add, which is how unique code vanished on RealAI.

Branch `nested` on this repo is a pointer at the same commit as `main`. It is a bookmark, not a second tree.

RealAI also holds `recovery/atomicfizzcaps-fork/2026-08-01/HOMEPC/f1a9c2` — a snapshot of this game inside the AI monorepo. Do not copy that tree back in. Game talks to RealAI over HTTP (`REALAI_API_BASE`).

## Rules (copied from the RealAI pass)

1. SHA uniqueness first. Same bytes = twin. Keep one path.
2. Canonical prefix wins when SHAs differ:
   - API: `backend/api/`
   - shared logic: `backend/lib/`
   - client modules: `frontend/js/modules/`
   - on-chain: `programs/fizzcaps_onchain/`
   - RealAI HTTP + gens: `backend/realai-client/` and `scripts/realai/`
3. Tiny files (<400 bytes) are stubs, not gold. Recover from the larger unique sibling or leave marked stub.
4. Never vendor `C:\realai` / RealAI organs / scanners into this repo.
5. Never force-push `main`.

## Empty / stub on current `main`

| Path | Bytes | Action |
|---|---|---|
| `battle.js` | 0 | delete or replace from `frontend/js` battle module |
| `install_solana.sh` | 0 | delete or restore from docs |
| `repo-tree.txt` | 0 | generated — keep gitignored |
| `scripts/apply-fixes.js` | 0 | delete or restore |
| `backend/solana/test` | 0 | drop |
| `backend/realai/realai-client.js` | 250 | **not gold** — use `scripts/realai/realai-client.js` (5159) or `backend/realai-client/` |
| `backend/realai/quest-generator.js` | 300 | **not gold** — use `scripts/realai/quest-generator.js` (7891) |
| `backend/realai/generate-npc.js` | 251 | stub |
| `backend/realai/dialogue-engine.js` | 311 | stub |
| `backend/realai/dungeon-generator.js` | 268 | stub |
| `backend/api/worldstate.js` | 258 | **not gold** — use `backend/world/worldstate.js` (3157) |
| `agents/overseer.js` | 310 | **not gold** — use `frontend/js/overseer/overseer.js` |
| `scripts/realai/overseer-brain.js` | 646 | **not gold** — use `frontend/js/overseer/overseer-brain.js` |
| `frontend/vendor/pixi.min.js` | 658 | broken twin of `frontend/js/vendor/pixi.min.js` |

## Same-SHA twins (keep left, shelf right)

- `frontend/data/factions.json` = `frontend/data/factions/factions.json`
- `frontend/data/factions_expanded.json` = `frontend/data/factions/factions_expanded.json`
- `frontend/data/items/items_common.json` = `frontend/data/items_common.json`
- `frontend/data/quest/quest_zion_spirittrail.json` = `frontend/data/npc/quest_zion_spirittrail.json`
- `frontend/data/npc/npc_westside_scrapknight_rowan.json` = same bytes without `.json` suffix

NPC pairs that share a SHA are copy-paste characters, not path twins. Leave until a content pass.

## Unique-SHA collisions (both real — pick a winner)

These are the important ones. Different bytes, same basename.

| Basename | Gold | Twin / older |
|---|---|---|
| `quests.js` | `frontend/js/modules/quests.js` (68k client) + `backend/api/quests.js` (API) | `frontend/js/quests.js`, `backend/lib/quests.js` |
| `narrative.js` | `frontend/js/modules/narrative.js` | `backend/api/narrative.js` (keep as API surface) |
| `nukes.js` | `frontend/js/modules/nukes.js` + `backend/api/nukes.js` | — both live |
| `mutations.js` | same split | — both live |
| `player.js` | `backend/api/player.js` | `server/routes/player.js` (legacy express) |
| `locations.js` | `backend/api/locations.js` | `backend/lib/locations.js` (500 B helper) |
| `loot-voucher.js` | `backend/api/loot-voucher.js` | `backend/lib/loot-voucher.js` |
| `gps.js` | `frontend/js/gps.js` | `backend/lib/gps.js` |
| `wallet.js` | `frontend/wallet/wallet.js` | `backend/routes/wallet.js` |
| `worldstate.js` | `backend/world/worldstate.js` | stub API file |
| `realai-client.js` | `scripts/realai/realai-client.js` / `backend/realai-client/` | stub under `backend/realai/` |
| `lib.rs` | `programs/fizzcaps_onchain/src/lib.rs` | `atomic_fizz_players/src/lib.rs` (separate crate — keep both) |
| `xp.js` | `backend/api/xp.js` | `backend/lib/xp.js` (near-duplicate — diff before merge) |

API + frontend pairs with different SHAs are **not** twins. They are the client/server split. Do not collapse those.

## How to run on HOMEPC

```powershell
cd C:\Users\tsmit\ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS

# 1. See nested .git without touching anything
powershell -ExecutionPolicy Bypass -File .\scripts\flatten_nested_git.ps1

# 2. Flatten (renames nested .git → .git.nested-bak) and stage files
powershell -ExecutionPolicy Bypass -File .\scripts\flatten_nested_git.ps1 -Apply -Readd

# 3. Unique vs twin report
python .\scripts\unique_gold_scan.py --root .

# 4. Review, then commit on a branch. Do not force-push main.
git checkout -b hygiene/unique-gold-local
git status --short
```

After flatten, re-run the scanner. Nested count must be 0 before the next push.

## Out of scope this pass

- Merging the two extra GitHub repos
- Deleting RealAI recovery forks
- Rewriting NPC JSON that shares a SHA
- Vendoring RealAI
