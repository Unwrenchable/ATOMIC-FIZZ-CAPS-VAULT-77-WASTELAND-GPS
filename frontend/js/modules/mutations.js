// public/js/modules/mutations.js
// ------------------------------------------------------------
// Atomic Fizz Caps — Mutation System Frontend Module
// Mutations are permanent stat changes from radiation or serum.
// Each has a benefit AND drawback. Max 5 active at once.
// Exposes: Game.modules.mutations
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!window.Game.modules) window.Game.modules = {};

  const API_BASE  = window.API_BASE || "https://api.atomicfizzcaps.xyz";
  const LS_MUT    = "afc_mutations_active";   // [mutationId, ...]
  const LS_CAT    = "afc_mutations_catalog";  // cached definitions

  const RARITY_COLORS = {
    common: "#aaaaaa", uncommon: "#00ff41",
    rare: "#4488ff", epic: "#cc44ff", legendary: "#ffd700"
  };

  // ----------------------------------------------------------
  // XSS-safe escaper
  // ----------------------------------------------------------
  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

  function sessionId() { return localStorage.getItem("sessionId") || ""; }

  async function apiGet(path) {
    const r = await fetch(`${API_BASE}${path}`, {
      headers: { "Authorization": `Bearer ${sessionId()}` }
    });
    return r.json();
  }
  async function apiPost(path, body) {
    const r = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sessionId()}` },
      body: JSON.stringify(body)
    });
    return r.json();
  }

  // ----------------------------------------------------------
  // Local cache helpers
  // ----------------------------------------------------------
  function getActive() {
    try { return JSON.parse(localStorage.getItem(LS_MUT) || "[]"); }
    catch { return []; }
  }
  function setActive(ids) { localStorage.setItem(LS_MUT, JSON.stringify(ids)); }

  function getCatalog() {
    try { return JSON.parse(localStorage.getItem(LS_CAT) || "null"); }
    catch { return null; }
  }
  function setCatalog(d) { localStorage.setItem(LS_CAT, JSON.stringify(d)); }

  // ----------------------------------------------------------
  // Toast
  // ----------------------------------------------------------
  function toast(msg, type) {
    const colors = { info: "#00ff41", warn: "#ffaa00", error: "#ff4444", rare: "#4488ff", epic: "#cc44ff" };
    const c = colors[type] || colors.info;
    const t = document.createElement("div");
    t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,10,5,0.97);border:1px solid ${c};color:${c};font-family:monospace;padding:10px 20px;z-index:10000;font-size:12px;pointer-events:none;max-width:380px;text-align:center;animation:mutFade 3.5s forwards;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3500);
  }

  // ----------------------------------------------------------
  // Load catalog from server or cache
  // ----------------------------------------------------------
  async function loadCatalog() {
    const cached = getCatalog();
    if (cached && cached._ts && Date.now() - cached._ts < 3600000) return cached;
    try {
      const data = await apiGet("/api/mutations/all");
      if (data.ok) {
        const catalog = { mutations: data.mutations, serums: data.serums, rules: data.rules, _ts: Date.now() };
        setCatalog(catalog);
        return catalog;
      }
    } catch { /* offline */ }
    return cached || { mutations: [], serums: [], rules: {} };
  }

  // ----------------------------------------------------------
  // Sync active mutations from server
  // ----------------------------------------------------------
  async function syncMutations() {
    if (!sessionId()) return;
    try {
      const data = await apiGet("/api/mutations/mine");
      if (data.ok) setActive(data.mutations.map(m => m.id));
    } catch { /* offline */ }
  }

  // ----------------------------------------------------------
  // Apply a serum from inventory
  // ----------------------------------------------------------
  async function applySerum(serumId) {
    if (!sessionId()) { toast("Sign in to use serums.", "warn"); return; }
    try {
      const data = await apiPost("/api/mutations/apply-serum", { serumId });
      if (data.ok) {
        if (data.action === "applied") {
          setActive([...getActive(), data.mutation.id]);
          toast(`MUTATION: ${data.mutation.name} applied. ${data.mutation.benefit}`, "rare");
          // Show drawback separately after 1s
          setTimeout(() => toast(`DRAWBACK: ${data.mutation.drawback}`, "warn"), 1200);
        } else if (data.action === "suppressed") {
          const active = getActive().filter(id => id !== data.removed);
          setActive(active);
          toast(`Mutation suppressed: ${data.removed}`, "info");
        }
        return data;
      } else {
        toast(data.error || "Serum failed.", "warn");
      }
    } catch { toast("Connection lost.", "error"); }
    return null;
  }

  // ----------------------------------------------------------
  // Notify server of current rad level (may trigger random mutation)
  // ----------------------------------------------------------
  async function checkRads(rads) {
    if (!sessionId()) return;
    try {
      const data = await apiPost("/api/mutations/rad-check", { rads });
      if (data.ok && data.mutationTriggered) {
        const active = getActive();
        if (!active.includes(data.mutation.id)) {
          setActive([...active, data.mutation.id]);
        }
        toast(`☢ RADIATION MUTATION: ${data.mutation.name}! ${data.mutation.benefit}`, "epic");
        setTimeout(() => toast(`DRAWBACK: ${data.mutation.drawback}`, "warn"), 1500);
      }
      return data;
    } catch { /* silent */ }
    return null;
  }

  // ----------------------------------------------------------
  // Get current active mutation effects (for game system use)
  // ----------------------------------------------------------
  function getActiveMutationEffects(catalog) {
    const active = getActive();
    if (!catalog?.mutations) return {};
    const merged = {};
    for (const id of active) {
      const def = catalog.mutations.find(m => m.id === id);
      if (!def?.effects) continue;
      for (const [k, v] of Object.entries(def.effects)) {
        if (typeof v === "number") merged[k] = (merged[k] || 0) + v;
        else if (typeof v === "boolean") merged[k] = merged[k] || v;
      }
    }
    return merged;
  }

  // ----------------------------------------------------------
  // Render mutation panel into container
  // ----------------------------------------------------------
  async function renderPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div style="font-family:monospace;color:#00ff41;padding:8px;font-size:11px;">// SCANNING GENETIC MARKERS...</div>';

    const [catalog] = await Promise.all([loadCatalog(), syncMutations()]);
    const active = getActive();

    let html = '<div class="mut-panel">';
    html += '<div class="mut-header">// MUTATION REGISTRY //</div>';
    html += `<div class="mut-subtitle">Active: ${escapeHtml(active.length)}/5 — Radiation or serums apply mutations. Each has benefits and drawbacks.</div>`;

    // Active mutations
    if (active.length > 0) {
      html += '<div class="mut-section-label">ACTIVE MUTATIONS</div>';
      for (const id of active) {
        const def = catalog.mutations.find(m => m.id === id);
        if (!def) continue;
        const color = RARITY_COLORS[def.rarity] || "#00ff41";
        html += `<div class="mut-card mut-active" style="border-color:${color};">`;
        html += `<div class="mut-card-header"><span style="color:${color};">${escapeHtml(def.icon || "🧬")}</span> <b>${escapeHtml(def.name)}</b> <span style="font-size:9px;color:${color};">${escapeHtml(def.rarity.toUpperCase())}</span></div>`;
        html += `<div class="mut-benefit">▲ ${escapeHtml(def.benefit)}</div>`;
        html += `<div class="mut-drawback">▼ ${escapeHtml(def.drawback)}</div>`;
        html += '</div>';
      }
    } else {
      html += '<div class="mut-empty">No active mutations. Apply a serum or absorb enough radiation.</div>';
    }

    // Serum inventory section
    html += '<div class="mut-section-label" style="margin-top:12px;">SERUMS IN INVENTORY</div>';
    const inv = (window.Game?.state?.inventory || []);
    const inventorySerums = inv.filter(i => i.type === "serum");
    if (inventorySerums.length > 0) {
      for (const serum of inventorySerums) {
        html += `<div class="mut-serum-row">`;
        html += `<span class="mut-serum-name">${escapeHtml(serum.name || serum.id)}</span>`;
        html += `<button class="mut-btn mut-btn-use" data-id="${escapeHtml(serum.id)}">USE</button>`;
        html += `</div>`;
      }
    } else {
      html += '<div class="mut-empty">No serums in inventory. Find them in nuke zones, quests, or trade with other players.</div>';
    }

    // Full catalogue (collapsed)
    html += '<div class="mut-section-label" style="margin-top:12px;">KNOWN MUTATIONS (Reference)</div>';
    for (const def of catalog.mutations || []) {
      const color = RARITY_COLORS[def.rarity] || "#aaaaaa";
      const isActive = active.includes(def.id);
      html += `<div class="mut-card mut-catalog" style="border-color:${color};opacity:${isActive ? 1 : 0.5};">`;
      html += `<div class="mut-card-header"><span>${escapeHtml(def.icon || "🧬")}</span> <b>${escapeHtml(def.name)}</b>${isActive ? ' <span style="color:#00ff41;">✓ ACTIVE</span>' : ''}</div>`;
      html += `<div class="mut-desc">${escapeHtml(def.description)}</div>`;
      html += `<div class="mut-benefit">▲ ${escapeHtml(def.benefit)}</div>`;
      html += `<div class="mut-drawback">▼ ${escapeHtml(def.drawback)}</div>`;
      if (def.conflicts?.length) {
        html += `<div class="mut-conflict">⚠ Conflicts with: ${escapeHtml(def.conflicts.join(", "))}</div>`;
      }
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // Wire up serum use buttons
    container.querySelectorAll(".mut-btn-use").forEach(btn => {
      btn.onclick = () => applySerum(btn.dataset.id).then(() => renderPanel(containerId));
    });
  }

  // ----------------------------------------------------------
  // Inject CSS
  // ----------------------------------------------------------
  function injectCSS() {
    if (document.getElementById("mut-styles")) return;
    const s = document.createElement("style");
    s.id = "mut-styles";
    s.textContent = `
      .mut-panel{padding:12px;font-family:monospace;}
      .mut-header{font-size:12px;color:#88ff88;letter-spacing:1px;margin-bottom:2px;}
      .mut-subtitle{font-size:10px;color:#445544;margin-bottom:10px;}
      .mut-section-label{font-size:10px;color:#556655;letter-spacing:1px;margin-bottom:6px;border-bottom:1px solid #222;padding-bottom:2px;}
      .mut-card{border:1px solid #00ff41;padding:8px;margin-bottom:6px;}
      .mut-card-header{display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;}
      .mut-desc{font-size:10px;color:#667766;margin-bottom:4px;line-height:1.4;}
      .mut-benefit{font-size:10px;color:#88cc88;margin-bottom:2px;}
      .mut-drawback{font-size:10px;color:#cc6644;margin-bottom:2px;}
      .mut-conflict{font-size:9px;color:#886644;margin-top:2px;}
      .mut-empty{font-size:10px;color:#445544;font-style:italic;padding:8px 0;}
      .mut-serum-row{display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #111;}
      .mut-serum-name{font-size:11px;}
      .mut-btn{background:#001a00;border:1px solid #00ff41;color:#00ff41;padding:4px 10px;font-family:monospace;font-size:10px;cursor:pointer;text-transform:uppercase;}
      .mut-btn:hover{background:#003300;}
      @keyframes mutFade{0%{opacity:0}10%{opacity:1}80%{opacity:1}100%{opacity:0}}
    `;
    document.head.appendChild(s);
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  Game.modules.mutations = {
    init() { injectCSS(); syncMutations(); },
    applySerum,
    checkRads,
    renderPanel,
    getActive,
    getActiveMutationEffects,
    loadCatalog,
    syncMutations
  };

})();
