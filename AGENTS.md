# ATOMIC FIZZ CAPS - VAULT 77 WASTELAND GPS
## Project Rules for AI Assistants (Grok, Copilot, Claude, etc.)

**THIS IS THE CANONICAL SOURCE OF TRUTH FOR WORK IN THIS REPO.**  
Higher priority than generic advice or other agent context files.

---

## The Pitch (memorize the voice)
Post-nuclear capitalism meets real GPS scavenging. Survivors walk the Mojave (or your local irradiated equivalent), claim real-world POIs for glowing Atomic Fizz Caps (FIZZ token on Solana), battle mutants, craft, level up, and chat with the **Overseer AI**. Everything is dripping with Vault-Tec corporate doublespeak, dark humor, radiation puns, and "the future of yesterday."

Tone for all generated content (NPC dialogue, lore, quest text, Overseer responses, commit messages that touch game text):
- Bureaucratic, upbeat, slightly menacing corporate voice.
- Heavy use of ☢️ , "citizen", "shareholder", "Vault-Tec is not responsible for...", "mild radiation poisoning as a feature".
- Fallout + meme + Solana degen energy.

---

## Architecture Overview (2026)
- **Frontend**: Mostly vanilla JS + Leaflet (custom Fallout map, fog of war, POI claiming, radio, V.A.T.S. battles, inventory, wallet). `frontend/` (or public/? see tree). Static-ish but served, with service worker.
- **Backend**: Node.js (ESM), Express-style in `backend/server.js`, heavy route modules in `backend/api/`, business logic in `backend/lib/`, `systems/`, `server/`.
  - Real-time elements, Redis for some state/scripts, KMS signing, Solana rewards/minting.
  - AI layer: Overseer, NPC dialogue, narrative, quests via **RealAI provider** (sibling repo) + direct Grok fallbacks.
- **On-chain**: Solana (Anchor). Workspace in `programs/fizzcaps_onchain/`. Rust programs for caps, minting, perhaps claims/NFTs. Separate `atomic_fizz_players/` crate.
- **MCP**: `.mcp.json` defines `vault77-game` (live data over your backend API), github, scoped filesystem, redis, solana, render, vercel, cloudflare. **Extremely powerful for AI-assisted dev** — use the live game state tools.
- **Generation**: Canonical content pipelines (NPCs, world, lore, avatars, sidequests). See `CANONICAL_GENERATOR_WORKFLOW.md` and `docs/development/`.
- **RealAI integration** (sibling `realai` repo at `../realai` or wherever): Run `python -m realai.provider` there, point game via `REALAI_API_BASE`. Prefer this over raw Grok calls for structured game data.
- **Docs**: Exhaustive in `docs/`. Start with `DOCS_INDEX.md`, `STATUS.md`, `docs/development/QUICK_REFERENCE.md`, `docs/setup/GROK_SETUP.md`.
- **Tests**: `tests/` (playtest-agent, security, load, quests, visual, etc.). `npm test*`.

**Cross-repo note**: This repo + `realai` are developed together. Use the multi-root workspace or switch dirs often. Skills in each `.grok/skills/` are auto-loaded based on cwd.

---

## Canonical Commands (run from this repo root)
```bash
# Content (prefer these)
npm run gen:npcs:sidequest
npm run gen:world
npm run gen:world:integrate

# RealAI-powered (requires sibling RealAI provider running on 8001)
npm run realai:ping
npm run realai:gen:npcs
npm run realai:gen:locations
npm run realai:gen:lore

# Dev / test
npm run dev                 # nodemon backend
npm start
npm run mcp:install
npm run lint && npm run format
npm test
npm run test:playtest
npm run test:load:full

# Solana / onchain
# (Anchor, cargo in programs/ and atomic_fizz_players/)
anchor build
# deploy to devnet etc. (see docs/deployment/)

# Avatars / Grok direct (see GROK_AVATAR_GUIDE.md etc.)
node grok-avatars.js ...
node scripts/enhance-avatar-assets.js
```

See `package.json` scripts, `docs/development/CANONICAL_GENERATOR_WORKFLOW.md`, `docs/setup/GROK_SETUP.md`.

**Always** set the right `.env` (copy `.env.example`):
- `XAI_API_KEY` (for Grok direct + inside RealAI)
- `REALAI_API_BASE=http://127.0.0.1:8001`
- `VAULT77_API_KEY` (admin for privileged MCP / tools)
- Solana RPC, Redis, KMS, Render/Vercel tokens as needed.

---

## Development Rules
1. **Content generation**: Use the canonical RealAI scripts first. Only fall back to raw Grok or HF when the provider doesn't support the style yet. Update both repos when schemas change.
2. **Tone & Lore**: All player-facing text, NPC lines, quest descriptions, Overseer replies, item flavor must pass the "Vault-Tec press release" filter. Use the extended lore in `backend/data/lore-*.json`.
3. **MCP superpower**: When an AI (Grok included) is working here, prefer calling the `vault77-game` MCP tools (via search_tool / use_tool) to inspect live players, locations, quests, worldstate instead of guessing from static files. Same for solana MCP for on-chain state.
4. **RealAI first for game AI**: Route Overseer, character gen, quest gen, narrative through the sibling RealAI provider. Keep direct Grok calls for image/video/creative where the structured provider doesn't fit.
5. **Backend changes**: Add routes in `backend/api/`, logic in `backend/lib/` or `systems/`. Update OpenAPI-ish if present. Test with `test-all-endpoints.sh` or the playtest agent.
6. **Frontend**: Leaflet + vanilla + some modules in `frontend/js/`. Keep it lightweight; no heavy framework unless justified. Test on mobile-ish (wrist UI fantasy).
7. **On-chain (Rust/Solana)**: Follow existing Anchor/Cargo workspace. Test on devnet. Use the solana MCP.
8. **Secrets**: Never commit. `.env`, session.txt, keys in KMS or env. `.gitignore` covers them.
9. **Tests & Playtests**: Run security + playtest agents after behavior changes. Visual regression for map/avatars if assets touched.
10. **Docs**: Update the relevant `docs/development/*.md` (they are iteration logs) + permanent docs (SETUP, FEATURES, DEPLOYMENT). Update STATUS.md for big changes.

## Cross-Repo Workflow (RealAI + this)
- Keep both checkouts.
- In realai: start provider.
- In this repo: run gens, test integration.
- When editing agent behavior here, consider whether the change belongs in RealAI core (agents, memory, safety, providers) so other consumers benefit.
- Use the `realai-game-integration` skill (from realai) + game skills here in the same session when possible.

## Git / Contribution
- Commit messages in character when they touch lore/content.
- Large gen runs or playtests → summary PRs or docs/ updates.
- MCP / Grok / RealAI setup changes → update `docs/MCP_SETUP.md`, `GROK_SETUP.md`, this AGENTS.md.
- Human review for any automated memory or high-impact lore.

## When Using Grok Here
- Cwd in this folder → these rules + `.grok/skills/*` (wasteland-*, overseer, solana, mcp-game-data, playtest-debug, etc.) are injected.
- Use `search_tool` + `use_tool` for the vault77-game, solana, etc. MCPs (configured in `.grok/config.toml`).
- Spawn subagents for parallel gen + review (best-of-n style).
- For visual/asset work, the `imagine` skill or direct image tools.
- Always verify with actual game endpoints or MCP live data, not just static JSON.

Update this file (and the game docs) when canonical commands, tone, or architecture shift.
