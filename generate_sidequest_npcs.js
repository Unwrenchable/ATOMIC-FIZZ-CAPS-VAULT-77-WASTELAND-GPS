// ------------------------------------------------------------
// STANDALONE SIDE‑QUEST NPC GENERATOR (FULL K+ UPGRADE)
// ------------------------------------------------------------

const fs = require("fs");
const path = require("path");

// Output directories
const NPC_DIR = "./public/data/npc/side_quest/";
const DIALOG_DIR = "./public/data/dialog/side_quest/";
const LOOT_DIR = "./public/data/loot/side_quest/";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(NPC_DIR);
ensureDir(DIALOG_DIR);
ensureDir(LOOT_DIR);

// Regions supported (strict)
const REGIONS = [
  "188",
  "anch",
  "anomaly_zones",
  "atomic_fizz",
  "blackmountain",
  "boulder_city",
  "bouldercity",
  "brotherhood",
  "bunker",
  "commonwealth_institute",
  "cottonwood",
  "desertridge",
  "divide",
  "drylake",
  "enclave",
  "fizzco",
  "freeside",
  "general_wasteland",
  "goodsprings",
  "hiddenvalley",
  "highway",
  "highways",
  "industrial",
  "jacobstown",
  "lakemead",
  "legion",
  "mojave",
  "mojaveridge",
  "ncr",
  "nellis",
  "nipton",
  "northvegas",
  "novac",
  "nv",
  "oldhighway",
  "outervegas",
  "outskirts",
  "pitt",
  "primm",
  "quarry",
  "redrock",
  "ridge",
  "ridgeline",
  "searchlight",
  "vegas_outskirts"
];

// Timeline sets
const TIMELINE_SETS = [
  ["prime"],
  ["echo"],
  ["shadow"],
  ["fractured"],
  ["prime", "echo"],
  ["prime", "shadow"]
];

// Archetypes
const ARCHETYPES = [
  "sidequest_informer",
  "sidequest_traveler",
  "sidequest_anomaly_researcher",
  "sidequest_fizzcaps_contact",
  "sidequest_region_legend"
];

// Behavior patterns (global fallback)
const BEHAVIOR_PATTERNS = [
  "quest_seeker",
  "timeline_observer",
  "anomaly_sensitive",
  "vegas_bound",
  "fizzcaps_informer"
];

// Quest hooks (global pool)
const QUEST_HOOKS = [
  // Vegas Core & Outskirts
  "vegas_rumor_01",
  "vegas_rumor_02",
  "vegas_rumor_03",
  "strip_whisper_01",
  "freeside_trouble_01",
  "outervegas_shadow_01",

  // FizzCaps / Atomic Fizz Corporate
  "fizzcaps_clue_01",
  "fizzcaps_clue_02",
  "fizzcaps_clue_03",
  "fizzco_coverup_01",
  "fizzco_lost_shipment_01",

  // Anomaly Zones
  "anomaly_investigation_01",
  "anomaly_investigation_02",
  "anomaly_bleed_01",
  "anomaly_echo_trace_01",
  "anomaly_fracture_warning_01",

  // Timeline Distortions
  "timeline_warning_01",
  "timeline_warning_02",
  "timeline_overlap_01",
  "timeline_shadow_event_01",
  "timeline_prime_discrepancy_01",

  // Mojave Subregions
  "goodsprings_mystery_01",
  "primm_oddity_01",
  "novac_sighting_01",
  "nipton_survivor_story_01",
  "boulder_city_conflict_01",
  "jacobstown_research_01",
  "blackmountain_broadcast_01",
  "drylake_ritual_01",
  "redrock_wind_omen_01",
  "searchlight_ash_phenomenon_01",

  // Highways & Wasteland Routes
  "highway_encounter_01",
  "highway_ghost_signal_01",
  "wasteland_route_warning_01",

  // NCR / Legion / Brotherhood / Enclave
  "ncr_dispatch_01",
  "ncr_border_tension_01",
  "legion_whisper_01",
  "legion_trial_01",
  "brotherhood_retrieval_01",
  "enclave_probe_01",

  // Divide / Pitt / DLC Regions
  "divide_echo_01",
  "divide_marking_01",
  "pitt_chain_rumor_01",
  "pitt_trog_activity_01",

  // Institute / Commonwealth
  "institute_scouting_01",
  "institute_synth_trace_01",

  // General Wasteland
  "region_story_01",
  "region_story_02",
  "wanderer_tale_01",
  "lost_caravan_01",
  "old_world_fragment_01"
];

