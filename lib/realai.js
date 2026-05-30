import { realai } from "../scripts/realai/realai-client.js";

export async function realaiChat(prompt, model) {
  return realai(prompt, model);
}
