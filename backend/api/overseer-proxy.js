// backend/api/overseer-proxy.js — HF/OpenAI/xAI Grok-aware Overseer AI proxy
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../lib/auth');
const grok = require('../lib/grok');

// Maximum prompt length allowed. Prevents clients sending multi-megabyte
// payloads that would be forwarded verbatim to the upstream AI provider,
// causing unnecessary token consumption or denial-of-service.
const MAX_PROMPT_LENGTH = 2000;

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
  const rawTrimmed = rawPrompt.trim();
  if (!rawTrimmed) {
    return res.status(400).json({ error: 'empty_prompt' });
  }

  // Pull live worldstate from server memory (active NPCs, quests, player stats)
  // and build a Vault-77 character-aware prompt for the Overseer AI.
  const worldstate = req.app.get('worldstate') || {};
  const worldstateSection = Object.keys(worldstate).length
    ? `\n### VAULT-77 WORLDSTATE\n${JSON.stringify(worldstate, null, 2)}\n`
    : '';

  const prompt = `You are the Overseer AI of Vault 77.
You speak in a gritty Fallout tone and always stay in character.
${worldstateSection}
### PLAYER INPUT
"${rawTrimmed}"

### INSTRUCTIONS
- Maintain Fallout / Vault-Tec tone at all times.
- Reference active worldstate data when relevant.
- Keep responses concise (under 200 words).`;

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
      return res.status(r.status).json({ ok: r.status >= 200 && r.status < 300, text, raw: json });
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
      return res.status(r.status).json({ ok: r.status >= 200 && r.status < 300, text, raw: json });
    }
  } catch (err) {
    console.error('[overseer-proxy] error', err);
    return res.status(500).json({ error: 'proxy_failed' });
  }
});

module.exports = router;
