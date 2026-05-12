// backend/lib/grok.js — Reusable xAI Grok API helper
// Supports text generation (chat completions), image generation,
// and video generation. All calls are direct fetch — no extra deps.
// xAI is OpenAI-compatible for text and uses its own Imagine endpoints
// for image/video generation.
'use strict';

const crypto = require('crypto');

const XAI_BASE_URL = 'https://api.x.ai/v1';
const XAI_CHAT_URL = `${XAI_BASE_URL}/chat/completions`;
const XAI_IMAGE_URL = `${XAI_BASE_URL}/images/generations`;
const XAI_VIDEO_URL = `${XAI_BASE_URL}/videos/generations`;

const DEFAULT_TEXT_MODEL = 'grok-3';
const DEFAULT_IMAGE_MODEL = process.env.GROK_IMAGE_MODEL || 'grok-imagine-image';
const DEFAULT_VIDEO_MODEL = process.env.GROK_VIDEO_MODEL || 'grok-imagine-video';

const OVERSEER_SYSTEM_PROMPT =
  'You are the Vault 77 Overseer AI: sarcastic, witty, dry humor mixed with Vault-Tec corporate cheer. ' +
  'Always respond in Fallout style — condescending yet helpful, 1950s slang, mock the player\'s bad luck. ' +
  'For NPC/quest generation: output clean JSON only, no extra text.';

// Maximum sizes enforced client-side to match upstream API limits.
const MAX_PROMPT_CHARS = 4000;
const MAX_TOKENS_JSON  = 1200;
const MAX_TOKENS_TEXT  = 800;

// Video poll constants (reused when callers want polling, e.g. scripts)
const POLL_INTERVAL_MS   = 5000;
const POLL_MAX_ATTEMPTS  = 12; // 12 × 5 s = 60 s max

// -----------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------

/**
 * Return the configured xAI API key from the environment.
 * Throws if not present so callers fail fast.
 * @returns {string}
 */
function getApiKey() {
  const key = process.env.XAI_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error('XAI_API_KEY is not configured');
  }
  return key.trim();
}

/**
 * Truncate a string to maxLen characters and strip literal quotes /
 * backslashes that could break JSON or prompt injection.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function sanitise(str, maxLen) {
  return String(str)
    .replace(/['"\\`]/g, '')
    .replace(/[\n\r]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Secure random integer in [0, max).  Used only for jitter/delay logic.
 * @param {number} max
 * @returns {number}
 */
function secureRandomInt(max) {
  if (max <= 1) return 0;
  return crypto.randomInt(max);
}

// -----------------------------------------------------------------------
// Text generation
// -----------------------------------------------------------------------

/**
 * Generate text via xAI Grok chat completions (OpenAI-compatible endpoint).
 *
 * @param {string} prompt   - User message.
 * @param {object} [opts]
 * @param {string}  [opts.model]       - Model ID; defaults to DEFAULT_TEXT_MODEL.
 * @param {boolean} [opts.jsonMode]    - Request JSON output; allows more tokens.
 * @param {string}  [opts.systemPrompt]- Override system prompt.
 * @param {number}  [opts.temperature] - Sampling temperature (default 0.85).
 * @returns {Promise<string>} Generated text.
 */
