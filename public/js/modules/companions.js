// public/js/modules/companions.js
// ------------------------------------------------------------
// Atomic Fizz Caps — Companion NPC Frontend Module
// One active companion + one active pet at a time.
// Trust earned through quests, trades, and dialogue actions.
// At max trust, companions can be minted as tradeable NFTs.
// Exposes: Game.modules.companions
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!window.Game.modules) window.Game.modules = {};

  // ----------------------------------------------------------
  // Combat and Command System (BUG-212)
  // ----------------------------------------------------------
  const COMBAT_COMMANDS = ['follow', 'wait', 'attack'];
  
  // Recruitable NPCs with combat stats
  const RECRUITABLE_NPCS = [
    {
      id: 'dude',
      name: 'The Dude',
      dialogId: 'dialog_dude',
      stats: { hp: 80, damage: 15, armor: 5 },
      abilities: ['melee', 'intimidate'],
      loyalty: 50,
      recruitCondition: 'flag:met_dude',
      description: 'A laid-back wanderer with surprising combat skills.'
    },
    {
      id: 'rex',
      name: 'Captain Rex',
      dialogId: 'dialog_rex',
      stats: { hp: 120, damage: 25, armor: 15 },
      abilities: ['rifle', 'leadership'],
      loyalty: 70,
      recruitCondition: 'flag:met_rex',
      description: 'A disciplined soldier with heavy weaponry expertise.'
    },
    {
      id: 'mara',
      name: 'Dr. Mara',
      dialogId: 'dialog_mara',
      stats: { hp: 60, damage: 10, armor: 3 },
      abilities: ['energy', 'healing'],
      loyalty: 60,
      recruitCondition: 'flag:met_mara',
      description: 'A mysterious healer with radiation-based powers.'
    },
    {
      id: 'lucy',
      name: 'Lucy',
      dialogId: 'dialog_lucy',
      stats: { hp: 90, damage: 20, armor: 8 },
      abilities: ['melee', 'repair'],
      loyalty: 65,
      recruitCondition: 'flag:met_lucy',
      description: 'A skilled mechanic and fighter.'
    }
  ];

  const TRUST_LABELS = {
    0: "Stranger", 1: "Acquaintance", 2: "Associate",
    3: "Ally", 4: "Trusted Companion", 5: "Sworn Companion", 6: "Legend Bond"
  };
  const RARITY_COLORS = {
    common: "#aaaaaa", uncommon: "#00ff41",
    rare: "#4488ff", epic: "#cc44ff", legendary: "#ffd700"
  };

  // ----------------------------------------------------------
  // XSS-safe HTML escaper
  // ----------------------------------------------------------
  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

  // ----------------------------------------------------------
  // Secure RNG for cosmetic ordering (not game-outcome)
  // ----------------------------------------------------------
  const _rngBuf = new Uint32Array(1);
  function _secureRandom() {
    crypto.getRandomValues(_rngBuf);
    return _rngBuf[0] / 0x100000000;
  }

  // ----------------------------------------------------------
  // Session token
  // ----------------------------------------------------------
  function sessionId() { return localStorage.getItem("sessionId") || ""; }

  // ----------------------------------------------------------
  // API helpers
  // ----------------------------------------------------------
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
  // Local roster cache
  // ----------------------------------------------------------
  function getRoster() {
    try { return JSON.parse(localStorage.getItem(LS_ROSTER) || "{}"); }
    catch { return {}; }
  }
  function setRoster(r) { localStorage.setItem(LS_ROSTER, JSON.stringify(r)); }

  function getCatalog() {
    try { return JSON.parse(localStorage.getItem(LS_CATALOG) || "null"); }
    catch { return null; }
  }
  function setCatalog(c) { localStorage.setItem(LS_CATALOG, JSON.stringify(c)); }

  // ----------------------------------------------------------
  // Toast
  // ----------------------------------------------------------
  function toast(msg, type) {
    const colors = { info: "#00ff41", warn: "#ffaa00", error: "#ff4444", epic: "#cc44ff", legendary: "#ffd700" };
    const c = colors[type] || colors.info;
    const t = document.createElement("div");
    t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,10,5,0.97);border:1px solid ${c};color:${c};font-family:monospace;padding:10px 20px;z-index:10000;font-size:13px;pointer-events:none;max-width:360px;text-align:center;animation:compFade 3.5s forwards;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3500);
  }

  // ----------------------------------------------------------
  // Trust bar HTML (0-6 scale)
  // ----------------------------------------------------------
  function trustBarHtml(trust, maxTrust, rarity) {
    const color = RARITY_COLORS[rarity] || "#00ff41";
    const pct = Math.min(100, (trust / maxTrust) * 100);
    return `<div style="background:#001500;border:1px solid #333;height:6px;margin:4px 0;">
      <div style="background:${color};height:100%;width:${pct}%;transition:width 0.4s;"></div>
    </div>
    <div style="font-size:10px;color:${color};">${escapeHtml(TRUST_LABELS[trust] || "Unknown")} (${escapeHtml(trust)}/${escapeHtml(maxTrust)})</div>`;
  }

  // ----------------------------------------------------------
  // Load catalog from server (or cache)
  // ----------------------------------------------------------
  async function loadCatalog() {
    const cached = getCatalog();
    if (cached && cached._ts && Date.now() - cached._ts < 3600000) return cached.data;
    try {
      const data = await apiGet("/api/companions/all");
      if (data.ok) {
        setCatalog({ data: data.companions, _ts: Date.now() });
        return data.companions;
      }
    } catch { /* offline — use cache */ }
    return cached?.data || [];
  }

  // ----------------------------------------------------------
  // Sync roster from server
  // ----------------------------------------------------------
  async function syncRoster() {
    if (!sessionId()) return;
    try {
      const data = await apiGet("/api/companions/mine");
      if (data.ok) setRoster(data.roster);
    } catch { /* offline */ }
  }

  // ----------------------------------------------------------
  // Add trust for an action (called by game events)
  // ----------------------------------------------------------
  async function addTrust(companionId, action) {
    if (!sessionId()) return;
    try {
      const data = await apiPost("/api/companions/trust", { companionId, action });
      if (data.ok) {
        const roster = getRoster();
        if (!roster[companionId]) roster[companionId] = {};
        roster[companionId].trust = data.trust;
        setRoster(roster);

        if (data.canRecruit) {
          toast(`${companionId}: Trust threshold reached — you can recruit them now.`, "epic");
        } else if (data.atMaxTrust) {
          toast("Max trust achieved — companion NFT mint unlocked.", "legendary");
        }
        return data;
      }
    } catch { /* offline */ }
    return null;
  }

  // ----------------------------------------------------------
  // Recruit a companion
  // ----------------------------------------------------------
  async function recruit(companionId) {
    if (!sessionId()) { toast("Sign in to recruit companions.", "warn"); return; }
    try {
      const data = await apiPost("/api/companions/recruit", { companionId });
      if (data.ok) {
        const roster = getRoster();
        if (!roster[companionId]) roster[companionId] = {};
        roster[companionId].recruited = true;
        setRoster(roster);
        toast(`${data.companion.name} has joined you. "${data.message}"`, "epic");
        return data;
      } else {
        toast(data.error || "Recruitment failed.", "warn");
      }
    } catch { toast("Connection lost.", "error"); }
    return null;
  }

  // ----------------------------------------------------------
  // Set active companion or pet
  // ----------------------------------------------------------
  async function setActive(companionId) {
    if (!sessionId()) { toast("Sign in to activate companions.", "warn"); return; }
    try {
      const data = await apiPost("/api/companions/set-active", { companionId });
      if (data.ok) {
        const roster = getRoster();
        // Deactivate any same-type already active in local cache
        for (const [cid, entry] of Object.entries(roster)) {
          if (entry.active && cid !== companionId) {
            // Only deactivate same type — we don't track isPet locally, so just sync
            entry.active = false;
          }
        }
        if (!roster[companionId]) roster[companionId] = {};
        roster[companionId].active = true;
        setRoster(roster);
        toast(`${data.active.name} is now your active ${data.isPet ? "pet" : "companion"}.`, "info");
        return data;
      } else {
        toast(data.error || "Cannot set active.", "warn");
      }
    } catch { toast("Connection lost.", "error"); }
    return null;
  }

  // ----------------------------------------------------------
  // Dismiss a companion (removes from active, keeps in roster)
  // ----------------------------------------------------------
  async function dismiss(companionId) {
    if (!sessionId()) return;
    try {
      const data = await apiPost("/api/companions/dismiss", { companionId });
      if (data.ok) {
        const roster = getRoster();
        if (roster[companionId]) roster[companionId].active = false;
        setRoster(roster);
        toast("Companion dismissed. They'll be waiting if you need them.", "info");
      } else {
        toast(data.error || "Cannot dismiss.", "warn");
      }
    } catch { toast("Connection lost.", "error"); }
  }

  // ----------------------------------------------------------
  // Get active companion buffs (for game integration)
  // ----------------------------------------------------------
  function getActiveBuffs(catalog) {
    const roster = getRoster();
    const buffs = [];
    for (const [cid, entry] of Object.entries(roster)) {
      if (!entry.active || !entry.recruited) continue;
      const def = (catalog || []).find(c => c.id === cid);
      if (def?.active_perk) buffs.push({ companionId: cid, name: def.name, perk: def.active_perk });
    }
    return buffs;
  }

  // ----------------------------------------------------------
  // Combat System Functions (BUG-212)
  // ----------------------------------------------------------
  
  // Check if NPC can be recruited for combat
  function canRecruitCombat(npcId) {
    const npc = RECRUITABLE_NPCS.find(n => n.id === npcId);
    if (!npc) return false;

    // Check if already recruited
    const roster = getRoster();
    if (roster[npcId]?.recruited) return false;

    // Check recruitment condition (simplified - in real implementation check flags)
    return window.GAME_STATE?.flags?.[npc.recruitCondition.replace('flag:', '')] || false;
  }

  // Recruit companion for combat
  async function recruitCombatCompanion(npcId) {
    if (!canRecruitCombat(npcId)) return null;

    const npc = RECRUITABLE_NPCS.find(n => n.id === npcId);
    if (!npc) return null;

    try {
      const data = await apiPost("/api/companions/recruit", { companionId: npcId });
      if (data.ok) {
        const roster = getRoster();
        if (!roster[npcId]) roster[npcId] = {};
        roster[npcId].recruited = true;
        roster[npcId].combatStats = { ...npc.stats };
        roster[npcId].abilities = [...npc.abilities];
        roster[npcId].loyalty = npc.loyalty;
        roster[npcId].inventory = [];
        roster[npcId].command = 'follow';
        roster[npcId].status = 'active';
        setRoster(roster);
        toast(`${npc.name} has joined you as a combat companion!`, "epic");
        return data;
      } else {
        toast(data.error || "Recruitment failed.", "warn");
      }
    } catch { toast("Connection lost.", "error"); }
    return null;
  }

  // Dismiss combat companion
  async function dismissCombatCompanion(companionId) {
    try {
      const data = await apiPost("/api/companions/dismiss", { companionId });
      if (data.ok) {
        const roster = getRoster();
        if (roster[companionId]) {
          // Return inventory items to player
          const companion = roster[companionId];
          if (companion.inventory) {
            // Note: In real implementation, would need to sync with player inventory
            companion.inventory.forEach(item => {
              // Add to player inventory logic here
            });
          }
          roster[companionId].active = false;
          roster[companionId].status = 'dismissed';
        }
        setRoster(roster);
        toast("Combat companion dismissed.", "info");
      } else {
        toast(data.error || "Cannot dismiss.", "warn");
      }
    } catch { toast("Connection lost.", "error"); }
  }

  // Set companion command
  function setCompanionCommand(companionId, command, target = null) {
    if (!COMBAT_COMMANDS.includes(command)) return false;

    const roster = getRoster();
    if (roster[companionId]) {
      roster[companionId].command = command;
      roster[companionId].target = target;
      setRoster(roster);
      return true;
    }
    return false;
  }

  // Transfer item to companion
  function giveItemToCompanion(companionId, itemId) {
    const roster = getRoster();
    if (!roster[companionId] || !roster[companionId].inventory) return false;

    // In real implementation, would need to check player inventory and transfer
    // For now, just add to companion inventory
    roster[companionId].inventory.push({ id: itemId, name: `Item ${itemId}` });
    setRoster(roster);
    return true;
  }

  // Take item from companion
  function takeItemFromCompanion(companionId, itemId) {
    const roster = getRoster();
    if (!roster[companionId] || !roster[companionId].inventory) return false;

    const itemIndex = roster[companionId].inventory.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return false;

    roster[companionId].inventory.splice(itemIndex, 1);
    setRoster(roster);
    // In real implementation, add to player inventory
    return true;
  }

  // Update loyalty based on player actions
  function updateLoyalty(companionId, change) {
    const roster = getRoster();
    if (roster[companionId]) {
      roster[companionId].loyalty = Math.max(0, Math.min(100, (roster[companionId].loyalty || 50) + change));
      setRoster(roster);

      // If loyalty drops too low, companion may leave
      // SECURITY: use crypto.getRandomValues() — Math.random() forbidden per project policy
      const _buf = new Uint32Array(1);
      crypto.getRandomValues(_buf);
      if (roster[companionId].loyalty < 20 && (_buf[0] / 0x100000000) < 0.1) {
        dismissCombatCompanion(companionId);
        toast(`Your companion has left due to low loyalty!`, "error");
      }
    }
  }

  // Get active combat companions
  function getActiveCombatCompanions() {
    const roster = getRoster();
    return Object.entries(roster)
      .filter(([id, entry]) => entry.recruited && entry.status === 'active')
      .map(([id, entry]) => ({ id, ...entry }));
  }

  // Process companion combat turns
  function processCombatTurn() {
    const companions = getActiveCombatCompanions();
    companions.forEach(companion => {
      if (companion.combatStats.hp <= 0) return;

      // Simple AI: attack if following or attacking
      if (companion.command === 'follow' || companion.command === 'attack') {
        // Find target (simplified - attack first enemy)
        if (Game.modules.battles?.state?.enemies?.length > 0) {
          const target = Game.modules.battles.state.enemies[0];
          const damage = companion.combatStats.damage;
          target.hp -= damage;

          if (Game.modules.battles?.addToLog) {
            Game.modules.battles.addToLog(`${companion.name || companion.id} attacks ${target.name} for ${damage} damage!`);
          }
        }
      }
    });
  }

  // ----------------------------------------------------------
  // Render companion panel into a container element
  // ----------------------------------------------------------
  async function renderPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div style="font-family:monospace;color:#00ff41;padding:8px;font-size:11px;">// LOADING COMPANION ROSTER...</div>';

    const [catalog] = await Promise.all([loadCatalog(), syncRoster()]);
    const roster = getRoster();

    let html = '<div class="comp-panel">';
    html += '<div class="comp-header">// COMPANION ROSTER //</div>';
    html += '<div class="comp-subtitle">One active companion + one active pet. Trust is earned through shared experience.</div>';

    // Active companion summary
    const active = catalog.filter(c => roster[c.id]?.active && roster[c.id]?.recruited && !c.isPet);
    const activePet = catalog.filter(c => roster[c.id]?.active && roster[c.id]?.recruited && c.isPet);
    if (active.length) {
      const a = active[0];
      html += `<div class="comp-active-summary" style="border-color:${RARITY_COLORS[a.rarity] || '#00ff41'};">`;
      html += `<div style="font-size:11px;opacity:0.6;">ACTIVE COMPANION</div>`;
      html += `<div style="font-size:14px;font-weight:bold;">${escapeHtml(a.name)} — ${escapeHtml(a.title)}</div>`;
      html += `<div style="font-size:11px;color:#88cc88;margin-top:4px;">${escapeHtml(a.active_perk?.description || "")}</div>`;
      html += `<button class="comp-btn comp-btn-dismiss" data-id="${escapeHtml(a.id)}" style="margin-top:6px;font-size:10px;">DISMISS</button>`;
      html += '</div>';
    }
    if (activePet.length) {
      const p = activePet[0];
      html += `<div class="comp-active-summary" style="border-color:${RARITY_COLORS[p.rarity] || '#00ff41'};">`;
      html += `<div style="font-size:11px;opacity:0.6;">ACTIVE PET</div>`;
      html += `<div style="font-size:14px;font-weight:bold;">${escapeHtml(p.name)} — ${escapeHtml(p.title)}</div>`;
      html += `<div style="font-size:11px;color:#88cc88;margin-top:4px;">${escapeHtml(p.active_perk?.description || "")}</div>`;
      html += `<button class="comp-btn comp-btn-dismiss" data-id="${escapeHtml(p.id)}" style="margin-top:6px;font-size:10px;">DISMISS</button>`;
      html += '</div>';
    }

    html += '<div class="comp-list">';
    for (const comp of catalog) {
      const entry = roster[comp.id] || { trust: 0, recruited: false, active: false };
      const color = RARITY_COLORS[comp.rarity] || "#00ff41";
      const canRecruit = entry.trust >= comp.trust_requirement && !entry.recruited;
      const isPet = comp.isPet || false;

      html += `<div class="comp-card" style="border-color:${color};">`;
      html += `<div class="comp-card-header">`;
      html += `<span class="comp-rarity" style="color:${color};">${escapeHtml(comp.rarity.toUpperCase())}${isPet ? " · PET" : ""}</span>`;
      html += `<span class="comp-name">${escapeHtml(comp.name)}</span>`;
      html += `<span class="comp-title">${escapeHtml(comp.title)}</span>`;
      html += `</div>`;
      html += `<div class="comp-desc">${escapeHtml(comp.description)}</div>`;
      html += `<div class="comp-trust">${trustBarHtml(entry.trust, 6, comp.rarity)}</div>`;
      html += `<div class="comp-perk"><b>Perk:</b> ${escapeHtml(comp.active_perk?.name || "")} — ${escapeHtml(comp.active_perk?.description || "")}</div>`;
      html += `<div class="comp-hinder"><b>Hindrance:</b> ${escapeHtml(comp.passive_hindrance || "None")}</div>`;
      html += `<div class="comp-actions">`;
      if (entry.recruited && !entry.active) {
        html += `<button class="comp-btn comp-btn-activate" data-id="${escapeHtml(comp.id)}">SET ACTIVE</button>`;
      } else if (canRecruit) {
        html += `<button class="comp-btn comp-btn-recruit" data-id="${escapeHtml(comp.id)}" style="border-color:${color};color:${color};">RECRUIT</button>`;
      } else if (!entry.recruited) {
        html += `<span class="comp-trust-needed">Trust needed: ${escapeHtml(comp.trust_requirement - entry.trust)} more</span>`;
      } else if (entry.active) {
        html += `<span style="color:${color};font-size:11px;">✓ ACTIVE</span>`;
      }
      if (entry.trust >= 6 && entry.recruited) {
        html += `<button class="comp-btn comp-btn-nft" data-id="${escapeHtml(comp.id)}" style="border-color:#ffd700;color:#ffd700;margin-left:6px;">MINT NFT</button>`;
      }
      html += `</div></div>`;
    }
    html += "</div></div>";

    container.innerHTML = html;

    // Wire up buttons
    container.querySelectorAll(".comp-btn-recruit").forEach(btn => {
      btn.onclick = () => recruit(btn.dataset.id).then(() => renderPanel(containerId));
    });
    container.querySelectorAll(".comp-btn-activate").forEach(btn => {
      btn.onclick = () => setActive(btn.dataset.id).then(() => renderPanel(containerId));
    });
    container.querySelectorAll(".comp-btn-dismiss").forEach(btn => {
      btn.onclick = () => dismiss(btn.dataset.id).then(() => renderPanel(containerId));
    });
    container.querySelectorAll(".comp-btn-nft").forEach(btn => {
      btn.onclick = () => toast("NFT minting coming via the Wasteland Exchange — check back soon, wanderer.", "legendary");
    });
  }

  // ----------------------------------------------------------
  // Inject CSS
  // ----------------------------------------------------------
  function injectCSS() {
    if (document.getElementById("comp-styles")) return;
    const s = document.createElement("style");
    s.id = "comp-styles";
    s.textContent = `
      .comp-panel{padding:12px;font-family:monospace;}
      .comp-header{font-size:12px;color:#ffd700;letter-spacing:1px;margin-bottom:2px;}
      .comp-subtitle{font-size:10px;color:#445544;margin-bottom:10px;}
      .comp-active-summary{border:1px solid #00ff41;padding:10px;margin-bottom:10px;}
      .comp-list{display:flex;flex-direction:column;gap:8px;}
      .comp-card{border:1px solid #00ff41;padding:10px;}
      .comp-card-header{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:4px;}
      .comp-rarity{font-size:9px;letter-spacing:1px;}
      .comp-name{font-size:13px;font-weight:bold;flex:1;}
      .comp-title{font-size:10px;color:#667766;font-style:italic;}
      .comp-desc{font-size:10px;color:#667766;line-height:1.4;margin-bottom:6px;}
      .comp-trust{margin-bottom:4px;}
      .comp-perk{font-size:10px;color:#88cc88;margin-bottom:2px;}
      .comp-hinder{font-size:10px;color:#aa6644;margin-bottom:6px;}
      .comp-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
      .comp-btn{background:#001a00;border:1px solid #00ff41;color:#00ff41;padding:5px 10px;font-family:monospace;font-size:10px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;}
      .comp-btn:hover{background:#003300;}
      .comp-trust-needed{font-size:10px;color:#556655;}
      @keyframes compFade{0%{opacity:0}10%{opacity:1}80%{opacity:1}100%{opacity:0}}
    `;
    document.head.appendChild(s);
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  Game.modules.companions = {
    init() { injectCSS(); syncRoster(); },
    addTrust,
    recruit,
    setActive,
    dismiss,
    renderPanel,
    getActiveBuffs,
    getRoster,
    loadCatalog
  };

})();