// Name fragments
const NAME_FRAGMENTS = [
  // Original core
  "Kael","Mira","Sylas","Varra","Daro","Lira","Joren","Hale",
  "Rhea","Tessa","Nina","Voss","Lenn","Marla","Dax","Nova",
  "Rook","Jett","Vera","Ash","Ren","Kade","Lio","Mara",

  // New additions (expanded + diverse)
  "Soren","Elara","Kerr","Vey","Talon","Nyx","Riven","Sable",
  "Kira","Dune","Solin","Rooke","Venn","Arlo","Sera","Kest",
  "Rylin","Tarn","Eris","Vale","Korr","Lyra","Senn","Dara",
  "Marlow","Jax","Torin","Sela","Brin","Korrin","Nira",
  "Thane","Vara","Eon","Sira","Dren","Kallin","Minsk",
  "Torra","Veyra","Saros","Nell","Ryl","Kess","Tovin","Saro",
  "Vennic","Lysa","Renn","Karo","Vexa","Sorin",
  "Jora","Nexa","Tallis","Vorn","Syla","Rav","Kerrin","Dessa",
  "Maro","Vex","Rylas","Kova","Jalen"
];

// ------------------------------------------------------------
// WORLD SYSTEMS: REGION BEHAVIOR, DIALOG, LOOT, HOOKS, RARITY, TRAITS
// ------------------------------------------------------------

// Region-specific behavior patterns (fallback to BEHAVIOR_PATTERNS)
const REGION_BEHAVIORS = {
  freeside: ["alley_runner", "razorkid", "patchstitcher", "quest_seeker"],
  divide: ["echo_touched", "marking_carrier", "timeline_observer"],
  drylake: ["dustprophet", "mirage_watcher", "anomaly_sensitive"],
  industrial: ["machine_whisperer", "gear_sister", "smoke_eater"],
  highways: ["roadsaint", "howler_gang", "mapmaker", "vegas_bound"],
  highway: ["roadsaint", "howler_gang", "mapmaker", "vegas_bound"],
  outskirts: ["outskirts_drifter", "outskirts_guard", "quest_seeker"],
  vegas_outskirts: ["vegas_bound", "quest_seeker"],
  pitt: ["chain_worker", "trog_whisperer", "broken"],
  anomaly_zones: ["anomaly_sensitive", "timeline_observer"]
};

// Region-specific dialog pools (fallback to behavior-based dialog)
const REGION_DIALOG = {
  drylake: [
    "Dust sings if you listen long enough.",
    "Mirages here remember you even when you forget them.",
    "The lake’s gone, but something’s still drowning out here."
  ],
  divide: [
    "Storms carve markings into the ground. Some match my scars.",
    "The Divide doesn’t forget what you owe it.",
    "Echoes here aren’t just sound. They’re memory."
  ],
  freeside: [
    "Caps don’t last long here. Neither do people.",
    "Watch your pockets and your shadow.",
    "If the Strip is the dream, Freeside’s the hangover."
  ],
  industrial: [
    "Smoke gets in your lungs and never leaves.",
    "Machines remember the hands that built them.",
    "Unit 47 doesn’t sleep. It waits."
  ],
  pitt: [
    "Chains talk louder than words in the Pitt.",
    "Steel keeps you alive. Or it kills you.",
    "Trogs aren’t the only things that hunt in the dark."
  ],
  outskirts: [
    "You’re close enough to see Vegas, too far to touch it.",
    "Out here, you’re either passing through or stuck forever.",
    "The city hums out there. Like it’s thinking."
  ],
  vegas_outskirts: [
    "Vegas is right there, like a mirage with teeth.",
    "You can feel the Strip from here, even if you never see it.",
    "Everyone out here thinks they’re on their way somewhere better."
  ]
};

// Region “identity” notes
const REGION_IDENTITY = {
  drylake: "Reality thins where the lake once was.",
  divide: "Storms carve memory into the land.",
  freeside: "Hope is a currency nobody accepts.",
  industrial: "Machines outlive the hands that built them.",
  pitt: "Steel is law, and law is pain.",
  outskirts: "Close enough to see Vegas, too far to touch it.",
  vegas_outskirts: "The city pulls at everyone out here.",
  anomaly_zones: "The world glitches at the edges of understanding."
};

