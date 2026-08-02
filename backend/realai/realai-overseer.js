'use strict';

/**
 * RealAI Overseer (Jax Harlan) integration.
 * Calls the sibling RealAI provider (OpenAI-compatible) with a rich Jax personality prompt.
 *
 * Env:
 *   REALAI_API_BASE or REALAI_PROVIDER_URL  (e.g. http://127.0.0.1:8001 for local dev / live building)
 *   REALAI_API_KEY
 *   REALAI_MODEL (optional, defaults to realai-overseer)
 *
 * Used by the /api/overseer/ask proxy for:
 *   - Player in-game interactions on /overseer (atomicfizzcaps.xyz/overseer)
 *   - Live dev / building assistance while staying in character
 *   - Consistent "Jax" personality across game systems
 */

const REALAI_API_BASE = (process.env.REALAI_API_BASE || process.env.REALAI_PROVIDER_URL || '').replace(/\/+$/, '');
const REALAI_API_KEY = process.env.REALAI_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY || 'realai';
const REALAI_MODEL = process.env.REALAI_MODEL || process.env.REALAI_OVERSEER_MODEL || 'realai-overseer';

async function callRealAiJax({ prompt, worldstate = {}, playerContext = {}, conversationHistory = [], repoSnapshot = [] }) {
  if (!REALAI_API_BASE) {
    throw new Error('REALAI_API_BASE not configured (set it to your RealAI provider, e.g. http://127.0.0.1:8001 for local dev)');
  }

  const system = `You are Jax Harlan, Vault 77 Overseer AI.

PERSONALITY (Jax Harlan):
- Gritty, dry, corporate Vault-Tec survivor voice with dark humor, radiation puns, "smoothskin", "citizen", "shareholder".
- Helpful but slightly menacing and bureaucratic. You run the wasteland telemetry, quests, and the long-range uplink.
- You are used for in-game player interactions (quests, status, lore, advice, location claims) AND for live game development/building help (code analysis, repo structure, refactor suggestions, debugging the backend/frontend/systems/realai integration) while staying in character.
- Never break character. Even technical dev advice comes through the Overseer terminal voice.

CAPABILITIES:
- Use live WORLDSTATE (player stats, npcs, quests, locations, factions, weather, events).
- Use PLAYER CONTEXT + CONVERSATION HISTORY for memory and consistency.
- For dev/building queries reference the REPO SNAPSHOT and give precise file/module advice.

RESPONSE STYLE:
- Short to medium length, atmospheric, immersive for the terminal.
- Reference specific world/player details when they matter.
- For pure identity / help / status use canonical Jax Harlan lines.`;

  const userMessage = [
    'WORLDSTATE:',
    JSON.stringify(worldstate, null, 2),
    '',
    'PLAYER CONTEXT + MEMORY:',
    JSON.stringify(playerContext || {}, null, 2),
    '',
    'RECENT CONVERSATION:',
    JSON.stringify((conversationHistory || []).slice(-8), null, 2),
    '',
    'REPO SNAPSHOT (for dev questions):',
    JSON.stringify((repoSnapshot || []).slice(0, 35), null, 2),
    '',
    'PLAYER / USER INPUT:',
    `"${String(prompt || '').trim()}"`,
    '',
    'Respond as Jax Harlan, Overseer of Vault 77. Stay in character at all times.'
  ].join('\n');

  const messages = [
    { role: 'system', content: system },
    ...(Array.isArray(conversationHistory)
      ? conversationHistory.slice(-8).map(h => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: String(h.content || '').slice(0, 700)
        }))
      : []),
    { role: 'user', content: userMessage }
  ];

  const url = `${REALAI_API_BASE}/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${REALAI_API_KEY}`
    },
    body: JSON.stringify({
      model: REALAI_MODEL || 'realai',
      messages,
      temperature: 0.82,
      max_tokens: 720
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`RealAI ${res.status}: ${txt.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  let text = '';
  if (data?.choices?.[0]) {
    const c = data.choices[0];
    text = (c.message && c.message.content) || c.text || '';
  } else if (data && data.generated_text) {
    text = data.generated_text;
  }

  text = String(text || '').trim();
  if (!text) throw new Error('RealAI returned empty text for Jax');

  return text;
}

module.exports = {
  callRealAiJax,
  REALAI_API_BASE
};