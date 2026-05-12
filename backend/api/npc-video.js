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
const MAX_DIALOG_TEXT_LENGTH = 800;
const PROMPT_DIALOG_TRUNCATE = 150;
// MAX_SPEECH_WORDS: fallback word cap for extracted dialog text (when video_speech is absent).
// 22 words ≈ 110 WPM (measured Fallout-style delivery) × 8 seconds, leaving room for pauses.
// Keep hand-written video_speech under 15 words for the best single-breath delivery.
const MAX_SPEECH_WORDS = parseInt(process.env.NPC_VIDEO_MAX_WORDS || '22', 10);
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

function _truncateWords(str, maxWords) {
  const words = String(str || '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

/**
 * Truncate a string to at most maxWords words, preferring a natural
 * sentence boundary over a hard mid-word cut.
 */
function truncateAtSentence(str, maxWords) {
  const words = String(str || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');

  const candidate = words.slice(0, maxWords).join(' ');
  let lastEnd = -1;
  for (let i = candidate.length - 1; i >= 0; i--) {
    if (/[.!?]/.test(candidate[i])) { lastEnd = i; break; }
  }
  if (lastEnd > 0) {
    const upToEnd = candidate.slice(0, lastEnd + 1).trim();
    if (upToEnd.split(/\s+/).length >= 4) return upToEnd;
  }
  return candidate;
}

/**
 * Extract a short, video-ready speech line from a raw dialog node text.
 *
 * Dialog nodes contain mixed content: [stage directions], *action cues*,
 * narrator prose, and the actual NPC dialogue in "double quotes".
 * This function extracts the first 1-2 quoted speech segments, then falls
 * back to the first clean paragraph, then truncates at a sentence boundary.
 */
function extractVideoSpeech(rawText, maxWords) {
  // Strip all HTML from the raw dialog text before any further processing.
  // Step 1: convert <br> line-break tags to newlines.
  // Step 2: remove every remaining angle-bracket character — this definitively
  //         eliminates any HTML injection surface including malformed/nested markup.
  let text = String(rawText || '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/</g, '').replace(/>/g, '');

  // Strip [bracketed stage directions]
  text = text.replace(/\[[^\]]{0,200}?\]/g, '');

  // Strip (parenthetical stage directions) — Kenny-style action cues
  text = text.replace(/\([^)]{5,200}?\)/g, '');

  // Strip *asterisk action cues*
  text = text.replace(/\*[^*]{0,200}?\*/g, '');

  // Strategy 1: pull quoted NPC speech "like this"
  const quotedParts = [];
  const quoteRe = /"([^"]{3,200})"/g;
  let m;
  while ((m = quoteRe.exec(text)) !== null) {
    const part = m[1].replace(/[\n\r]+/g, ' ').trim();
    if (part.length > 3) quotedParts.push(part);
    if (quotedParts.length >= 2) break;
  }

  if (quotedParts.length > 0) {
    const combined = quotedParts.join(' ').replace(/\s+/g, ' ').trim();
    return truncateAtSentence(combined, maxWords);
  }

  // Strategy 2: accumulate the first few non-empty, non-ellipsis paragraphs up
  // to the word budget.  When accumulated count is below 1/3 of the budget,
  // always pull in the next paragraph (let truncateAtSentence clip it) so
  // short openers like "Hey. You." get extended with the following content.
  const paragraphs = text.split(/\n+/).map((s) => s.trim());
  const accumulated = [];
  let wordCount = 0;
  const minWords = Math.ceil(maxWords / 3);
  for (const p of paragraphs) {
    if (!p || p.length <= 1 || /^[.…\s]+$/.test(p)) continue;
    const pWords = p.split(/\s+/).filter(Boolean).length;
    if (wordCount + pWords > maxWords && wordCount >= minWords) break;
    accumulated.push(p);
    wordCount += pWords;
    if (wordCount >= maxWords) break;
  }

  if (accumulated.length > 0) {
    return truncateAtSentence(accumulated.join(' '), maxWords);
  }

  return truncateAtSentence(text.replace(/[\n\r]+/g, ' ').trim(), maxWords);
}

function pickVoiceProfile(npcId) {
  const voices = [
    'voice: raspy baritone, gravelly wasteland cadence',
    'voice: clipped military cadence, firm and direct',
    'voice: calm medic tone, measured and reassuring',
    'voice: fast-talking scavenger, nervous edge',
    'voice: charismatic trader patter, sly and smooth',
    'voice: stern elder tone, deliberate and low',
    'voice: cheerful but eerie vault-tec cadence',
    'voice: rough outlaw drawl, dry sarcasm',
  ];
  let hash = 0;
  const key = String(npcId || 'unknown_npc');
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  return voices[Math.abs(hash) % voices.length];
}

// Validate npcId — alphanumeric, underscores and hyphens only, length 1-80
function isValidNpcId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
}

// ----------------------------------------------------------------
// Build the Fallout-themed prompt
// ----------------------------------------------------------------
function buildPrompt(npcId, npcName, portrait, dialogText, videoSpeech) {
  const safeNpcId   = sanitiseForPrompt(npcId, 80).toLowerCase();
  const safeName    = sanitiseForPrompt(npcName,   MAX_NPC_NAME_LENGTH);
  const safePortrait = portrait ? sanitiseForPrompt(String(portrait), 100) : 'rugged wasteland survivor';
  // Use pre-written video_speech if provided; otherwise extract from dialog text
  const safeDialog  = videoSpeech
    ? truncateAtSentence(sanitiseForPrompt(String(videoSpeech), 300), MAX_SPEECH_WORDS)
    : extractVideoSpeech(dialogText, MAX_SPEECH_WORDS);
  const voiceProfile = pickVoiceProfile(safeNpcId);

  return (
    `Wasteland NPC named ${safeName}, ${safePortrait} appearance, ` +
    `identity lock character_id=${safeNpcId}; keep the exact same person in every clip with this character_id ` +
    `(same face structure, hair/facial hair, age, skin tone, body type, signature outfit and accessories), ` +
    `never redesign or swap actor identity, ` +
    `${voiceProfile}; keep this exact voice profile for character_id=${safeNpcId} in every scene, ` +
    `speaking in post-apocalyptic Fallout style, delivering this complete line: "${safeDialog}", ` +
    `must complete the full sentence before the clip ends — no trailing words cut off — ` +
    `fit delivery naturally within 8 seconds at a measured wasteland pace, ` +
    `8 seconds, retro Pocket-Boy green tint, moody lighting`
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
  const { npcId, npcName, portrait, dialogText, videoSpeech } = req.body || {};

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
  const prompt = buildPrompt(npcId, npcName, portrait, dialogText, videoSpeech);

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
        model: process.env.GROK_VIDEO_MODEL || 'grok-imagine-video',
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
