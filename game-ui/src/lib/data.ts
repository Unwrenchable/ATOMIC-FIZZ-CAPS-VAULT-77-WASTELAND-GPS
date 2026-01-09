import fs from "fs/promises";
import path from "path";

export async function loadData(name: string) {
  const file = path.join(process.cwd(), "public", "data", `${name}.json`);
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw);
}
