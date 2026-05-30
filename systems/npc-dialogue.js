import { generateDialogue } from "../scripts/realai/dialogue-engine.js";
import { DialogueContexts } from "./dialogue-contexts.js";

export async function npcSpeak(npc, player, mode = "GREET") {
  const context = DialogueContexts[mode] || DialogueContexts.GREET;
  return generateDialogue(npc, player, context);
}
