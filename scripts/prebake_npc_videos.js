#!/usr/bin/env node
// scripts/prebake_npc_videos.js
// Pre-generates NPC videos using xAI once, uploads them to Cloudflare R2,
// and writes a static manifest (public/data/npc-videos.json).
//
// Players get instant video from R2 CDN — zero per-player API cost.
// R2 free tier: 10GB storage, free egress. Handles 1.4GB of all NPC videos.
//
// Usage:
//   XAI_API_KEY=xai-... R2_* vars set → node scripts/prebake_npc_videos.js
//   # or with .env:
//   node scripts/prebake_npc_videos.js
//
//   # Default: KEY_NODES_ONLY mode — generates intro + quest offers + fallback per NPC (~3 nodes each)
//   # This cuts API costs by ~80% vs generating every dialog branch.
//
//   # Generate every dialog node (full set — expensive):
//   ALL_NODES=1 node scripts/prebake_npc_videos.js
//
//   # Generate only one video per NPC (intro-preferred):
//   ONE_PER_NPC=1 node scripts/prebake_npc_videos.js
//
//   # Generate only specific NPCs:
//   NPC_FILTER=phaltron,arnie node scripts/prebake_npc_videos.js
//
//   # Dry-run (build prompts, no API calls):
//   DRY_RUN=1 node scripts/prebake_npc_videos.js
//
//   # Skip R2 upload (save locally only, for testing):
//   NO_UPLOAD=1 node scripts/prebake_npc_videos.js
//
// Dialog node video_speech field:
//   Add "video_speech": "exact line to speak" to any dialog node and the
//   prebake script will use it directly instead of guessing from the node text.
//   This is the recommended way to ensure videos sound right.
//   Keep video_speech under 15 words for best results — that's the sweet spot for
//   8-second delivery. The hard extraction fallback cap is 22 words (set by
//   NPC_VIDEO_MAX_WORDS) to allow slightly longer natural sentences when needed.
//
// R2 setup (one-time):
//   1. dash.cloudflare.com → R2 → Create bucket "atomicfizz-videos"
//   2. Enable "Public access" on bucket → note your r2.dev subdomain
//   3. Manage R2 API Tokens → Create token with Object Read & Write
//   4. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//      R2_BUCKET_NAME, R2_PUBLIC_URL to your .env
//
// Output:
//   public/videos/npc/<npcId>_<nodeId>.mp4  — local cache (optional)
//   public/data/npc-videos.json             — manifest with R2 URLs

'use strict';

try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }

const fs   = require('fs');
const path = require('path');

const { generateVideo } = require('../backend/lib/grok');

// -----------------------------------------------------------------------
// Paths
// -----------------------------------------------------------------------
const DIALOG_DIR    = path.resolve(__dirname, '../public/data/narrative');
const VIDEO_OUT_DIR = path.resolve(__dirname, '../public/videos/npc');
const MANIFEST_PATH = path.resolve(__dirname, '../public/data/npc-videos.json');
const LORE_OVERRIDES_PATH = path.resolve(__dirname, '../public/data/narrative/npc_video_lore_overrides.json');

// -----------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------
const DRY_RUN       = process.env.DRY_RUN === '1';
const NO_UPLOAD     = process.env.NO_UPLOAD === '1';
const NPC_FILTER    = process.env.NPC_FILTER
  ? process.env.NPC_FILTER.split(',').map((s) => s.trim().toLowerCase())
  : null;
const DELAY_MS      = parseInt(process.env.PREBAKE_DELAY_MS || '2000', 10);
const DURATION      = parseInt(process.env.GROK_VIDEO_DURATION || '8', 10);
const ASPECT        = process.env.GROK_VIDEO_ASPECT || '3:4';
const RESOLUTION    = process.env.GROK_VIDEO_RESOLUTION || '720p';
const SKIP_EXISTING = process.env.SKIP_EXISTING !== '0';
const ONE_PER_NPC   = process.env.ONE_PER_NPC === '1';
// KEY_NODES_ONLY: generate only intro, quest offer nodes, and fallback per NPC (default: true).
// Set ALL_NODES=1 to generate every dialog branch node.
const KEY_NODES_ONLY = process.env.ALL_NODES !== '1';
// MAX_SPEECH_WORDS: fallback word cap for extracted dialog text (when video_speech is absent).
// 22 words ≈ 110 WPM (Fallout-paced delivery) × 8 seconds, with room for pauses.
// Hand-written video_speech values are best kept under 15 words for clean single-breath clips.
const MAX_SPEECH_WORDS = parseInt(process.env.NPC_VIDEO_MAX_WORDS || '22', 10);
const INCLUDE_ENDGAME_NPCS = process.env.INCLUDE_ENDGAME_NPCS === '1';

