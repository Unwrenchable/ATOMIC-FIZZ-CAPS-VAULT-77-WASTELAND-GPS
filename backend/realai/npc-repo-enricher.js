const crypto = require('crypto');

const {
  generateCharacterConcept,
  generateNpcDossier
} = require('./overseer-creator');

const AVATAR_PARTS = {
  head: [
    'head_base.svg',
    'head_round.svg',
    'head_square.svg',
    'head_heart.svg',
    'head_oblong.svg',
    'head_diamond.svg'
  ],
  eyes: [
    'eyes_set1.svg',
    'eyes_almond.svg',
    'eyes_round.svg',
    'eyes_hooded.svg',
    'eyes_downturned.svg',
    'eyes_upturned.svg',
    'eyes_monolid.svg',
    'eyes_deepset.svg'
  ],
  nose: [
    'nose_straight.svg',
    'nose_roman.svg',
    'nose_snub.svg',
    'nose_button.svg',
    'nose_aquiline.svg',
    'nose_wide.svg',
    'nose_narrow.svg'
  ],
  mouth: [
    'mouth_thin.svg',
    'mouth_full.svg',
    'mouth_wide.svg',
    'mouth_small.svg',
    'mouth_heartshaped.svg'
  ],
  hair: [
    'hair_bald.svg',
    'hair_buzzcut.svg',
    'hair_short.svg',
    'hair_medium.svg',
    'hair_long.svg',
    'hair_mohawk.svg',
    'hair_ponytail.svg',
    'hair_braids.svg',
    'hair_dreads.svg',
    'hair_slickedback.svg',
    'hair_wasteland.svg'
  ],
  facialHair: [
    'beard_stubble.svg',
    'beard_goatee.svg',
    'beard_full.svg',
    'beard_mustache.svg',
    'beard_mutton.svg',
    'beard_vandyke.svg',
    'beard_wasteland.svg'
  ],
  scars: [
    'scar_cheek_left.svg',
    'scar_cheek_right.svg',
    'scar_brow.svg',
    'scar_lip.svg',
    'scar_forehead.svg',
    'scar_burn_left.svg',
    'scar_burn_right.svg',
    'scar_claw.svg',
    'scar_bullet.svg'
  ],
  markings: [
    'marking_tribal.svg',
    'marking_warpaint.svg',
    'marking_freckles.svg',
    'marking_moles.svg',
    'marking_radiation_burns.svg',
    'marking_circuitry.svg',
    'marking_tattoo_vault.svg',
    'marking_tattoo_faction.svg'
  ],
  accessories: [
    'acc_eyepatch_left.svg',
    'acc_eyepatch_right.svg',
    'acc_glasses.svg',
    'acc_sunglasses.svg',
    'acc_goggles.svg',
    'acc_bandana.svg',
    'acc_respirator.svg',
    'acc_earring_left.svg',
    'acc_earring_right.svg',
    'acc_earrings_both.svg',
    'acc_nose_ring.svg',
    'acc_cybernetic_eye.svg'
  ],
  shirt: [
    'shirt_jacket.svg',
    'shirt_vault_suit.svg',
    'shirt_armor.svg',
    'shirt_wasteland_gear.svg'
  ]
};

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeText(value, maxLength) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return '';
  }

  if (Number.isFinite(maxLength) && maxLength > 0) {
    return text.slice(0, maxLength);
  }

  return text;
}

function toLowerWords(value) {
  return normalizeText(value).toLowerCase();
}

function hashIndex(seed, length) {
  if (!length || length <= 1) {
    return 0;
  }

  const digest = crypto.createHash('sha256').update(String(seed || 'vault-77')).digest();
  return digest[0] % length;
}

function hashText(value, length) {
  return crypto
    .createHash('sha256')
    .update(String(value || 'vault-77'))
    .digest('hex')
    .slice(0, length || 12);
}

function pick(seed, values, fallback) {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback || '';
  }

  return values[hashIndex(seed, values.length)];
}

