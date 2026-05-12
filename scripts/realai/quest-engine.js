import { realai } from "./realai-client.js";

const prompt = 
You are the Quest Engine for a Fallout-style wasteland RPG.
Generate 3 quests. Each quest must include:
- Title
- Description
- Objective steps
- Required items
- NPCs involved
- Rewards
- Difficulty rating
- Optional twist
;

realai(prompt, "realai-overseer");
