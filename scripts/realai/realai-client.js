import fetch from "node-fetch";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const LEGACY_MODEL_ALIASES = new Set([
  "",
  "local",
  "llama-3.2-1b",
  "realai-1.0",
  "realai-2.0",
  "realai-overseer"
]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getDefaultModel() {
  return process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";
}

function getApiKey() {
  return process.env.OPENAI_API_KEY || process.env.AI_API_KEY || "";
}

function resolveModel(model) {
  const normalized = String(model || "").trim();
  return LEGACY_MODEL_ALIASES.has(normalized) ? getDefaultModel() : normalized;
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

  throw new Error("RealAI cloud response did not include message content.");
}

async function requestCompletion(prompt, model, apiKey) {
  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: resolveModel(model),
      messages: [{ role: "user", content: prompt }]
    })
  });

  const raw = await res.text();
  const data = raw ? JSON.parse(raw) : {};

  if (!res.ok) {
    const detail = data?.error?.message || raw || "Unknown RealAI cloud error.";
    const error = new Error(`RealAI cloud request failed (${res.status}): ${detail}`);
    error.retryable = RETRYABLE_STATUS_CODES.has(res.status);
    throw error;
  }

  return extractMessageText(data);
}

export async function realai(prompt, model = getDefaultModel()) {
  const apiKey = getApiKey();
  const normalizedPrompt = String(prompt || "").trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for RealAI cloud mode.");
  }

  if (!normalizedPrompt) {
    throw new Error("RealAI requires a non-empty prompt.");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestCompletion(normalizedPrompt, model, apiKey);
    } catch (error) {
      if (!error.retryable || attempt === 1) {
        throw error;
      }

      await delay(500 * (attempt + 1));
    }
  }

  throw new Error("RealAI cloud request exhausted retries.");
}