function compactStrings(values, maxItems, maxLength) {
  const unique = [];

  for (const value of Array.isArray(values) ? values : []) {
    const text = normalizeText(value, maxLength);
    if (text && !unique.includes(text)) {
      unique.push(text);
    }
    if (unique.length >= maxItems) {
      break;
    }
  }

  return unique;
}

function extractPersonalityText(npc) {
  if (typeof npc.personality === 'string') {
    return normalizeText(npc.personality, 240);
  }

  const personality = safeObject(npc.personality);
  return [
    normalizeText(personality.archetype, 120),
    compactStrings(personality.traits, 4, 80).join(', '),
    normalizeText(personality.voice, 120)
  ]
    .filter(Boolean)
    .join(' | ');
}

function extractDialogLines(npc) {
  const dialog = safeObject(npc.dialog);
  return compactStrings([
    ...(Array.isArray(npc.dialogPool) ? npc.dialogPool : []),
    ...(Array.isArray(dialog.idle) ? dialog.idle : []),
    ...(Array.isArray(dialog.approach) ? dialog.approach : []),
    ...(Array.isArray(dialog.gossip) ? dialog.gossip : []),
    ...(Array.isArray(dialog.greetings) ? dialog.greetings : [])
  ], 6, 140);
}

function extractAppearanceText(npc) {
  const appearance = safeObject(npc.appearance);
  return [
    normalizeText(appearance.species || appearance.race, 80),
    normalizeText(appearance.description, 200),
    normalizeText(appearance.clothing || appearance.outfit, 120),
    normalizeText(appearance.distinctive || appearance.distinctive_features, 140)
  ]
    .filter(Boolean)
    .join(' | ');
}

function resolveRegion(npc) {
  return normalizeText(
    npc.homeRegion ||
      npc.currentRegion ||
      npc.region ||
      npc.poi ||
      (Array.isArray(npc.spawnPool) && npc.spawnPool[0]) ||
      '',
    80
  );
}

function buildSeedText(npc, options) {
  return [
    normalizeText(options && options.seedPrompt, 240),
    normalizeText(options && options.baseCharacter, 240),
    normalizeText(npc.id, 80),
    normalizeText(npc.name || npc.fullName, 120),
    normalizeText(npc.title, 120),
    normalizeText(npc.role, 120),
    normalizeText(npc.type, 80),
    normalizeText(npc.archetype, 80),
    normalizeText(npc.faction || npc.factionTag, 120),
    resolveRegion(npc),
    normalizeText(npc.description, 220),
    extractAppearanceText(npc),
    extractPersonalityText(npc),
    compactStrings(npc.questHooks, 4, 100).join(' | '),
    extractDialogLines(npc).join(' | ')
  ]
    .filter(Boolean)
    .join(' | ');
}

function buildGenerationContext(npc, options) {
  const faction = normalizeText(npc.faction || npc.factionTag || (options && options.defaultFaction), 80);
  const location = resolveRegion(npc);
  const playstyle = normalizeText(options && options.playstyle, 120);
  const currentGoal = normalizeText(options && options.currentGoal, 140);
  const profileName = normalizeText(options && options.playerName, 64);

  const learnedFacts = [];
  if (playstyle) {
    learnedFacts.push({ key: 'playstyle', value: playstyle });
  }
  if (currentGoal) {
    learnedFacts.push({ key: 'current_goal', value: currentGoal });
  }

  return {
    wallet: null,
    profile: {
      name: profileName,
      faction,
      location
    },
    memory: {
      regionsVisited: location ? [location] : []
    },
    recentConversation: [],
    learnedFacts
  };
}

function buildGenerationOptions(npc, options) {
  const personality = extractPersonalityText(npc);
  const background = normalizeText(npc.archetype || npc.role || npc.type, 120);
  const notes = [
    normalizeText(npc.description, 220),
    extractAppearanceText(npc),
    compactStrings(npc.questHooks, 4, 100).join(' | ')
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    npcName: normalizeText(npc.fullName || npc.name, 64),
    name: normalizeText(npc.fullName || npc.name, 64),
    seedPrompt: buildSeedText(npc, options),
    baseCharacter: normalizeText(options && options.baseCharacter, 240),
    notes,
    background,
    personality,
    race: normalizeText(options && options.raceOverride, 24),
    gender: normalizeText(options && options.genderOverride, 24)
  };
}

