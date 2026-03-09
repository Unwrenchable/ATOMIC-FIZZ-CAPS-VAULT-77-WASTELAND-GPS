/**
 * ☢️ Vault-77 MCP Server
 * Model Context Protocol server for the Atomic Fizz Caps Wasteland GPS game.
 *
 * Exposes game data (players, locations, items, quests, config) as MCP tools
 * and resources so AI assistants can answer questions about live game state.
 *
 * Transport: stdio (works with VS Code GitHub Copilot, Claude Desktop, etc.)
 *
 * ⚠️  This file is ESM ("type":"module" in mcp/package.json) and is STANDALONE.
 * Do NOT import it from the CommonJS backend — run it as a separate process.
 *
 * Usage:
 *   node mcp/vault77-server.js
 *
 * Environment variables:
 *   VAULT77_API_URL   - Base URL of the backend API (default: https://api.atomicfizzcaps.xyz)
 *   VAULT77_API_KEY   - Optional API key / admin password for privileged endpoints
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = (process.env.VAULT77_API_URL || "https://api.atomicfizzcaps.xyz").replace(/\/$/, "");
const API_KEY = process.env.VAULT77_API_KEY || "";

// ── helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (API_KEY) headers["x-admin-key"] = API_KEY;
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

function errorResult(err) {
  return { content: [{ type: "text", text: `☢️ Error: ${err.message || String(err)}` }], isError: true };
}

// ── server ───────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "vault77-game",
  version: "1.0.0",
});

// ── tools ────────────────────────────────────────────────────────────────────

/**
 * check_api_health
 * Pings the backend /api/health endpoint.
 */
