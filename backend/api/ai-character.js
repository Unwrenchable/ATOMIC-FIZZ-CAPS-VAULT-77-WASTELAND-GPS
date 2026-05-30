const express = require('express');
const router = express.Router();

const { resolveOverseerContext, saveOverseerContext } = require('../realai/overseer-context');
const {
  generateCharacterConcept,
  generateCharacterNames,
  generateNpcDossier
} = require('../realai/overseer-creator');

function safeBody(req) {
  return req && req.body && typeof req.body === 'object' ? req.body : {};
}

async function getContext(req) {
  try {
    return await resolveOverseerContext(req, safeBody(req));
  } catch (error) {
    console.error('[ai-character] failed to resolve Overseer context', error);
    return {
      wallet: null,
      profile: null,
      recentConversation: [],
      memory: {},
      learnedFacts: []
    };
  }
}

router.post('/generate-concept', async (req, res) => {
  try {
    const body = safeBody(req);
    const overseerContext = await getContext(req);
    const concept = generateCharacterConcept(body, overseerContext);
    await saveOverseerContext(
      overseerContext,
      `Generated a character concept for ${concept.suggestedName || 'a wastelander'}.`
    );

    return res.json({
      ok: true,
      source: 'overseer-local',
      concept
    });
  } catch (error) {
    console.error('[ai-character] concept generation failed', error);
    return res.status(500).json({
      ok: false,
      error: 'Overseer character forge jammed. Try the terminal again in a minute.'
    });
  }
});

router.post('/generate-names', async (req, res) => {
  try {
    const body = safeBody(req);
    const overseerContext = await getContext(req);
    const names = generateCharacterNames(body, overseerContext);
    await saveOverseerContext(overseerContext, 'Generated a fresh set of wasteland names.');

    return res.json({
      ok: true,
      source: 'overseer-local',
      names
    });
  } catch (error) {
    console.error('[ai-character] name generation failed', error);
    return res.status(500).json({
      ok: false,
      error: 'Name forge offline. The Overseer misplaced the roster.'
    });
  }
});

router.post('/generate-npc', async (req, res) => {
  try {
    const body = safeBody(req);
    const overseerContext = await getContext(req);
    const npc = generateNpcDossier(body, overseerContext);
    await saveOverseerContext(
      overseerContext,
      `Forged NPC dossier ${npc.name || 'unknown contact'} in sector ${npc.homeRegion || 'wasteland'}.`
    );

    return res.json({
      ok: true,
      source: 'overseer-local',
      npc
    });
  } catch (error) {
    console.error('[ai-character] npc generation failed', error);
    return res.status(500).json({
      ok: false,
      error: 'NPC forge offline. The wasteland contact board is full of static.'
    });
  }
});

router.get('/health', async (req, res) => {
  const overseerContext = await getContext(req);
  return res.json({
    ok: true,
    status: 'ok',
    source: 'overseer-local',
    hasSession: !!overseerContext.wallet,
    rememberedLines: Array.isArray(overseerContext.recentConversation)
      ? overseerContext.recentConversation.length
      : 0
  });
});

module.exports = router;