// Region-specific loot pools (added on top of base loot)
const REGION_LOOT = {
  divide: ["echo_shard", "storm_mark"],
  drylake: ["dust_relic", "mirage_glass"],
  industrial: ["gear_scrap", "unit47_component"],
  freeside: ["alley_token", "razorkid_shiv"],
  pitt: ["chain_link", "slag_chunk"],
  outskirts: ["outskirts_scrip"],
  highways: ["road_talisman"],
  highway: ["road_talisman"],
  vegas_outskirts: ["vegas_scrip"]
};

// Region-specific quest hooks (fallback to global QUEST_HOOKS)
const REGION_QUEST_HOOKS = {
  freeside: ["freeside_trouble_01", "vegas_rumor_01", "vegas_rumor_02"],
  divide: ["divide_echo_01", "divide_marking_01", "timeline_warning_01"],
  pitt: ["pitt_chain_rumor_01", "pitt_trog_activity_01"],
  drylake: ["drylake_ritual_01", "anomaly_investigation_01"],
  redrock: ["redrock_wind_omen_01"],
  searchlight: ["searchlight_ash_phenomenon_01"],
  highways: ["highway_encounter_01", "highway_ghost_signal_01"],
  highway: ["highway_encounter_01", "highway_ghost_signal_01"],
  vegas_outskirts: ["vegas_rumor_03", "wasteland_route_warning_01"]
};

// Region-specific archetype weighting (fallback to ARCHETYPES)
const REGION_ARCHETYPES = {
  highways: {
    sidequest_traveler: 0.7,
    sidequest_informer: 0.1,
    sidequest_anomaly_researcher: 0.1,
    sidequest_region_legend: 0.1
  },
  highway: {
    sidequest_traveler: 0.7,
    sidequest_informer: 0.1,
    sidequest_anomaly_researcher: 0.1,
    sidequest_region_legend: 0.1
  },
  anomaly_zones: {
    sidequest_anomaly_researcher: 0.6,
    sidequest_informer: 0.1,
    sidequest_traveler: 0.1,
    sidequest_region_legend: 0.2
  },
  freeside: {
    sidequest_informer: 0.5,
    sidequest_traveler: 0.2,
    sidequest_region_legend: 0.3
  },
  divide: {
    sidequest_anomaly_researcher: 0.4,
    sidequest_traveler: 0.2,
    sidequest_region_legend: 0.4
  },
  pitt: {
    sidequest_region_legend: 0.4,
    sidequest_traveler: 0.3,
    sidequest_informer: 0.3
  }
};

// Rarity tiers
const RARITY_TIERS = ["common", "uncommon", "rare", "legendary"];

// Personality traits
const PERSONALITY_TRAITS = [
  "paranoid",
  "hopeful",
  "broken",
  "calculating",
  "superstitious",
  "echo_haunted",
  "fizzcaps_obsessed",
  "wander_driven",
  "anomaly_tuned"
];

// Moods
const MOODS = [
  "tired",
  "agitated",
  "curious",
  "distant",
  "haunted",
  "wired",
  "calm"
];

// Roles (for UI grouping)
const ROLES = [
  "scout",
  "wanderer",
  "informant",
  "legend",
  "researcher",
  "drifter",
  "local"
];

// World hooks (tiny lore fragments)
const WORLD_HOOKS = {
  divide: [
    "They mention a courier who vanished in a storm.",
    "They talk about markings that move between visits."
  ],
  drylake: [
    "They swear the dust remembers footsteps.",
    "They mention a circle of stones that hum at night."
  ],
  freeside: [
    "They know a back alley where debts are settled in blood.",
    "They mention a kid who paints warnings on walls."
  ],
  industrial: [
    "They talk about a machine that keeps working with no power.",
    "They mention a unit that remembers old commands."
  ],
  pitt: [
    "They whisper about a chain gang that never sleeps.",
    "They mention a trog that speaks in broken words."
  ],
  outskirts: [
    "They talk about a signal that only comes at dusk.",
    "They mention a trader who never reaches the city."
  ],
  vegas_outskirts: [
    "They know a ridge where you can see the Strip flicker.",
    "They mention a camp that moves every night."
  ]
};

