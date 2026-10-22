'use strict';

const crypto = require('crypto');

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

function titleCase(value) {
  return normalizeText(value)
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toKebab(value, fallback) {
  const text = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return text || fallback;
}

function hashIndex(seed, length) {
  if (!length || length <= 1) {
    return 0;
  }

  const digest = crypto.createHash('sha256').update(String(seed || 'vault-77')).digest();
  return digest[0] % length;
}

function pick(seed, values) {
  if (!Array.isArray(values) || values.length === 0) {
    return '';
  }

  return values[hashIndex(seed, values.length)];
}

function pickDistinct(seed, values, count) {
  const pool = Array.isArray(values) ? values.slice() : [];
  const picked = [];

  while (pool.length > 0 && picked.length < count) {
    const index = hashIndex(`${seed}:${picked.length}`, pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }

  return picked;
}

function findLearnedValue(learnedFacts, key) {
  const facts = Array.isArray(learnedFacts) ? learnedFacts : [];
  const match = facts.find((entry) => entry && entry.key === key && entry.value);
  return normalizeText(match && match.value, 120);
}

function getRecentPlayerLines(context) {
  const recentConversation = Array.isArray(context && context.recentConversation)
    ? context.recentConversation
    : [];

  return recentConversation
    .filter((entry) => entry && entry.role === 'user')
    .slice(-6)
    .map((entry) => normalizeText(entry.content, 220))
    .filter(Boolean);
}

function buildSeedBundle(options, context) {
  const profile = safeObject(context && context.profile);
  const memory = safeObject(context && context.memory);
  const recentLines = getRecentPlayerLines(context);
  const fragments = [
    normalizeText(options && options.seedPrompt, 240),
    normalizeText(options && options.baseCharacter, 240),
    normalizeText(options && options.notes, 240),
    normalizeText(options && options.background, 120),
    normalizeText(options && options.personality, 160),
    normalizeText(profile.name, 64),
    normalizeText(profile.faction, 64),
    normalizeText(profile.location, 80),
    findLearnedValue(context && context.learnedFacts, 'current_goal'),
    findLearnedValue(context && context.learnedFacts, 'playstyle'),
    recentLines.join(' '),
    Array.isArray(memory.regionsVisited) ? memory.regionsVisited.slice(-3).join(' ') : '',
    Array.isArray(memory.poisDiscovered) ? memory.poisDiscovered.slice(-4).join(' ') : ''
  ].filter(Boolean);

  const seedText = fragments.join(' | ');

  return {
    seedText,
    profile,
    recentLines,
    currentGoal: findLearnedValue(context && context.learnedFacts, 'current_goal'),
    playstyle: findLearnedValue(context && context.learnedFacts, 'playstyle')
  };
}

function chooseByKeyword(seedText, rules, fallback) {
  const text = normalizeText(seedText).toLowerCase();
  const keys = Object.keys(rules);

  for (const key of keys) {
    if (text.includes(key)) {
      return rules[key];
    }
  }

  return fallback;
}

function resolveRace(options, seedText) {
  const explicit = normalizeText(options && options.race, 24).toLowerCase();
  if (explicit) {
    return explicit;
  }

  return chooseByKeyword(
    seedText,
    {
      ghoul: 'ghoul',
      synth: 'synth',
      mutant: 'human',
      vault: 'human'
    },
    'human'
  );
}

function resolveGender(options, seedText) {
  const explicit = normalizeText(options && options.gender, 24).toLowerCase();
  if (explicit) {
    return explicit;
  }

  return chooseByKeyword(
    seedText,
    {
      she: 'female',
      her: 'female',
      woman: 'female',
      girl: 'female',
      he: 'male',
      him: 'male',
      man: 'male',
      boy: 'male'
    },
    'male'
  );
}

function resolveAgeRange(options, seedText) {
  const explicit = normalizeText(options && options.ageRange, 24).toLowerCase();
  if (explicit) {
    return explicit;
  }

  return chooseByKeyword(
    seedText,
    {
      old: 'elder',
      elder: 'elder',
      young: 'young',
      kid: 'young',
      teen: 'young'
    },
    'adult'
  );
}

function resolveArchetype(seedText) {
  return chooseByKeyword(
    seedText,
    {
      medic: 'field-medic',
      doctor: 'field-medic',
      healer: 'field-medic',
      trader: 'caravan-trader',
      merchant: 'caravan-trader',
      courier: 'courier-runner',
      scout: 'wasteland-scout',
      sniper: 'wasteland-scout',
      raider: 'raider-defector',
      brotherhood: 'steel-exile',
      vault: 'vault-exile',
      hacker: 'signal-hacker',
      mechanic: 'junk-engineer',
      engineer: 'junk-engineer',
      cult: 'atom-mystic',
      atom: 'atom-mystic'
    },
    'wasteland-survivor'
  );
}

function resolveFaction(seedText, profileFaction, archetype) {
  const keywordFaction = chooseByKeyword(
    `${seedText} ${profileFaction || ''}`,
    {
      brotherhood: 'Brotherhood of Steel',
      followers: 'Followers of the Apocalypse',
      railroad: 'Railroad',
      ncr: 'NCR',
      legion: 'Caesar\'s Legion',
      raider: 'Independent',
      atom: 'Children of Atom',
      vault: 'Vault Remnant'
    },
    ''
  );

  if (keywordFaction) {
    return keywordFaction;
  }

  return {
    'field-medic': 'Followers of the Apocalypse',
    'caravan-trader': 'Independent',
    'courier-runner': 'Independent',
    'wasteland-scout': 'Independent',
    'raider-defector': 'Independent',
    'steel-exile': 'Brotherhood of Steel',
    'vault-exile': 'Vault Remnant',
    'signal-hacker': 'Independent',
    'junk-engineer': 'Independent',
    'atom-mystic': 'Children of Atom',
    'wasteland-survivor': titleCase(profileFaction || 'Independent')
  }[archetype] || 'Independent';
}

function generateNames(options, context) {
  const bundle = buildSeedBundle(options, context);
  const race = resolveRace(options, bundle.seedText);
  const gender = resolveGender(options, bundle.seedText);
  const archetype = resolveArchetype(bundle.seedText);
  const key = `${race}:${gender}:${archetype}:${bundle.seedText}`;

  const firstNames = {
    human: {
      male: ['Jax', 'Rhett', 'Mason', 'Caleb', 'Eli', 'Knox', 'Silas', 'Boone'],
      female: ['Sable', 'Mara', 'Vera', 'Nadia', 'Iris', 'Cass', 'June', 'Nova']
    },
    ghoul: {
      male: ['Cinder', 'Ash', 'Rattle', 'Knurl', 'Grim', 'Static', 'Dust'],
      female: ['Ember', 'Soot', 'Morrow', 'Hush', 'Vex', 'Cinder', 'Velvet']
    },
    synth: {
      male: ['Cipher', 'Relay', 'Orion', 'Echo', 'Unit-7', 'Vector', 'Proxy'],
      female: ['Nova', 'Luma', 'Echo', 'Iona', 'Circuit', 'Nyx', 'Proxy']
    }
  };

  const lastNames = {
    'wasteland-survivor': ['Hale', 'Voss', 'Rook', 'Cross', 'Vale', 'Morrow', 'Drift'],
    'field-medic': ['Mercy', 'Rowe', 'Sawyer', 'Ashford', 'Voss', 'Graves'],
    'caravan-trader': ['Ledger', 'Mire', 'Carver', 'Stone', 'Gale', 'Mercer'],
    'courier-runner': ['Wire', 'Stride', 'Mercer', 'Post', 'Harlan', 'Dash'],
    'wasteland-scout': ['Quarry', 'Reed', 'Holt', 'Drift', 'Kane', 'Tread'],
    'raider-defector': ['Blacktooth', 'Spur', 'Rivet', 'Crow', 'Rust'],
    'steel-exile': ['Quinn', 'Forge', 'Halberd', 'Mercer', 'Cross'],
    'vault-exile': ['Cole', 'Ward', 'Barrett', 'Stanton', 'Hayes'],
    'signal-hacker': ['Watt', 'Relay', 'Morse', 'Byte', 'Vega'],
    'junk-engineer': ['Rivet', 'Coil', 'Spanner', 'Bexley', 'Torque'],
    'atom-mystic': ['Glow', 'Pilgrim', 'Ash', 'Cairn', 'Wake']
  };

  const firstPool = (((firstNames[race] || {}).female && gender === 'female')
    ? firstNames[race].female
    : ((firstNames[race] || {}).male || firstNames.human.male));
  const lastPool = lastNames[archetype] || lastNames['wasteland-survivor'];
  const firstPicked = pickDistinct(`${key}:first`, firstPool, 5);
  const lastPicked = pickDistinct(`${key}:last`, lastPool, 5);
  const uniqueNames = [];

  for (let index = 0; index < 5; index += 1) {
    const first = firstPicked[index % firstPicked.length] || pick(`${key}:first:${index}`, firstPool);
    const last = lastPicked[index % lastPicked.length] || pick(`${key}:last:${index}`, lastPool);
    const fullName = `${first} ${last}`.trim();

    if (!uniqueNames.includes(fullName)) {
      uniqueNames.push(fullName);
    }
  }

  return uniqueNames;
}

function buildAppearanceHints(options, seedText, archetype) {
  const race = resolveRace(options, seedText);
  const gender = resolveGender(options, seedText);
  const ageRange = resolveAgeRange(options, seedText);

  const expression = {
    'field-medic': 'determined',
    'caravan-trader': 'friendly',
    'courier-runner': 'stern',
    'wasteland-scout': 'suspicious',
    'raider-defector': 'stern',
    'steel-exile': 'determined',
    'vault-exile': 'friendly',
    'signal-hacker': 'suspicious',
    'junk-engineer': 'smirking',
    'atom-mystic': 'weary',
    'wasteland-survivor': 'weary'
  }[archetype];

  const accessory = chooseByKeyword(
    seedText,
    {
      goggles: 'goggles',
      mask: 'respirator',
      bandana: 'bandana',
      hood: 'goggles'
    },
    archetype === 'signal-hacker' ? 'goggles' : 'none'
  );

  return {
    gender,
    race,
    ageRange,
    bodyType: archetype === 'steel-exile' ? 'muscular' : (archetype === 'wasteland-scout' ? 'slim' : 'average'),
    expression,
    scar: chooseByKeyword(seedText, { scar: 'cheek_left', burn: 'burn_left', wound: 'brow' }, archetype === 'raider-defector' ? 'cheek_left' : 'none'),
    accessory,
    voice: race === 'ghoul' ? 'raspy' : (archetype === 'vault-exile' ? 'smooth' : 'weathered')
  };
}

function buildBackstory(name, archetype, faction, region, bundle) {
  const locationText = region || bundle.profile.location || 'the Mojave fringe';
  const goalText = bundle.currentGoal || 'find a place worth defending';

  const intros = {
    'field-medic': `${name} learned triage by lantern light, stitching up caravan guards and chem-burned drifters while the world kept collapsing around them.`,
    'caravan-trader': `${name} grew up counting crates, bullets, and betrayals on caravan routes where every handshake had a hidden price.`,
    'courier-runner': `${name} made a living moving sealed satchels through dead zones, learning every shortcut and every ambush site between settlements.`,
    'wasteland-scout': `${name} survived by reading dust, tracks, and broken skyline silhouettes long before most wastelanders learned to read people.`,
    'raider-defector': `${name} clawed free of a raider pack and kept the lessons, but not the leash.`,
    'steel-exile': `${name} walked away from a steel order and its rules, keeping the discipline while shedding the chain of command.`,
    'vault-exile': `${name} came out of a vault with clean hands, old manuals, and just enough optimism to be dangerous.`,
    'signal-hacker': `${name} learned to hear meaning in static, ghost frequencies, and the kind of coded traffic most people mistake for noise.`,
    'junk-engineer': `${name} built a reputation turning busted generators, collapsed terminals, and scorched scrap into tools that still matter.`,
    'atom-mystic': `${name} spent too long near hot places and came back with a faith in glow, omen, and strange timing.`,
    'wasteland-survivor': `${name} is the kind of wastelander who kept moving when cleaner stories would have ended in a grave.`
  };

  const closers = [
    `Now they move through ${locationText} under the banner of ${faction}, trying to ${goalText}.`,
    `These days they haunt ${locationText}, carrying ${faction} scars and a private plan to ${goalText}.`,
    `Now the wasteland knows them as ${faction} adjacent at best, and still stubborn enough to ${goalText}.`
  ];

  return `${intros[archetype] || intros['wasteland-survivor']} ${pick(`${name}:${archetype}:closer`, closers)}`;
}

function buildAppearanceDescription(name, archetype, hints, seedText) {
  const clothing = {
    'field-medic': 'patched medic leathers with red-stained wraps',
    'caravan-trader': 'road-dusted trader layers and hidden pockets',
    'courier-runner': 'travel-cut duster gear and courier straps',
    'wasteland-scout': 'sun-bleached scout gear with a long sightline hood',
    'raider-defector': 'salvaged armor with old gang marks scratched off',
    'steel-exile': 'disciplined field armor stripped of official insignia',
    'vault-exile': 'vault remnants mixed with hard-used surface gear',
    'signal-hacker': 'signal-tuned wraps, wire spools, and scavenged optics',
    'junk-engineer': 'grease-marked coveralls and tool rigging',
    'atom-mystic': 'glow-charred cloth and devotional trinkets',
    'wasteland-survivor': 'practical scavenger layers built for bad weather'
  };

  const features = [
    hints.scar !== 'none' ? 'a scar that makes eye contact before they do' : '',
    hints.accessory !== 'none' ? `a ${hints.accessory} rig that looks earned, not decorative` : '',
    chooseByKeyword(seedText, { tattoo: 'weathered ink along the jawline', cyber: 'small tech scars near the temple', burn: 'sun-darkened burn marks across one cheek' }, 'hard mileage in the face and posture')
  ].filter(Boolean);

  return `${name} carries ${clothing[archetype] || clothing['wasteland-survivor']}, ${features.join(', ')}, and the kind of ${hints.expression} expression that tells strangers to measure their words.`;
}

function buildPersonality(archetype, bundle) {
  const playstyle = bundle.playstyle || 'cautious but stubborn';
  const lines = {
    'field-medic': `Calm under pressure, medically blunt, and difficult to rattle. They treat people like triage problems until trust is earned, then turn fiercely protective.`,
    'caravan-trader': `Sharp-eyed, social when profitable, and impossible to fully read. They speak like every conversation is part bargain, part threat assessment.`,
    'courier-runner': `Measured, quiet, and reliable in motion. They hate wasted words, wasted routes, and wasted second chances.`,
    'wasteland-scout': `Patient, observant, and always tracking exits. They prefer to learn a room before they belong to it.`,
    'raider-defector': `Guarded, volatile when cornered, but deeply loyal once someone gets past the armor. They know violence too well to romanticize it.`,
    'steel-exile': `Disciplined, skeptical, and hard to impress. They carry old doctrine in their spine even when their mouth says otherwise.`,
    'vault-exile': `Earnest, adaptive, and still a little too willing to believe systems can be repaired. They are learning to let optimism travel armed.`,
    'signal-hacker': `Analytical, half-distracted by patterns, and drawn to hidden signals. They listen for what people are not saying.`,
    'junk-engineer': `Dry-humored, practical, and happiest when solving ugly mechanical problems with uglier tools.`,
    'atom-mystic': `Warm, unsettling, and convinced meaning hides inside fallout. They speak like prophecy and field notes got stitched together.`,
    'wasteland-survivor': `Resourceful, hard to knock off balance, and shaped by living on bad odds.`
  };

  return `${lines[archetype] || lines['wasteland-survivor']} Current field style reads ${playstyle}.`;
}

function buildRelationships(archetype, faction) {
  const base = [
    `Keeps one boot in ${faction} territory and the other pointed toward an exit.`,
    'Treats strangers like live ordnance until proven otherwise.',
    'Builds loyalty slowly, but once granted it is the real thing.'
  ];

  if (archetype === 'vault-exile') {
    base[1] = 'Still believes communities can hold together if someone is stubborn enough to do the work.';
  } else if (archetype === 'raider-defector') {
    base[1] = 'Knows exactly how predatory crews think and refuses to become easy prey again.';
  }

  return base;
}

function buildMotivations(bundle, archetype) {
  return [
    bundle.currentGoal || 'Secure a future that feels larger than simple survival.',
    {
      'field-medic': 'Keep vulnerable settlements breathing through the next crisis.',
      'caravan-trader': 'Turn supply routes into leverage before someone else does.',
      'courier-runner': 'Keep moving secrets and people faster than danger can catch them.',
      'wasteland-scout': 'Map safe paths through ground everyone else calls cursed.',
      'raider-defector': 'Burn down the old debts that still stalk them.',
      'steel-exile': 'Decide what discipline is worth without blind obedience.',
      'vault-exile': 'Prove vault-born idealism can survive open air.',
      'signal-hacker': 'Decode the signal buried underneath the wasteland static.',
      'junk-engineer': 'Build something useful enough that people stop calling it scrap.',
      'atom-mystic': 'Follow the glow toward the meaning only they think they can hear.',
      'wasteland-survivor': 'Stay alive long enough to choose what survival is for.'
    }[archetype],
    'Find allies worth trusting before the next bad turn hits.'
  ];
}

function buildSkills(archetype) {
  return {
    'field-medic': ['Triage', 'Chem handling', 'Field surgery'],
    'caravan-trader': ['Barter', 'Route reading', 'Threat spotting'],
    'courier-runner': ['Navigation', 'Steady nerves', 'Fast draws'],
    'wasteland-scout': ['Tracking', 'Long sightlines', 'Stealth movement'],
    'raider-defector': ['Close-quarters fighting', 'Intimidation', 'Salvage tactics'],
    'steel-exile': ['Weapons discipline', 'Armor drills', 'Tactical command'],
    'vault-exile': ['Systems repair', 'Protocol recall', 'Adaptation'],
    'signal-hacker': ['Signal intercepts', 'Terminal cracking', 'Pattern analysis'],
    'junk-engineer': ['Repair', 'Improvised fabrication', 'Power systems'],
    'atom-mystic': ['Radiation tolerance', 'Occult reading', 'Survival instinct'],
    'wasteland-survivor': ['Scavenging', 'Resilience', 'Street sense']
  }[archetype] || ['Scavenging', 'Resilience', 'Street sense'];
}

function generateCharacterConcept(options, context) {
  const bundle = buildSeedBundle(options, context);
  const archetype = resolveArchetype(bundle.seedText);
  const faction = resolveFaction(bundle.seedText, bundle.profile.faction, archetype);
  const names = generateNames(options, context);
  const suggestedName = normalizeText(options && options.name, 64) || names[0];
  const region = bundle.profile.location || pick(`${bundle.seedText}:region`, ['the Mojave edge', 'Dry Lake', 'the old highway', 'the Strip outskirts']);
  const appearanceHints = buildAppearanceHints(options, bundle.seedText, archetype);

  return {
    suggestedName,
    nameSuggestions: names,
    backstory: buildBackstory(suggestedName, archetype, faction, region, bundle),
    appearance: buildAppearanceDescription(suggestedName, archetype, appearanceHints, bundle.seedText),
    personality: buildPersonality(archetype, bundle),
    skills: buildSkills(archetype),
    motivations: buildMotivations(bundle, archetype),
    relationships: buildRelationships(archetype, faction),
    appearanceHints,
    seedSummary: normalizeText(bundle.seedText, 220)
  };
}

function generateNpcDossier(options, context) {
  const concept = generateCharacterConcept(options, context);
  const bundle = buildSeedBundle(options, context);
  const archetype = resolveArchetype(bundle.seedText);
  const faction = resolveFaction(bundle.seedText, bundle.profile.faction, archetype);
  const region = toKebab(bundle.profile.location || pick(`${bundle.seedText}:npc-region`, ['dry-lake', 'old-highway', 'strip-underground', 'vault-77-perimeter']), 'wasteland');
  const role = {
    'field-medic': 'Wasteland Medic',
    'caravan-trader': 'Road Broker',
    'courier-runner': 'Signal Courier',
    'wasteland-scout': 'Dust Scout',
    'raider-defector': 'Turncoat Gunhand',
    'steel-exile': 'Steel Exile',
    'vault-exile': 'Vault Surface Envoy',
    'signal-hacker': 'Static Listener',
    'junk-engineer': 'Scrapwright',
    'atom-mystic': 'Glow Whisper',
    'wasteland-survivor': 'Wasteland Drifter'
  }[archetype] || 'Wasteland Drifter';
  const npcName = normalizeText(options && options.npcName, 64) || concept.suggestedName;
  const id = `npc_${region}_${toKebab(npcName, 'wanderer')}`.slice(0, 48);

  return {
    id,
    name: npcName,
    faction,
    role,
    type: 'dynamic',
    homeRegion: region,
    currentRegion: region,
    poi: 'dynamic',
    personality: concept.personality,
    description: concept.backstory,
    dialogueProfile: {
      tone: toKebab(role, 'dynamic-npc'),
      personalityTags: [toKebab(archetype, 'survivor'), 'overseer-generated', 'player-seeded'],
      knowledge: pickDistinct(`${id}:knowledge`, [
        'supply routes',
        'vault rumors',
        'raider chatter',
        'settlement politics',
        'broken tech',
        'wasteland weather',
        'faction patrols',
        'radio static'
      ], 3),
      anomalyAwareness: Number((0.25 + (hashIndex(`${id}:anomaly`, 50) / 100)).toFixed(2))
    },
    behavior: {
      schedule: {
        day: [region],
        night: [region],
        wanderChance: Number((0.2 + (hashIndex(`${id}:wander`, 30) / 100)).toFixed(2))
      },
      roaming: [region, 'player-vicinity'],
      anomalySensitivity: Number((0.2 + (hashIndex(`${id}:sense`, 35) / 100)).toFixed(2)),
      rareEncounter: archetype === 'atom-mystic' || archetype === 'signal-hacker'
    },
    dialog: {
      approach: [
        `You look like you know how to survive, ${bundle.profile.name || 'wanderer'}.`,
        'Keep your voice down. The wasteland eavesdrops.',
        `Name's ${npcName}. Don't waste it.`
      ],
      idle: [
        'Static is louder than the wind today.',
        'Trade routes are getting meaner by the mile.',
        'Some days the dust tells the truth first.'
      ],
      gossip: [
        `${faction} is shifting pieces again.`,
        'Somebody is buying trouble with clean caps.',
        'Vault rumors travel faster than caravans now.'
      ]
    },
    motivations: concept.motivations,
    appearanceHints: concept.appearanceHints,
    notes: 'Generated by the self-hosted Overseer core using stored player context and recent terminal memory.'
  };
}

module.exports = {
  generateCharacterConcept,
  generateCharacterNames: generateNames,
  generateNpcDossier
};
