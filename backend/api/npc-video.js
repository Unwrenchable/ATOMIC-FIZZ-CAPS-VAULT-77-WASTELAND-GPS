// backend/api/npc-video.js — xAI Grok NPC video generation proxy
// Generates short Fallout-themed NPC videos via xAI API with Redis caching.
'use strict';

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../lib/auth');
const redis = require('../lib/redis');

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------
const XAI_VIDEO_URL = 'https://api.x.ai/v1/videos/generations';
const XAI_POLL_URL = (jobId) => `https://api.x.ai/v1/videos/generations/${encodeURIComponent(jobId)}`;
const CACHE_TTL_SECONDS = 86400; // 24 hours
const MAX_NPC_NAME_LENGTH = 60;
const MAX_DIALOG_TEXT_LENGTH = 200;
const PROMPT_DIALOG_TRUNCATE = 150;
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 6; // 6 × 5 s = 30 s max

// ----------------------------------------------------------------
// Input sanitisation helpers
// ----------------------------------------------------------------
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// Strip characters that would break out of the prompt or cause prompt injection
function sanitiseForPrompt(str, maxLen) {
  return String(str)
    .replace(/['"\\`]/g, '') // remove quotes and backslashes
    .replace(/\n|\r/g, ' ')  // collapse newlines
    .trim()
    .slice(0, maxLen);
}

// Validate npcId — alphanumeric, underscores and hyphens only, length 1-80
function isValidNpcId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}

// ----------------------------------------------------------------
// Build the Fallout-themed prompt
// ----------------------------------------------------------------
function buildPrompt(npcName, portrait, dialogText) {
  const safeName    = sanitiseForPrompt(npcName,   MAX_NPC_NAME_LENGTH);
  const safePortrait = portrait ? sanitiseForPrompt(String(portrait), 100) : 'rugged wasteland survivor';
  const safeDialog  = sanitiseForPrompt(dialogText, PROMPT_DIALOG_TRUNCATE);

  return (
    `Wasteland NPC named ${safeName}, ${safePortrait} appearance, ` +
    `speaking in post-apocalyptic Fallout style, saying "${safeDialog}", ` +
    `8 seconds, retro Pip-Boy green tint, moody lighting`
  ).slice(0, 2000); // hard cap for upstream safety
}

// ----------------------------------------------------------------
// Poll xAI for async job completion
// ----------------------------------------------------------------
async function pollForVideoUrl(jobId, apiKey) {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    // Wait before polling (also before first attempt to give the job time)
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const pollRes = await fetch(XAI_POLL_URL(jobId), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!pollRes.ok) {
      console.warn(`[npc-video] poll attempt ${attempt + 1} returned HTTP ${pollRes.status}`);
      continue;
    }

    const pollJson = await pollRes.json();

    // Success: direct URL in response
    if (pollJson.url && typeof pollJson.url === 'string') {
      return pollJson.url;
    }

    // Nested result objects (e.g. { data: [{ url: '...' }] })
    if (Array.isArray(pollJson.data) && pollJson.data[0] && pollJson.data[0].url) {
      return pollJson.data[0].url;
    }

    // Still processing: check status field
    const status = (pollJson.status || '').toLowerCase();
    if (status === 'failed' || status === 'error') {
      throw new Error(`xAI job ${jobId} failed with status: ${status}`);
    }

    // status === 'processing' or similar — keep polling
    console.log(`[npc-video] job ${jobId} status: ${status || 'unknown'}, attempt ${attempt + 1}/${POLL_MAX_ATTEMPTS}`);
  }

  throw new Error(`xAI job ${jobId} did not complete within ${(POLL_INTERVAL_MS * POLL_MAX_ATTEMPTS) / 1000}s`);
}