// Story seeds (for future quest expansion)
const STORY_SEEDS = {
  divide: [
    {
      id: "seed_divide_01",
      summary: "Mentions a courier who vanished in a Divide storm.",
      potential: "Could lead to a Divide micro‑quest later."
    }
  ],
  drylake: [
    {
      id: "seed_drylake_01",
      summary: "Talks about a ritual that keeps the dust calm.",
      potential: "Could tie into anomaly stabilization."
    }
  ],
  freeside: [
    {
      id: "seed_freeside_01",
      summary: "Knows a name that still scares the Kings.",
      potential: "Could unlock a Freeside faction thread."
    }
  ],
  pitt: [
    {
      id: "seed_pitt_01",
      summary: "Heard of a chain that even the bosses fear.",
      potential: "Could lead to a unique Pitt artifact."
    }
  ],
  outskirts: [
    {
      id: "seed_outskirts_01",
      summary: "Mentions a radio tower that only broadcasts at 3:33.",
      potential: "Could tie into Overseer signal anomalies."
    }
  ]
};

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(weights, fallbackArray) {
  if (!weights) return pick(fallbackArray);
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    if (r < weight) return key;
    r -= weight;
  }
  return entries[entries.length - 1][0];
}

function randomName() {
  const first = pick(NAME_FRAGMENTS);
  const last = pick(NAME_FRAGMENTS);
  return first === last ? `${first} ${last}r` : `${first} ${last}`;
}

function assignRarity() {
  const r = Math.random();
  if (r < 0.6) return "common";
  if (r < 0.85) return "uncommon";
  if (r < 0.97) return "rare";
  return "legendary";
}

function assignTraits() {
  const traits = new Set();
  const count = 1 + Math.floor(Math.random() * 2); // 1–2 traits
  while (traits.size < count) traits.add(pick(PERSONALITY_TRAITS));
  return [...traits];
}

function assignMood() {
  return pick(MOODS);
}

function assignRole(archetype) {
  switch (archetype) {
    case "sidequest_informer":
      return "informant";
    case "sidequest_traveler":
      return "wanderer";
    case "sidequest_anomaly_researcher":
      return "researcher";
    case "sidequest_region_legend":
      return "legend";
    case "sidequest_fizzcaps_contact":
      return "informant";
    default:
      return pick(ROLES);
  }
}

function assignIntelligence() {
  return 3 + Math.floor(Math.random() * 6); // 3–8
}

function assignStability(region) {
  if (region === "anomaly_zones" || region === "divide" || region === "drylake") {
    return Math.round((0.2 + Math.random() * 0.5) * 100) / 100; // 0.2–0.7
  }
  return Math.round((0.6 + Math.random() * 0.4) * 100) / 100; // 0.6–1.0
}

function assignDanger(region) {
  if (region === "pitt" || region === "divide" || region === "anomaly_zones") {
    return pick(["high", "unknown"]);
  }
  if (region === "freeside" || region === "industrial" || region === "outervegas") {
    return pick(["medium", "high"]);
  }
  return pick(["low", "medium"]);
}

function assignLootRarity(npcRarity) {
  switch (npcRarity) {
    case "common": return pick(["common", "common", "uncommon"]);
    case "uncommon": return pick(["uncommon", "uncommon", "rare"]);
    case "rare": return pick(["rare", "rare", "legendary"]);
    case "legendary": return pick(["legendary", "legendary", "anomaly"]);
    default: return "common";
  }
}

function pickQuestHooks(region) {
  const pool = REGION_QUEST_HOOKS[region] || QUEST_HOOKS;
  const count = 1 + Math.floor(Math.random() * 3);
  const hooks = new Set();
  while (hooks.size < count) hooks.add(pick(pool));
  return [...hooks];
}

function pickWorldHook(region) {
  const pool = WORLD_HOOKS[region];
  if (!pool || !pool.length) return null;
  return pick(pool);
}

function pickStorySeed(region) {
  const pool = STORY_SEEDS[region];
  if (!pool || !pool.length) return null;
  return pick(pool);
}

