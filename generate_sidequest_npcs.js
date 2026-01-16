// ------------------------------------------------------------
// STANDALONE SIDE‑QUEST NPC GENERATOR
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

// Regions supported
const REGIONS = [
  "mojave",
  "commonwealth",
  "capital_wasteland",
  "new_reno",
  "appalachia",
  "dlc_regions",
  "travelers"
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

// Behavior patterns
const BEHAVIOR_PATTERNS = [
  "quest_seeker",
  "timeline_observer",
  "anomaly_sensitive",
  "vegas_bound",
  "fizzcaps_informer"
];

// Quest hooks
const QUEST_HOOKS = [
  "vegas_rumor_01",
  "vegas_rumor_02",
  "vegas_rumor_03",
  "fizzcaps_clue_01",
  "fizzcaps_clue_02",
  "fizzcaps_clue_03",
  "anomaly_investigation_01",
  "anomaly_investigation_02",
  "timeline_warning_01",
  "timeline_warning_02",
  "region_story_01",
  "region_story_02"
];

// Name fragments
const NAME_FRAGMENTS = [
  "Kael","Mira","Sylas","Varra","Daro","Lira","Joren","Hale",
  "Rhea","Tessa","Nina","Voss","Lenn","Marla","Dax","Nova",
  "Rook","Jett","Vera","Ash","Ren","Kade","Lio","Mara"
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName() {
  const first = pick(NAME_FRAGMENTS);
  const last = pick(NAME_FRAGMENTS);
  return first === last ? `${first} ${last}r` : `${first} ${last}`;
}

function pickQuestHooks() {
  const count = 1 + Math.floor(Math.random() * 3);
  const hooks = new Set();
  while (hooks.size < count) hooks.add(pick(QUEST_HOOKS));
  return [...hooks];
}

function buildTravelData(region) {
  if (region !== "travelers") return null;

  const origins = ["mojave","commonwealth","capital_wasteland","new_reno","appalachia"];
  const originRegion = pick(origins);
  const destinationRegion = "vegas_outskirts";
  const travelPath = [originRegion, destinationRegion];

  return { originRegion, destinationRegion, travelPath };
}

function generateNPC(region, index) {
  const safeRegion = REGIONS.includes(region) ? region : "mojave";
  const timelines = pick(TIMELINE_SETS);
  const archetype = pick(ARCHETYPES);
  const behaviorPattern =
    safeRegion === "travelers" ? "vegas_bound" : pick(BEHAVIOR_PATTERNS);

  const id = `npc_sidequest_${safeRegion}_${timelines.join("-")}_${String(index).padStart(3,"0")}`;
  const name = randomName();
  const questHooks = pickQuestHooks();
  const travelData = buildTravelData(safeRegion);

  const npc = {
    id,
    type: "side_quest",
    name,
    region: travelData ? travelData.originRegion : safeRegion,
    timelines,
    archetype,
    behaviorPattern,
    dialogPool: `${id}_dialog`,
    lootPool: `${id}_loot`,
    questHooks,
    anomalyAwareness: Math.round((0.3 + Math.random() * 0.6) * 100) / 100,
    factionTag: "neutral",
    notes: "Generated side‑quest NPC with region, timeline, and quest hooks."
  };

  if (travelData) {
    npc.originRegion = travelData.originRegion;
    npc.destinationRegion = travelData.destinationRegion;
    npc.travelPath = travelData.travelPath;
  }

  return npc;
}

function generateDialog(npc) {
  let lines = [];

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

  return {
    id: npc.lootPool,
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
