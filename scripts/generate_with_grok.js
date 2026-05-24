#!/usr/bin/env node
// scripts/generate_with_grok.js
// Bulk-generate wasteland NPCs (and optionally short video clips) via
// xAI Grok and save the result to generated_npcs_grok.json.
//
// Usage:
//   XAI_API_KEY=xai-... node scripts/generate_with_grok.js [count] [--no-video]
//
// Arguments:
//   count       Number of NPCs to generate (default: 5, max: 20 per call).
//   --no-video  Skip video generation even if XAI_API_KEY is set.
//
// Output:
//   generated_npcs_grok.json in the project root.

'use strict';

try {
  require('dotenv').config();
} catch (_) {
  // dotenv not installed — run `npm install` in the project root.
  // Environment variables may already be set via the shell; continue.
  console.warn('[generate_with_grok] dotenv not found — run `npm install` to load .env files automatically.');
}

const fs   = require('fs');
const path = require('path');

const { generateNPCBatch, generateVideo } = require('../backend/lib/grok');

// -----------------------------------------------------------------------
// CLI argument parsing
// -----------------------------------------------------------------------
const args      = process.argv.slice(2);
const countArg  = args.find((a) => /^\d+$/.test(a));
const noVideo   = args.includes('--no-video');
const npcCount  = countArg ? Math.max(1, Math.min(parseInt(countArg, 10), 20)) : 5;

// -----------------------------------------------------------------------
// Video generation defaults (can be overridden via env vars for flexibility)
// -----------------------------------------------------------------------
const VIDEO_DURATION_SECONDS = parseInt(process.env.GROK_VIDEO_DURATION || '8', 10);
const VIDEO_ASPECT_RATIO     = process.env.GROK_VIDEO_ASPECT     || '16:9';
const VIDEO_RESOLUTION       = process.env.GROK_VIDEO_RESOLUTION || '720p';

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------
async function bulkGenerate() {
  if (!process.env.XAI_API_KEY) {
    console.error('[generate_with_grok] XAI_API_KEY is not set. Cannot continue.');
    console.error('  Set it in .env or pass it as an environment variable:');
    console.error('  XAI_API_KEY=xai-... node scripts/generate_with_grok.js');
    process.exit(1);
  }

  console.log(`☢  Atomic Fizz Caps — Grok NPC Generator`);
  console.log(`   Generating ${npcCount} NPCs… stand by, smoothskin.`);

  let npcs;
  try {
    npcs = await generateNPCBatch(npcCount);
  } catch (err) {
    console.error('[generate_with_grok] NPC batch generation failed:', err.message);
    process.exit(1);
  }

  if (!npcs || npcs.length === 0) {
    console.error('[generate_with_grok] No NPCs returned — check prompt / API response.');
    process.exit(1);
  }

  console.log(`✅  Received ${npcs.length} NPC(s) from Grok.`);

  // -----------------------------------------------------------------------
  // Optional: generate a short video for each NPC
  // -----------------------------------------------------------------------
  if (!noVideo) {
    console.log('🎬  Generating videos for each NPC (use --no-video to skip)…');

    for (const npc of npcs) {
      const seed = npc.videoPromptSeed || `${npc.name}, ${npc.appearance || 'wasteland survivor'}`;
      const videoPrompt =
        `Fallout retro animated style, 8-second clip: ${seed}. ` +
        `Wasteland background, radiation glow, gritty 1950s filter, Pocket-Boy green tint.`;

      try {
        const videoUrl = await generateVideo(videoPrompt, {
          duration  : VIDEO_DURATION_SECONDS,
          aspect    : VIDEO_ASPECT_RATIO,
          resolution: VIDEO_RESOLUTION,
        });
        npc.videoUrl = videoUrl;
        console.log(`   🎥  ${npc.name || npc.id}: ${videoUrl}`);
      } catch (err) {
        console.error(`   ⚠  Video failed for ${npc.name || npc.id}: ${err.message}`);
        // Non-fatal — continue with remaining NPCs
      }

      // Polite delay between requests to respect rate limits (~60 rpm for video)
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  // -----------------------------------------------------------------------
  // Save output
  // -----------------------------------------------------------------------
  const outFile = path.resolve(__dirname, '..', 'generated_npcs_grok.json');
  fs.writeFileSync(outFile, JSON.stringify(npcs, null, 2), 'utf8');
  console.log(`\n💾  Saved ${npcs.length} NPC(s) to ${outFile}`);
  console.log('   Rads rising. Load those NPCs into the wasteland, smoothskin.');
}

bulkGenerate().catch((err) => {
  console.error('[generate_with_grok] Fatal error:', err);
  process.exit(1);
});
