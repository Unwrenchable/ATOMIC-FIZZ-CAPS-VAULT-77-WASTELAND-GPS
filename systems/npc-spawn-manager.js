import { generateNPC } from "../scripts/realai/generate-npc.js";
import { buildPlayerInfluence } from "./player-influence.js";
import { buildRegionInfluence } from "./region-influence.js";
import { animationMap, interactionMap } from "./npc-animation-map.js";

const activeNPCs = new Map();
const regionSpawnCache = new Map();

function buildSpawnSeed(player, regionName, region, spawnIndex) {
  return {
    ...buildPlayerInfluence(player),
    region: regionName,
    region_palette: region.palette,
    region_factions: region.factions,
    region_vibe: region.vibe,
    spawn_index: spawnIndex
  };
}

function applyAnimationAndBehaviorMaps(npc) {
  return {
    ...npc,
    animation_profile: {
      idle: animationMap.idle[npc.animation_profile.idle] || "idle_relaxed",
      walk: animationMap.walk[npc.animation_profile.walk] || "walk_confident",
      gesture: animationMap.gesture[npc.animation_profile.gesture] || "gesture_adjust"
    },
    interaction_profile: {
      ...npc.interaction_profile,
      mapped_attitude:
        interactionMap.attitude[npc.interaction_profile.attitude_toward_player] || "neutral",
      mapped_distance:
        interactionMap.distance[npc.interaction_profile.distance_behavior] || 2.5
    }
  };
}

export async function spawnNPCsForRegion(player, regionName) {
  if (regionSpawnCache.has(regionName)) {
    return regionSpawnCache.get(regionName);
  }

  const region = buildRegionInfluence(regionName);
  const npcCount = 4;
  const jobs = [];

  for (let index = 0; index < npcCount; index += 1) {
    jobs.push(
      generateNPC(buildSpawnSeed(player, regionName, region, index)).then((npc) => {
        const mappedNPC = applyAnimationAndBehaviorMaps(npc);
        activeNPCs.set(mappedNPC.id, mappedNPC);
        return mappedNPC;
      })
    );
  }

  const npcs = await Promise.all(jobs);
  regionSpawnCache.set(regionName, npcs);
  return npcs;
}

export function getActiveNPCs() {
  return Array.from(activeNPCs.values());
}

export function clearSpawnedNPCs() {
  activeNPCs.clear();
  regionSpawnCache.clear();
}
