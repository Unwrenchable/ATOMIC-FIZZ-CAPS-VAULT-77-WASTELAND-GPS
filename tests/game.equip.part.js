// Equipment regression tests (registered by tests/game.test.js)
"use strict";
const fs = require("fs");
const path = require("path");
const { test, sandbox, load, json, FE, assert } = require("./game.test.js");

function slotsCtx() { const ctx = sandbox(); ctx.Game = { modules: {} }; load(ctx, "js/game/slots.js"); return ctx.Game.Slots; }

function psWith(state, legacy) {
  const ctx = sandbox();
  ctx.Game = { modules: {} };
  if (state) ctx.localStorage.setItem("afc_unified_player_state_v2", JSON.stringify(state));
  if (legacy) ctx.localStorage.setItem("afc_equipped_items", JSON.stringify(legacy));
  load(ctx, "js/game/slots.js");
  load(ctx, "js/game/player-state.js");
  const PS = ctx.Game.modules.PlayerState;
  if (typeof PS.init === "function") PS.init(); else PS.load();
  return { ctx, PS };
}

const pipe = { id: "pipe", name: "Lead Pipe", type: "weapon", damage: 6 };
const helm = { id: "helm", name: "Riot Helmet", type: "armor", slot: "head", armor: 3 };
const glove = { id: "glove", name: "Left Glove", type: "armor", slot: "arm_l", armor: 1 };
const suit = { id: "suit", name: "Reactor Harness", type: "armor", slot: "chest", covers: ["arms", "legs"], armor: 20 };
const stim = { id: "stim", name: "Stim", type: "consumable", heal: 20 };

test("slots normalize: arm_r/arm_l->arms, leg_*->legs, full->chest+arms+legs, consumables none", () => {
  const S = slotsCtx();
  assert.deepStrictEqual([...S.slotsFor({ type: "armor", slot: "arm_r" })], ["arms"]);
  assert.deepStrictEqual([...S.slotsFor({ type: "armor", slot: "leg_l" })], ["legs"]);
  assert.deepStrictEqual([...S.slotsFor({ type: "armor", slot: "full" })], ["chest", "arms", "legs"]);
  assert.deepStrictEqual([...S.slotsFor(suit)], ["chest", "arms", "legs"]);
  assert.deepStrictEqual([...S.slotsFor(stim)], []);
  assert.strictEqual(S.slotFor({ type: "armor", name: "Cowboy Boots" }), "legs");
});

test("item data: every armor has a canonical slot (no arm_r/leg_l/full, no slot-less armor)", () => {
  const S = slotsCtx();
  const files = ["mintables.json", "items/loot_tables.json", "items/items.json"];
  for (const f of files) {
    (function walk(o) {
      if (Array.isArray(o)) return o.forEach(walk);
      if (!o || typeof o !== "object") return;
      if (o.type === "armor") {
        assert.ok(["head", "chest", "arms", "legs", "accessory"].includes(o.slot), `${f}:${o.id} slot=${o.slot}`);
        assert.ok(S.slotsFor(o).length > 0);
      }
      Object.values(o).forEach(walk);
    })(json("data/" + f));
  }
});

test("equip uses one store; unequip by item clears every covered slot", () => {
  const { PS } = psWith({ inventory: [pipe, helm, glove, suit] });
  assert.ok(PS.equipItem("glove"));
  assert.strictEqual(PS.getEquipped().arms.id, "glove");
  assert.ok(PS.equipItem("suit"));
  const eq = PS.getEquipped();
  assert.strictEqual(eq.chest.id, "suit"); assert.strictEqual(eq.arms.id, "suit"); assert.strictEqual(eq.legs.id, "suit");
  assert.ok(PS.unequipItem({ id: "suit" }));
  const e2 = PS.getEquipped();
  assert.ok(!e2.chest && !e2.arms && !e2.legs);
  // armor with a non-chest slot unequips from its own slot (old bug: always "chest")
  PS.equipItem("helm");
  assert.ok(PS.unequipItem({ id: "helm" }));
  assert.ok(!PS.getEquipped().head);
});

test("consumables are used, not equipped", () => {
  const { PS } = psWith({ inventory: [{ ...stim, quantity: 2 }] });
  PS.equipItem("stim");
  assert.ok(!PS.getEquipped().aid);
});

test("legacy afc_equipped_items migrates without losing owned items; sold items are dropped", () => {
  const { ctx, PS } = psWith({ inventory: [pipe, helm] }, { weapon: pipe, head: helm, chest: suit, arm_r: glove });
  const eq = PS.getEquipped();
  assert.strictEqual(eq.weapon.id, "pipe");
  assert.strictEqual(eq.head.id, "helm");
  assert.ok(!eq.chest, "suit is not owned any more");
  assert.strictEqual(ctx.localStorage.getItem("afc_equipped_items"), null);
});

test("durability is per item and weapon wear hits the weapon slot", () => {
  const { PS } = psWith({ inventory: [pipe, { ...pipe, id: "pipe2", name: "Pipe 2" }] });
  PS.equipItem("pipe");
  PS.decayDurability("weapon", 30);
  assert.strictEqual(PS.getEquipped().weapon.durability, 70);
  PS.equipItem("pipe2");
  assert.strictEqual(PS.getEquipped().weapon.durability, 100, "fresh weapon, not the slot's wear");
  assert.strictEqual(PS.getItem("pipe").durability, 70, "wear stays with the first pipe");
  PS.decayDurability("weapon", 100);
  assert.ok(!PS.getEquipped().weapon, "broken weapon unequips");
  assert.strictEqual(PS.equipItem("pipe2"), false, "broken items cannot be re-equipped");
  const b = fs.readFileSync(path.join(FE, "js/modules/battles.js"), "utf8");
  assert.ok(b.includes('decayDurability("weapon", 1)'));
  assert.ok(!/decayDurability\(res\.weapon\.slot/.test(b));
});

test("selling (removeItem) unequips", () => {
  const { PS } = psWith({ inventory: [pipe] });
  PS.equipItem("pipe");
  PS.removeItem("pipe", 1);
  assert.ok(!PS.getEquipped().weapon);
});

test("STAT shows weapon and armor", () => {
  const { ctx, PS } = psWith({ inventory: [pipe, helm] });
  PS.equipItem("pipe"); PS.equipItem("helm");
  load(ctx, "js/game/vitals.js");
  ctx.Game.Vitals.render(ctx.document);
  const box = ctx.document.getElementById("stat-gear");
  const texts = box.children.map((r) => r.children.map((c) => c.textContent).join(" "));
  assert.ok(texts.some((t) => t.includes("WEAPON") && t.includes("Lead Pipe")), texts.join("|"));
  assert.ok(texts.some((t) => t.includes("HEAD") && t.includes("Riot Helmet")));
});

test("inventory UI: consumables get no EQUIP button; armor unequips by item", () => {
  const ui = fs.readFileSync(path.join(FE, "js/modules/inventory-ui.js"), "utf8");
  assert.ok(!/item\.slot \|\| "chest"\);\s*\n\s*if \(Game\.modules\?\.PlayerState\?\.unequipItem\)/.test(ui));
  assert.ok(ui.includes("PlayerState.unequipItem(item)"));
  assert.ok(!/canEquip = \([^;]*consumable/.test(ui));
});
