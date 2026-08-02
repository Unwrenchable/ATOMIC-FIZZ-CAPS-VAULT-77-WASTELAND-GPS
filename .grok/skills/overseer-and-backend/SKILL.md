---
name: overseer-and-backend
description: >
  Add or modify backend API endpoints, Overseer logic, NPC dialogue systems, quest engines,
  encounter/battle/crafting, Redis usage, auth, or any Node/JS server-side feature.
  Includes wiring to RealAI/Grok for intelligence, updating the vault77 MCP server if new
  data needs to be exposed, and testing with the full playtest + endpoint suite.
metadata:
  short-description: "Backend, Overseer, quests, encounters, API features for the wasteland game"
---

# Overseer / Backend Feature Development Skill

Most game intelligence and rules live in or are called from the Node backend.

## Key Areas
- `backend/api/` — individual route modules (overseer-proxy.js, quests.js, npc-*.js, battles, crafting, caps, gps, claims, etc.).
- `backend/lib/` — shared logic (grok.js, quests.js, npc-xai-context.js, locations.js, nft-minting, solana-rewards, cooldowns, etc.).
- `backend/server.js`, `server/`, `systems/` (dialogue-contexts, quest-manager, npc-spawn-manager, player-influence, etc.).
- `backend/realai/` and `lib/realai.js` — client to the sibling RealAI provider.
- MCP server: `mcp/vault77-server.js` — expose new queries here when you want live data tools for AI assistants.

## Development Pattern
1. **Understand via live data + code**
   - Use `use-vault77-mcp` tools to see current state of the feature you're touching.
   - `grep` and read the relevant api/*.js + lib/*.js + systems/*.js.
2. **For AI-powered features (Overseer, NPC talk, quest gen, narrative)**
   - Prefer calling through RealAI provider (structured, local models, consistent game schemas).
   - See `backend/lib/grok.js`, `backend/lib/npc-xai-context.js`, `api/overseer-proxy.js`, `api/grok/` .
   - Update context builders so the model always has the right wasteland memory + player state.
3. **Add a new endpoint or system**
   - Add file or extend existing in `backend/api/`.
   - Wire in `backend/server.js` or routes.
   - Add to admin or player auth middleware as appropriate.
   - If it should be queryable by AI devs, also extend the vault77-game MCP server.
4. **Persistence / state**
   - Many things go through Redis (see `backend/lib/redis.js`, server/redis_scripts/).
   - Some player state in DB or on-chain.
5. **Test**
   - `./test-all-endpoints.sh`
   - `npm run test:playtest` (the autonomous agent exercises many flows).
   - Specific tests in `tests/` (quests_*.test.js, etc.).
   - Manual in browser against your local backend + realai provider.
6. **Docs**
   - Update the relevant permanent doc + a development summary in `docs/development/`.
   - If Overseer commands changed, `docs/features/OVERSEER_COMMANDS.md`.

## Special for Overseer Bot
- The Overseer is both a player-facing chat and an autonomous game master.
- It uses rich context (player, world, faction, recent events, quests).
- Changes to context or prompting often need coordinated updates in RealAI (if using provider) and the proxy + NPC context libs here.
- Test with real player sessions or the playtest agent talking to it.

## When Changing Data Shapes
- Update any frontend that consumes the API.
- Update MCP server if exposing new fields.
- Update generators and lore JSON.
- Consider migration for existing test/mainnet players.

Coordinate with `wasteland-content-gen` when the feature needs new quests/NPCs/lore, and with `playtest-debug` after the change.
