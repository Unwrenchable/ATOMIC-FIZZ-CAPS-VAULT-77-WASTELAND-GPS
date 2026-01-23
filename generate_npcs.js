const fs = require("fs");
const path = require("path");

// Load data files
const rules = require("./public/data/npc_generator/npc_generator_rules.json");
const template = require("./public/data/npc_generator/npc_generator_template.json");
const archetypes = require("./public/data/archetypes/archetypes.json").archetypes;
const regionPools = require("./public/data/archetypes/region_pools.json").regionPools;
const timelineVariants = require("./public/data/archetypes/timeline_variants.json").variants;
const behaviorPatterns = require("./public/data/archetypes/behavior_patterns.json").patterns;

// Output directory
const OUTPUT_DIR = "./public/data/npc/generated/";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Utility: random pick
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Utility: weighted pick
function weightedPick(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    if (r < weight) return key;
    r -= weight;
  }
  return entries[0][0];
}

// Generate NPCs for each region
let npcIndex = 1;

for (const region in regionPools) {
  const regionList = regionPools[region];

  if (!Array.isArray(regionList)) {
    console.warn(`Skipping region "${region}" — regionPools entry is invalid.`);
    continue;
  }

  // Determine population
  const override = rules.population.regionOverrides[region] || {};
  const min = override.min ?? rules.population.defaultPerRegionMin;
  const max = override.max ?? rules.population.defaultPerRegionMax;
  const count = Math.floor(Math.random() * (max - min + 1)) + min;

  for (let i = 0; i < count; i++) {
    const id = template.idFormat
      .replace("{region}", region)
      .replace("{index}", npcIndex.toString().padStart(3, "0"));

    const archetypeId = weightedPick(rules.archetypeWeights);
    const archetype = archetypes.find(a => a.id === archetypeId);

    if (!archetype) {
      console.warn(`Missing archetype "${archetypeId}" — skipping NPC ${id}`);
      continue;
    }

    const npc = {
      id,
      name: pick(archetype.namePattern || ["Wanderer"]),
      archetype: archetype.id,
      spawnPool: regionList,
      behaviorPattern: archetype.behaviorPattern || "wanderer_basic",
      lootPool: archetype.lootPool || "default_loot",
      dialogPool: archetype.dialogPool || "default_dialog",
      factionTag: weightedPick(rules.factions.weights),
      timelineVariants: [],
      // Appearance data for Fallout 4 style character portraits
      appearance: generateNPCAppearance(archetype)
    };

    // Timeline variants
    if (Math.random() < rules.timeline.echoChance) npc.timelineVariants.push("echo");
    if (Math.random() < rules.timeline.shadowChance) npc.timelineVariants.push("shadow");
    if (Math.random() < rules.timeline.fracturedChance) npc.timelineVariants.push("fractured");

    // Save file
    const filePath = path.join(OUTPUT_DIR, `${npc.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(npc, null, 2));

    npcIndex++;
  }
}

// Generate random NPC appearance
function generateNPCAppearance(archetype) {
  const genders = ['male', 'female', 'nonbinary'];
  const races = archetype?.racePool || ['human', 'human', 'human', 'ghoul', 'synth'];
  const skinTones = ['pale', 'fair', 'light', 'medium', 'tan', 'olive', 'brown', 'dark'];
  const faceShapes = ['oval', 'round', 'square', 'heart', 'oblong', 'diamond'];
  const hairStyles = ['bald', 'buzzcut', 'short', 'medium', 'long', 'mohawk', 'ponytail', 'braids', 'dreads', 'slickedback', 'wasteland'];
  const hairColors = ['black', 'darkbrown', 'brown', 'auburn', 'red', 'ginger', 'blonde', 'platinum', 'white', 'gray'];
  const eyeShapes = ['almond', 'round', 'hooded', 'downturned', 'upturned', 'monolid', 'deepset'];
  const eyeColors = ['brown', 'hazel', 'amber', 'green', 'blue', 'gray', 'black'];
  const noseTypes = ['straight', 'roman', 'snub', 'button', 'aquiline', 'wide', 'narrow'];
  const mouthTypes = ['thin', 'full', 'wide', 'small', 'heartshaped'];
  const scars = ['none', 'none', 'none', 'cheek_left', 'cheek_right', 'brow', 'lip', 'forehead', 'claw', 'bullet'];
  const expressions = ['neutral', 'stern', 'friendly', 'suspicious', 'weary', 'determined', 'smirking'];
  const ageRanges = ['young', 'adult', 'adult', 'middleaged', 'elder'];
  const bodyTypes = ['slim', 'average', 'muscular', 'heavy'];

  const gender = pick(genders);
  const race = pick(races);

  return {
    gender,
    race,
    skinTone: pick(skinTones),
    faceShape: pick(faceShapes),
    hairStyle: pick(hairStyles),
    hairColor: pick(hairColors),
    eyeShape: pick(eyeShapes),
    eyeColor: race === 'ghoul' ? 'ghoul_yellow' : (race === 'synth' ? pick(['synth_blue', 'synth_gold', ...eyeColors]) : pick(eyeColors)),
    noseType: pick(noseTypes),
    mouthType: pick(mouthTypes),
    facialHair: gender === 'male' ? pick(['none', 'none', 'stubble', 'goatee', 'fullbeard', 'mustache']) : 'none',
    scar: pick(scars),
    marking: race === 'ghoul' ? 'radiation_burns' : (race === 'synth' ? (Math.random() < 0.3 ? 'circuitry' : 'none') : 'none'),
    accessory: Math.random() < 0.2 ? pick(['glasses', 'goggles', 'bandana', 'eyepatch_left']) : 'none',
    expression: pick(expressions),
    ageRange: pick(ageRanges),
    bodyType: pick(bodyTypes),
    voice: race === 'synth' ? 'robotic' : pick(['smooth', 'gruff', 'raspy', 'weathered', 'youthful'])
  };
}

console.log("NPC generation complete.");
