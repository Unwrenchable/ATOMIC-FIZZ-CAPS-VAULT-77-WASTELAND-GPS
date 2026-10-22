// IP pass regression tests (registered by tests/game.test.js)
"use strict";
const fs = require("fs");
const path = require("path");
const { test, sandbox, load, json, FE, ROOT, assert } = require("./game.test.js");

const BANNED = [/Cooper Howard/, /\bVault (13|111|76|87)\b/, /Commonwealth/, /\bNCR\b/, /New California Republic/, /McCarran/, /Megaton/,
  /Novac/, /\bT-51/, /\bX-01\b/, /Dunwich/, /Far Harbor/, /Diamond City/, /\bthe Pitt\b/, /Sole Survivor/, /Brotherhood of Steel/,
  /Vault-Tec/i, /Nuka-Cola/, /Pip-Boy/, /Shady Sands/, /Freeside/, /Rivet City/, /Mr\. House/, /\bFallout\b(?![_\-])/];

function walk(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (f === "node_modules") continue;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(json|js|html)$/.test(f) && !f.endsWith(".min.js")) out.push(p);
  }
  return out;
}

test("no franchise names left in shipped frontend copy/data (URLs excepted)", () => {
  const hits = [];
  for (const f of walk(FE, [])) {
    const s = fs.readFileSync(f, "utf8").replace(/https?:\/\/[^\s"'<>)]+/g, "");
    for (const re of BANNED) if (re.test(s)) hits.push(`${path.relative(ROOT, f)}: ${re}`);
  }
  assert.deepStrictEqual(hits.slice(0, 20), []);
});

test("renamed files exist and old ones are gone; raster manifest renamed", () => {
  const n = (p) => fs.existsSync(path.join(FE, p));
  assert.ok(n("data/narrative/dialog_cutter_hale.json") && !n("data/narrative/dialog_ghoul_cooper.json"));
  assert.ok(n("data/narrative/dialog_vault_sleeper_echo.json") && n("data/narrative/dialog_last_sleeper_echo.json"));
  assert.ok(n("data/npc/npc_188_compact_trooper_darin_moss.json"));
  const m = json("assets/avatars-raster/manifest.json");
  const s = JSON.stringify(m);
  assert.ok(!/fallout|vault_tec/i.test(s));
});

test("old NPC/dialog ids still resolve to the renamed dialogs", () => {
  const ctx = sandbox(); ctx.Game = { modules: {} };
  load(ctx, "js/modules/narrative.js");
  const n = ctx.Game.modules.narrative;
  assert.strictEqual(n.resolveDialogIdFromNpc("ghoul_cooper"), "dialog_cutter_hale");
  assert.strictEqual(n.resolveDialogIdFromNpc("dialog_ghoul_cooper"), "dialog_cutter_hale");
  assert.strictEqual(n.resolveDialogIdFromNpc("sole_survivor_echo"), "dialog_last_sleeper_echo");
});

test("saved quests under old ids are migrated", () => {
  const ctx = sandbox(); ctx.Game = { modules: {} };
  ctx.localStorage.setItem("afc_unified_player_state_v2", JSON.stringify({ questsActive: ["quest_tv_ghoul_cooper"], questsCompleted: ["quest_fo2_ncr_founding"] }));
  load(ctx, "js/game/slots.js"); load(ctx, "js/game/player-state.js");
  const st = ctx.Game.modules.PlayerState.getState();
  assert.deepStrictEqual([...st.questsActive], ["quest_tv_cutter_hale"]);
  assert.deepStrictEqual([...st.questsCompleted], ["quest_fo2_compact_founding"]);
});

test("/special/update enforces the 28-point budget (no inflation)", () => {
  const R = require(path.join(ROOT, "backend/api/vitals-rules.js"));
  const all10 = { S: 10, P: 10, E: 10, C: 10, I: 10, A: 10, L: 10 };
  const creator = { S: 10, P: 4, E: 4, C: 4, I: 2, A: 2, L: 2 };
  const legacy = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };
  assert.strictEqual(R.checkUpdateTotal(all10, creator).ok, false);
  assert.strictEqual(R.checkUpdateTotal(creator, legacy).ok, true);
  assert.strictEqual(R.checkUpdateTotal(legacy, legacy).ok, true, "legacy 35 may stay");
  assert.strictEqual(R.checkUpdateTotal({ ...legacy, S: 6 }, legacy).ok, false, "but not grow");
  const src = fs.readFileSync(path.join(ROOT, "backend/api/player.js"), "utf8");
  const upd = src.slice(src.indexOf('router.post("/special/update"'), src.indexOf("/unlock-survey-credit"));
  assert.ok(upd.includes("checkUpdateTotal("));
});
