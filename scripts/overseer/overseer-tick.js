import fs from "fs";
import path from "path";
import { realai } from "../realai/realai-client.js";
import { extractJson } from "./json-extract.js";

const ROOT = process.cwd();
const WORLDSTATE_PATH = path.join(ROOT, "public", "overseer", "worldstate", "worldstate.json");
const EVENTS_PATH = path.join(ROOT, "public", "overseer", "events", "player_events.json");
const LOG_PATH = path.join(ROOT, "public", "overseer", "logs", "overseer_log.json");

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function saveJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

function buildLocalPrompt(worldstate, events) {
  let p = "";
  p += "You are THE OVERSEER of Vault 77.\n";
  p += "Generate a creative Fallout-style analysis of the worldstate and events.\n";
  p += "Do NOT output JSON.\n\n";
  p += "WORLDSTATE:\n" + JSON.stringify(worldstate) + "\n\n";
  p += "EVENTS:\n" + JSON.stringify(events) + "\n\n";
  return p;
}

function buildCloudPrompt(localOutput) {
  let p = "";
  p += "Convert the following Overseer analysis into STRICT JSON ONLY.\n";
  p += "No text before or after. No markdown.\n\n";
  p += "ANALYSIS:\n" + localOutput + "\n\n";
  p += "SCHEMA:\n";
  p += "{\n";
  p += '  "worldstate": <updated worldstate JSON>,\n';
  p += '  "log_entry": {\n';
  p += '    "timestamp": "<ISO8601>",\n';
  p += '    "summary": "<short overseer summary>",\n';
  p += '    "details": "<long overseer commentary>"\n';
  p += "  }\n";
  p += "}\n";
  return p;
}

async function runOverseerTick() {
  const worldstate = loadJson(WORLDSTATE_PATH, {
    version: 1,
    time: { last_tick: null },
    regions: [],
    factions: [],
    settlements: [],
    notable_npcs: []
  });

  const events = loadJson(EVENTS_PATH, []);

  // 1. Local creative model
  const localPrompt = buildLocalPrompt(worldstate, events);
  const localOutput = await realai(localPrompt, "llama-3.2-1b");

  // 2. Cloud JSON model
  const cloudPrompt = buildCloudPrompt(localOutput);
  const raw = await realai(cloudPrompt, "gpt-4o-mini");

  let data = extractJson(raw);

  if (!data) {
    console.error("Hybrid Overseer: cloud model returned no JSON. Using fallback.");
    data = {
      worldstate: worldstate,
      log_entry: {
        timestamp: new Date().toISOString(),
        summary: "Fallback hybrid tick",
        details: "Cloud model returned no JSON."
      }
    };
  }

  saveJson(WORLDSTATE_PATH, data.worldstate);

  const log = loadJson(LOG_PATH, []);
  log.push(data.log_entry);
  saveJson(LOG_PATH, log);

  saveJson(EVENTS_PATH, []);
}

runOverseerTick().catch(err => {
  console.error("Hybrid Overseer failed:", err);
  process.exit(1);
});
