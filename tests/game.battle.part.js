// Battle regression tests (registered by tests/game.test.js)
"use strict";
const path = require("path");
const { test, sandbox, load, ROOT, assert } = require("./game.test.js");

function battle(special, opts = {}) {
  const ctx = sandbox();
  const sp = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5, ...(special || {}) };
  const added = { xp: 0, caps: 0, items: [] };
  ctx.Game = { modules: { PlayerState: {
    getSpecial: () => sp, getPerks: () => [], getState: () => ({ equipped: opts.equipped || {} }),
    awardXP: (x) => { added.xp += x; }, awardCaps: (c) => { added.caps += c; }, addItem: (i) => added.items.push(i.id),
    decayDurability() {},
  } } };
  if (opts.fetch) ctx.fetch = opts.fetch;
  if (opts.session) ctx.localStorage.setItem("sessionId", "s1");
  load(ctx, "js/modules/battles.js");
  const B = ctx.Game.modules.battle;
  B.init({ player: { hp: 100, maxHp: 100, equipped: opts.equipped || {} } });
  B._getCurrentWeather = () => "clear";
  return { ctx, B, added };
}
const enc = (n = 2, hp = 10) => ({ id: "e1", enemies: Array.from({ length: n }, (_, i) => ({ id: "rat" + i, name: "Rat " + i, hp, damage: 4 })), rewards: { xp: 20, caps: 10 } });
const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };

test("accuracy is stat-based: Lookout raises hit chance, evasion lowers it, clamped", () => {
  const lo = battle({ P: 1 }).B, hi = battle({ P: 10 }).B;
  const a = lo._playerHitChance({ category: "rifle" }, {}, "clear");
  const b = hi._playerHitChance({ category: "rifle" }, {}, "clear");
  assert.ok(b > a);
  assert.ok(hi._playerHitChance({ category: "rifle" }, { evasion: 0.3 }, "clear") < b);
  assert.ok(lo._playerHitChance({ category: "rifle" }, { evasion: 5 }, "rain") >= 0.10);
  assert.ok(battle({ A: 10 }).B._enemyHitChance({}) < battle({ A: 1 }).B._enemyHitChance({}));
});

test("a miss deals no damage (no more flat 100% hit)", () => {
  const { B } = battle();
  B.start(enc(1));
  B._rand = () => 0.999;
  const r = B.playerAttack();
  assert.strictEqual(r.hit, false);
  assert.strictEqual(B.state.enemyHp[0], 10);
});

test("every live enemy attacks; dead ones do not", async () => {
  const { B } = battle();
  B.start(enc(3));
  B.state.enemyHp[1] = 0;
  B._rand = () => 0; // all hit
  const r = await B.enemyAttack();
  assert.deepStrictEqual(Array.from(r.hits, (h) => h.idx).join(","), "0,2");
  assert.strictEqual(B.gs.player.hp, 100 - r.damage);
});

test("targeting picks the enemy that takes the hit; dead targets are refused", () => {
  const { B } = battle();
  B.start(enc(3));
  assert.ok(B.setTarget(2));
  B._rand = seq(0.99, 0); // crit roll (no), hit roll (yes)
  B.playerAttack();
  assert.strictEqual(B.state.enemyHp[0], 10);
  assert.ok(B.state.enemyHp[2] < 10);
  B.state.enemyHp[1] = 0;
  assert.strictEqual(B.setTarget(1), false);
});

test("unarmed attack works even with a ranged weapon out of ammo", () => {
  const { B } = battle({ S: 9 }, { equipped: { weapon: { id: "gun", name: "Gun", ammoType: "10mm", damage: 12 } } });
  B.start(enc(1, 50));
  B._rand = seq(0.99, 0); // crit roll, then hit roll
  assert.strictEqual(B.playerAttack().reason, "NO_AMMO");
  const r = B.playerAttack({ unarmed: true });
  assert.ok(r.unarmed && r.hit);
  assert.strictEqual(r.damage, 7); // 5 + floor((9-5)/2)
});

test("failed flee is one action: a second click during the enemy turn is ignored", async () => {
  const { B } = battle();
  B.start(enc(1));
  B._rand = () => 0.99; // flee fails, enemy misses
  const p1 = B.takeTurn("flee");
  const p2 = await B.takeTurn("flee");
  assert.ok(p2.ignored);
  const r1 = await p1;
  assert.strictEqual(r1.escaped, false);
  assert.strictEqual(r1.enemy.hits.length, 1);
});

test("battle state persists across reloads and clears when the fight ends", async () => {
  const { ctx, B } = battle();
  B.start(enc(2));
  B.state.enemyHp[0] = 3;
  B._persist();
  const raw = ctx.localStorage.getItem("afc_battle_state_v1");
  assert.ok(raw);
  B.state = null;
  assert.ok(B._restore());
  assert.strictEqual(B.state.enemyHp[0], 3);
  B._rand = () => 0;
  await B.takeTurn("flee");
  assert.strictEqual(ctx.localStorage.getItem("afc_battle_state_v1"), null);
});

test("signed-in WIN applies only server-approved rewards", async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(url);
    const body = url.endsWith("/start") ? { ok: true, battleId: "a".repeat(24) } : { ok: true, rewards: { xp: 5, caps: 2, items: [] } };
    return { ok: true, status: 200, json: async () => body };
  };
  const { B, added } = battle({}, { fetch, session: true });
  B.start(enc(1, 1));
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(B.state.battleId, "a".repeat(24));
  B._rand = seq(0.99, 0, 0.99);
  const out = await B.takeTurn("attack");
  assert.strictEqual(out.end, "WIN");
  assert.deepStrictEqual({ xp: added.xp, caps: added.caps }, { xp: 5, caps: 2 });
  assert.ok(calls.some((u) => u.endsWith("/api/encounter/battle/resolve")));
});

test("server rules: caps from enemy HP, clamp requests, reject replays / too-fast / wrong wallet", () => {
  const R = require(path.join(ROOT, "backend/encounters/battle-rewards.js"));
  const enemies = R.sanitizeEnemies([{ id: "x", hp: 99999 }, { id: "y", hp: 40 }]);
  assert.strictEqual(enemies[0].hp, R.LIMITS.MAX_ENEMY_HP);
  const cap = R.rewardCap(R.sanitizeEnemies([{ id: "a", hp: 40 }]));
  const ok = R.approveRewards({ xp: 1e9, caps: 1e9, items: ["stimpak", "<script>", "a", "b", "c"] }, cap);
  assert.ok(ok.xp <= cap.xp && ok.caps <= cap.caps && ok.items.length <= 3 && !ok.items.includes("<script>"));
  const battle = { wallet: "W", cap, startedAt: 0, resolved: false };
  assert.ok(R.checkResolve(battle, { wallet: "W", result: "WIN", turns: 2, now: 5000 }).ok);
  assert.ok(!R.checkResolve(battle, { wallet: "X", result: "WIN", turns: 2, now: 5000 }).ok);
  assert.ok(!R.checkResolve(battle, { wallet: "W", result: "WIN", turns: 2, now: 10 }).ok, "too fast");
  assert.ok(!R.checkResolve({ ...battle, resolved: true }, { wallet: "W", result: "WIN", turns: 2, now: 5000 }).ok);
  assert.ok(!R.checkResolve(battle, { wallet: "W", result: "WIN", turns: 0, now: 5000 }).ok, "too few turns");
});
