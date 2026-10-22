// B.L.A.S.T.E.D. / stats regression tests (registered by tests/game.test.js)
"use strict";
const fs = require("fs");
const path = require("path");
const { test, sandbox, load, FE, assert } = require("./game.test.js");
const src = (rel) => fs.readFileSync(path.join(FE, rel), "utf8");

function withVitals(initial) {
  const ctx = sandbox();
  const special = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5, ...(initial || {}) };
  const calls = { set: [], update: [] };
  ctx.Game = {
    modules: { PlayerState: {
      getBaseSpecial: () => ({ ...special }),
      setSpecial: (k, v) => { calls.set.push([k, v]); special[k] = v; },
    } },
    ApiClient: { updateSpecial: async (w, sp) => { calls.update.push([w, sp]); return { ok: true }; } },
  };
  load(ctx, "js/game/vitals.js");
  return { ctx, V: ctx.Game.Vitals, special, calls };
}

test("B.L.A.S.T.E.D. labels map onto the internal S/P/E/C/I/A/L keys", () => {
  const { V } = withVitals();
  assert.strictEqual(V.STATS.map((s) => s.letter).join(""), "BLASTED");
  assert.strictEqual(V.KEYS.join(""), "SPECIAL");
  V.STATS.forEach((s) => assert.ok(s.line && s.name));
});

test("creator stats land in PlayerState and are pushed to the backend", async () => {
  const { ctx, V, special, calls } = withVitals();
  ctx.currentWallet = "W1";
  const sp = { S: 10, P: 4, E: 4, C: 4, I: 2, A: 2, L: 2 };
  await V.apply(sp);
  assert.deepStrictEqual({ ...special }, sp);
  assert.strictEqual(calls.update.length, 1);
  assert.strictEqual(calls.update[0][0], "W1");
});

test("characterCreated event applies stats (no separate stores)", async () => {
  const { ctx, special } = withVitals();
  ctx.dispatchEvent(new ctx.CustomEvent("characterCreated", { detail: { special: { S: 9, P: 1, E: 1, C: 1, I: 1, A: 1, L: 1 } } }));
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(special.S, 9);
});

test("render fills a child bar, not the track, and shows letters + one-liners", () => {
  const { ctx, V } = withVitals({ S: 7 });
  const d = ctx.document;
  const bar = { children: [], style: {}, querySelector() { return this.children[0] || null; }, appendChild(c) { this.children.push(c); } };
  const label = { textContent: "S" };
  const row = { classList: {}, querySelector: () => label };
  const val = d.getElementById("special-S"); val.parentNode = row;
  d.querySelector = (sel) => (sel.includes('"S"') ? bar : null);
  V.render(d);
  assert.strictEqual(val.textContent, 7);
  assert.strictEqual(bar.style.width, undefined, "track width must not be set");
  assert.strictEqual(bar.children[0].style.width, "70%");
  assert.strictEqual(label.textContent, "B");
  assert.ok(d.getElementById("special-line-S").textContent.includes("Brawn"));
});

test("profile from backend: real stats adopted; default profile gets local stats pushed", async () => {
  const a = withVitals();
  await a.V.adoptProfile({ special: { S: 8, P: 3, E: 3, C: 3, I: 3, A: 3, L: 5 } });
  assert.strictEqual(a.special.S, 8);
  assert.strictEqual(a.calls.update.length, 0);
  const b = withVitals({ S: 9, P: 1 });
  b.ctx.currentWallet = "W2";
  await b.V.adoptProfile({ special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 } });
  assert.strictEqual(b.special.S, 9);
  assert.strictEqual(b.calls.update.length, 1);
});

test("save migration v2 pulls creator stats from the old appearance blob once", () => {
  const { ctx, V } = withVitals();
  const store = ctx.localStorage;
  const app = { special: { S: 6, P: 6, E: 4, C: 4, I: 4, A: 2, L: 2 } };
  store.setItem("playerAppearance_encoded", Buffer.from(JSON.stringify(app)).toString("base64"));
  const st = V.migrateState({ special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 } }, store);
  assert.strictEqual(st.vitalsVersion, 2);
  assert.strictEqual(st.special.S, 6);
  // non-default saves are never overwritten, and v2 saves are left alone
  const keep = V.migrateState({ special: { S: 3, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 } }, store);
  assert.strictEqual(keep.special.S, 3);
  const done = V.migrateState({ vitalsVersion: 2, special: { S: 5 } }, store);
  assert.strictEqual(done.special.S, 5);
});

test("respec sends auth, create sends stats, creator has no unspent alert, main.js no track width", () => {
  const ps = src("js/pipboy-special.js");
  const respec = ps.slice(ps.indexOf("async function apiRespec"), ps.indexOf("function renderSpecial"));
  assert.ok(/Authorization/.test(respec));
  assert.ok(/special: currentSpecial\(\)/.test(ps));
  const cc = src("js/modules/character-creator.js");
  assert.ok(!/alert\(`You have/.test(cc));
  assert.ok(cc.includes("ccUnspentWarn"));
  assert.ok(!/barEl\.style\.width/.test(src("js/main.js")));
  assert.ok(src("index.html").includes('src="/js/game/vitals.js"'));
  const st = src("js/game/player-state.js");
  const setSp = st.slice(st.indexOf("setSpecial: function"), st.indexOf("getPerks,"));
  assert.ok(setSp.includes("triggerStatsUpdate()"), "setSpecial must refresh STAT immediately");
});