function chooseHead(seed, hints, text) {
  if (hints.race === 'ghoul') {
    return pick(seed, ['head_oblong.svg', 'head_square.svg', 'head_base.svg']);
  }
  if (hints.race === 'synth') {
    return pick(seed, ['head_diamond.svg', 'head_square.svg', 'head_base.svg']);
  }
  if (text.includes('merchant') || text.includes('friendly')) {
    return pick(seed, ['head_round.svg', 'head_heart.svg', 'head_base.svg']);
  }
  return pick(seed, AVATAR_PARTS.head, 'head_base.svg');
}

function chooseEyes(seed, hints) {
  const byExpression = {
    friendly: ['eyes_round.svg', 'eyes_almond.svg'],
    stern: ['eyes_hooded.svg', 'eyes_deepset.svg'],
    suspicious: ['eyes_downturned.svg', 'eyes_hooded.svg'],
    determined: ['eyes_upturned.svg', 'eyes_deepset.svg'],
    smirking: ['eyes_almond.svg', 'eyes_upturned.svg'],
    weary: ['eyes_deepset.svg', 'eyes_downturned.svg']
  };

  return pick(seed, byExpression[hints.expression] || AVATAR_PARTS.eyes, 'eyes_set1.svg');
}

function chooseMouth(seed, hints) {
  const byExpression = {
    friendly: ['mouth_full.svg', 'mouth_heartshaped.svg'],
    stern: ['mouth_thin.svg', 'mouth_small.svg'],
    suspicious: ['mouth_thin.svg', 'mouth_wide.svg'],
    determined: ['mouth_wide.svg', 'mouth_thin.svg'],
    smirking: ['mouth_heartshaped.svg', 'mouth_wide.svg'],
    weary: ['mouth_small.svg', 'mouth_thin.svg']
  };

  return pick(seed, byExpression[hints.expression] || AVATAR_PARTS.mouth, 'mouth_thin.svg');
}

function chooseHair(seed, hints, text) {
  if (hints.ageRange === 'elder') {
    return pick(seed, ['hair_bald.svg', 'hair_slickedback.svg', 'hair_wasteland.svg']);
  }
  if (text.includes('raider') || text.includes('punk') || text.includes('weirdo')) {
    return pick(seed, ['hair_mohawk.svg', 'hair_wasteland.svg', 'hair_dreads.svg']);
  }
  if (text.includes('courier') || text.includes('trooper') || text.includes('scout')) {
    return pick(seed, ['hair_buzzcut.svg', 'hair_short.svg', 'hair_slickedback.svg']);
  }
  if (hints.gender === 'female') {
    return pick(seed, ['hair_medium.svg', 'hair_long.svg', 'hair_braids.svg', 'hair_ponytail.svg']);
  }
  return pick(seed, ['hair_short.svg', 'hair_buzzcut.svg', 'hair_wasteland.svg', 'hair_medium.svg']);
}

function chooseShirt(seed, text) {
  if (text.includes('vault')) {
    return 'shirt_vault_suit.svg';
  }
  if (text.includes('trooper') || text.includes('guard') || text.includes('legion') || text.includes('ncr') || text.includes('brotherhood')) {
    return 'shirt_armor.svg';
  }
  if (text.includes('mechanic') || text.includes('engineer') || text.includes('scrap') || text.includes('scav')) {
    return 'shirt_wasteland_gear.svg';
  }
  return pick(seed, ['shirt_jacket.svg', 'shirt_wasteland_gear.svg', 'shirt_armor.svg'], 'shirt_jacket.svg');
}

function chooseAccessory(hints) {
  const map = {
    goggles: 'acc_goggles.svg',
    respirator: 'acc_respirator.svg',
    bandana: 'acc_bandana.svg',
    cybernetic_eye: 'acc_cybernetic_eye.svg',
    glasses: 'acc_glasses.svg',
    eyepatch_left: 'acc_eyepatch_left.svg',
    eyepatch_right: 'acc_eyepatch_right.svg'
  };

  return map[hints.accessory] || '';
}

