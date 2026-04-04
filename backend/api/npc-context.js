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
const rateLimit = require('express-rate-limit');

const { authMiddleware } = require('../lib/auth');
const { buildNPCContext, generateDynamicEncounter, prepareCharacterCast } =
  require('../lib/npc-xai-context');

// SEC-013 FIX: Rate-limit all NPC context endpoints to prevent unauthenticated
// callers from draining xAI / HuggingFace API quota.
// The encounter endpoint calls generateDynamicEncounter → Grok API; without a
// limit an attacker could exhaust the API key with trivial requests.
const npcContextLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many NPC context requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for the AI-backed encounter endpoint (each request costs tokens)
// SEC-013 FIX: key by authenticated wallet address instead of IP to prevent
// one wallet from exhausting quota for all users behind the same NAT/proxy.
const encounterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req.player && req.player.wallet) || req.ip,
  message: { error: 'Too many encounter generation requests — slow down, Vault Dweller' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Simple input sanitizer — strips characters that cannot appear in an NPC id
function sanitizeId(raw) {
  return String(raw || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 64).toLowerCase();
}

// -----------------------------------------------------------------------
// GET /api/npc-context
// Returns the full character cast (all NPC profiles).
// -----------------------------------------------------------------------
router.get('/', npcContextLimiter, (req, res) => {
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
router.get('/:npcId', npcContextLimiter, (req, res) => {
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
// SEC-013 FIX: Requires authentication (authMiddleware) AND a strict rate
// limiter (encounterLimiter) because each call hits the xAI / HF API and
// consumes paid tokens.  Previously unauthenticated with no per-route limit.
// Query params:
//   ?level=<number>
//   ?region=<string>
//   ?faction=<string>  hostile faction id
// -----------------------------------------------------------------------
router.get('/:npcId/encounter', authMiddleware, encounterLimiter, async (req, res) => {
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
    return res.status(500).json({ error: 'Encounter generation failed' });
  }
});

module.exports = router;
