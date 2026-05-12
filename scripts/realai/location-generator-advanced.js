import { realai } from "./realai-client.js";

const prompt = 
Generate 5 detailed Fallout-style wasteland locations.
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
;

realai(prompt, "realai-overseer");