function chooseScar(hints) {
  const map = {
    cheek_left: 'scar_cheek_left.svg',
    cheek_right: 'scar_cheek_right.svg',
    brow: 'scar_brow.svg',
    lip: 'scar_lip.svg',
    forehead: 'scar_forehead.svg',
    burn_left: 'scar_burn_left.svg',
    burn_right: 'scar_burn_right.svg',
    claw: 'scar_claw.svg',
    bullet: 'scar_bullet.svg'
  };

  return map[hints.scar] || '';
}

function chooseMarking(seed, npc, hints, text) {
  if (hints.race === 'synth') {
    return 'marking_circuitry.svg';
  }
  if (hints.race === 'ghoul') {
    return 'marking_radiation_burns.svg';
  }
  if (text.includes('vault')) {
    return 'marking_tattoo_vault.svg';
  }
  if (text.includes('tribal') || text.includes('mystic') || text.includes('shaman')) {
    return pick(seed, ['marking_tribal.svg', 'marking_warpaint.svg']);
  }
  if (text.includes('faction') || text.includes('trooper') || text.includes('legion') || text.includes('ncr')) {
    return 'marking_tattoo_faction.svg';
  }
  if (normalizeText(npc.timeline, 24) === 'shadow') {
    return 'marking_warpaint.svg';
  }
  if (normalizeText(npc.timeline, 24) === 'echo') {
    return 'marking_freckles.svg';
  }
  return '';
}

function shouldAddFacialHair(seed, hints, text) {
  if (hints.gender !== 'male') {
    return false;
  }
  if (hints.race === 'synth') {
    return hashIndex(`${seed}:facialHair`, 3) === 0;
  }
  if (text.includes('elder') || text.includes('drifter') || text.includes('scout') || text.includes('merchant')) {
    return true;
  }
  return hashIndex(`${seed}:facialHair`, 2) === 0;
}

function buildAvatarParts(npc, concept, dossier) {
  const hints = safeObject((concept && concept.appearanceHints) || (dossier && dossier.appearanceHints));
  const seed = `${npc.id || npc.name}:${concept && concept.seedSummary ? concept.seedSummary : dossier && dossier.description ? dossier.description : ''}`;
  const text = toLowerWords(buildSeedText(npc, {}));
  const parts = {
    head: chooseHead(`${seed}:head`, hints, text),
    eyes: chooseEyes(`${seed}:eyes`, hints),
    nose: pick(`${seed}:nose`, AVATAR_PARTS.nose, 'nose_straight.svg'),
    mouth: chooseMouth(`${seed}:mouth`, hints),
    hair: chooseHair(`${seed}:hair`, hints, text),
    shirt: chooseShirt(`${seed}:shirt`, text)
  };

  const accessory = chooseAccessory(hints);
  if (accessory) {
    parts.accessories = accessory;
  }

  const scar = chooseScar(hints);
  if (scar) {
    parts.scars = scar;
  }

  const marking = chooseMarking(`${seed}:marking`, npc, hints, text);
  if (marking) {
    parts.markings = marking;
  }

  if (shouldAddFacialHair(seed, hints, text)) {
    parts.facialHair = pick(`${seed}:facialHair`, AVATAR_PARTS.facialHair, 'beard_stubble.svg');
  }

  return parts;
}

function buildAppearanceOverlay(npc, concept, dossier, parts) {
  const appearance = safeObject(npc.appearance);
  const hints = safeObject(concept.appearanceHints || dossier.appearanceHints);
  const overlay = {
    parts
  };

  if (!normalizeText(appearance.species || appearance.race, 80)) {
    overlay.species = hints.race === 'ghoul'
      ? 'Ghoul'
      : hints.race === 'synth'
        ? 'Synth'
        : 'Human';
  }

  if (!normalizeText(appearance.description, 220)) {
    overlay.description = normalizeText(concept.appearance, 220);
  }

  if (!normalizeText(appearance.outfit || appearance.clothing, 140)) {
    overlay.outfit = normalizeText(
      (safeObject(dossier.appearance).outfit || '').replace(/\.$/, ''),
      140
    ) || normalizeText(concept.appearance, 140);
  }

  if (!normalizeText(appearance.distinctive || appearance.distinctive_features, 160)) {
    overlay.distinctive = normalizeText(concept.personality, 160);
  }

  return overlay;
}

