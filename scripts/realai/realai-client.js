/**
 * RealAI client — OpenAI-compatible chat against canonical provider (default :8001).
 *
 * Env:
 *   REALAI_API_BASE / REALAI_PROVIDER_URL  (default http://127.0.0.1:8001)
 *   REALAI_API_KEY                         (default "realai")
 *   REALAI_MODEL                           (default "realai")
 *   OPENAI_API_KEY                         (fallback key only)
 *
 * Usage:
 *   node scripts/realai/realai-client.js "Generate 3 wasteland NPCs"
 *   REALAI_API_BASE=http://127.0.0.1:8001 node scripts/realai/generate-npcs.js
 */

import fetch from "node-fetch";

const baseUrl = (
  process.env.REALAI_API_BASE ||
  process.env.REALAI_PROVIDER_URL ||
  process.env.AI_PROXY_URL?.replace(/\/v1\/chat\/completions\/?$/, "") ||
  "http://127.0.0.1:8001"
).replace(/\/+$/, "");

const apiKey =
  process.env.REALAI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.AI_API_KEY ||
  "realai";

const defaultModel =
  process.env.REALAI_MODEL ||
  process.env.OPENAI_MODEL ||
  process.env.AI_MODEL ||
  "realai";

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const LEGACY_MODEL_ALIASES = new Set([
  "",
  "local",
  "llama-3.2-1b",
  "realai-1.0",
  "realai-2.0",
  "realai-overseer",
]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveModel(model) {
  const normalized = String(model || "").trim();
  return LEGACY_MODEL_ALIASES.has(normalized) ? defaultModel : normalized;
}

function extractMessageText(data) {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => part && part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("");
  }

  throw new Error("RealAI response did not include message content.");
}

export async function realaiChat(messages, options = {}) {
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
    body: JSON.stringify({
      model: resolveModel(options.model),
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: Boolean(options.stream),
    }),
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Non-JSON response (${response.status}): ${raw.slice(0, 400)}`);
  }

  if (!response.ok) {
    const detail =
      data?.error?.message || data?.detail || raw || "Unknown RealAI error.";
    const error = new Error(`RealAI request failed (${response.status}): ${detail}`);
    error.retryable = RETRYABLE_STATUS_CODES.has(response.status);
    throw error;
  }

  return data;
}

/**
 * Legacy single-prompt helper used by generator scripts.
 */
export async function realai(prompt, model = defaultModel) {
  const normalizedPrompt = String(prompt || "").trim();
  if (!normalizedPrompt) {
    throw new Error("RealAI requires a non-empty prompt.");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const data = await realaiChat(
        [{ role: "user", content: normalizedPrompt }],
        { model }
      );
      return extractMessageText(data);
    } catch (error) {
      if (!error.retryable || attempt === 1) {
        throw error;
      }
      await delay(500 * (attempt + 1));
    }
  }

  throw new Error("RealAI request exhausted retries.");
}

/**
 * Character Studio — canonical provider portraits + personas for in-game NPCs.
 */
export async function realaiCreateCharacter({
  name,
  description,
  style = "fallout-meme",
}) {
  const response = await fetch(`${baseUrl}/v1/characters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ name, description, style }),
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`Non-JSON character response (${response.status})`);
  }

  if (!response.ok) {
    const detail = data?.detail || data?.error || raw;
    throw new Error(`Character Studio failed (${response.status}): ${detail}`);
  }

  return data;
}

export { baseUrl, defaultModel };

async function main() {
  const arg = process.argv.slice(2).join(" ").trim() || "Say hello in one wasteland line.";

  if (arg === "ping") {
    const health = await fetch(`${baseUrl}/health`);
    if (!health.ok) {
      console.error(`[RealAI] Provider not reachable at ${baseUrl}/health`);
      process.exit(1);
    }
    console.log(`[RealAI] OK ${baseUrl}`);
    return;
  }

  const text = await realai(arg);
  console.log(text);
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("realai-client.js") ||
    process.argv[1].includes("realai-client"));

if (isMain) {
  main().catch((err) => {
    console.error(`[RealAI] ${err.message}`);
    process.exit(1);
  });
}