function buildTravelData(region) {
  // Keep this as a hook for future traveler expansion
  if (region !== "travelers") return null;

  const origins = ["mojave","commonwealth","capital_wasteland","new_reno","appalachia"];
  const originRegion = pick(origins);
  const destinationRegion = "vegas_outskirts";
  const travelPath = [originRegion, destinationRegion];

  return { originRegion, destinationRegion, travelPath };
}

// ------------------------------------------------------------
// NPC GENERATION
// ------------------------------------------------------------

function generateNPC(region, index) {
  const safeRegion = region;

  const timelines = pick(TIMELINE_SETS);

  const archetypeKey = weightedPick(
    REGION_ARCHETYPES[safeRegion],
    ARCHETYPES
  );
  const archetype = archetypeKey;

  const regionBehaviors = REGION_BEHAVIORS[safeRegion];
  const behaviorPattern =
    regionBehaviors && regionBehaviors.length
      ? pick(regionBehaviors)
      : pick(BEHAVIOR_PATTERNS);

  const id = `npc_sidequest_${safeRegion}_${timelines.join("-")}_${String(index).padStart(3,"0")}`;
  const name = randomName();
  const questHooks = pickQuestHooks(safeRegion);
  const travelData = buildTravelData(safeRegion);
  const rarity = assignRarity();
  const traits = assignTraits();
  const mood = assignMood();
  const role = assignRole(archetype);
  const intelligence = assignIntelligence();
  const stability = assignStability(safeRegion);
  const danger = assignDanger(safeRegion);
  const worldHook = pickWorldHook(safeRegion);
  const storySeed = pickStorySeed(safeRegion);
  const lootRarity = assignLootRarity(rarity);

  const npc = {
    id,
    type: "side_quest",
    name,
    region: travelData ? travelData.originRegion : safeRegion,
    timelines,
    archetype,
    behaviorPattern,
    rarity,
    lootRarity,
    traits,
    mood,
    role,
    intelligence,
    stability,
    danger,
    dialogPool: `${id}_dialog`,
    lootPool: `${id}_loot`,
    questHooks,
    anomalyAwareness: Math.round((0.3 + Math.random() * 0.6) * 100) / 100,
    factionTag: "neutral",
    notes: REGION_IDENTITY[safeRegion] || "Generated side‑quest NPC with region, timeline, rarity, traits, and quest hooks."
  };

  if (worldHook) {
    npc.worldHook = worldHook;
  }

  if (storySeed && Math.random() < 0.35) {
    npc.storySeed = storySeed;
  }

  if (travelData) {
    npc.originRegion = travelData.originRegion;
    npc.destinationRegion = travelData.destinationRegion;
    npc.travelPath = travelData.travelPath;
  }

  const mqPool = MICRO_QUEST_TEMPLATES[safeRegion];
  if (mqPool && Math.random() < 0.3) {
    npc.microQuest = pick(mqPool);
  }

  // Glitch flags for UI based on timelines
  npc.glitchEcho = (timelines || []).includes("echo");
  npc.glitchShadow = (timelines || []).includes("shadow");
  npc.glitchFractured = (timelines || []).includes("fractured");

  return npc;
}

