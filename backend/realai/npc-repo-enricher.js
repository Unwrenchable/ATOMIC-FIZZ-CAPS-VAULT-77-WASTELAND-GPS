'use strict';

const crypto = require('crypto');
const avatarManifest = require('../../public/assets/avatars/manifest.json');
const { generateNpcDossier } = require('./overseer-creator');

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasDialog(npc) {
  if (!npc || typeof npc !== 'object') return false;

  if (Array.isArray(npc.dialogPool) && npc.dialogPool.some(hasText)) {
    return true;
  }

  if (Array.isArray(npc.dialog) && npc.dialog.some(hasText)) {
    return true;
  }

  if (isObject(npc.dialog)) {
    return Object.values(npc.dialog).some((entry) => {
      if (Array.isArray(entry)) return entry.some(hasText);
      return hasText(entry);
    });
  }

  return false;
}

function hashByte(seed, offset) {
  const digest = crypto.createHash('sha256').update(String(seed || 'vault-77')).digest();
  return digest[offset % digest.length];
}

function pick(seed, values, fallback) {
  if (!Array.isArray(values) || values.length === 0) return fallback;
  return values[hashByte(seed, 0) % values.length];
}

function chance(seed, threshold) {
  const normalized = hashByte(seed, 11) / 255;
  return normalized < threshold;
}

function mapScarToAsset(scar) {
  const value = String(scar || '').toLowerCase();
  const table = {
    cheek_left: 'scar_cheek_left.svg',
    cheek_right: 'scar_cheek_right.svg',
    brow: 'scar_brow.svg',
    forehead: 'scar_forehead.svg',
    lip: 'scar_lip.svg',
    burn_left: 'scar_burn_left.svg',
    burn_right: 'scar_burn_right.svg',
    bullet: 'scar_bullet.svg',
    claw: 'scar_claw.svg'
  };
  return table[value] || '';
}

function mapAccessoryToAsset(accessory) {
  const value = String(accessory || '').toLowerCase();
  const table = {
    eyepatch: 'acc_eyepatch_left.svg',
    glasses: 'acc_glasses.svg',
    sunglasses: 'acc_sunglasses.svg',
    goggles: 'acc_goggles.svg',
    bandana: 'acc_bandana.svg',
    respirator: 'acc_respirator.svg',
    earring: 'acc_earring_left.svg',
    earrings: 'acc_earrings_both.svg',
    nose_ring: 'acc_nose_ring.svg',
    cybernetic_eye: 'acc_cybernetic_eye.svg'
  };
  return table[value] || '';
}

function buildParts(idSeed, hints) {
  const partsCatalog = (avatarManifest && avatarManifest.parts) || {};
  const parts = {
    head: pick(`${idSeed}:head`, partsCatalog.head, 'head_base.svg'),
    eyes: pick(`${idSeed}:eyes`, partsCatalog.eyes, 'eyes_set1.svg'),
    nose: pick(`${idSeed}:nose`, partsCatalog.nose, 'nose_straight.svg'),
    mouth: pick(`${idSeed}:mouth`, partsCatalog.mouth, 'mouth_thin.svg'),
    hair: pick(`${idSeed}:hair`, partsCatalog.hair, 'hair_short.svg'),
    shirt: pick(`${idSeed}:shirt`, partsCatalog.shirt, 'shirt_jacket.svg')
  };

  const scarAsset = mapScarToAsset(hints && hints.scar);
  if (scarAsset && (partsCatalog.scars || []).includes(scarAsset)) {
    parts.scars = scarAsset;
  }

  const accessoryAsset = mapAccessoryToAsset(hints && hints.accessory);
  if (accessoryAsset && (partsCatalog.accessories || []).includes(accessoryAsset)) {
    parts.accessories = accessoryAsset;
  }

  if (String((hints && hints.race) || '').toLowerCase() === 'synth') {
    if ((partsCatalog.markings || []).includes('marking_circuitry.svg')) {
      parts.markings = 'marking_circuitry.svg';
    }
  } else if (String((hints && hints.race) || '').toLowerCase() === 'ghoul') {
    if ((partsCatalog.markings || []).includes('marking_radiation_burns.svg')) {
      parts.markings = 'marking_radiation_burns.svg';
    }
  } else if (chance(`${idSeed}:marking`, 0.25) && Array.isArray(partsCatalog.markings)) {
    parts.markings = pick(`${idSeed}:marking`, partsCatalog.markings, '');
  }

  if (
    String((hints && hints.gender) || '').toLowerCase() === 'male' &&
    chance(`${idSeed}:facialHair`, 0.55) &&
    Array.isArray(partsCatalog.facialHair)
  ) {
    parts.facialHair = pick(`${idSeed}:facialHair`, partsCatalog.facialHair, '');
  }

  return parts;
}

