#!/usr/bin/env node
// scripts/test_video_generation.js
// Quickly generate 2-3 short Fallout-themed test videos via the xAI API.
// No NPC batch generation — uses hard-coded prompts for a fast sanity check.
//
// Usage:
//   XAI_API_KEY=xai-... node scripts/test_video_generation.js
//   # or, if you have a .env file:
//   node scripts/test_video_generation.js
//
// Output:
//   test_videos_output.json  — saved in the project root.
//
// Options (env vars):
//   GROK_VIDEO_DURATION   - Duration in seconds (default: 5)
//   GROK_VIDEO_ASPECT     - Aspect ratio (default: '16:9')
//   GROK_VIDEO_RESOLUTION - Resolution (default: '720p')
//   TEST_VIDEO_COUNT      - Number of test videos to generate (1–3, default: 2)

'use strict';

try {
  require('dotenv').config();
} catch (_) {
  console.warn('[test_video] dotenv not found — run `npm install` first, or export XAI_API_KEY manually.');
}

const fs   = require('fs');
const path = require('path');

const { generateVideo } = require('../backend/lib/grok');

// -----------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------
const DURATION   = parseInt(process.env.GROK_VIDEO_DURATION   || '5',   10);
const ASPECT     = process.env.GROK_VIDEO_ASPECT               || '16:9';
const RESOLUTION = process.env.GROK_VIDEO_RESOLUTION           || '720p';
const COUNT      = Math.max(1, Math.min(parseInt(process.env.TEST_VIDEO_COUNT || '2', 10), 3));
const DELAY_MS   = parseInt(process.env.GROK_VIDEO_DELAY_MS    || '1200', 10);

// Hard-coded Fallout-themed prompts for a self-contained smoke test.
// Each covers a different NPC archetype so you can spot-check variety.
const TEST_PROMPTS = [
  {
    label: 'Trader at collapsed highway market',
    prompt:
      'Fallout retro animated style, 5-second clip: a weathered caravan trader in a battered leather duster ' +
      'stands at a makeshift market stall on a collapsed highway overpass, haggling over scrap metal and Nuka-Cola. ' +
      'Wasteland backdrop, radiation haze, warm golden sunset, gritty 1950s filter, Pocket-Boy green HUD overlay.',
  },
  {
    label: 'Vault-Tec propaganda broadcast',
    prompt:
      'Fallout retro animated style, 5-second clip: a cheerful 1950s Vault-Tec announcer in a pristine blue jumpsuit ' +
      'gestures at a glowing holographic poster of Vault 77. Retro TV static overlay, warm amber studio lights, ' +
      'exaggerated corporate optimism clashing with visible wasteland ruins through a cracked window.',
  },
  {
    label: 'Super Mutant warlord monologue',
    prompt:
      'Fallout retro animated style, 5-second clip: a massive green Super Mutant warlord pounds his chest ' +
      'atop a ruined skyscraper, yelling at a crowd of raiders below. Stormy sky, lightning strikes, ' +
      'radioactive green glow around him, gritty post-apocalyptic atmosphere, Pocket-Boy green tint.',
  },
];

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------
async function runTestGeneration() {
  if (!process.env.XAI_API_KEY) {
    console.error('');
    console.error('❌  XAI_API_KEY is not set.');
    console.error('');
    console.error('  1. Get a key at https://console.x.ai/');
    console.error('  2. Add it to your .env file:   XAI_API_KEY=xai-...');
    console.error('  3. Re-run:   node scripts/test_video_generation.js');
    console.error('');
    process.exit(1);
  }

  const prompts = TEST_PROMPTS.slice(0, COUNT);

  console.log('');
  console.log('☢  Atomic Fizz Caps — xAI Video Generation Test');
  console.log(`   Generating ${prompts.length} test video(s) — stand by, smoothskin.`);
  console.log(`   Duration: ${DURATION}s  |  Aspect: ${ASPECT}  |  Resolution: ${RESOLUTION}`);
  console.log('');

  const results = [];

  for (let i = 0; i < prompts.length; i++) {
    const { label, prompt } = prompts[i];
    console.log(`[${i + 1}/${prompts.length}] Generating: "${label}"…`);

    const start = Date.now();
    try {
      const url = await generateVideo(prompt, {
        duration  : DURATION,
        aspect    : ASPECT,
        resolution: RESOLUTION,
      });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`   ✅  Done in ${elapsed}s → ${url}`);
      results.push({ label, prompt, url, ok: true, elapsedSeconds: parseFloat(elapsed) });
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.error(`   ⚠   Failed after ${elapsed}s: ${err.message}`);
      results.push({ label, prompt, url: null, ok: false, error: err.message, elapsedSeconds: parseFloat(elapsed) });
    }

    // Polite delay between requests to respect upstream rate limits
    if (i < prompts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  // -----------------------------------------------------------------------
  // Save results
  // -----------------------------------------------------------------------
  const outFile = path.resolve(__dirname, '..', 'test_videos_output.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8');

  const succeeded = results.filter((r) => r.ok).length;
  console.log('');
  console.log(`💾  Results saved to ${outFile}`);
  console.log(`   ${succeeded}/${results.length} video(s) succeeded.`);

  if (succeeded > 0) {
    console.log('');
    console.log('🎬  Video URLs:');
    results.filter((r) => r.ok).forEach((r) => console.log(`   ${r.url}`));
  }

  console.log('');
  console.log('   Rads rising. Paste those URLs into a browser to preview your footage, smoothskin.');

  // Exit non-zero only if ALL videos failed
  if (succeeded === 0) process.exit(1);
}

runTestGeneration().catch((err) => {
  console.error('[test_video] Fatal error:', err);
  process.exit(1);
});