// R2 config
const R2_ACCOUNT_ID        = process.env.R2_ACCOUNT_ID        || '';
const R2_ACCESS_KEY_ID     = process.env.R2_ACCESS_KEY_ID     || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME       = process.env.R2_BUCKET_NAME       || 'atomicfizz-videos';
const R2_PUBLIC_URL        = (process.env.R2_PUBLIC_URL       || '').replace(/\/$/, '');

const USE_R2 = !NO_UPLOAD && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_PUBLIC_URL;

let NPC_LORE_OVERRIDES = {};
try {
  NPC_LORE_OVERRIDES = JSON.parse(fs.readFileSync(LORE_OVERRIDES_PATH, 'utf8'));
} catch (_) {
  NPC_LORE_OVERRIDES = {};
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/** Strip HTML tags from dialog text for use in prompts */
function _stripHtml(str) {
  return String(str || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip prompt-injection characters */
function sanitise(str, maxLen) {
  return String(str)
    .replace(/['"\\`]/g, '')
    .replace(/[\n\r]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function _truncateWords(str, maxWords) {
  var words = String(str || '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

/**
 * Truncate a string to at most maxWords words, preferring a natural
 * sentence boundary (period / exclamation / question mark) over a hard cut.
 * Falls back to plain word truncation when no sentence boundary is found.
 */
function truncateAtSentence(str, maxWords) {
  var words = String(str || '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');

  var candidate = words.slice(0, maxWords).join(' ');
  // Walk backwards to find the last sentence-ending punctuation
  var lastEnd = -1;
  for (var i = candidate.length - 1; i >= 0; i--) {
    if (/[.!?]/.test(candidate[i])) { lastEnd = i; break; }
  }
  if (lastEnd > 0) {
    var upToEnd = candidate.slice(0, lastEnd + 1).trim();
    // Accept the sentence boundary only if it gives us a meaningful fragment (≥ 4 words)
    if (upToEnd.split(/\s+/).length >= 4) return upToEnd;
  }
  return candidate;
}

/**
 * Extract a short, clean speech line from a dialog node's text field.
 *
 * Dialog texts contain a mix of:
 *   - [Stage directions in brackets]
 *   - *Action cues in asterisks*
 *   - Narrator / atmosphere prose
 *   - "Actual NPC dialogue in double-quotes"
 *   - Ellipsis-only pause lines ("...", "…")
 *
 * Strategy (in priority order):
 *   1. Pull the first one or two quoted speech segments ("…").
 *   2. Fall back to the first non-empty, non-ellipsis paragraph.
 * Then truncate at a sentence boundary rather than mid-word.
 *
 * @param {string} rawText - The full node text from the dialog JSON.
 * @param {number} maxWords - Maximum word budget.
 * @returns {string} A clean, short speech line ready for the video prompt.
 */
function extractVideoSpeech(rawText, maxWords) {
  // Strip all HTML from the raw dialog text before any further processing.
  // Step 1: convert <br> line-break tags to newlines.
  // Step 2: remove every remaining angle-bracket character — this definitively
  //         eliminates any HTML injection surface including malformed/nested markup.
  var text = String(rawText || '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/</g, '').replace(/>/g, '');

  // Strip [bracketed stage directions]
  text = text.replace(/\[[^\]]{0,200}?\]/g, '');

  // Strip (parenthetical stage directions) — Kenny-style action cues
  text = text.replace(/\([^)]{5,200}?\)/g, '');

  // Strip *asterisk action cues*
  text = text.replace(/\*[^*]{0,200}?\*/g, '');

  // --- Strategy 1: extract quoted NPC speech ---
  var quotedParts = [];
  var quoteRe = /"([^"]{3,200})"/g;
  var m;
  while ((m = quoteRe.exec(text)) !== null) {
    var part = m[1].replace(/[\n\r]+/g, ' ').trim();
    if (part.length > 3) quotedParts.push(part);
    if (quotedParts.length >= 2) break; // two sentences is enough
  }

  if (quotedParts.length > 0) {
    var combined = quotedParts.join(' ').replace(/\s+/g, ' ').trim();
    return truncateAtSentence(combined, maxWords);
  }

  // --- Strategy 2: accumulate the first few non-empty, non-ellipsis paragraphs ---
  // Paragraphs are separated by newlines (normalised from <br><br> or \n\n).
  // We combine paragraphs until we reach the word budget.  When the current
  // accumulated count is below 1/3 of the budget, we always pull in the next
  // paragraph (letting truncateAtSentence clip it) so short openers like
  // "Hey. You." are extended with the following content rather than kept alone.
  var paragraphs = text.split(/\n+/).map(function (s) { return s.trim(); });
  var accumulated = [];
  var wordCount = 0;
  var minWords = Math.ceil(maxWords / 3); // must exceed this before stopping
  for (var j = 0; j < paragraphs.length; j++) {
    var p = paragraphs[j];
    if (!p || p.length <= 1 || /^[.…\s]+$/.test(p)) continue;
    var pWords = p.split(/\s+/).filter(Boolean).length;
    if (wordCount + pWords > maxWords && wordCount >= minWords) break;
    accumulated.push(p);
    wordCount += pWords;
    if (wordCount >= maxWords) break;
  }

  if (accumulated.length > 0) {
    return truncateAtSentence(accumulated.join(' '), maxWords);
  }

  // Last-resort: sanitise the whole thing and truncate
  return truncateAtSentence(text.replace(/[\n\r]+/g, ' ').trim(), maxWords);
}

function pickVoiceProfile(npcKey) {
  var voices = [
    'voice: raspy baritone, gravelly wasteland cadence',
    'voice: clipped military cadence, firm and direct',
    'voice: calm medic tone, measured and reassuring',
    'voice: fast-talking scavenger, nervous edge',
    'voice: charismatic trader patter, sly and smooth',
    'voice: stern elder tone, deliberate and low',
    'voice: cheerful but eerie vault-tec cadence',
    'voice: rough outlaw drawl, dry sarcasm',
  ];
  var hash = 0;
  for (var i = 0; i < npcKey.length; i++) hash = ((hash << 5) - hash + npcKey.charCodeAt(i)) | 0;
  return voices[Math.abs(hash) % voices.length];
}

/**
 * Collect the key nodes to generate videos for from a dialog file.
 * In KEY_NODES_ONLY mode (default): intro, quest offer nodes, fallback only.
 * In ALL_NODES mode (ALL_NODES=1): every dialog branch node.
 * Returns array of { nodeId, text, videoSpeech } objects.
 */
function collectNodes(npcId, dialog) {
  var nodes = [];

  function addNode(node) {
    if (!node || !node.id) return;
    nodes.push({
      nodeId: node.id,
      text: node.text || '',
      videoSpeech: node.video_speech || null,
    });
  }

  if (ONE_PER_NPC || KEY_NODES_ONLY) {
    // Always include intro
    if (dialog.intro) addNode(dialog.intro);

    // Quest offer nodes (contain offers_quest) — essential for quest flow
    var sections = ['knowledge_nodes', 'emotional_nodes', 'quest_nodes'];
    sections.forEach(function (key) {
      if (Array.isArray(dialog[key])) {
        dialog[key].forEach(function (n) {
          if (KEY_NODES_ONLY && !n.offers_quest) return; // only quest offers in key mode
          addNode(n);
        });
      }
    });

    // Fallback node
    if (dialog.fallback) addNode(dialog.fallback);

    if (ONE_PER_NPC) {
      // Collapse to single intro-preferred node
      var chosen =
        nodes.find(function (n) { return /intro/i.test(String(n.nodeId || '')); }) ||
        nodes[0];
      nodes = chosen ? [chosen] : [];
    }
  } else {
    // ALL_NODES mode — include everything
    if (dialog.intro) addNode(dialog.intro);
    if (dialog.fallback) addNode(dialog.fallback);
    var allSections = ['knowledge_nodes', 'emotional_nodes', 'quest_nodes'];
    allSections.forEach(function (key) {
      if (Array.isArray(dialog[key])) { dialog[key].forEach(addNode); }
    });
    if (dialog.nodes && typeof dialog.nodes === 'object') {
      Object.keys(dialog.nodes).forEach(function (id) { addNode(dialog.nodes[id]); });
    }
    if (Array.isArray(dialog.wildcards)) { dialog.wildcards.forEach(addNode); }
  }

  // Deduplicate by nodeId
  var seen = {};
  return nodes.filter(function (n) {
    if (seen[n.nodeId]) return false;
    seen[n.nodeId] = true;
    return true;
  });
}

/**
 * Build a Fallout-themed video prompt for a specific dialog node.
 * @param {string} npcId
 * @param {object} dialog
 * @param {string} nodeId
 * @param {string} nodeText  - Raw node text (used when videoSpeech is absent)
 * @param {string|null} videoSpeech - Pre-written speech line; takes priority over extraction
 */
function buildNodePrompt(npcId, dialog, nodeId, nodeText, videoSpeech) {
  var lore       = NPC_LORE_OVERRIDES[npcId] || {};
  var npcKey     = sanitise(npcId || dialog.id || dialog.npc || 'unknown_npc', 60).toLowerCase();
  var name       = sanitise(lore.display_name || dialog.npc || dialog.id || 'Unknown NPC', 60);
  var portrait   = sanitise(lore.portrait_anchor || dialog.portrait || 'wasteland survivor', 120);
  var desc       = sanitise(lore.description_anchor || dialog.description || '', 180);
  var mood       = sanitise(dialog.mood || 'neutral', 30);
  var personality = Array.isArray(dialog.personality)
    ? dialog.personality.slice(0, 3).join(', ')
    : '';
  // Use pre-written video_speech when available; otherwise extract from raw text
  var speech = videoSpeech
    ? truncateAtSentence(sanitise(videoSpeech, 300), MAX_SPEECH_WORDS)
    : extractVideoSpeech(nodeText, MAX_SPEECH_WORDS);
  var voiceProfile = pickVoiceProfile(npcKey);

  return (
    `Fallout post-apocalyptic wasteland style, ${DURATION}-second cinematic clip. ` +
    `NPC named ${name}. Appearance: ${portrait}. ` +
    `Identity lock: character_id=${npcKey}; keep the exact same person across all scenes with this character_id ` +
    `(same face structure, hair/facial hair, age, skin tone, body type, signature clothing and accessories). ` +
    `Do not redesign or swap actor identity between scenes. ` +
    (lore.prompt_lore ? `Lore anchor: ${sanitise(lore.prompt_lore, 220)}. ` : '') +
    `${voiceProfile}. Keep this exact voice profile for character_id=${npcKey} in every scene. ` +
    (desc ? `Character: ${desc}. ` : '') +
    `Mood: ${mood}${personality ? ', personality: ' + personality : ''}. ` +
    (speech ? `NPC delivers this complete line: "${speech}". Must finish the full sentence before the clip ends — no words cut off. Deliver at a measured wasteland pace within ${DURATION} seconds. ` : '') +
    `Pocket-Boy green terminal tint, moody wasteland lighting, retro 1950s aesthetic.`
  ).slice(0, 2000);
}

/**
 * Download a URL to a local file path.
 */
async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed HTTP ${res.status} for ${url}`);
  const arrayBuf = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuf));
  return true;
}

/**
 * Upload a local file to Cloudflare R2 using the S3-compatible API.
 * R2 endpoint: https://<accountId>.r2.cloudflarestorage.com
 * Returns the public CDN URL (via R2_PUBLIC_URL).
 *
 * Uses the AWS Signature V4 signing process via the built-in crypto module —
 * no AWS SDK dependency needed.
 */
async function uploadToR2(localPath, r2Key) {
  const crypto = require('crypto');

  const fileBuffer = fs.readFileSync(localPath);
  const host       = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const endpoint   = `https://${host}/${R2_BUCKET_NAME}/${r2Key}`;
  const region     = 'auto';
  const service    = 's3';
  const now        = new Date();
  const amzDate    = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp  = amzDate.slice(0, 8);
  const payloadHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  const canonicalHeaders =
    `content-type:video/mp4\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    'PUT',
    `/${R2_BUCKET_NAME}/${r2Key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  function hmac(key, data) {
    return crypto.createHmac('sha256', key).update(data).digest();
  }
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp), region), service),
    'aws4_request'
  );
  const signature = hmac(signingKey, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      'Content-Type':          'video/mp4',
      'x-amz-content-sha256':  payloadHash,
      'x-amz-date':            amzDate,
      'Authorization':          authorization,
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`R2 upload failed HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  return `${R2_PUBLIC_URL}/${r2Key}`;
}

/**
 * Load the manifest or return a fresh one.
 */
function loadManifest() {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return { _readme: 'Pre-baked NPC video manifest', _version: 2, _generated: null, npcs: {} };
  }
}

/**
 * Save the manifest to disk.
 */
function saveManifest(manifest) {
  manifest._generated = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

// -----------------------------------------------------------------------
// Discover NPC dialog files
// -----------------------------------------------------------------------
function discoverDialogs() {
  const files = fs.readdirSync(DIALOG_DIR).filter((f) => f.startsWith('dialog_') && f.endsWith('.json'));
  const dialogs = [];

  for (const file of files) {
    const npcId = file.replace(/^dialog_/, '').replace(/\.json$/, '');
    if (NPC_FILTER && !NPC_FILTER.includes(npcId)) continue;

    try {
      const raw    = fs.readFileSync(path.join(DIALOG_DIR, file), 'utf8');
      const dialog = JSON.parse(raw);
      dialogs.push({ npcId, dialog, file });
    } catch (err) {
      console.warn(`[prebake] Could not parse ${file}: ${err.message}`);
    }
  }

  return dialogs;
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------
async function main() {
  console.log('');
  console.log('☢  Atomic Fizz Caps — NPC Video Pre-Baker');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no API calls)' : 'LIVE'}`);
  console.log(`   Storage: ${USE_R2 ? `Cloudflare R2 (${R2_BUCKET_NAME})` : 'Local only (NO_UPLOAD=1 or R2 not configured)'}`);
  console.log(`   Duration: ${DURATION}s  |  Aspect: ${ASPECT}  |  Resolution: ${RESOLUTION}`);
  if (ONE_PER_NPC) console.log('   Mode: One video per NPC (intro-preferred)');
  else if (KEY_NODES_ONLY) console.log('   Mode: Key nodes only — intro + quest offers + fallback (set ALL_NODES=1 for all)');
  else console.log('   Mode: All dialog nodes (ALL_NODES=1)');
  if (NPC_FILTER) console.log(`   Filter: ${NPC_FILTER.join(', ')}`);
  console.log('');

  if (!DRY_RUN && !process.env.XAI_API_KEY) {
    console.error('❌  XAI_API_KEY is not set. Export it or add it to .env');
    process.exit(1);
  }

  if (!DRY_RUN && !USE_R2 && !NO_UPLOAD) {
    console.warn('⚠️   R2 not configured. Videos will be saved locally only.');
    console.warn('    Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,');
    console.warn('    R2_BUCKET_NAME, R2_PUBLIC_URL in .env to auto-upload.');
    console.warn('    Or set NO_UPLOAD=1 to suppress this warning.');
    console.warn('');
  }

  fs.mkdirSync(VIDEO_OUT_DIR, { recursive: true });

  const discovered = discoverDialogs();
  if (discovered.length === 0) {
    console.warn('   No dialog files matched. Check NPC_FILTER or DIALOG_DIR.');
    process.exit(0);
  }

  console.log(`   Found ${discovered.length} NPC(s) to process.\n`);

  const manifest = loadManifest();
  let generated = 0;
  let skipped   = 0;
  let failed    = 0;

  // Build a flat list of all (npcId, nodeId, nodeText, videoSpeech) work items
  const workItems = [];
  for (const { npcId, dialog } of discovered) {
    const lore = NPC_LORE_OVERRIDES[npcId] || {};
    if (!INCLUDE_ENDGAME_NPCS && lore.visibility === 'endgame_only') {
      console.log(`   [lore-skip] ${npcId} is endgame_only (set INCLUDE_ENDGAME_NPCS=1 to include)`);
      continue;
    }

    const nodes = collectNodes(npcId, dialog);
    if (nodes.length === 0) {
      // Dialog file has no standard content nodes — synthesize one intro line from description
      // Use lore default_video_speech if set, which is ideal for entries-format dialog files
      workItems.push({
        npcId,
        dialog,
        nodeId: `${npcId}_auto_intro`,
        nodeText: dialog.description || `${dialog.npc || npcId} introduces themselves in the wasteland.`,
        videoSpeech: lore.default_video_speech || null,
      });
      continue;
    }

    for (const { nodeId, text, videoSpeech } of nodes) {
      workItems.push({ npcId, dialog, nodeId, nodeText: text, videoSpeech });
    }
  }

  console.log(`   Total nodes to generate: ${workItems.length}\n`);

  for (let i = 0; i < workItems.length; i++) {
    const { npcId, dialog, nodeId, nodeText, videoSpeech } = workItems[i];
    const videoFile = `${npcId}_${nodeId}.mp4`;
    const videoPath = path.join(VIDEO_OUT_DIR, videoFile);
    const r2Key     = `npc/${videoFile}`;

    const label = `${npcId}/${nodeId}`;
    process.stdout.write(`[${i + 1}/${workItems.length}] ${label.padEnd(40)} `);

    // Determine if this node already has a URL in the manifest
    const existingUrl = manifest.npcs[npcId] && manifest.npcs[npcId][nodeId];
    const localExists = fs.existsSync(videoPath);

    // Skip if R2 URL already in manifest (most reliable signal)
    if (SKIP_EXISTING && existingUrl && String(existingUrl).startsWith('http')) {
      console.log('→ SKIP (R2 URL in manifest)');
      skipped++;
      continue;
    }

    // Skip if local file exists and we're in local-only mode
    if (SKIP_EXISTING && localExists && !USE_R2) {
      if (!manifest.npcs[npcId]) manifest.npcs[npcId] = {};
      manifest.npcs[npcId][nodeId] = `/videos/npc/${videoFile}`;
      console.log('→ SKIP (local file exists)');
      skipped++;
      continue;
    }

    const prompt = buildNodePrompt(npcId, dialog, nodeId, nodeText, videoSpeech);

    if (DRY_RUN) {
      console.log(`→ DRY RUN — prompt (${prompt.length} chars)`);
      console.log(`   "${prompt.slice(0, 120)}..."`);
      skipped++;
      continue;
    }

    const start = Date.now();
    try {
      // 1. Generate via xAI — get a temporary URL
      const videoUrl = await generateVideo(prompt, {
        duration  : DURATION,
        aspect    : ASPECT,
        resolution: RESOLUTION,
      });

      // 2. Download to local disk (needed for R2 upload and as local cache)
      await downloadFile(videoUrl, videoPath);
      const sizeKb = Math.round(fs.statSync(videoPath).size / 1024);

      // 3. Upload to R2 (if configured) — get a permanent public URL
      let finalUrl;
      if (USE_R2) {
        finalUrl = await uploadToR2(videoPath, r2Key);
        process.stdout.write(`→ R2 OK  `);
      } else {
        finalUrl = `/videos/npc/${videoFile}`;
        process.stdout.write(`→ LOCAL  `);
      }

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`${elapsed}s  ${sizeKb} KB  ${finalUrl}`);

      if (!manifest.npcs[npcId]) manifest.npcs[npcId] = {};
      manifest.npcs[npcId][nodeId] = finalUrl;
      generated++;
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`→ FAIL  ${elapsed}s  ${err.message}`);
      failed++;
    }

    // Save manifest after each success so partial runs aren't lost
    if (generated % 5 === 0 && generated > 0) saveManifest(manifest);

    // Polite delay between API calls
    if (i < workItems.length - 1 && !DRY_RUN) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // Final manifest save
  saveManifest(manifest);

  console.log('');
  console.log(`💾  Manifest saved → ${MANIFEST_PATH}`);
  console.log(`   Generated: ${generated}  |  Skipped: ${skipped}  |  Failed: ${failed}`);
  console.log('');

  if (USE_R2) {
    console.log('   ✅  Videos are live on Cloudflare R2. Deploy the manifest:');
    console.log('   git add public/data/npc-videos.json');
    console.log('   git commit -m "chore: update NPC video manifest"');
    console.log('   git push  →  done. Players get videos instantly.');
  } else {
    console.log('   Videos saved locally. Configure R2 vars to auto-upload, or');
    console.log('   commit the MP4s manually for small sets (< 100MB).');
  }

  console.log('');
  console.log('   Rads stable. Players will never wait on generation again, smoothskin.');

  if (failed > 0 && generated === 0) process.exit(1);
}

main().catch((err) => {
  console.error('[prebake] Fatal:', err);
  process.exit(1);
});
