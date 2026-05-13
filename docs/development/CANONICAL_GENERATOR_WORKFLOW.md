# Canonical Generator Workflow

This document defines the single supported content-generation path for this repository so we do not maintain duplicate pipelines.

## Canonical Commands

Run from repository root:

- `npm run gen:locations`
- `npm run gen:npcs`
- `npm run gen:npcs:sidequest`
- `npm run gen:world`
- `npm run gen:world:integrate`

Validation helper:

- `npm run verify:hf`

## Canonical Files

The canonical generator flow is the top-level script family:

- `generate_locations.js`
- `generate_npcs.js`
- `generate_sidequest_npcs.js`
- `generate_world.js`
- `integrate_world.js`

## Non-Canonical Scripts

`scripts/realai/*` is not part of the release or deployment pipeline. Treat those scripts as experimental utilities unless they are explicitly promoted and wired into package scripts.

## Promotion Rule

Before promoting any experimental script into the canonical path:

1. Add a dedicated npm script in `package.json`.
2. Update this document with the new canonical command.
3. Remove or archive the replaced script path to avoid dual maintenance.
