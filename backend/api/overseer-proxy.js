// backend/api/overseer-proxy.js — HF/OpenAI/xAI Grok-aware Overseer AI proxy
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../lib/auth');
const grok = require('../lib/grok');

// Maximum prompt length allowed. Prevents clients sending multi-megabyte
// payloads that would be forwarded verbatim to the upstream AI provider,
// causing unnecessary token consumption or denial-of-service.
const MAX_PROMPT_LENGTH = 2000;

// In-process response cache — avoids redundant upstream calls for identical
// prompts within a short window.  Keys are prompt strings; values are
// { text, expiresAt }.  Cache is intentionally small and short-lived.
const CACHE_TTL_MS    = 60 * 1000; // 60 seconds
const CACHE_MAX_ITEMS = 200;
const _responseCache  = new Map();

function cacheGet(prompt) {
  const entry = _responseCache.get(prompt);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _responseCache.delete(prompt);
    return null;
  }
  // Re-insert to maintain LRU order (Map preserves insertion order)
  _responseCache.delete(prompt);
  _responseCache.set(prompt, entry);
  return entry.text;
}

function cacheSet(prompt, text) {
  // Evict oldest entry when at capacity to bound memory usage
  if (_responseCache.size >= CACHE_MAX_ITEMS) {
    const firstKey = _responseCache.keys().next().value;
    _responseCache.delete(firstKey);
  }
  _responseCache.set(prompt, { text, expiresAt: Date.now() + CACHE_TTL_MS });
}

function normalizeOutput(json) {
  if (!json) return '';
  if (Array.isArray(json)) {
    const first = json[0] || {};
    return first.generated_text || first.summary_text || first.text || JSON.stringify(json);
  }
  if (json.generated_text) return json.generated_text;
  if (json.summary_text) return json.summary_text;
  if (json.text) return json.text;
  if (json.choices && json.choices[0]) {
    return json.choices[0].message?.content || json.choices[0].text || JSON.stringify(json);
  }
  return JSON.stringify(json);
}

// SECURITY: authMiddleware prevents unauthenticated callers from consuming
// AI API quota. Without this, bots could drain the API key allowance.
router.post('/ask', authMiddleware, async (req, res) => {
  const rawPrompt = (req.body && req.body.prompt) || '';

  // BUG FIX: validate prompt type and enforce length limit before forwarding to
  // the AI provider. Without this check a malicious client could send a
  // multi-megabyte string, consuming upstream API quota or causing OOM.
  if (typeof rawPrompt !== 'string') {
    return res.status(400).json({ error: 'invalid_prompt' });
  }
  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: 'prompt_too_long', maxLength: MAX_PROMPT_LENGTH });
  }
  const prompt = rawPrompt.trim();
  if (!prompt) {
    return res.status(400).json({ error: 'empty_prompt' });
  }

  // Cache hit — return immediately without calling upstream
  const cached = cacheGet(prompt);
  if (cached) {
    return res.json({ ok: true, text: cached, cached: true });
  }

  const xaiKey  = process.env.XAI_API_KEY || '';
  const aiKey   = process.env.AI_API_KEY  || '';
  const proxyUrl = process.env.AI_PROXY_URL || '';
  const model    = process.env.AI_MODEL || '';

  // Priority: xAI Grok → HF → OpenAI-compatible
  const useGrok = xaiKey.length > 0;
  const useHF   = !useGrok && (aiKey.startsWith('hf_') || proxyUrl.includes('huggingface.co'));

  if (!useGrok && !aiKey) {
    return res.status(400).json({ error: 'missing_api_key' });
  }

  try {
    if (useGrok) {
      // xAI Grok path — OpenAI-compatible, uses lib/grok.js for consistency
      const text = await grok.generateWithGrok(prompt, {
        model      : model || grok.DEFAULT_TEXT_MODEL,
        jsonMode   : false,
        temperature: 0.85,
      });
      cacheSet(prompt, text);
      return res.json({ ok: true, text });
    } else if (useHF) {
      const hfUrl = proxyUrl || `https://api-inference.huggingface.co/models/${model || 'gpt2'}`;
      const r = await fetch(hfUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt })
      });
      const json = await r.json();
      const text = normalizeOutput(json);
      if (r.ok) cacheSet(prompt, text);
      return res.status(r.status).json({ ok: r.ok, text, raw: json });
    } else {
      const openaiUrl = proxyUrl || 'https://api.openai.com/v1/chat/completions';
      const body = { model: model || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 800 };
      const r = await fetch(openaiUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await r.json();
      const text = normalizeOutput(json);
      if (r.ok) cacheSet(prompt, text);
      return res.status(r.status).json({ ok: r.ok, text, raw: json });
    }
  } catch (err) {
    console.error('[overseer-proxy] error', err);
    return res.status(500).json({ ok: false, error: 'proxy_failed' });
  }
});

module.exports = router;