function generateDialog(npc) {
  let lines = [];

  // Region-specific override first
  const regionLines = REGION_DIALOG[npc.region];
  if (regionLines && regionLines.length) {
    lines = regionLines;
  } else {
    // Fallback to behavior-based dialog
    switch (npc.behaviorPattern) {
      case "vegas_bound":
        lines = [
          "Roads all point to Vegas, one way or another.",
          "Something’s pulling us west. You feel it too.",
          "I crossed borders that don’t exist anymore."
        ];
        break;

      case "timeline_observer":
        lines = [
          "Things don’t line up the way they used to.",
          "Sometimes I remember a different version of this place.",
          "Feels like we’ve talked before… somewhere else."
        ];
        break;

      case "anomaly_sensitive":
        lines = [
          "Hear that hum? That’s not the wind.",
          "Places out here bend wrong. Stay too long and you bend with them.",
          "I mark the spots that make my teeth ache."
        ];
        break;

      case "fizzcaps_informer":
        lines = [
          "Ever seen a cap glow from the inside?",
          "FizzCaps weren’t just a drink. They were a test.",
          "Some say the road to Vegas is paved in old FizzCo contracts."
        ];
        break;

      default:
        lines = [
          "Wasteland’s loud if you know how to listen.",
          "Everyone’s chasing something. Me? I’m trying not to get caught.",
          "You look like someone who asks the wrong questions."
        ];
    }
  }

  // Mood flavor
  switch (npc.mood) {
    case "tired":
      lines.push("Sorry, it’s been a long day out here.");
      break;
    case "agitated":
      lines.push("Look, I don’t have time for this.");
      break;
    case "curious":
      lines.push("You don’t move like the locals. Where’re you from?");
      break;
    case "haunted":
      lines.push("Sometimes I hear footsteps behind me when I’m alone.");
      break;
    case "wired":
      lines.push("Haven’t slept much. Too much noise in my head.");
      break;
    case "distant":
      lines.push("I was thinking about somewhere else. Someone else.");
      break;
    case "calm":
      lines.push("Storms come and go. You learn to breathe through them.");
      break;
  }

  // Timeline flavor
  const timelines = npc.timelines || [];
  if (timelines.includes("echo")) {
    lines = lines.map(l => `${l} Feels like I’ve said that before.`);
  } else if (timelines.includes("shadow")) {
    lines = lines.map(l => l.replace(/\.$/, "..."));
  } else if (timelines.includes("fractured")) {
    lines = lines.map(l => l.split(" ").slice(0, -1).join(" ") + "...");
  }

  // Trait flavor (light touch)
  if (npc.traits && npc.traits.includes("paranoid")) {
    lines.push("Someone’s listening. They always are.");
  }
  if (npc.traits && npc.traits.includes("hopeful")) {
    lines.push("Maybe this place isn’t done with us yet.");
  }
  if (npc.traits && npc.traits.includes("echo_haunted")) {
    lines.push("I hear voices that sound like mine, but wrong.");
  }

  // Intelligence-based special line
  if (npc.intelligence >= 7) {
    lines.push("You ever think this world isn’t the first draft?");
  }

  return {
    id: npc.dialogPool,
    lines,
    specialChecks: {
      perception_6: "Their eyes twitch like they’re tracking something unseen.",
      intelligence_7: "You sense they’ve seen more than one version of this place."
    }
  };
}

function generateLoot(npc) {
  const items = ["caps_small","scrap_metal"];

  if (npc.behaviorPattern === "anomaly_sensitive" || npc.anomalyAwareness > 0.6)
    items.push("anomaly_fragment_small");

  if (npc.behaviorPattern === "fizzcaps_informer")
    items.push("fizzcaps_prototype_note");

  if (npc.behaviorPattern === "vegas_bound")
    items.push("vegas_access_chip_fragment");

  const regionExtras = REGION_LOOT[npc.region];
  if (regionExtras && regionExtras.length) {
    items.push(pick(regionExtras));
  }

  if (npc.rarity === "rare") {
    items.push("caps_medium");
  } else if (npc.rarity === "legendary") {
    items.push("caps_large", "legendary_token");
  }

  // Loot rarity tag for UI
  return {
    id: npc.lootPool,
    lootRarity: npc.lootRarity,
    items: [...new Set(items)]
  };
}

function writeJSON(dir, filename, data) {
  ensureDir(dir);
  const fullPath = path.join(dir, filename);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Wrote: ${fullPath}`);
}

// ------------------------------------------------------------
// MAIN EXECUTION
// ------------------------------------------------------------

const args = process.argv.slice(2);

const region = args.includes("--region")
  ? args[args.indexOf("--region") + 1]
  : "mojave";

if (!REGIONS.includes(region)) {
  console.error(`ERROR: Unknown region "${region}".`);
  console.error("Allowed regions are:");
  console.error(REGIONS.join(", "));
  process.exit(1);
}

const count = args.includes("--count")
  ? parseInt(args[args.indexOf("--count") + 1], 10)
  : 20;

console.log(`Generating ${count} side‑quest NPCs for region: ${region}`);

for (let i = 1; i <= count; i++) {
  const npc = generateNPC(region, i);
  const dialog = generateDialog(npc);
  const loot = generateLoot(npc);

  writeJSON(NPC_DIR, `${npc.id}.json`, npc);
  writeJSON(DIALOG_DIR, `${npc.dialogPool}.json`, dialog);
  writeJSON(LOOT_DIR, `${npc.lootPool}.json`, loot);
}

console.log("Side‑quest NPC generation complete.");