function normalizeContext(options) {
  const playerName = hasText(options.playerName) ? options.playerName.trim() : 'Wanderer';
  const location = hasText(options.location) ? options.location.trim() : 'general_wasteland';
  const faction = hasText(options.defaultFaction) ? options.defaultFaction.trim() : 'Independent';
  const learnedFacts = [];

  if (hasText(options.playstyle)) {
    learnedFacts.push({ key: 'playstyle', value: options.playstyle.trim() });
  }
  if (hasText(options.currentGoal)) {
    learnedFacts.push({ key: 'current_goal', value: options.currentGoal.trim() });
  }

  return {
    profile: {
      name: playerName,
      location,
      faction
    },
    learnedFacts
  };
}

function buildEnrichmentForNpc(npc, options) {
  if (!npc || !hasText(npc.id)) return null;

  const context = normalizeContext(options || {});
  const dossier = generateNpcDossier(
    {
      npcName: npc.name,
      seedPrompt: options.seedPrompt,
      baseCharacter: options.baseCharacter,
      notes: [npc.name, npc.role, npc.type, npc.faction, npc.homeRegion, npc.currentRegion].filter(hasText).join(' | '),
      personality: npc.personality,
      background: npc.description
    },
    context
  );

  const appearanceHints = isObject(dossier.appearanceHints) ? dossier.appearanceHints : {};
  const parts = buildParts(npc.id, appearanceHints);
  const overlay = {};

  if (!isObject(npc.parts) || Object.keys(npc.parts).length === 0) {
    overlay.parts = parts;
  }

  if (!isObject(npc.appearanceHints) || Object.keys(npc.appearanceHints).length === 0) {
    overlay.appearanceHints = appearanceHints;
  }

  if (!hasText(npc.description) && hasText(dossier.description)) {
    overlay.description = dossier.description;
  }

  if (!hasText(npc.personality) && hasText(dossier.personality)) {
    overlay.personality = dossier.personality;
  }

  if (!hasDialog(npc) && isObject(dossier.dialog)) {
    overlay.dialog = dossier.dialog;
  }

  if (!isObject(npc.dialogueProfile) && isObject(dossier.dialogueProfile)) {
    overlay.dialogProfile = dossier.dialogueProfile;
  }

  if (!isObject(npc.behavior) && isObject(dossier.behavior)) {
    overlay.behavior = dossier.behavior;
  }

  if (!Array.isArray(npc.motivations) && Array.isArray(dossier.motivations)) {
    overlay.motivations = dossier.motivations;
  }

  if (!hasText(npc.role) && hasText(dossier.role)) {
    overlay.role = dossier.role;
  }

  if (!hasText(npc.homeRegion) && hasText(dossier.homeRegion)) {
    overlay.homeRegion = dossier.homeRegion;
  }

  if (!hasText(npc.currentRegion) && hasText(dossier.currentRegion)) {
    overlay.currentRegion = dossier.currentRegion;
  }

  if (!isObject(npc.appearance)) {
    overlay.appearance = {
      hints: appearanceHints,
      parts
    };
  }

  overlay.overseerEnrichment = {
    source: 'self-hosted-overseer',
    version: 1,
    seedHash: crypto
      .createHash('sha256')
      .update([npc.id, options.seedPrompt || '', options.baseCharacter || ''].join('|'))
      .digest('hex')
      .slice(0, 16)
  };

  if (Object.keys(overlay).length === 1 && overlay.overseerEnrichment) {
    return null;
  }

  return overlay;
}

function createNpcEnrichmentManifest(npcs, options = {}) {
  const list = Array.isArray(npcs) ? npcs : [];
  const manifest = {
    ok: true,
    source: 'self-hosted-overseer',
    total: list.length,
    options: {
      defaultFaction: hasText(options.defaultFaction) ? options.defaultFaction.trim() : 'Independent',
      playerName: hasText(options.playerName) ? options.playerName.trim() : 'Wanderer'
    },
    npcs: {}
  };

  for (const npc of list) {
    const overlay = buildEnrichmentForNpc(npc, options);
    if (overlay && hasText(npc.id)) {
      manifest.npcs[npc.id] = overlay;
    }
  }

  return manifest;
}

module.exports = {
  buildEnrichmentForNpc,
  createNpcEnrichmentManifest
};
