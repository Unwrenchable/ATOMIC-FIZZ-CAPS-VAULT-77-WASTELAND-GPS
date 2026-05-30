// backend/api/overseer-proxy.js — local-first Overseer AI proxy with optional cloud fallback
const express = require('express');
const router = express.Router();
const grok = require('../lib/grok');
const { generateLocalOverseerReply } = require('../realai/local-overseer');
const { resolveOverseerContext, saveOverseerContext } = require('../realai/overseer-context');

const MAX_PROMPT_LENGTH = 2000;
const IDENTITY_QUERY_REGEX = /who are you|what are you|your name|identify yourself|who is jax|are you jax|who am i talking to/i;
const HELP_QUERY_REGEX = /\bhelp\b|\bwhat can you do\b|\bcommands?\b|\bhow do i\b/;
const STATUS_QUERY_REGEX = /\bstatus\b|\bworldstate\b|\bonline\b|\buplink\b|\bsignal\b/;
const REALAI_MODE_LOCAL = 'local';
const REALAI_MODE_AUTO = 'auto';
const REALAI_MODE_CLOUD = 'cloud';

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

function buildFallbackText(rawPrompt, reason) {
  const prompt = String(rawPrompt || '').trim();
  const lowered = prompt.toLowerCase();

  if (IDENTITY_QUERY_REGEX.test(lowered)) {
    return 'Jax Harlan, Vault 77 Overseer AI. The long-range uplink is coughing up dust, but I still run this terminal and the wasteland telemetry stack.';
  }

  if (HELP_QUERY_REGEX.test(lowered)) {
    return 'Fallback core online. I can still help with quests, wasteland orientation, gear chatter, and basic survival advice while the big-brain uplink gets its circuits kicked back into place.';
  }

  if (STATUS_QUERY_REGEX.test(lowered)) {
    return 'Vault 77 fallback core online. Worldstate telemetry is thin, but the terminal is still breathing and the wasteland has not won yet.';
  }

  if (!prompt) {
    return 'Jax Harlan here. The main uplink is degraded, so you are on the fallback core. Ask your question again and I will make do with the scraps.';
  }

  return `Jax Harlan here. The long-range Overseer uplink is degraded (${reason}), so you are getting the fallback core instead of the full wasteland brain. Ask again in a minute, smoothskin.`;
}

async function respondWithFallback(res, rawPrompt, reason, overseerContext) {
  const text = buildFallbackText(rawPrompt, reason);
  await saveOverseerContext(overseerContext, text);
  return res.json({
    ok: true,
    fallback: true,
    source: 'fallback',
    reason,
    text
  });
}

async function readResponsePayload(response) {
  const raw = await response.text();
  if (!raw) {
    return { json: null, raw: '' };
  }

  try {
    return { json: JSON.parse(raw), raw };
  } catch {
    return { json: null, raw };
  }
}

function getRepoSnapshotEntries(value) {
  return Array.isArray(value) ? value : [];
}

function getRealAiMode() {
  const normalized = String(
    process.env.OVERSEER_REALAI_MODE || process.env.REALAI_MODE || REALAI_MODE_LOCAL
  )
    .trim()
    .toLowerCase();

  if (
    normalized === REALAI_MODE_AUTO ||
    normalized === REALAI_MODE_CLOUD ||
    normalized === REALAI_MODE_LOCAL
  ) {
    return normalized;
  }

  return REALAI_MODE_LOCAL;
}

async function safeResolveOverseerContext(req) {
  try {
    return await resolveOverseerContext(req, req.body || {});
  } catch (error) {
    console.error('[overseer-proxy] context resolution failed', error);
    return null;
  }
}

async function respondWithLocalRealAi(res, rawPrompt, worldstate, repoSnapshot, mode, overseerContext) {
  const text = generateLocalOverseerReply({
    rawPrompt,
    worldstate,
    repoSnapshot,
    playerContext: overseerContext
  });
  await saveOverseerContext(overseerContext, text);
  return res.json({
    ok: true,
    fallback: false,
    source: 'local-realai',
    mode,
    text
  });
}

