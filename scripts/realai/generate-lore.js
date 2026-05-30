import { fileURLToPath } from "node:url";
import { realai } from "./realai-client.js";

export async function main() {
  const prompt = `
Write a new lore entry for the Atomic Fizz Caps universe.
Include:
- History
- Rumors
- Hidden secrets
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
