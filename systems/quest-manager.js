import { generateQuest } from "../scripts/realai/quest-generator.js";
import { regionQuestFlavor } from "./region-influence.js";

const activeQuests = new Map();

export async function createQuestFromNPC(npc, player, regionName) {
  const region = {
    name: regionName,
    flavor: regionQuestFlavor(regionName)
  };

  const quest = await generateQuest(npc, player, region);
  activeQuests.set(quest.id, quest);
  return quest;
}

export function getActiveQuests() {
  return Array.from(activeQuests.values());
}

export function clearActiveQuests() {
  activeQuests.clear();
}