server.tool(
  "check_api_health",
  "Ping the Atomic Fizz Caps backend API health endpoint. Returns service status and uptime.",
  {},
  async () => {
    try {
      const data = await apiFetch("/api/health");
      return textResult(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

/**
 * get_player_profile
 * Look up a player's wasteland profile (caps, XP, level, faction, quests).
 */
server.tool(
  "get_player_profile",
  "Get a Vault-77 player's full wasteland profile including caps balance, XP, level, faction, and active quests.",
  { wallet: z.string().min(32).max(88).describe("Solana wallet address (base58)") },
  async ({ wallet }) => {
    try {
      const data = await apiFetch(`/api/player?wallet=${encodeURIComponent(wallet)}`);
      return textResult(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

/**
 * get_leaderboard
 * Returns the top N players sorted by a given metric.
 */
server.tool(
  "get_leaderboard",
  "Fetch the Vault-77 wasteland leaderboard. Shows top survivors ranked by caps earned, XP, or claims.",
  {
    metric: z
      .enum(["caps", "xp", "claims"])
      .optional()
      .default("caps")
      .describe("Ranking metric: caps (default), xp, or claims"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Number of top players to return (1-50, default 10)"),
  },
  async ({ metric, limit }) => {
    try {
      const data = await apiFetch(`/api/caps/leaderboard?metric=${metric}&limit=${limit}`);
      return textResult(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

/**
 * list_locations
 * Returns POI location data from the backend.
 */
server.tool(
  "list_locations",
  "List Vault-77 Points of Interest (POIs) — real-world wasteland locations players can explore and claim.",
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .default(50)
      .describe("Max locations to return (1-500, default 50)"),
    type: z
      .string()
      .optional()
      .describe("Filter by location type, e.g. vault, settlement, factory, ruin"),
  },
  async ({ limit, type }) => {
    try {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (type) qs.set("type", type);
      const data = await apiFetch(`/api/locations?${qs}`);
      return textResult(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

/**
 * list_items
 * Returns item definitions from the game data.
 */
server.tool(
  "list_items",
  "List Vault-77 item definitions — weapons, armor, consumables, ammo, and crafting components.",
  {
    category: z
      .enum(["weapon", "armor", "consumable", "ammo", "component", "key", "misc"])
      .optional()
      .describe("Filter by item category"),
    search: z.string().optional().describe("Search item names or descriptions"),
  },
  async ({ category, search }) => {
    try {
      const qs = new URLSearchParams();
      if (category) qs.set("category", category);
      if (search) qs.set("q", search);
      const data = await apiFetch(`/api/mintables?${qs}`);
      return textResult(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

/**
 * get_game_config
 * Returns current game configuration (cooldowns, distances, XP rates, etc.).
 */
server.tool(
  "get_game_config",
  "Get the current Vault-77 game configuration: GPS claim radius, cooldown durations, XP multipliers, token settings.",
  {},
  async () => {
    try {
      const data = await apiFetch("/api/config/frontend");
      return textResult(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

/**
 * get_quest_definitions
 * Returns quest definitions. Optionally filter by quest ID.
 */
server.tool(
  "get_quest_definitions",
  "Get Vault-77 quest definitions — story missions, side quests, faction quests, and repeatable challenges.",
  {
    id: z.string().optional().describe("Specific quest ID to fetch (omit for all quests)"),
  },
  async ({ id }) => {
    try {
      const path = id ? `/api/quests?id=${encodeURIComponent(id)}` : "/api/quests";
      const data = await apiFetch(path);
      return textResult(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

/**
 * get_cooldown_status
 * Check whether a specific player/POI cooldown is active.
 */
server.tool(
  "get_cooldown_status",
  "Check the claim cooldown status for a player at a specific Vault-77 location.",
  {
    wallet: z.string().min(32).max(88).describe("Solana wallet address"),
    poi_id: z.string().describe("POI / location ID to check the cooldown for"),
  },
  async ({ wallet, poi_id }) => {
    try {
      const data = await apiFetch(
        `/api/cooldowns?wallet=${encodeURIComponent(wallet)}&poi=${encodeURIComponent(poi_id)}`
      );
      return textResult(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

/**
 * get_rotation
 * Returns the current daily/weekly event rotation.
 */
server.tool(
  "get_rotation",
  "Get the current Vault-77 daily and weekly event rotation — bonus XP zones, double-caps windows, special encounters.",
  {},
  async () => {
    try {
      const data = await apiFetch("/api/rotation");
      return textResult(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

/**
 * get_faction_data
 * Returns faction definitions and standings.
 */
server.tool(
  "get_faction_data",
  "Get Vault-77 faction data — each wasteland faction's lore, bonuses, territory, and reputation thresholds.",
  {
    faction: z.string().optional().describe("Faction name or ID (omit for all factions)"),
  },
  async ({ faction }) => {
    try {
      const qs = faction ? `?faction=${encodeURIComponent(faction)}` : "";
      const data = await apiFetch(`/api/locations${qs}`);
      return textResult({ factions_note: "Faction data is embedded in location metadata", data });
    } catch (err) {
      return errorResult(err);
    }
  }
);

// ── resources ────────────────────────────────────────────────────────────────

server.resource(
  "vault77-health",
  "vault77://health",
  { mimeType: "application/json", description: "Live API health status" },
  async () => {
    try {
      const data = await apiFetch("/api/health");
      return { contents: [{ uri: "vault77://health", mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { contents: [{ uri: "vault77://health", mimeType: "application/json", text: `{"error": "${err.message}"}` }] };
    }
  }
);

server.resource(
  "vault77-config",
  "vault77://config",
  { mimeType: "application/json", description: "Current frontend/game configuration" },
  async () => {
    try {
      const data = await apiFetch("/api/config/frontend");
      return { contents: [{ uri: "vault77://config", mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { contents: [{ uri: "vault77://config", mimeType: "application/json", text: `{"error": "${err.message}"}` }] };
    }
  }
);

server.resource(
  "vault77-locations",
  "vault77://locations",
  { mimeType: "application/json", description: "All Vault-77 Points of Interest" },
  async () => {
    try {
      const data = await apiFetch("/api/locations?limit=500");
      return { contents: [{ uri: "vault77://locations", mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { contents: [{ uri: "vault77://locations", mimeType: "application/json", text: `{"error": "${err.message}"}` }] };
    }
  }
);

server.resource(
  "vault77-items",
  "vault77://items",
  { mimeType: "application/json", description: "All Vault-77 item definitions" },
  async () => {
    try {
      const data = await apiFetch("/api/mintables");
      return { contents: [{ uri: "vault77://items", mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { contents: [{ uri: "vault77://items", mimeType: "application/json", text: `{"error": "${err.message}"}` }] };
    }
  }
);

server.resource(
  "vault77-rotation",
  "vault77://rotation",
  { mimeType: "application/json", description: "Current daily/weekly event rotation" },
  async () => {
    try {
      const data = await apiFetch("/api/rotation");
      return { contents: [{ uri: "vault77://rotation", mimeType: "application/json", text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return { contents: [{ uri: "vault77://rotation", mimeType: "application/json", text: `{"error": "${err.message}"}` }] };
    }
  }
);

// ── connect ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
