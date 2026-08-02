# Canonical Generator Workflow

This document defines the single supported content-generation path for this repository so we do not maintain duplicate pipelines.

## Canonical Commands

Run from repository root:

- `npm run gen:npcs:sidequest`
- `npm run gen:world`
- `npm run gen:world:integrate`

## Official RealAI Utility Commands

Requires canonical provider running (`C:\Users\tsmit\realai`):

```powershell
py -3.14 -m realai.provider   # http://127.0.0.1:8001
```

Set `REALAI_API_BASE=http://127.0.0.1:8001` in `.env` (see `.env.example`). Character portraits/personas: `POST /v1/characters` with style `fallout-meme` or `solana-game`, or UI at `http://localhost:3000/characters` when the RealAI frontend is up (use a different port for this game's backend if both run locally).

Run from repository root:

- `npm run realai:ping`
- `npm run realai:gen:locations`
- `npm run realai:gen:npcs`
- `npm run realai:gen:lore`

Validation helper:

- `npm run verify:hf`

## Canonical Files

The canonical generator flow is the top-level script family:

- `generate_sidequest_npcs.js`
- `generate_world.js`
- `integrate_world.js`

## Non-Canonical Scripts

Most `scripts/realai/*` files remain experimental utilities. The promoted exceptions are:

- `scripts/realai/generate-locations.js`
- `scripts/realai/generate-npcs.js`
- `scripts/realai/generate-lore.js`

Those files are wired into `package.json` as the official RealAI utility commands above.

For gameplay code, use the structured RealAI APIs instead of calling `realai(prompt)` directly:

- `scripts/realai/generate-npc.js`
- `scripts/realai/dialogue-engine.js`
- `scripts/realai/quest-generator.js`

## Promotion Rule

Before promoting any experimental script into the canonical path:

1. Add a dedicated npm script in `package.json`.
2. Update this document with the new canonical command.
3. Remove or archive the replaced script path to avoid dual maintenance.
