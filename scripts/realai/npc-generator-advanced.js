import { fileURLToPath } from "node:url";
import { realai } from "./realai-client.js";

export async function main() {
  const prompt = `
Generate 5 advanced Fallout-style NPCs.
Each NPC must include:
- Name
- Faction
- Personality traits
- Combat style
- Inventory
- Dialogue sample
- Backstory
- Secret weakness
- Reputation impact
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
