// backend/api/npc-context.js
// -----------------------------------------------------------------------
// Atomic Fizz Caps – NPC xAI Context API
// GET  /api/npc-context/:npcId          → static NPC profile + prompt context
// GET  /api/npc-context/:npcId/encounter → dynamic AI-generated encounter
// GET  /api/npc-context                  → full character cast list
// -----------------------------------------------------------------------
'use strict';

const express = require('express');
const router  = express.Router();

const { buildNPCContext, generateDynamicEncounter, prepareCharacterCast } =
  require('../lib/npc-xai-context');

// Simple input sanitizer — strips characters that cannot appear in an NPC id
function sanitizeId(raw) {
  return String(raw || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64).toLowerCase();
}

// -----------------------------------------------------------------------
// GET /api/npc-context
// Returns the full character cast (all NPC profiles).
// -----------------------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const cast = prepareCharacterCast();
    return res.json({ cast, total: cast.length });
  } catch (err) {
    console.error('[npc-context] prepareCharacterCast error:', err.message);
    return res.status(500).json({ error: 'Failed to prepare character cast' });
  }
});

// -----------------------------------------------------------------------
// GET /api/npc-context/:npcId
// Returns the xAI prompt context for a single NPC.
// Accepts optional query params:
//   ?level=<number>   player level (default 1)
//   ?faction=<string> player faction id
//   ?region=<string>  current region name
// -----------------------------------------------------------------------
router.get('/:npcId', (req, res) => {
  const npcId = sanitizeId(req.params.npcId);
  if (!npcId) {
    return res.status(400).json({ error: 'npcId is required' });
  }

  const playerContext = {
    level : parseInt(req.query.level,   10) || 1,
    faction: sanitizeId(req.query.faction || ''),
    region : String(req.query.region || 'wasteland').slice(0, 80),
  };

  const ctx = buildNPCContext(npcId, playerContext);
  if (!ctx) {
    return res.status(404).json({ error: `NPC "${npcId}" not found` });
  }

  // Strip the raw grok_opts from the public response (internal use only)
  const { grok_opts: _grokOpts, ...publicCtx } = ctx;
  return res.json(publicCtx);
});

// -----------------------------------------------------------------------
// GET /api/npc-context/:npcId/encounter
// Generates a dynamic AI-powered encounter narrative for the NPC's region.
// Query params:
//   ?level=<number>
//   ?region=<string>
//   ?faction=<string>  hostile faction id
// -----------------------------------------------------------------------
router.get('/:npcId/encounter', async (req, res) => {
  const npcId = sanitizeId(req.params.npcId);
  if (!npcId) {
    return res.status(400).json({ error: 'npcId is required' });
  }

  const level    = parseInt(req.query.level,   10) || 1;
  const region   = String(req.query.region   || 'wasteland').slice(0, 80);
  const faction  = sanitizeId(req.query.faction || 'raiders');

  try {
    const narrative = await generateDynamicEncounter(region, level, faction);
    return res.json({ npc_id: npcId, region, level, faction, narrative });
  } catch (err) {
    console.error('[npc-context] generateDynamicEncounter error:', err.message);
    return res.status(500).json({ error: 'Encounter generation failed', detail: err.message });
  }
});

module.exports = router;
