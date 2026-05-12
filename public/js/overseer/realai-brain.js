import { realai } from "../../../backend/tools/realai.js";

export async function overseerDecision(worldState) {
  return await realai(`
    You are the Overseer of Vault 77.
    Analyze this world state and decide what happens next:
    ${JSON.stringify(worldState)}
  `, "realai-overseer");
}