// ----------------------------------------------------------------
// POST /generate
// ----------------------------------------------------------------
router.post('/generate', authMiddleware, async (req, res) => {
  const { npcId, npcName, portrait, dialogText } = req.body || {};

  // --- Input validation ---
  if (!isValidNpcId(npcId)) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_input',
      message: 'npcId is required and must be alphanumeric (1-80 chars, hyphens/underscores allowed).',
    });
  }

  if (!isNonEmptyString(npcName) || npcName.length > MAX_NPC_NAME_LENGTH) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_input',
      message: `npcName must be a non-empty string of at most ${MAX_NPC_NAME_LENGTH} characters.`,
    });
  }

  if (!isNonEmptyString(dialogText) || dialogText.length > MAX_DIALOG_TEXT_LENGTH) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_input',
      message: `dialogText must be a non-empty string of at most ${MAX_DIALOG_TEXT_LENGTH} characters.`,
    });
  }

  // --- Check API key configured ---
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      error: 'xai_not_configured',
      message: 'Video feed offline – Overseer has not authorized xAI access.',
    });
  }

  // --- Redis cache check (key is unprefixed; redis lib adds afw: prefix internally) ---
  // Include a short hash of the prompt inputs so different NPC states get distinct cache entries
  const promptHash = crypto
    .createHash('sha1')
    .update(`${npcId}:${npcName}:${portrait || ''}:${sanitiseForPrompt(dialogText, PROMPT_DIALOG_TRUNCATE)}`)
    .digest('hex')
    .slice(0, 8);
  const cacheKey = `npc_video:${npcId}:${promptHash}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached && typeof cached === 'string' && cached.startsWith('https://')) {
      console.log(`[npc-video] cache hit for npcId=${npcId}`);
      return res.json({ ok: true, url: cached, cached: true });
    }
  } catch (cacheErr) {
    // Non-fatal — continue without cache
    console.warn('[npc-video] Redis get error (continuing without cache):', cacheErr.message);
  }

  // --- Build prompt ---
  const prompt = buildPrompt(npcName, portrait, dialogText);

  // --- Call xAI video generation API ---
  let videoUrl;
  try {
    const xaiRes = await fetch(XAI_VIDEO_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'aurora',
        prompt,
        duration_seconds: 8,
        aspect_ratio: '3:4',
        resolution: '720p',
      }),
    });

    if (!xaiRes.ok) {
      const errBody = await xaiRes.text();
      console.error(`[npc-video] xAI API error HTTP ${xaiRes.status}:`, errBody);
      return res.status(502).json({
        ok: false,
        error: 'upstream_error',
        message: `xAI API returned HTTP ${xaiRes.status}`,
      });
    }

    const xaiJson = await xaiRes.json();

    // Direct URL in response — synchronous generation
    if (xaiJson.url && typeof xaiJson.url === 'string') {
      videoUrl = xaiJson.url;
    } else if (Array.isArray(xaiJson.data) && xaiJson.data[0] && xaiJson.data[0].url) {
      videoUrl = xaiJson.data[0].url;
    } else if (xaiJson.job_id && typeof xaiJson.job_id === 'string') {
      // Async generation — poll for result
      console.log(`[npc-video] async job ${xaiJson.job_id} started, polling...`);
      videoUrl = await pollForVideoUrl(xaiJson.job_id, apiKey);
    } else {
      console.error('[npc-video] unexpected xAI response shape:', JSON.stringify(xaiJson));
      return res.status(502).json({
        ok: false,
        error: 'upstream_error',
        message: 'Unexpected response from xAI API — no URL or job_id found.',
      });
    }
  } catch (err) {
    console.error('[npc-video] upstream fetch/poll error:', err.message);
    return res.status(502).json({
      ok: false,
      error: 'upstream_error',
      message: err.message || 'Video generation failed.',
    });
  }

  // --- Cache the result ---
  try {
    await redis.set(cacheKey, videoUrl, { EX: CACHE_TTL_SECONDS });
    console.log(`[npc-video] cached video URL for npcId=${npcId} (TTL ${CACHE_TTL_SECONDS}s)`);
  } catch (cacheErr) {
    console.warn('[npc-video] Redis set error (video still returned to client):', cacheErr.message);
  }

  return res.json({ ok: true, url: videoUrl, cached: false });
});

module.exports = router;
