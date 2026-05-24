import { fileURLToPath } from "node:url";
import { realai } from "./realai-client.js";

export async function main() {
  const prompt = `
Generate 10 Fallout-style wasteland locations.
Each location must include:
- Name
- Region
- Environmental hazards
- Enemy types
- Loot table
- Lore snippet
- Encounter hooks
- Hidden secrets
- Map description
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
