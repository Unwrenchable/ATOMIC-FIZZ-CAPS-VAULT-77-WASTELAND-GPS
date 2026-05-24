# ☢️ MCP Server Setup — Vault-77 Wasteland GPS

Model Context Protocol (MCP) lets AI assistants (GitHub Copilot, Claude
Desktop, Cursor, etc.) connect to live game data and your codebase, making
them dramatically more useful when working on this repo.

---

## What Is MCP?

[MCP](https://modelcontextprotocol.io/) is an open standard by Anthropic that
lets AI assistants securely connect to **external data sources and tools**.
Think of it as a USB-C port for AI: any MCP-compatible host (VS Code, Claude
Desktop, Cursor) plugs into any MCP server.

---

## Servers Configured in This Repo

Several MCP servers are defined in [`.mcp.json`](../.mcp.json) at the repo root:

| Server | What it provides |
|---|---|
| **`vault77-game`** | Live game data: players, locations, items, quests, config, leaderboard |
| **`github`** | GitHub repo: issues, PRs, commits, code search |
| **`filesystem`** | Read-only access to `backend/`, `public/`, `docs/`, `mcp/` |
| **`redis`** | Redis inspection and key/value access |
| **`cloudflare`** | Cloudflare account tooling |
| **`solana`** | Solana RPC / chain tooling |
| **`render`** | Render deployment tooling |
| **`vercel`** | Vercel deployment tooling |

---

## Quick Start

### 1 — Install the custom server dependencies

```bash
npm run mcp:install
# or manually:
cd mcp && npm install
```

### 2 — Set environment variables (optional)

By default the server points at the live production API. For local
development, override with:

```bash
# .env or your shell rc
export VAULT77_API_URL=http://localhost:3000   # local backend
export VAULT77_API_KEY=your-admin-password     # for privileged tools
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx   # for the github MCP server
```

### 3 — Open the repo in VS Code

GitHub Copilot in VS Code automatically reads `.mcp.json` and starts the
configured MCP servers when you open a Copilot Chat (Agent mode). No further
configuration is needed.

### 4 — Claude Desktop (optional)

Add each server block to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vault77-game": {
      "command": "node",
      "args": ["/absolute/path/to/repo/mcp/vault77-server.js"],
      "env": {
        "VAULT77_API_URL": "https://api.atomicfizzcaps.xyz"
      }
    }
  }
}
```

---

## Vault-77 Game Server Tools

The custom `vault77-game` server (`mcp/vault77-server.js`) exposes the
following tools to AI assistants:

| Tool | Description |
|---|---|
| `check_api_health` | Ping the backend API — is it alive? |
| `get_player_profile` | Full player profile by wallet address (caps, XP, level, faction, quests) |
| `get_leaderboard` | Top survivors ranked by caps, XP, or claim count |
| `list_locations` | All Vault-77 POIs (filterable by type) |
| `list_items` | Item definitions (weapons, armor, consumables, ammo…) |
| `get_game_config` | Live game config: claim radius, cooldowns, XP rates |
| `get_quest_definitions` | All quests or a single quest by ID |
| `get_cooldown_status` | Cooldown remaining for a wallet+POI pair |
| `get_rotation` | Current daily/weekly bonus event rotation |
| `get_faction_data` | Faction lore, bonuses, and territory |

### Resources (readable URIs)

| URI | Content |
|---|---|
| `vault77://health` | API health JSON |
| `vault77://config` | Frontend game configuration |
| `vault77://locations` | All POI location data |
| `vault77://items` | All item definitions |
| `vault77://rotation` | Current event rotation |

---

## Running the Server Manually

```bash
# With npm
npm run mcp:start

# Directly
node mcp/vault77-server.js
```

The server speaks the MCP stdio protocol, so it's designed to be launched by
an MCP host, not run interactively. You'll see no output unless an MCP client
connects.

---

## Adding New Tools

Edit `mcp/vault77-server.js`. Each tool follows this pattern:

```javascript
server.tool(
  "tool_name",                          // unique snake_case ID
  "Human-readable description",         // shown in AI UI
  { param: z.string().describe("…") }, // zod input schema
  async ({ param }) => {
    const data = await apiFetch(`/api/route?q=${encodeURIComponent(param)}`);
    return textResult(data);            // or errorResult(err)
  }
);
```

The server uses ESM (`"type": "module"` in `mcp/package.json`) and is kept
separate from the CommonJS backend to avoid module-system conflicts.

---

## Why These Three Servers?

| Need | Server |
|---|---|
| "What quests are broken?" | `vault77-game` → `get_quest_definitions` |
| "Show me recent PRs" | `github` → list pull requests |
| "How does Redis auth work?" | `filesystem` → read `backend/lib/auth.js` |
| "Who's top of the leaderboard?" | `vault77-game` → `get_leaderboard` |
| "What items drop from dungeons?" | `vault77-game` → `list_items` + `filesystem` |

Together these three servers cover the full context an AI needs to help you
develop, debug, and extend the game without constantly pasting code snippets.
