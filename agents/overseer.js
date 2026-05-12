import { realaiChat } from "../lib/realai.js";
import fs from "fs";

export async function overseerScan() {
  const files = fs.readdirSync("./");

  const summary = await realaiChat(
    "Analyze these files and find issues:\n" + files.join("\n")
  );

  console.log(summary);
}

overseerScan();
