---
name: wasteland-avatars
description: >
  End-to-end avatar, portrait, video clip, and character asset pipeline for NPCs and players.
  Covers Grok Imagine / HF direct, RealAI character endpoint, enhance scripts, validation,
  integration into frontend data and map, and the various guides (GROK_AVATAR_GUIDE, AVATAR_*, etc.).
  Use for "generate avatars for the new raider faction", "fix broken NPC images", "add video to overseer".
metadata:
  short-description: "Avatar / portrait / NPC visual + video generation and integration"
---

# Wasteland Avatar & Character Asset Pipeline

Avatars are a huge part of the identity and "real AI" feel of the game (Pocket-Boy wrist UI showing living NPCs).

## Main Workflows
- Direct Grok + HF: `grok-avatars.js`, `grok-only-avatars.js`, `integrate-grok-avatars.sh`, `enhance-avatar-assets.js`, `validate-avatars.sh`.
- Via RealAI provider: `POST /v1/characters` (style fallout-meme or solana-game) from the sibling realai UI or scripts. See `realai:gen:*` and CANONICAL_GENERATOR_WORKFLOW.
- Video: `scripts/test_video_generation.js`, `/api/npc/video/generate`, prebake scripts.
- Post-process + integrate: `integrate-avatars.sh`, copy into `frontend/assets/`, `frontend/img/`, data JSONs, map markers.

## Guides (read before starting)
- `GROK_AVATAR_GUIDE.md`
- `GROK_ONLY_AVATAR_SYSTEM.md`
- `AI_AVATAR_GENERATION_GUIDE.md`
- `AVATAR_GENERATION_WORKFLOW.md`
- `AVATAR_SYSTEM_README.md`
- `frontend/CHARACTER_ASSETS_QUICKSTART.md` etc. in docs/features/
- `validate-avatars.sh` and `integrate-avatars.sh` for the mechanical steps.

## Recommended Steps
1. Decide source: prefer RealAI structured characters when possible (consistent with quests/lore), fall back to direct Grok Imagine for pure visuals or when volume/speed matters.
2. Generate batch (node script or RealAI call).
3. Enhance / upscale / style transfer if the scripts do it.
4. Validate (no broken images, correct dimensions, naming convention).
5. Integrate: run the integrate script, or manually place in the right asset dirs + update any manifest / data files the frontend uses for that NPC/faction.
6. Test in browser: character creator test pages, map with new icons, Overseer / NPC dialogue that references the new face.
7. For video clips: run the generation + wire into the NPC data and frontend video player.

## Gotchas
- Asset paths in frontend are finicky (svg fallbacks, multiple layers for icons).
- Naming must match the NPC id / key used in quests, systems, backend data.
- HF API key sharing across repos (see the HF guides in docs/setup/).
- Cost: image + video gen adds up; use small batches and --no-video first for text-only iteration.
- RealAI provider may need the image model stack running (see realai models/image/, providers/image/).

## Coordination
- When the visual language changes, update character creator docs and test HTMLs.
- New assets often require frontend/js changes for display (especially map markers, inventory thumbnails, dialogue portraits).
- If using for player mintable companions or scrap NFTs, also touch Solana side + mint workers.

After a big avatar drop, run visual-playtest and manual map + dialogue smoke tests.