router.post('/ask', async (req, res) => {
  const rawPrompt = (req.body && req.body.prompt) || '';

  if (typeof rawPrompt !== 'string') {
    return res.status(400).json({ ok: false, error: 'invalid_prompt' });
  }
  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ ok: false, error: 'prompt_too_long', maxLength: MAX_PROMPT_LENGTH });
  }
  if (!rawPrompt.trim()) {
    return res.status(400).json({ ok: false, error: 'empty_prompt' });
  }

  try {
    // Pull worldstate from server memory (NPCs, quests, player stats, etc.)
    const worldstate = req.app.get('worldstate') || {};
    const repoSnapshot = getRepoSnapshotEntries(req.app.get('repoSnapshot'));
    const realAiMode = getRealAiMode();
    const overseerContext = await safeResolveOverseerContext(req);

    if (realAiMode !== REALAI_MODE_CLOUD) {
      try {
        return await respondWithLocalRealAi(
          res,
          rawPrompt,
          worldstate,
          repoSnapshot,
          realAiMode,
          overseerContext
        );
      } catch (localErr) {
        console.error('[overseer-proxy] local RealAI generation failed', localErr);
        if (realAiMode === REALAI_MODE_LOCAL) {
          return await respondWithFallback(res, rawPrompt, 'local_realai_failed', overseerContext);
        }
      }
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

    const xaiKey = process.env.XAI_API_KEY || '';
    const aiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
    const proxyUrl = process.env.AI_PROXY_URL || '';
    const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || '';
    const hasCustomProxy = proxyUrl.length > 0;

    const useGrok = xaiKey.length > 0;
    const useHF = !useGrok && (aiKey.startsWith('hf_') || proxyUrl.includes('huggingface.co'));

    if (!useGrok && !aiKey && !hasCustomProxy) {
      return await respondWithFallback(
        res,
        rawPrompt,
        realAiMode === REALAI_MODE_CLOUD ? 'missing_model_credentials' : 'cloud_credentials_missing_after_local_fail',
        overseerContext
      );
    }

    if (useGrok) {
      try {
        const text = await grok.generateWithGrok(prompt, {
          model      : model || grok.DEFAULT_TEXT_MODEL,
          jsonMode   : false,
          temperature: 0.85,
        });

        if (typeof text === 'string' && text.trim()) {
          await saveOverseerContext(overseerContext, text.trim());
          return res.json({ ok: true, text: text.trim(), source: 'grok', mode: REALAI_MODE_CLOUD });
        }

        console.warn('[overseer-proxy] grok returned empty text');
        return await respondWithFallback(res, rawPrompt, 'empty_grok_response', overseerContext);
      } catch (err) {
        console.error('[overseer-proxy] grok request failed', err);
        return await respondWithFallback(res, rawPrompt, 'grok_request_failed', overseerContext);
      }
    } else if (useHF) {
      const hfUrl = proxyUrl || `https://api-inference.huggingface.co/models/${model || 'gpt2'}`;
      const headers = { 'Content-Type': 'application/json' };
      if (aiKey) headers.Authorization = `Bearer ${aiKey}`;
      const r = await fetch(hfUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs: prompt })
      });

      const payload = await readResponsePayload(r);
      const text = normalizeOutput(payload.json) || payload.raw.trim();

      if (!r.ok) {
        console.warn('[overseer-proxy] hugging face upstream error', r.status, text.slice(0, 200));
        return await respondWithFallback(res, rawPrompt, `hf_http_${r.status}`, overseerContext);
      }

      if (!text) {
        console.warn('[overseer-proxy] hugging face returned empty payload');
        return await respondWithFallback(res, rawPrompt, 'empty_hf_response', overseerContext);
      }

      await saveOverseerContext(overseerContext, text);
      return res.json({ ok: true, text, source: 'huggingface', mode: REALAI_MODE_CLOUD });
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

      const payload = await readResponsePayload(r);
      const text = normalizeOutput(payload.json) || payload.raw.trim();

      if (!r.ok) {
        console.warn('[overseer-proxy] openai-compatible upstream error', r.status, text.slice(0, 200));
        return await respondWithFallback(res, rawPrompt, `openai_http_${r.status}`, overseerContext);
      }

      if (!text) {
        console.warn('[overseer-proxy] openai-compatible upstream returned empty payload');
        return await respondWithFallback(res, rawPrompt, 'empty_openai_response', overseerContext);
      }

      await saveOverseerContext(overseerContext, text);
      return res.json({
        ok: true,
        text,
        source: hasCustomProxy ? 'custom-proxy' : 'openai',
        mode: REALAI_MODE_CLOUD
      });
    }
  } catch (err) {
    console.error('[overseer-proxy] error', err);
    const overseerContext = await safeResolveOverseerContext(req);
    return respondWithFallback(res, rawPrompt, 'overseer_proxy_failed', overseerContext);
  }
});

module.exports = router;