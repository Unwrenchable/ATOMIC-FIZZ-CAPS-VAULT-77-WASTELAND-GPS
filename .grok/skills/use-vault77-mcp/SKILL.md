---
name: use-vault77-mcp
description: >
  Discover and effectively use the custom vault77-game MCP server (and other configured MCPs)
  while developing the wasteland game. Teaches how to call search_tool then use_tool for live
  player data, locations, quests, leaderboard, worldstate, etc. Essential when the user is
  debugging production issues, adding features that touch game state, or wants the AI to
  "see" the current world instead of guessing from static files.
metadata:
  short-description: "Leverage the live vault77-game + solana + other MCP tools inside Grok"
---

# Use Vault77 Game MCP Tools (and friends)

The `.grok/config.toml` in this repo wires up the same MCP servers defined in `.mcp.json` (plus more) so Grok can use them natively via the `search_tool` and `use_tool` primitives.

## First Time in a Session
1. Call `search_tool` with a query like "vault77" or "game data" or "player locations".
2. The tool will return available tools, namespaced e.g. `vault77-game__list_players`, `vault77-game__get_location`, `vault77-game__claim_poi`, etc.
3. Then call `use_tool` with the exact qualified name and arguments (JSON schema will guide you).

Example flow:
- "Show me the current leaderboard and top players with their caps"
- "What POIs have been claimed near the old nuclear plant?"
- "Is the Overseer bot responding for player X?"

## High-Value Tools (typical)
- Live player state, inventory, claims, cooldowns
- World / location / geofence data
- Quest progress, active encounters
- Economy / caps / minting status
- Config / feature flags
- Leaderboard, factions, reputation

Use these instead of only reading `backend/data/*.json` or `frontend/data/`. The live view is authoritative during dev against a running backend (local or prod via the env vars).

## Other Powerful MCPs Available Here
- `solana__*` — query on-chain accounts, recent txs, program state for fizzcaps programs. Pair with `programs/fizzcaps_onchain/`.
- `filesystem` (scoped) — safe read/write to backend, scripts, docs, mcp, programs.
- `github`, `render`, `vercel`, `redis` — deployment, repo, cache inspection.

## Best Practices
- Always prefer MCP live data when the question involves "current players", "what's deployed", "on chain balances", "recent claims".
- For write actions via MCP (if the server exposes privileged ones), you will need `VAULT77_API_KEY` set and the user should be aware (or use in a controlled test backend).
- Combine with code reading: use MCP to see the symptom, then `grep` / `read_file` to find the root cause in `backend/lib/`, `systems/`, `server/`, workers, etc.
- When adding new backend capabilities, consider also exposing useful read/query tools through the vault77-game MCP server so future AI sessions (and other MCP clients) benefit.

## Troubleshooting MCP
- Server not starting: run `npm run mcp:install` first.
- Auth: set `VAULT77_API_KEY` for admin tools.
- For local dev backend: `VAULT77_API_URL=http://localhost:3000` in env before starting Grok or use the /mcps modal to restart servers.
- Use `grok inspect` (CLI) or the TUI /mcps modal (Ctrl+L) to see loaded status, errors, and exact tool names.

See also game `docs/MCP_SETUP.md`.
