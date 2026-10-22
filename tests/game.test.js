// tests/game.test.js
// Gameplay regression tests (portraits, stats, equip, battle). Node built-ins only.
// Browser modules are loaded into a vm sandbox with a minimal window/document stub.
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const FE = path.join(ROOT, "frontend");
let passed = 0;
let failed = 0;
const pending = [];

function test(name, fn) {
  pending.push(async () => {
    try {
      await fn();
      console.log(`  ok  ${name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL ${name}\n       ${err && err.stack ? err.stack.split("\n").slice(0, 3).join("\n       ") : err}`);
      failed++;
    }
  });
}

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] || null,
    get length() { return m.size; },
    _map: m,
  };
}

function makeEl(id) {
  const el = {
    id, style: {}, dataset: {}, children: [], classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    textContent: "", innerHTML: "", value: "", disabled: false,
    appendChild(c) { this.children.push(c); return c; }, prepend(c) { this.children.unshift(c); return c; },
    removeChild() {}, replaceChildren(...c) { this.children = c; }, setAttribute(k, v) { this[k] = v; }, getAttribute(k) { return this[k]; },
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    append(...c) { this.children.push(...c); }, remove() {}, closest() { return null; }, focus() {}, click() {},
  };
  return el;
}

function sandbox(extra = {}) {
  const els = new Map();
  const document = {
    readyState: "complete",
    getElementById: (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
    querySelector: () => null, querySelectorAll: () => [],
    createElement: (t) => makeEl(t), createElementNS: (_ns, t) => makeEl(t), createTextNode: (t) => ({ textContent: t }),
    addEventListener() {}, removeEventListener() {}, body: makeEl("body"), head: makeEl("head"),
    dispatchEvent() { return true; },
  };
  const listeners = {};
  const win = {
    document, localStorage: makeStorage(), sessionStorage: makeStorage(), console,
    setTimeout: (f) => { return 0; }, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener() {},
    dispatchEvent(ev) { (listeners[ev.type] || []).forEach((f) => f(ev)); return true; },
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    crypto: require("crypto").webcrypto, location: { hostname: "localhost", href: "http://localhost/", origin: "http://localhost" },
    navigator: { userAgent: "node" }, fetch: async () => ({ ok: false, json: async () => ({}) }),
    btoa: (s) => Buffer.from(s, "binary").toString("base64"), atob: (s) => Buffer.from(s, "base64").toString("binary"),
    alert() {}, confirm: () => true, prompt: () => null, requestAnimationFrame: () => 0,
    Uint32Array, Math, JSON, Date, Promise, Object, Array, String, Number, Boolean, Map, Set, Error, encodeURIComponent, decodeURIComponent, escape, unescape,
    _els: els, _listeners: listeners,
    ...extra,
  };
  win.window = win; win.self = win; win.globalThis = win;
  return vm.createContext(win);
}

function load(ctx, rel) {
  const code = fs.readFileSync(path.join(FE, rel), "utf8");
  vm.runInContext(code, ctx, { filename: rel });
  return ctx;
}

function json(rel) {
  return JSON.parse(fs.readFileSync(path.join(FE, rel), "utf8"));
}

function paintedMap() {
  const src = fs.readFileSync(path.join(FE, "js/modules/quests.js"), "utf8");
  const block = src.slice(src.indexOf("PAINTED_NPC: {"), src.indexOf("},", src.indexOf("PAINTED_NPC: {")) + 1);
  const map = {};
  for (const m of block.matchAll(/([a-z0-9_]+):\s*'(painted\/[^']+)'/g)) map[m[1]] = m[2];
  return map;
}

module.exports = { test, sandbox, load, json, paintedMap, FE, ROOT, assert };

// ---------------------------------------------------------------- portraits
test("dialogue portrait uses painted head first (partsFor), then legacy presets", () => {
  const PAINTED = paintedMap();
  const ctx = sandbox();
  ctx.Game = { modules: {}, Avatar: { partsFor: (id, fb) => (PAINTED[String(id).toLowerCase()] ? { head: PAINTED[String(id).toLowerCase()] } : fb) } };
  load(ctx, "js/modules/narrative.js");
  const n = ctx.Game.modules.narrative;
  assert.deepStrictEqual(n._resolvePortraitParts({ portrait: "arnie" }, "dialog_arnie"), { head: "painted/npc_arnie.svg" });
  // portrait "default" falls through to the dialog id
  assert.deepStrictEqual(n._resolvePortraitParts({ portrait: "default" }, "dialog_doc"), { head: "painted/npc_doc.svg" });
  // no painted head: legacy vector preset
  assert.strictEqual(n._resolvePortraitParts({ portrait: "bless" }, "dialog_bless").head, "head_round.svg");
  assert.strictEqual(n._resolvePortraitParts({}, "dialog_nobody").head, "head_base.svg");
});

test("every painted NPC's dialogue resolves to its painted head", () => {
  const PAINTED = paintedMap();
  const ctx = sandbox();
  ctx.Game = { modules: {}, Avatar: { partsFor: (id, fb) => (PAINTED[String(id).toLowerCase()] ? { head: PAINTED[String(id).toLowerCase()] } : fb) } };
  load(ctx, "js/modules/narrative.js");
  const n = ctx.Game.modules.narrative;
  const dir = path.join(FE, "data/narrative");
  for (const f of fs.readdirSync(dir).filter((x) => /^dialog_.*\.json$/.test(x))) {
    const id = f.slice(7, -5);
    if (!PAINTED[id]) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    assert.ok(d.portrait && d.portrait !== "default", `${f} needs a portrait field`);
    const parts = n._resolvePortraitParts(d, "dialog_" + id);
    assert.ok(String(parts.head).startsWith("painted/"), `${id} -> ${parts.head}`);
    assert.ok(fs.existsSync(path.join(FE, "assets/avatars", parts.head)), `missing ${parts.head}`);
  }
});

test("sw.js CACHE_VERSION is not the stale April value", () => {
  const sw = fs.readFileSync(path.join(FE, "sw.js"), "utf8");
  const v = /CACHE_VERSION = '([^']+)'/.exec(sw)[1];
  assert.ok(!["v1.1.0-20260403", "v1.2.0-20261022a", "v1.2.1-20261022b"].includes(v), "bump CACHE_VERSION when assets/data change");
});

if (require.main === module) {
  // Optional per-area suites register more tests on load.
  for (const f of fs.readdirSync(__dirname).filter((x) => /^game\..+\.part\.js$/.test(x)).sort()) require(path.join(__dirname, f));
  (async () => {
    for (const run of pending) await run();
    console.log(`\nGame tests: ${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  })();
}
