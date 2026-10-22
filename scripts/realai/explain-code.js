import { realai } from "./realai-client.js";
import fs from "fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node explain-code.js <path-to-file>");
  process.exit(1);
}

const code = fs.readFileSync(file, "utf8");
const prompt = "Explain this code in detail and suggest improvements:\n\n" + code;

realai(prompt);
