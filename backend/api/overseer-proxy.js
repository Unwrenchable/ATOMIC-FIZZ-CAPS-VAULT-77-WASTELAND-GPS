// backend/api/overseer-proxy.js — HF/OpenAI/xAI Grok-aware Overseer AI proxy
const express = require('express');
const router = express.Router();
const grok = require('../lib/grok');

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

router.post('/ask', async (req, res) => {
  // Pull worldstate from server memory (NPCs, quests, player stats, etc.)
  const worldstate = req.app.get("worldstate") || {};
  const repoSnapshot = req.app.get("repoSnapshot") || [];
  const rawPrompt = (req.body && req.body.prompt) || '';

  if (typeof rawPrompt !== 'string') {
    return res.status(400).json({ error: 'invalid_prompt' });
  }
  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: 'prompt_too_long', maxLength: MAX_PROMPT_LENGTH });
  }
  if (!rawPrompt.trim()) {
    return res.status(400).json({ error: 'empty_prompt' });
  }

  // FINAL WORLDSTATE-AWARE PROMPT
  const prompt = `
You are the Overseer AI of Vault 77.
You speak in a gritty Fallout tone and stay in character.

### WORLDSTATE
${JSON.stringify(worldstate, null, 2)}

### REPO SNAPSHOT (first 50 files)
${JSON.stringify(repoSnapshot.slice(0, 50), null, 2)}

### PLAYER INPUT
"${rawPrompt.trim()}"

### INSTRUCTIONS
- Analyze the repo structure.
- Detect missing files.
- Detect broken imports.
- Suggest fixes.
- Identify architectural problems.
- Help refactor modules.
- Help evolve the AI system.
- Maintain Fallout tone when speaking to the player.
`;

  const xaiKey  = process.env.XAI_API_KEY || '';
  const aiKey   = process.env.AI_API_KEY  || '';
  const proxyUrl = process.env.AI_PROXY_URL || '';
  const model    = process.env.AI_MODEL || '';
  const hasCustomProxy = proxyUrl.length > 0;

  const useGrok = xaiKey.length > 0;
  const useHF   = !useGrok && (aiKey.startsWith('hf_') || proxyUrl.includes('huggingface.co'));

  if (!useGrok && !aiKey && !hasCustomProxy) {
    return res.status(400).json({ error: 'missing_api_key' });
  }

  try {
    if (useGrok) {
      const text = await grok.generateWithGrok(prompt, {
        model      : model || grok.DEFAULT_TEXT_MODEL,
        jsonMode   : false,
        temperature: 0.85,
      });
      return res.json({ ok: true, text });
    } else if (useHF) {
      const hfUrl = proxyUrl || `https://api-inference.huggingface.co/models/${model || 'gpt2'}`;
      const headers = { 'Content-Type': 'application/json' };
      if (aiKey) headers.Authorization = `Bearer ${aiKey}`;
      const r = await fetch(hfUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs: prompt })
      });
      const json = await r.json();
      const text = normalizeOutput(json);
      return res.status(r.status).json({ ok: r.status >= 200 && r.status < 300, text, raw: json });
    } else {
      const openaiUrl = proxyUrl || 'https://api.openai.com/v1/chat/completions';
      const body = { model: model || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 800 };
      const headers = { 'Content-Type': 'application/json' };
      if (aiKey) headers.Authorization = `Bearer ${aiKey}`;
      const r = await fetch(openaiUrl, {
        method: 'POST',
        headers,
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