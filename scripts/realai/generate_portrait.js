import realAI from "./realai-client.js";

async function generateNPCPortrait(npc) {
  const prompt = `${npc.name}, ${npc.visual.gender} ${npc.visual.age} ${npc.role}, ${npc.visual.notable.join(", ")}, Fallout wasteland portrait, bust-up, stylized concept art, neon green CRT glow, thick outlines, gritty shading, subtle scanlines, Pip-Boy color palette, rugged clothing, dust and scratches, centered composition, 4:5 aspect ratio, not photorealistic`;

  console.log("Generating portrait for:", npc.name);
  console.log("Prompt:", prompt);

  const response = await realAI.chat(prompt, { 
    provider: "ollama", 
    model: "llama3.2:3b" 
  });

  console.log("✅ Prompt ready. Now send to image model.");
  return prompt;
}

// Test
const npc = {
  name: "Rusty Jack",
  visual: { gender: "male", age: "50s", notable: ["scarred face", "cybernetic eye", "leather duster"] }
};

generateNPCPortrait(npc);
