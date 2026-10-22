import { realai } from "./realai-client.js";
import { regionDialogueFlavor } from "../../systems/region-influence.js";
import { buildWorldBrainContextBlock, buildWorldBrainSystemPrompt } from "./world-brain.js";

function stripWrappingQuotes(text) {
  return String(text || "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ");
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildFallbackLine(npc = {}, context = "") {
  const attitude = npc?.interaction_profile?.attitude_toward_player || "neutral";

  if (/trade|barter/i.test(context)) {
    return "Got scraps. Show me caps.";
  }

  if (/threat|aggressive|intimid/i.test(context)) {
    return "Back off. I still bite.";
  }

  if (/help|info/i.test(context)) {
    return "Keep east. Trouble's stirring.";
  }

  if (/gossip|what's going on/i.test(context)) {
    return "Patrol dust means bad news.";
  }

  if (/farewell|ends the conversation/i.test(context)) {
    return "Stay sharp out there.";
  }

  if (attitude === "hostile") {
    return "You lost, smoothskin?";
  }

  if (attitude === "friendly") {
    return "Didn't expect company today.";
  }

  return "Easy there, drifter.";
}

export function buildDialoguePrompt(npc = {}, player = {}, context = "") {
  const regionFlavor = regionDialogueFlavor(npc?.background?.origin);
  const worldBrainSeed = {
    player,
    region: { name: npc?.background?.origin || "unknown", flavor: regionFlavor },
    cell: npc?.cell || {},
    world_state: npc?.world_state || {},
    faction_influence: npc?.faction_influence || {},
    ar_context: npc?.ar_context || {},
    time_of_day: npc?.time_of_day || "unknown",
    difficulty_tuning: npc?.difficulty_tuning || "balanced",
    engagement_tuning: npc?.engagement_tuning || "neutral"
  };

  return `
${buildWorldBrainSystemPrompt()}

You are currently generating ONE short spoken line for the wasteland simulation.
Generate ONE short line of dialogue spoken by the NPC.

OUTPUT ONLY THE SPOKEN LINE.
NO JSON.
NO labels.
NO extra text.

NPC DATA:
${JSON.stringify(npc, null, 2)}

PLAYER DATA:
${JSON.stringify(player, null, 2)}

CONTEXT:
"${context}"

REGION FLAVOR:
"${regionFlavor}"

${buildWorldBrainContextBlock(worldBrainSeed)}

RULES:
- Fallout Mojave tone.
- Short, punchy, gritty.
- Under 14 words.
- Reflect NPC personality, background, faction, attitude, cell tuning, and world simulation state.
- Reflect region vibe and faction tension if relevant.
- Reflect player style, alignment, personality, vibe, and engagement tuning if relevant.
- If AR context is present, make the line readable in 2-3 seconds.
- No paragraphs.
- No narration.
- No stage directions.
- Just the spoken line.
  `.trim();
}

export async function generateDialogue(npc = {}, player = {}, context = "") {
  try {
    const prompt = buildDialoguePrompt(npc, player, context);
    const raw = await realai(prompt, "gpt-4o-mini");
    const line = stripWrappingQuotes(raw);

    if (!line || countWords(line) > 14) {
      throw new Error("Dialogue line must be 14 words or fewer.");
    }

    return line;
  } catch (error) {
    console.error("[dialogue-engine] dialogue generation failed:", error.message);
    return buildFallbackLine(npc, context);
  }
}
