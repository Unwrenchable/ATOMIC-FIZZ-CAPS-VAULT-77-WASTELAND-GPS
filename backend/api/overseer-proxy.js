// backend/api/overseer-proxy.js — HF/OpenAI-aware Overseer AI proxy
const express = require('express');
const router = express.Router();

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
  const prompt = (req.body && req.body.prompt) || '';
  const apiKey = process.env.AI_API_KEY;
  const proxyUrl = process.env.AI_PROXY_URL || '';
  const model = process.env.AI_MODEL || '';

  if (!apiKey) return res.status(400).json({ error: 'missing_api_key' });

  try {
    const useHF = apiKey.startsWith('hf_') || proxyUrl.includes('huggingface.co');

    if (useHF) {
      const hfUrl = proxyUrl || `https://api-inference.huggingface.co/models/${model || 'gpt2'}`;
      const r = await fetch(hfUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = await r.json();
      const text = normalizeOutput(json);
      return res.status(r.status).json({ ok: r.status >= 200 && r.status < 300, text, raw: json });
    }
  } catch (err) {
    console.error('[overseer-proxy] error', err);
    return res.status(500).json({ error: 'proxy_failed', message: err.message });
  }
});

module.exports = router;
