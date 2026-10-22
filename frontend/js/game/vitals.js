// frontend/js/game/vitals.js
// B.L.A.S.T.E.D. — the single display/sync layer for the seven player stats.
// Internal keys stay S/P/E/C/I/A/L (saves, backend, battle math); only the labels changed.
// PlayerState is the one source of truth; this module renders STAT and syncs to the backend.
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.Game = root.Game || {};

  const STATS = [
    { key: "S", letter: "B", name: "Brawn",     line: "Hit harder, haul more junk." },
    { key: "P", letter: "L", name: "Lookout",   line: "Aim true, spot loot and ambushes first." },
    { key: "E", letter: "A", name: "Absorb",    line: "Soak hits and rads." },
    { key: "C", letter: "S", name: "Swagger",   line: "Cheaper deals, loyal companions, smooth talk." },
    { key: "I", letter: "T", name: "Tinker",    line: "Craft, hack, learn faster." },
    { key: "A", letter: "E", name: "Escape",    line: "Move fast, sneak quiet, bail out of fights." },
    { key: "L", letter: "D", name: "Dumb Luck", line: "Crits, jackpots, weird stuff." },
  ];
  const KEYS = STATS.map((s) => s.key);
  const SAVE_VERSION = 2;

  function clamp(v) {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : 5;
  }

  function normalize(sp) {
    const out = {};
    KEYS.forEach((k) => { out[k] = clamp(sp && sp[k] != null ? sp[k] : 5); });
    return out;
  }

  function isDefault(sp) {
    return !sp || KEYS.every((k) => (sp[k] == null ? 5 : sp[k]) === 5);
  }

  function ps() { const G = root.Game || {}; return (G.modules && G.modules.PlayerState) || G.PlayerState; }

  function get() {
    const P = ps();
    if (P && typeof P.getBaseSpecial === "function") return normalize(P.getBaseSpecial());
    if (P && typeof P.getSpecial === "function") return normalize(P.getSpecial());
    return normalize(null);
  }

  // Save migration: old saves kept stats only in the creator's encoded appearance.
  // Pull them into the PlayerState blob once; never overwrite non-default saved stats.
  function migrateState(state, storage) {
    if (!state || typeof state !== "object") return state;
    if ((state.vitalsVersion || 1) >= SAVE_VERSION) return state;
    state.special = normalize(state.special);
    if (isDefault(state.special) && storage) {
      try {
        const enc = storage.getItem("playerAppearance_encoded");
        if (enc) {
          const app = JSON.parse(decodeURIComponent(escape(root.atob(enc))));
          if (app && app.special && !isDefault(app.special)) state.special = normalize(app.special);
        }
      } catch (_) { /* corrupt appearance blob: keep defaults */ }
    }
    state.vitalsVersion = SAVE_VERSION;
    return state;
  }

  function wallet() {
    return root.currentWallet || (root.Game.player && root.Game.player.wallet) || null;
  }

  // Creator confirm / backend profile -> PlayerState (+ backend when we have a wallet).
  async function apply(special, opts = {}) {
    const sp = normalize(special);
    const P = ps();
    if (P && typeof P.setSpecial === "function") KEYS.forEach((k) => P.setSpecial(k, sp[k]));
    render();
    const w = wallet();
    const api = root.Game.ApiClient || root.ApiClient;
    if (opts.push !== false && w && api && typeof api.updateSpecial === "function") {
      try { await api.updateSpecial(w, sp); } catch (_) { /* offline: local stays authoritative */ }
    }
    return sp;
  }

  // Backend profile arrives: adopt it unless it is untouched defaults and we have real local stats,
  // in which case push local up (profiles created before stats were sent).
  function adoptProfile(profile) {
    if (!profile) return;
    const local = get();
    if (profile.special && !isDefault(profile.special)) return apply(profile.special, { push: false });
    if (!isDefault(local)) return apply(local, { push: true });
    render();
  }

  function render(doc) {
    const d = doc || root.document;
    if (!d) return;
    const sp = get();
    STATS.forEach((s) => {
      const v = sp[s.key];
      const valEl = d.getElementById(`special-${s.key}`);
      if (valEl) valEl.textContent = v;
      const row = valEl && valEl.parentNode && valEl.parentNode.classList ? valEl.parentNode : null;
      const label = row && row.querySelector ? row.querySelector(".special-label") : null;
      if (label) { label.textContent = s.letter; label.title = `${s.name}: ${s.line}`; }
      const lineEl = d.getElementById(`special-line-${s.key}`);
      if (lineEl) lineEl.textContent = `${s.name} — ${s.line}`;
      const bar = d.querySelector(`.special-bar[data-special-key="${s.key}"]`);
      if (bar) {
        let fill = bar.querySelector ? bar.querySelector(".special-fill") : null;
        if (!fill) {
          fill = d.createElement("div");
          fill.className = "special-fill";
          bar.appendChild(fill);
        }
        fill.style.width = `${v * 10}%`;
      }
    });
    renderGear(d);
    renderPortrait(d);
  }

  // STAT: equipped weapon + armor, with per-item durability
  function renderGear(d) {
    const box = d.getElementById("stat-gear");
    const P = ps();
    if (!box || !P || typeof P.getEquipped !== "function") return;
    const eq = P.getEquipped() || {};
    const rows = [["WEAPON", "weapon"], ["HEAD", "head"], ["CHEST", "chest"], ["ARMS", "arms"], ["LEGS", "legs"], ["ACCESSORY", "accessory"]];
    box.textContent = "";
    rows.forEach(([label, slot]) => {
      const it = eq[slot];
      const row = d.createElement("div");
      row.className = "panel-row";
      const l = d.createElement("span"); l.className = "label"; l.textContent = label;
      const v = d.createElement("span"); v.className = "value"; v.id = `stat-gear-${slot}`;
      if (it) {
        const extra = slot === "weapon" ? (it.damage != null ? ` DMG ${it.damage}` : "") : (it.armor != null ? ` DR ${it.armor}` : "");
        const dur = typeof it.durability === "number" ? ` (${it.durability}%)` : "";
        v.textContent = `${it.name || it.id}${extra}${dur}`;
      } else v.textContent = slot === "weapon" ? "FISTS" : "—";
      row.appendChild(l); row.appendChild(v); box.appendChild(row);
    });
  }

  let _portraitKey = null;
  async function renderPortrait(d) {
    const box = d.getElementById("character-appearance-preview");
    const A = root.Game.Avatar;
    if (!box || !A || typeof A.compose !== "function") return;
    let app = null;
    try {
      const cc = root.Game.modules && root.Game.modules.CharacterCreator;
      app = cc && (cc.loadSavedAppearance ? cc.loadSavedAppearance() : null);
    } catch (_) {}
    const parts = (typeof A.playerPartsFor === "function" && A.playerPartsFor(app)) || undefined;
    const key = JSON.stringify(parts || "default");
    if (_portraitKey === key && box.querySelector && box.querySelector("img")) return;
    _portraitKey = key;
    try {
      const url = await A.compose(parts);
      const img = d.createElement("img");
      img.className = "character-portrait-img";
      img.alt = (app && app.name) || "Wanderer";
      img.src = url;
      box.textContent = "";
      box.appendChild(img);
    } catch (_) { _portraitKey = null; }
  }

  const api = { STATS, KEYS, SAVE_VERSION, normalize, isDefault, get, apply, adoptProfile, migrateState, render, renderPortrait };
  root.Game.Vitals = api;

  if (root.addEventListener) {
    root.addEventListener("characterCreated", (e) => {
      const sp = e && e.detail && e.detail.special;
      if (sp) apply(sp); else render();
    });
    root.addEventListener("statsUpdated", () => render());
    root.addEventListener("inventoryUpdated", () => render());
    root.addEventListener("gameInitialized", () => render());
  }
  if (root.document && root.document.addEventListener) {
    // STAT tab: render immediately on open (no polling lag).
    root.document.addEventListener("click", (e) => {
      const t = e && e.target && e.target.closest ? e.target.closest('[data-pipboy-tab="panel-stat"]') : null;
      if (t) render();
    });
  }
})();