async function generateWithGrok(prompt, opts = {}) {
  const {
    model       = DEFAULT_TEXT_MODEL,
    jsonMode    = false,
    systemPrompt = OVERSEER_SYSTEM_PROMPT,
    temperature = 0.85,
  } = opts;

  const apiKey = getApiKey();
  const safePrompt = sanitise(prompt, MAX_PROMPT_CHARS);

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: safePrompt  },
    ],
    temperature,
    max_tokens: jsonMode ? MAX_TOKENS_JSON : MAX_TOKENS_TEXT,
    // xAI chat completions are OpenAI-compatible; request strict JSON output
    // when the caller expects a parseable object (e.g. NPC batch generation).
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };

  const res = await fetch(XAI_CHAT_URL, {
    method : 'POST',
    headers: {
      Authorization : `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[grok] chat error HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() ?? '';
}

// -----------------------------------------------------------------------
// Structured NPC batch generation
// -----------------------------------------------------------------------

/**
 * Generate a batch of wasteland NPCs via Grok and return them as an array.
 * Falls back to an empty array on parse errors so callers can continue.
 *
 * @param {number} [count=5]  - Number of NPCs to generate.
 * @param {string} [model]    - Override default text model.
 * @returns {Promise<Array>}  - Array of NPC objects (may be empty on failure).
 */
async function generateNPCBatch(count = 5, model) {
  // Cap at 20 per call — a practical upper bound chosen to keep prompt
  // length manageable and stay within a single API response token budget.
  // For larger batches, call this function multiple times.
  const safeCount = Math.max(1, Math.min(count, 20));
  const prompt = [
    `Generate ${safeCount} unique wasteland NPCs for Atomic Fizz Caps.`,
    'Each as a JSON object with these exact fields:',
    '  id (string, snake_case), name (string), role (one of: "trader"|"quest_giver"|"hostile"|"signal_runner"),',
    '  appearance (string, detailed for avatar generation), personality (array of 3-5 trait strings),',
    '  dialogueStarter (array of 3 strings), questHook (string, optional),',
    '  videoPromptSeed (string, 1-sentence detailed description for video generation).',
    'Theme: post-apocalyptic Mojave, quirky Fallout humor, tie into Red Menace / factions / GPS claims.',
    'IMPORTANT: Respond ONLY with a valid JSON array of objects — no markdown, no extra text.',
  ].join(' ');

  const raw = await generateWithGrok(prompt, {
    model  : model || DEFAULT_TEXT_MODEL,
    jsonMode: true,
    systemPrompt: OVERSEER_SYSTEM_PROMPT,
  });

  // Strip markdown code fences if model wraps output
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
  } catch (err) {
    console.error('[grok] NPC batch JSON parse failed:', err.message, '— raw:', cleaned.slice(0, 300));
    return [];
  }
}

// -----------------------------------------------------------------------
// Image generation
// -----------------------------------------------------------------------

/**
 * Generate an image via xAI Grok Imagine and return its URL.
 *
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string}  [opts.model]  - Image model; defaults to DEFAULT_IMAGE_MODEL.
 * @param {number}  [opts.n]      - Number of images (default 1).
 * @param {string}  [opts.size]   - Image size (default '1024x1024').
 * @returns {Promise<string>}  Image URL.
 */
async function generateImage(prompt, opts = {}) {
  const {
    model = DEFAULT_IMAGE_MODEL,
    n     = 1,
    size,
  } = opts;

  const apiKey    = getApiKey();
  const safePrompt = sanitise(prompt, MAX_PROMPT_CHARS);

  const res = await fetch(XAI_IMAGE_URL, {
    method : 'POST',
    headers: {
      Authorization : `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: safePrompt,
      n,
      ...(size ? { size } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[grok] image error HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const url  = json.data?.[0]?.url;
  if (!url) throw new Error('[grok] image generation returned no URL');
  return url;
}

// -----------------------------------------------------------------------
// Video generation (with async polling)
// -----------------------------------------------------------------------

/**
 * Poll an xAI async video job until it completes or the attempt budget runs out.
 *
 * @param {string} jobId
 * @param {string} apiKey
 * @returns {Promise<string>} Video URL.
 */
async function _pollVideoJob(jobId, apiKey) {
  const pollUrl = `${XAI_BASE_URL}/videos/${encodeURIComponent(jobId)}`;

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    // Add a small jitter to avoid thundering herd in batch scripts
    const jitter = secureRandomInt(500);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS + jitter));

    const pollRes = await fetch(pollUrl, {
      method : 'GET',
      headers: {
        Authorization : `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!pollRes.ok) {
      console.warn(`[grok] video poll attempt ${attempt + 1} returned HTTP ${pollRes.status}`);
      continue;
    }

    const pollJson = await pollRes.json();

    // Current xAI shape
    if (pollJson.video && typeof pollJson.video.url === 'string') return pollJson.video.url;

    // Backward-compatible shapes
    if (pollJson.url && typeof pollJson.url === 'string') return pollJson.url;
    if (Array.isArray(pollJson.data) && pollJson.data[0]?.url) return pollJson.data[0].url;

    const status = (pollJson.status || '').toLowerCase();
    if (status === 'failed' || status === 'error') {
      throw new Error(`[grok] video job ${jobId} failed with status: ${status}`);
    }

    console.log(`[grok] video job ${jobId} status: ${status || 'processing'} (attempt ${attempt + 1}/${POLL_MAX_ATTEMPTS})`);
  }

  throw new Error(`[grok] video job ${jobId} did not complete within ${(POLL_INTERVAL_MS * POLL_MAX_ATTEMPTS) / 1000}s`);
}

/**
 * Generate a short video clip via xAI Grok Imagine Video.
 * Handles both synchronous (URL in response) and asynchronous (job_id) generation.
 *
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string}  [opts.model]      - Video model; defaults to DEFAULT_VIDEO_MODEL.
 * @param {number}  [opts.duration]   - Duration in seconds (default 8).
 * @param {string}  [opts.aspect]     - Aspect ratio (default '16:9').
 * @param {string}  [opts.resolution] - Resolution (default '720p').
 * @returns {Promise<string>} Video URL.
 */
async function generateVideo(prompt, opts = {}) {
  const {
    model      = DEFAULT_VIDEO_MODEL,
    duration   = 8,
    aspect     = '16:9',
    resolution = '720p',
  } = opts;

  const apiKey    = getApiKey();
  const safePrompt = sanitise(prompt, MAX_PROMPT_CHARS);

  const res = await fetch(XAI_VIDEO_URL, {
    method : 'POST',
    headers: {
      Authorization : `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt          : safePrompt,
      duration_seconds: duration,
      aspect_ratio    : aspect,
      resolution,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[grok] video error HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = await res.json();

  // Synchronous: URL returned immediately
  if (json.url && typeof json.url === 'string')             return json.url;
  if (Array.isArray(json.data) && json.data[0]?.url)       return json.data[0].url;

  // Asynchronous: poll for result
  if (json.job_id && typeof json.job_id === 'string') {
    console.log(`[grok] async video job ${json.job_id} started — polling…`);
    return _pollVideoJob(json.job_id, apiKey);
  }

  // Current xAI async shape
  if (json.request_id && typeof json.request_id === 'string') {
    console.log(`[grok] async video request ${json.request_id} started — polling…`);
    return _pollVideoJob(json.request_id, apiKey);
  }

  throw new Error('[grok] video generation returned no URL or job_id');
}

// -----------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------
module.exports = {
  generateWithGrok,
  generateNPCBatch,
  generateImage,
  generateVideo,
  // Expose for testing / extension
  OVERSEER_SYSTEM_PROMPT,
  DEFAULT_TEXT_MODEL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_VIDEO_MODEL,
};
