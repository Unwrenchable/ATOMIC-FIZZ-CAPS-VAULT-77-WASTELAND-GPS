// public/js/modules/nukes.js
// ------------------------------------------------------------
// Atomic Fizz Caps — Nuke Silo & Zone Frontend Module
// Players collect nuclear keycards and launch code fragments.
// 3 keycards + complete 8-char code + silo proximity = launch.
// Active nuke zones show on the map with unique loot/bosses.
// Exposes: Game.modules.nukes
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!window.Game.modules) window.Game.modules = {};

  const API_BASE       = window.API_BASE || "https://api.atomicfizzcaps.xyz";
  const LS_ACTIVE      = "afc_nuke_zones_active";   // [{ id, name, expiresAt, ... }]
  const _LS_CODE_STATUS = "afc_nuke_code_status";    // fragment zone info
  const CHECK_INTERVAL = 60_000;                    // poll active zones every 60s

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
  // Toast
  // ----------------------------------------------------------
  function toast(msg, type) {
    const colors = { info: "#00ff41", warn: "#ffaa00", error: "#ff4444", nuke: "#ff6600", launch: "#ff0000" };
    const c = colors[type] || colors.info;
    const t = document.createElement("div");
    t.style.cssText = `position:fixed;top:60px;left:50%;transform:translateX(-50%);background:rgba(20,0,0,0.97);border:2px solid ${c};color:${c};font-family:monospace;padding:12px 24px;z-index:10001;font-size:13px;pointer-events:none;max-width:400px;text-align:center;animation:nukeFade 4s forwards;letter-spacing:1px;`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 4000);
  }

  // ----------------------------------------------------------
  // Active zone cache
  // ----------------------------------------------------------
  function getActiveZones() {
    try { return JSON.parse(localStorage.getItem(LS_ACTIVE) || "[]"); }
    catch { return []; }
  }
  function setActiveZones(zones) { localStorage.setItem(LS_ACTIVE, JSON.stringify(zones)); }

  // ----------------------------------------------------------
  // Poll active zones from server
  // ----------------------------------------------------------
  async function refreshActiveZones() {
    try {
      const data = await apiGet("/api/nukes/zones");
      if (data.ok) {
        setActiveZones(data.activeZones);
        return data.activeZones;
      }
    } catch { /* offline */ }
    return getActiveZones().filter(z => z.expiresAt > Date.now());
  }

  // ----------------------------------------------------------
  // Check if player GPS is inside any active nuke zone
  // Returns the zone definition or null
  // ----------------------------------------------------------
  function isInNukeZone(lat, lng) {
    const zones = getActiveZones();
    const now = Date.now();
    for (const zone of zones) {
      if (zone.expiresAt <= now) continue;
      const distM = haversineMeters(lat, lng, zone.center_lat, zone.center_lng);
      const radiusM = (zone.radius_km || 1) * 1000;
      if (distM <= radiusM) return zone;
    }
    return null;
  }

  // ----------------------------------------------------------
  // Haversine
  // ----------------------------------------------------------
  function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6_371_000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1); const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ----------------------------------------------------------
  // Claim a code fragment at player's current GPS position
  // ----------------------------------------------------------
  async function claimFragment(zoneId) {
    if (!sessionId()) { toast("Sign in to collect code fragments.", "warn"); return; }
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
      );
      const data = await apiPost("/api/nukes/claim-fragment", {
        zoneId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
      if (data.ok) {
        toast(`Fragment ${data.fragment.position}/4: "${data.fragment.chars}" — ${data.fragmentsCollected}/4 collected.`, "nuke");
      } else {
        toast(data.error || "Could not collect fragment.", "warn");
      }
      return data;
    } catch (err) {
      toast("GPS unavailable.", "warn");
      return null;
    }
  }

  // ----------------------------------------------------------
  // Launch sequence UI
  // ----------------------------------------------------------
  async function showLaunchSequence() {
    if (!sessionId()) { toast("Sign in to access launch terminals.", "warn"); return; }

    // Fetch current keycard status
    let keycardData;
    try { keycardData = await apiGet("/api/nukes/my-keycards"); }
    catch { toast("Cannot reach launch terminal — signal lost.", "error"); return; }

    if (!keycardData.ok) { toast(keycardData.error || "Terminal error.", "error"); return; }

    // Build launch UI overlay
    const overlay = document.createElement("div");
    overlay.id = "nuke-launch-overlay";
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,0,0,0.96);z-index:10002;overflow-y:auto;display:flex;align-items:center;justify-content:center;font-family:monospace;";

    const panel = document.createElement("div");
    panel.style.cssText = "width:min(480px,94vw);border:2px solid #ff6600;padding:20px;color:#ff6600;";

    const kc     = keycardData.keycards || [];
    const frags  = keycardData.fragments || [];
    const canLaunch = keycardData.canLaunch;

    let html = `<div style="font-size:10px;opacity:0.6;margin-bottom:6px;">// VAULT-TEC NUCLEAR LAUNCH TERMINAL //</div>`;
    html += `<div style="font-size:18px;font-weight:bold;margin-bottom:12px;color:#ff4400;">☢ LAUNCH AUTHORIZATION SYSTEM</div>`;

    html += `<div style="font-size:12px;margin-bottom:8px;">KEYCARDS: ${escapeHtml(kc.length)}/3 required</div>`;
    for (const k of kc) {
      html += `<div style="font-size:10px;color:#ffaa00;">▶ ${escapeHtml(k.name || k.id)}</div>`;
    }
    if (kc.length < 3) {
      html += `<div style="font-size:10px;color:#774400;margin-top:4px;">Find ${escapeHtml(3 - kc.length)} more keycard(s) from high-level enemies, quests, or nuke zones.</div>`;
    }

    html += `<div style="font-size:12px;margin:12px 0 6px;">LAUNCH CODE FRAGMENTS: ${escapeHtml(frags.length)}/4</div>`;
    for (let i = 0; i < 4; i++) {
      const f = frags[i];
      html += `<div style="font-size:11px;color:${f ? "#ffaa00" : "#443300"};">Fragment ${i + 1}: ${f ? `"${escapeHtml(f.fragment_chars)}"` : "[ MISSING ]"}</div>`;
    }

    if (canLaunch) {
      html += `<div style="margin-top:14px;border:1px solid #ff4400;padding:10px;">`;
      html += `<div style="font-size:12px;color:#ff4400;margin-bottom:8px;">⚡ READY TO LAUNCH</div>`;
      html += `<div style="font-size:10px;margin-bottom:6px;">Enter complete launch code:</div>`;
      html += `<input id="nuke-code-input" type="text" maxlength="8" placeholder="XXXXXXXX" style="background:#100000;color:#ff6600;border:1px solid #ff4400;padding:6px;font-family:monospace;font-size:14px;width:100%;box-sizing:border-box;letter-spacing:4px;text-transform:uppercase;" />`;
      html += `<div style="font-size:10px;margin:8px 0 6px;">Select target zone:</div>`;
      html += `<select id="nuke-zone-select" style="background:#100000;color:#ff6600;border:1px solid #ff4400;padding:6px;font-family:monospace;width:100%;box-sizing:border-box;">`;
      html += `<option value="">-- Select Zone --</option>`;

      // Load zone catalog
      let zoneCatalog = [];
      try {
        const zd = await apiGet("/api/nukes/zone-catalog");
        if (zd.ok) zoneCatalog = zd.zones.filter(z => z.targetable);
      } catch { /* offline */ }

      for (const z of zoneCatalog) {
        html += `<option value="${escapeHtml(z.id)}">${escapeHtml(z.name)} — ${escapeHtml(z.description?.slice(0, 60))}...</option>`;
      }
      html += `</select>`;
      html += `<div style="font-size:10px;margin:8px 0 4px;">Select launch silo (must be physically present):</div>`;
      html += `<select id="nuke-silo-select" style="background:#100000;color:#ff6600;border:1px solid #ff4400;padding:6px;font-family:monospace;width:100%;box-sizing:border-box;">`;
      html += `<option value="">-- Select Silo --</option>`;

      let siloCatalog = [];
      try {
        const sd = await apiGet("/api/nukes/zone-catalog");
        if (sd.ok) siloCatalog = sd.silos || [];
      } catch { /* offline */ }

      for (const s of siloCatalog) {
        html += `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.codename)})</option>`;
      }
      html += `</select>`;
      html += `<button id="nuke-launch-btn" style="margin-top:10px;width:100%;background:#300000;border:2px solid #ff4400;color:#ff4400;padding:10px;font-family:monospace;font-size:13px;cursor:pointer;text-transform:uppercase;letter-spacing:2px;">⚠ INITIATE LAUNCH SEQUENCE ⚠</button>`;
      html += '</div>';
    } else {
      html += `<div style="margin-top:12px;font-size:10px;color:#773300;line-height:1.6;">`;
      html += `Collect ${escapeHtml(3 - kc.length)} more keycards and ${escapeHtml(4 - frags.length)} more code fragments to unlock the launch sequence.`;
      html += `</div>`;
    }

    html += `<button id="nuke-close-btn" style="margin-top:14px;width:100%;background:#0a0000;border:1px solid #552200;color:#552200;padding:8px;font-family:monospace;font-size:11px;cursor:pointer;">CLOSE TERMINAL</button>`;

    panel.innerHTML = html;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    document.getElementById("nuke-close-btn").onclick = () => overlay.remove();

    const launchBtn = document.getElementById("nuke-launch-btn");
    if (launchBtn) {
      launchBtn.onclick = async () => {
        const code     = (document.getElementById("nuke-code-input")?.value || "").trim();
        const zoneId   = document.getElementById("nuke-zone-select")?.value || "";
        const siloId   = document.getElementById("nuke-silo-select")?.value || "";

        if (!code || code.length < 8) { toast("Enter the complete 8-character launch code.", "warn"); return; }
        if (!zoneId) { toast("Select a target zone.", "warn"); return; }
        if (!siloId) { toast("Select a launch silo.", "warn"); return; }

        launchBtn.textContent = "ACQUIRING GPS...";
        launchBtn.disabled = true;

        let pos;
        try {
          pos = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
          );
        } catch {
          toast("GPS unavailable — cannot confirm silo position.", "error");
          launchBtn.textContent = "⚠ INITIATE LAUNCH SEQUENCE ⚠";
          launchBtn.disabled = false;
          return;
        }

        launchBtn.textContent = "AUTHENTICATING...";

        const result = await apiPost("/api/nukes/launch", {
          siloId, targetZoneId: zoneId, launchCode: code,
          lat: pos.coords.latitude, lng: pos.coords.longitude
        });

        if (result.ok) {
          overlay.remove();
          showLaunchConfirmed(result);
          await refreshActiveZones();
        } else {
          toast(result.error || "Launch failed.", "error");
          launchBtn.textContent = "⚠ INITIATE LAUNCH SEQUENCE ⚠";
          launchBtn.disabled = false;
        }
      };
    }
  }

  // ----------------------------------------------------------
  // Launch confirmed screen
  // ----------------------------------------------------------
  function showLaunchConfirmed(result) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:10003;display:flex;align-items:center;justify-content:center;font-family:monospace;";
    overlay.innerHTML = `
      <div style="text-align:center;color:#ff4400;max-width:400px;padding:20px;animation:nukeFlash 0.5s ease;">
        <div style="font-size:60px;margin-bottom:12px;">☢</div>
        <div style="font-size:24px;font-weight:bold;letter-spacing:4px;margin-bottom:8px;">LAUNCH CONFIRMED</div>
        <div style="font-size:14px;color:#ff8800;margin-bottom:12px;">${escapeHtml(result.targetZone?.name || "Unknown Zone")}</div>
        <div style="font-size:11px;color:#884422;line-height:1.6;margin-bottom:16px;">${escapeHtml(result.message || "")}</div>
        <div style="font-size:11px;color:#553322;">Zone active for ${escapeHtml(result.durationHours || 3)} hours.</div>
        <button onclick="this.parentElement.parentElement.remove()" style="margin-top:16px;background:#200000;border:1px solid #ff4400;color:#ff4400;padding:8px 20px;font-family:monospace;cursor:pointer;font-size:12px;text-transform:uppercase;">CLOSE</button>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 15000);
  }

  // ----------------------------------------------------------
  // Render nuke status panel
  // ----------------------------------------------------------
  async function renderPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div style="font-family:monospace;color:#ff6600;padding:8px;font-size:11px;">// SCANNING NUCLEAR ACTIVITY...</div>';

    const [zones, codeStatus] = await Promise.all([
      refreshActiveZones(),
      apiGet("/api/nukes/launch-code-status").catch(() => null)
    ]);

    let html = '<div class="nuke-panel">';
    html += '<div class="nuke-header">// NUCLEAR LAUNCH SYSTEM //</div>';

    // Active zones
    html += '<div class="nuke-section">ACTIVE NUKE ZONES</div>';
    if (zones.length === 0) {
      html += '<div class="nuke-empty">No active nuclear zones. Collect keycards + launch code fragments and find a silo to launch.</div>';
    } else {
      for (const z of zones) {
        const mins = Math.max(0, Math.floor((z.expiresAt - Date.now()) / 60000));
        html += `<div class="nuke-zone-card">`;
        html += `<div class="nuke-zone-name">☢ ${escapeHtml(z.name)}</div>`;
        html += `<div class="nuke-zone-timer">⏱ ${escapeHtml(mins)} minutes remaining</div>`;
        html += `<div class="nuke-zone-loot">Unique loot active. High radiation — bring RadAway.</div>`;
        html += `</div>`;
      }
    }

    // Code fragment status
    if (codeStatus?.ok) {
      html += '<div class="nuke-section" style="margin-top:12px;">WEEKLY CODE FRAGMENTS</div>';
      html += `<div style="font-size:10px;color:#775500;margin-bottom:6px;">Collect one fragment from each zone to assemble the launch code.</div>`;
      for (const fz of (codeStatus.fragmentZones || [])) {
        html += `<div class="nuke-frag-row"><span class="nuke-frag-num">[${escapeHtml(fz.position)}/4]</span> <span class="nuke-frag-zone">${escapeHtml(fz.zoneName)}</span>`;
        html += `<button class="nuke-btn nuke-btn-claim" data-zone="${escapeHtml(fz.zoneId)}">COLLECT</button>`;
        html += `</div>`;
      }
    }

    // Launch button
    html += `<button class="nuke-btn nuke-btn-launch" style="margin-top:14px;width:100%;border-color:#ff4400;color:#ff4400;">☢ OPEN LAUNCH TERMINAL</button>`;

    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll(".nuke-btn-claim").forEach(btn => {
      btn.onclick = () => claimFragment(btn.dataset.zone).then(() => renderPanel(containerId));
    });
    container.querySelector(".nuke-btn-launch")?.addEventListener("click", showLaunchSequence);
  }

  // ----------------------------------------------------------
  // Inject CSS
  // ----------------------------------------------------------
  function injectCSS() {
    if (document.getElementById("nuke-styles")) return;
    const s = document.createElement("style");
    s.id = "nuke-styles";
    s.textContent = `
      .nuke-panel{padding:12px;font-family:monospace;}
      .nuke-header{font-size:12px;color:#ff6600;letter-spacing:1px;margin-bottom:8px;}
      .nuke-section{font-size:10px;color:#884400;letter-spacing:1px;border-bottom:1px solid #222;padding-bottom:2px;margin-bottom:6px;}
      .nuke-zone-card{border:1px solid #ff4400;padding:8px;margin-bottom:6px;background:rgba(30,0,0,0.5);}
      .nuke-zone-name{font-size:13px;font-weight:bold;color:#ff6600;margin-bottom:4px;}
      .nuke-zone-timer{font-size:11px;color:#ffaa00;margin-bottom:2px;}
      .nuke-zone-loot{font-size:10px;color:#886644;}
      .nuke-frag-row{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #111;}
      .nuke-frag-num{font-size:10px;color:#884400;flex-shrink:0;}
      .nuke-frag-zone{font-size:11px;flex:1;}
      .nuke-empty{font-size:10px;color:#553300;font-style:italic;padding:8px 0;}
      .nuke-btn{background:#100000;border:1px solid #ff6600;color:#ff6600;padding:5px 10px;font-family:monospace;font-size:10px;cursor:pointer;text-transform:uppercase;letter-spacing:1px;}
      .nuke-btn:hover{background:#220000;}
      @keyframes nukeFade{0%{opacity:0}10%{opacity:1}80%{opacity:1}100%{opacity:0}}
      @keyframes nukeFlash{0%{opacity:0;transform:scale(0.8)}100%{opacity:1;transform:scale(1)}}
    `;
    document.head.appendChild(s);
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  Game.modules.nukes = {
    init() {
      injectCSS();
      refreshActiveZones();
      setInterval(refreshActiveZones, CHECK_INTERVAL);
    },
    refreshActiveZones,
    isInNukeZone,
    claimFragment,
    showLaunchSequence,
    renderPanel,
    getActiveZones
  };

})();
