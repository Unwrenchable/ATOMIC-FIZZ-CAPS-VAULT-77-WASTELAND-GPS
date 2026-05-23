"use strict";

const { buildEncounterSeed } = require("./seed-builder");
const { chooseEncounterType } = require("./logic/encounter-chooser");
const { generateNPC } = require("../realai/generate-npc");
const { generateQuest } = require("../realai/quest-generator");
const { generateDialogue } = require("../realai/dialogue-engine");
const { generateWorldEvent } = require("../realai/world-event");
const { generateDungeon } = require("../realai/dungeon-generator");

function getRegionContext(seed = {}) {
  return {
    name: seed.region,
    cell: seed.cell,
    faction_influence: seed.worldstate?.factions || {},
    ar_context: {
      enabled: Boolean(seed.ar_mode),
      mode: seed.ar_mode ? "ar" : "map"
    },
    world_state: seed.worldstate,
    difficulty_tuning:
      seed.tuning?.danger_adjustment < 0
        ? "reduced"
        : seed.tuning?.danger_adjustment > 0
          ? "raised"
          : "balanced",
    engagement_tuning: seed.tuning?.interest_boost ? "boosted" : "neutral"
  };
}

function buildNpcSeed(seed = {}, encounterType) {
  return {
    ...seed,
    merchant: encounterType === "merchant",
    patrol: encounterType === "faction_patrol"
  };
}

async function buildNpcPayload(seed = {}, encounterType) {
  const npc = await generateNPC(buildNpcSeed(seed, encounterType));
  const dialogueContext =
    encounterType === "merchant"
      ? "trade encounter"
      : encounterType === "faction_patrol"
        ? "patrol stop"
        : "encounter intro";
  const dialogue = await generateDialogue(npc, seed.player, dialogueContext);
  const quest =
    encounterType === "npc" || encounterType === "faction_patrol"
      ? await generateQuest(npc, seed.player, getRegionContext(seed))
      : null;

  return { npc, dialogue, quest };
}

async function handleEncounterCheck(req, res) {
  try {
    const body = req.body || {};
    const { player, gps, region, ar_mode, cooldowns } = body;
    const seed = await buildEncounterSeed(player, gps, region, ar_mode, req.app, cooldowns);
    const decision = await chooseEncounterType(seed);

    if (decision.encounter_type === "none") {
      return res.json({ ok: true, ...decision, payload: null });
    }

    let payload = null;

    switch (decision.encounter_type) {
      case "npc":
      case "merchant":
      case "faction_patrol":
        payload = await buildNpcPayload(decision.seed, decision.encounter_type);
        break;
      case "event":
      case "hazard":
      case "discovery":
        payload = await generateWorldEvent({
          ...decision.seed,
          hazard: decision.encounter_type === "hazard",
          discovery: decision.encounter_type === "discovery"
        });
        break;
      case "dungeon":
        payload = await generateDungeon(decision.seed);
        break;
      default:
        payload = null;
        break;
    }

    return res.json({
      ok: true,
      ...decision,
      payload
    });
  } catch (error) {
    console.error("[encounter] check failed:", error);
    const status = /required|invalid|range/i.test(error.message) ? 400 : 500;

    return res.status(status).json({
      ok: false,
      error:
        status === 400
          ? `Vault scanner jammed: ${error.message}`
          : "Wasteland signal lost. Encounter scan failed."
    });
  }
}

module.exports = {
  handleEncounterCheck
};
