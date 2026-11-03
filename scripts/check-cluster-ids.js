#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = path.join(__dirname, "..");
const toml = fs.readFileSync(path.join(root, "Anchor.toml"), "utf8");
const rs = fs.readFileSync(path.join(root, "programs/fizzcaps_onchain/src/lib.rs"), "utf8");

function tomlId(section) {
  const re = new RegExp("\\[" + section.replace(".", "\\.") + "\\][\\s\\S]*?fizzcaps_onchain\\s*=\\s*\"([^\"]+)\"");
  const match = toml.match(re);
  if (!match) {
    console.error("Anchor.toml is missing [" + section + "] fizzcaps_onchain");
    process.exit(1);
  }
  return match[1];
}

function declareFor(feature) {
  const lines = rs.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("declare_id!")) continue;
    const window = lines.slice(Math.max(0, i - 2), i + 1).join("\n");
    if (!window.includes('feature = "' + feature + '"')) continue;
    const match = lines[i].match(/declare_id!\("([^"]+)"\)/);
    if (match) return match[1];
  }
  console.error("lib.rs has no declare_id! next to feature " + feature);
  process.exit(1);
}

const devnet = tomlId("programs.devnet");
const localnet = tomlId("programs.localnet");
const mainnet = tomlId("programs.mainnet");
const rsDevnet = declareFor("devnet");
const rsLocalnet = declareFor("localnet");
const rsMainnet = declareFor("mainnet");

const pairs = [
  ["devnet", devnet, rsDevnet],
  ["localnet", localnet, rsLocalnet],
  ["mainnet", mainnet, rsMainnet],
];
for (const [name, toml, rust] of pairs) {
  if (toml !== rust) {
    console.error(name + " declare_id " + rust + " != Anchor.toml " + toml);
    process.exit(1);
  }
}
const ids = [devnet, localnet, mainnet];
if (new Set(ids).size !== ids.length) {
  console.error("each cluster needs its own program id: " + ids.join(" "));
  process.exit(1);
}
if (!rs.includes('compile_error!("exactly one of features localnet, devnet, mainnet must be set")')) {
  console.error("lib.rs is missing the single-cluster compile_error!");
  process.exit(1);
}
if (/default\s*=\s*\[[^\]]*(localnet|devnet|mainnet)/.test(fs.readFileSync(path.join(root, "programs/fizzcaps_onchain/Cargo.toml"), "utf8"))) {
  console.error("Cargo.toml must not default a cluster feature");
  process.exit(1);
}

console.log("declare_id matches Anchor.toml");
console.log("  devnet   " + devnet);
console.log("  localnet " + localnet);
console.log("  mainnet  " + mainnet);
