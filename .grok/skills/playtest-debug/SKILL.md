---
name: playtest-debug
description: >
  Run playtests, load/soak/security tests, visual checks, or debug failures from the test suite
  and playtest agent. Includes using the test playtest agent, inspecting screenshots, logs,
  fixing map/quest/inventory/claiming bugs, and the full "run test → analyze → fix → retest"
  loop. Use when user says "playtest", "the claiming is broken", "fix the radio", "security issue".
metadata:
  short-description: "Playtest, load test, security test, and debug the wasteland experience"
---

# Playtest & Debug Skill for Wasteland GPS

The game has rich automated playtesting and visual regression because it's a real-world GPS + blockchain + AI experience that must feel solid in the wasteland.

## Key Test Commands
```bash
npm test                       # security.test.js baseline
npm run test:playtest          # node tests/playtest-agent.cjs (the main autonomous tester)
npm run test:load
npm run test:load:full         # heavy concurrent
npm run test:load -- --players 1000 ...
# Visual / map / specific
node tests/visual-playtest.js
# Endpoint smoke
./test-all-endpoints.sh
```

Screenshots and artifacts land in `tests/screenshots/`.

There are also legacy HTML test pages in `legacy/` and `frontend/` for manual radio, inventory, map, character creator, etc.

## Debugging Loop
1. Reproduce: run the relevant test or playtest agent with focused scenario (e.g. claim flow, battle V.A.T.S., radio overlap, wallet auth, Overseer chat).
2. Gather evidence:
   - Console output from the test.
   - `tests/screenshots/*.png` (use image tools or describe).
   - Live state via `use-vault77-mcp` tools (players, locations, quests at the moment of failure).
   - Backend logs (if running `npm run dev`).
   - Relevant code: `frontend/js/modules/worldmap.js`, `poi-markers.js`, `backend/api/*.js`, `backend/lib/`, `systems/quest-*.js`, `server/lootRoller.js` etc.
3. Hypothesize root cause (race, auth, geofence math, Solana timing, RealAI prompt drift, Redis script, etc.).
4. Fix with `search_replace`.
5. Re-run the exact test + broader playtest.
6. If visual, compare before/after screenshots (perhaps use `imagine` or just describe diffs).
7. Update the corresponding `docs/development/*_FIXES.md` or `TESTING_GUIDE.md` style doc.
8. If it touches player economy or claims, run security + load smoke.

## Common Hotspots (from history)
- Map / POI / Leaflet icon fallbacks, fog of war, explore button state.
- Audio overlap (radio, encounter sounds).
- Inventory persistence across sessions / claims.
- Quest state machines, end conditions, secret/ending branches.
- Wallet signature + KMS vs local signing.
- Mint worker streams, claim cooldowns, geofence edge cases.
- Overseer / NPC dialogue context leaking or going stale.
- Solana devnet flakiness vs mainnet.

## When Involving AI Content
- If a playtest reveals bad NPC dialogue or quest text, treat it as a content-gen task: use `wasteland-content-gen` + RealAI provider tuning.
- Update prompt templates / lore in `backend/data/` or the RealAI character/quest generators.

## For Security / Exploit Sims
Always re-run the full security test after changes to auth, economy, claiming, minting, or admin routes.

Use `todo_write` with explicit test cases for complex bugs.
