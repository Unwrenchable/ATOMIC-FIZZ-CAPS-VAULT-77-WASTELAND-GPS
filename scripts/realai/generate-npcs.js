import { fileURLToPath } from "node:url";
import { realai } from "./realai-client.js";

export async function main() {
  const prompt = `
Generate 5 unique Fallout-style NPCs.
Each NPC must include:
- Name
- Personality
- Faction alignment
- Dialogue sample
  `;

  const result = await realai(prompt);
  console.log(result);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
