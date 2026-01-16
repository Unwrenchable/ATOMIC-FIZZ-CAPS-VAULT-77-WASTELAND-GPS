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

  // Determine population
  const override = rules.population.regionOverrides[region] || {};
  const min = override.min || rules.population.defaultPerRegionMin;
  const max = override.max || rules.population.defaultPerRegionMax;
  const count = Math.floor(Math.random() * (max - min + 1)) + min;

  for (let i = 0; i < count; i++) {
    const id = template.idFormat
      .replace("{region}", region)
      .replace("{index}", npcIndex.toString().padStart(3, "0"));

    const archetypeId = weightedPick(rules.archetypeWeights);
    const archetype = archetypes.find(a => a.id === archetypeId);

    const npc = {
      id,
      name: pick(archetype.namePattern),
      archetype: archetype.id,
      spawnPool: regionList,
      behaviorPattern: archetype.behaviorPattern || "wanderer_basic",
      lootPool: archetype.lootPool,
      dialogPool: archetype.dialogPool,
      factionTag: weightedPick(rules.factions.weights),
      timelineVariants: []
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

console.log("NPC generation complete.");
