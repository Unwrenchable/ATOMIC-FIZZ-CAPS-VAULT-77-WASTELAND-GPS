import { realai } from "./realai-client.js";
import fs from "fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node refactor-file.js <path-to-file>");
  process.exit(1);
}

const code = fs.readFileSync(file, "utf8");
const prompt = "Refactor this code for clarity, performance, and maintainability. Return only the improved code:\n\n" + code;

realai(prompt);
