/**
 * Resolve the live RealAI hive CJS client path (does not load secrets).
 * Prefers REALAI_HIVE_CLIENT, then product/plugin candidates, then sibling ESM.
 *
 * Note: some shells set REALAI_HOME to C:\RealAI-clean\realai (package).
 * We also try product root C:\RealAI-clean.
 */
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCT_HOME = "C:\\RealAI-clean";

function candidates() {
  const out = [];
  if (process.env.REALAI_HIVE_CLIENT) out.push(process.env.REALAI_HIVE_CLIENT);
  const homes = [
    process.env.REALAI_HOME,
    process.env.REALAI_HOME ? path.resolve(process.env.REALAI_HOME, "..") : null,
    PRODUCT_HOME,
  ].filter(Boolean);
  for (const home of homes) {
    out.push(path.join(home, "realai", "plugins", "atomic_fizz_realai", "realai-client.js"));
    out.push(path.join(home, "plugins", "atomic_fizz_realai", "realai-client.js"));
  }
  out.push(path.join(__dirname, "realai-client.js"));
  return out;
}

export function resolveHiveClientPath() {
  for (const p of candidates()) {
    if (p && fs.existsSync(p)) return p;
  }
  return path.join(__dirname, "realai-client.js");
}

export function hiveEnv() {
  const client = resolveHiveClientPath();
  const product =
    fs.existsSync(path.join(PRODUCT_HOME, "realai", "plugins", "atomic_fizz_realai", "realai-client.js"))
      ? PRODUCT_HOME
      : process.env.REALAI_HOME || PRODUCT_HOME;
  return {
    REALAI_HOME: product,
    REALAI_API_BASE:
      process.env.REALAI_API_BASE ||
      process.env.REALAI_PROVIDER_URL ||
      "http://127.0.0.1:8001",
    REALAI_HIVE_CLIENT: client,
  };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").includes("resolve-hive-client")) {
  console.log(JSON.stringify(hiveEnv(), null, 2));
}
