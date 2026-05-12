import { realai } from "./realai-client.js";

const prompt = 
Generate dialogue for a Fallout-style NPC.
Include:
- Greeting line
- 3 branching dialogue options
- NPC emotional tone
- Hidden motive
- A secret line only revealed with high Charisma
;

realai(prompt, "realai-overseer");
