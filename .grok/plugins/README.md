# Local / Project Plugins for Grok

This directory can hold Grok plugins (see `~/.grok/docs/user-guide/09-plugins.md`).

A plugin is a folder containing:
- `skills/` (SKILL.md files — already have project skills at sibling `.grok/skills/`)
- `agents/` (optional custom agent defs)
- `hooks/` + `hooks.json`
- `.mcp.json` (additional MCP servers)
- `.lsp.json`

## Current Use
The high-value project-specific skills live in the sibling `../.grok/skills/` (auto-discovered by cwd/repo priority).

They are:
- wasteland-content-gen
- use-vault77-mcp
- playtest-debug
- solana-dev
- overseer-and-backend
- wasteland-avatars

Plus the root `AGENTS.md` and `.grok/config.toml` (MCP wiring for vault77-game etc.).

## Turning This Into a Shareable Plugin (future)
1. Create e.g. `wasteland-dev/` subdir.
2. Copy or symlink the skills/ into it (or move).
3. Add a `package.json` or just the structure.
4. Register via user `~/.grok/config.toml` [plugins] paths or the marketplace flow.
5. Or use `grok plugins` commands.

For team sharing, commit the plugin dir under `.grok/plugins/my-team-plugin/` and point teammates' global config at the repo path, or publish it.

See also the realai sibling repo's `.grok/plugins/` for parallel structure.
