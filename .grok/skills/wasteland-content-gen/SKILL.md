---
name: wasteland-content-gen
description: >
  Generate or regenerate wasteland content (NPCs, sidequests, world POIs/locations, lore, quests)
  using the canonical pipelines. Prefers RealAI provider (sibling repo) over raw Grok for
  structured game data. Enforces Vault-Tec tone, correct JSON schemas, and integration steps.
  Use for "add 5 new NPCs", "generate more sidequests", "expand the map", "new lore drop".
metadata:
  short-description: "Canonical NPC / world / lore / quest generation for Atomic Fizz"
---

# Wasteland Content Generation Skill (Canonical)

**Always follow the canonical generator workflow.** Do not invent new scripts when the official ones exist.

## Prerequisites
- RealAI provider running in sibling `realai` repo (see realai-local-dev and realai-game-integration skills).
  ```powershell
  # in realai/
  $env:PYTHONPATH="src"; python -m realai.provider
  ```
- In this repo `.env`:
  ```
  REALAI_API_BASE=http://127.0.0.1:8001
  XAI_API_KEY=...   # for Grok fallbacks / image inside RealAI or direct
  ```
- `npm run mcp:install` if using MCP tools for validation.

## Canonical Commands (from repo root)
```bash
# Pure world / sidequest (no AI or lighter)
npm run gen:npcs:sidequest
npm run gen:world
npm run gen:world:integrate

# RealAI-powered (structured, preferred for NPCs, locations, lore)
npm run realai:ping          # verify connection
npm run realai:gen:npcs
npm run realai:gen:locations
npm run realai:gen:lore
```

See `package.json`, `docs/development/CANONICAL_GENERATOR_WORKFLOW.md`, `docs/setup/GROK_SETUP.md`.

## Steps for a Content Task
1. Confirm RealAI provider is healthy and game `.env` points at it.
2. Decide scope (how many, which style: fallout-meme, solana-game, sidequest, etc.).
3. Run the appropriate canonical npm script (or node script under scripts/realai/).
4. Inspect output in `backend/data/`, `frontend/data/`, or wherever the generator writes.
5. Run integration / world integrate steps.
6. Validate with game tools:
   - Use `vault77-game` MCP tools (search_tool "vault77") to query live or the new data.
   - Run `npm run test:playtest` or specific quest tests.
   - Manual: load the map, claim a new POI, talk to new NPC via Overseer.
7. If tone or schema is off, fix the prompt/templates in the generator script + RealAI side if the model behavior needs tuning.
8. Commit the generated data + any script/prompt changes. Update lore docs.

## Avatar / Visual Pipeline
See `GROK_AVATAR_GUIDE.md`, `AVATAR_GENERATION_WORKFLOW.md`, `AI_AVATAR_GENERATION_GUIDE.md`, `validate-avatars.sh`, `integrate-avatars.sh`.
Often still uses direct Grok Imagine + HF + post-processing scripts.
Coordinate with `realai-game-integration` when portraits/personas should come through RealAI `/v1/characters`.

## Tone Rules (non-negotiable)
- Every line of NPC dialogue, quest text, item description, Overseer reply must sound like a Vault-Tec press release written by a deranged marketing AI in 2077.
- Radiation is a feature. Death is user error. Capitalism will save the wasteland.
- Update `backend/data/lore-saitama*.json` and similar when adding deep lore.

## After Generation
- Run relevant tests.
- If this changes what players see, consider a playtest agent run.
- Update `STATUS.md` or a `docs/development/*_SUMMARY.md` if it's a big content drop.
- Sync any schema changes back to RealAI (provider output expectations).

Use `todo_write` to track batches of 10+ NPCs or multi-stage world gen.