function buildDialogOverlay(npc, dossier) {
  if (extractDialogLines(npc).length > 0) {
    return null;
  }

  const dialog = safeObject(npc.dialog);
  const generated = safeObject(dossier.dialog);
  const overlay = {};

  if (!Array.isArray(dialog.idle) || dialog.idle.length === 0) {
    overlay.idle = compactStrings(generated.idle, 3, 120);
  }

  if (!Array.isArray(dialog.approach) || dialog.approach.length === 0) {
    overlay.approach = compactStrings(generated.approach, 3, 120);
  }

  if (!Array.isArray(dialog.gossip) || dialog.gossip.length === 0) {
    overlay.gossip = compactStrings(generated.gossip, 3, 120);
  }

  return Object.keys(overlay).length ? overlay : null;
}

function buildEnrichmentForNpc(npc, options) {
  const sourceNpc = safeObject(npc);
  if (!sourceNpc.id || !sourceNpc.name) {
    return null;
  }

  const generationContext = buildGenerationContext(sourceNpc, options);
  const generationOptions = buildGenerationOptions(sourceNpc, options);
  const concept = generateCharacterConcept(generationOptions, generationContext);
  const dossier = generateNpcDossier(generationOptions, generationContext);
  const parts = buildAvatarParts(sourceNpc, concept, dossier);
  const overlay = {
    parts
  };

  if (!sourceNpc.appearanceHints) {
    overlay.appearanceHints = concept.appearanceHints;
  }

  if (!sourceNpc.description) {
    overlay.description = normalizeText(dossier.description, 320);
  }

  if (!sourceNpc.personality) {
    overlay.personality = normalizeText(concept.personality, 260);
  }

  if (!sourceNpc.dialogProfile) {
    overlay.dialogProfile = dossier.dialogueProfile;
  }

  if (!sourceNpc.behavior) {
    overlay.behavior = dossier.behavior;
  }

  if (!sourceNpc.motivations) {
    overlay.motivations = dossier.motivations;
  }

  if (!sourceNpc.role && dossier.role) {
    overlay.role = dossier.role;
  }

  if (!sourceNpc.homeRegion && dossier.homeRegion) {
    overlay.homeRegion = dossier.homeRegion;
  }

  if (!sourceNpc.currentRegion && dossier.currentRegion) {
    overlay.currentRegion = dossier.currentRegion;
  }

  const appearanceOverlay = buildAppearanceOverlay(sourceNpc, concept, dossier, parts);
  if (Object.keys(appearanceOverlay).length) {
    overlay.appearance = appearanceOverlay;
  }

  const dialogOverlay = buildDialogOverlay(sourceNpc, dossier);
  if (dialogOverlay) {
    overlay.dialog = dialogOverlay;
  }

  overlay.overseerEnrichment = {
    generated: true,
    source: 'self-hosted-overseer',
    portraitReady: true,
    seedHash: hashText(buildSeedText(sourceNpc, options), 16)
  };

  return overlay;
}

function createNpcEnrichmentManifest(npcs, options) {
  const entries = {};
  const list = Array.isArray(npcs) ? npcs : [];

  for (const npc of list) {
    const enrichment = buildEnrichmentForNpc(npc, options);
    if (enrichment) {
      entries[npc.id] = enrichment;
    }
  }

  return {
    ok: true,
    source: 'self-hosted-overseer',
    total: Object.keys(entries).length,
    options: {
      seedPrompt: normalizeText(options && options.seedPrompt, 240),
      baseCharacter: normalizeText(options && options.baseCharacter, 240)
    },
    npcs: entries
  };
}

module.exports = {
  buildEnrichmentForNpc,
  createNpcEnrichmentManifest
};
