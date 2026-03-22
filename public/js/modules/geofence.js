// public/js/modules/geofence.js
// ------------------------------------------------------------
// Atomic Fizz Caps — Real-World Geo-fence System (Frontend)
// Checks player GPS position against Fallout pilgrimage sites.
// When the player is physically at a real-world location they
// receive a unique geo-locked collector item.
//
// Exposes: Game.modules.geofence
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!window.Game.modules) window.Game.modules = {};

  // ----------------------------------------------------------
  // Constants
  // ----------------------------------------------------------
  const CHECK_INTERVAL_MS  = 30_000;   // check every 30 seconds
  const LS_DISMISSED_KEY   = "afc_geofence_dismissed"; // { locationId: timestamp }
  const LS_COLLECTED_KEY   = "afc_geofence_collected"; // [ locationId, ... ]
  const DISMISS_TTL_MS     = 24 * 3600 * 1000;         // re-prompt after 24h
  const API_BASE           = window.API_BASE || "https://api.atomicfizzcaps.xyz";
  const TIER_COLORS        = {
    legendary: "#ffd700",
    epic:      "#cc44ff",
    rare:      "#4488ff",
    common:    "#00ff41"
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
  // Haversine distance in meters (mirrors server-side calc)
  // ----------------------------------------------------------
  function _haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6_371_000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ----------------------------------------------------------
  // Auth helper
  // ----------------------------------------------------------
  function sessionId() {
    return localStorage.getItem("sessionId") || "";
  }

  // ----------------------------------------------------------
  // Dismissed locations (client-side, suppresses re-prompt for 24h)
  // ----------------------------------------------------------
  function getDismissed() {
    try { return JSON.parse(localStorage.getItem(LS_DISMISSED_KEY) || "{}"); }
    catch { return {}; }
  }
  function setDismissed(locationId) {
    const d = getDismissed();
    d[locationId] = Date.now();
    localStorage.setItem(LS_DISMISSED_KEY, JSON.stringify(d));
  }
  function isDismissed(locationId) {
    const d = getDismissed();
    return d[locationId] && (Date.now() - d[locationId]) < DISMISS_TTL_MS;
  }

  // ----------------------------------------------------------
  // Locally-collected cache (prevents re-prompting for already-owned)
  // ----------------------------------------------------------
  function getLocalCollected() {
    try { return JSON.parse(localStorage.getItem(LS_COLLECTED_KEY) || "[]"); }
    catch { return []; }
  }
  function markLocalCollected(locationId) {
    const c = getLocalCollected();
    if (!c.includes(locationId)) { c.push(locationId); localStorage.setItem(LS_COLLECTED_KEY, JSON.stringify(c)); }
  }

  // ----------------------------------------------------------
  // Geo-fence prompt card (shown when player is at a site)
  // ----------------------------------------------------------
  function _showGeofencePrompt(location, distanceM) {
    // Remove any existing prompt
    const old = document.getElementById("gf-prompt-card");
    if (old) old.remove();

    const tierColor = TIER_COLORS[location.tier] || "#00ff41";
    const card = document.createElement("div");
    card.id = "gf-prompt-card";
    card.style.cssText = [
      "position:fixed", "bottom:120px", "left:50%",
      "transform:translateX(-50%)", "width:min(380px,92vw)",
      "background:#000d00", "border:2px solid " + tierColor,
      "color:" + tierColor, "font-family:monospace",
      "padding:16px", "z-index:10000", "box-shadow:0 0 20px " + tierColor + "55",
      "animation:gfCardIn 0.4s ease"
    ].join(";");

    card.innerHTML = [
      '<div style="font-size:10px;opacity:0.6;margin-bottom:4px;">// PIP-BOY SIGNAL DETECTED //</div>',
      '<div style="font-size:14px;font-weight:bold;margin-bottom:6px;">',
        escapeHtml(location.name), "</div>",
      '<div style="font-size:11px;opacity:0.7;margin-bottom:8px;">',
        escapeHtml(location.city), ' &mdash; ',
        escapeHtml(Math.round(distanceM)), "m from center</div>",
      '<div style="font-size:12px;line-height:1.5;margin-bottom:10px;color:#88cc88;">',
        escapeHtml(location.promptMessage), "</div>",
      '<div style="display:flex;gap:8px;">',
        '<button id="gf-btn-claim" style="flex:1;background:#001a00;color:',
          tierColor, ';border:1px solid ', tierColor,
          ';padding:8px;font-family:monospace;cursor:pointer;font-size:12px;',
          'text-transform:uppercase;letter-spacing:1px;">',
          "⚡ CLAIM REWARD</button>",
        '<button id="gf-btn-dismiss" style="background:#001a00;color:#555;',
          'border:1px solid #333;padding:8px;font-family:monospace;cursor:pointer;',
          'font-size:11px;">✕</button>',
      "</div>"
    ].join("");

    document.body.appendChild(card);

    document.getElementById("gf-btn-dismiss").onclick = () => {
      setDismissed(location.id);
      card.remove();
    };

    document.getElementById("gf-btn-claim").onclick = () => {
      claimReward(location);
      card.remove();
    };
  }

  // ----------------------------------------------------------
  // Reward success card (shown after successful claim)
  // ----------------------------------------------------------
  function showRewardCard(location, reward) {
    const tierColor = TIER_COLORS[location.tier] || "#ffd700";
    const card = document.createElement("div");
    card.style.cssText = [
      "position:fixed", "top:50%", "left:50%",
      "transform:translate(-50%,-50%)", "width:min(400px,94vw)",
      "background:#000d00", "border:2px solid " + tierColor,
      "color:" + tierColor, "font-family:monospace",
      "padding:20px", "z-index:10001", "text-align:center",
      "box-shadow:0 0 40px " + tierColor + "66",
      "animation:gfCardIn 0.4s ease"
    ].join(";");

    card.innerHTML = [
      '<div style="font-size:22px;margin-bottom:8px;">⚡</div>',
      '<div style="font-size:11px;opacity:0.6;margin-bottom:4px;">GEO-LOCKED REWARD UNLOCKED</div>',
      '<div style="font-size:16px;font-weight:bold;margin-bottom:8px;">',
        escapeHtml(location.name), "</div>",
      '<div style="font-size:12px;color:#88cc88;line-height:1.6;margin-bottom:12px;">',
        escapeHtml(reward.message), "</div>",
      '<div style="display:flex;justify-content:center;gap:20px;margin-bottom:14px;font-size:12px;">',
        '<span>+', escapeHtml(reward.xp), ' XP</span>',
        '<span>+', escapeHtml(reward.caps), ' CAPS</span>',
      "</div>",
      '<div style="font-size:10px;opacity:0.5;margin-bottom:12px;font-style:italic;">',
        "This item cannot be obtained anywhere else.", "</div>",
      '<button id="gf-reward-close" style="background:#001a00;color:',
        tierColor, ';border:1px solid ', tierColor,
        ';padding:8px 20px;font-family:monospace;cursor:pointer;',
        'text-transform:uppercase;letter-spacing:1px;font-size:12px;">',
        "COLLECT</button>"
    ].join("");

    document.body.appendChild(card);
    document.getElementById("gf-reward-close").onclick = () => card.remove();

    // Auto-close after 30 seconds
    setTimeout(() => { if (card.parentNode) card.remove(); }, 30_000);
  }

  // ----------------------------------------------------------
  // Claim reward from server
  // ----------------------------------------------------------
  async function claimReward(location) {
    const sid = sessionId();
    if (!sid) {
      showToast("Sign in to claim this reward, wanderer.", "warn");
      return;
    }

    let playerLat, playerLng;
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      playerLat = pos.coords.latitude;
      playerLng = pos.coords.longitude;
    } catch {
      showToast("GPS unavailable — cannot verify location.", "warn");
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/geofence/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sid}`
        },
        body: JSON.stringify({
          locationId: location.id,
          lat: playerLat,
          lng: playerLng
        })
      });

      const data = await resp.json();

      if (!resp.ok) {
        if (resp.status === 409) {
          showToast("Already collected — this badge lives in your inventory.", "info");
          markLocalCollected(location.id);
        } else if (resp.status === 400 && data.distanceMeters) {
          showToast(
            `Too far — you're ${data.distanceMeters}m away, need to be within ${data.requiredMeters}m.`,
            "warn"
          );
        } else {
          showToast(data.error || "Claim failed.", "warn");
        }
        return;
      }

      markLocalCollected(location.id);
      showRewardCard(location, data.reward);

    } catch (err) {
      console.error("[geofence] claim error:", err);
      showToast("Signal lost — couldn't reach the server.", "warn");
    }
  }

  // ----------------------------------------------------------
  // Simple toast
  // ----------------------------------------------------------
  function showToast(msg, type) {
    const colors = { info: "#00ff41", warn: "#ffaa00", error: "#ff4444" };
    const color = colors[type] || "#00ff41";
    const t = document.createElement("div");
    t.style.cssText = [
      "position:fixed", "bottom:80px", "left:50%",
      "transform:translateX(-50%)", "background:rgba(0,20,10,0.95)",
      "border:1px solid " + color, "color:" + color,
      "font-family:monospace", "padding:10px 20px",
      "z-index:9999", "font-size:13px",
      "animation:gfCardIn 0.3s ease,gfCardOut 0.3s 2.7s ease forwards",
      "pointer-events:none", "max-width:340px", "text-align:center"
    ].join(";");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
  }

  // ----------------------------------------------------------
  // Inject CSS animations (once)
  // ----------------------------------------------------------
  function injectCSS() {
    if (document.getElementById("gf-styles")) return;
    const s = document.createElement("style");
    s.id = "gf-styles";
    s.textContent = `
      @keyframes gfCardIn  { from { opacity:0; transform:translate(-50%,-50%) scale(0.95) } to { opacity:1; transform:translate(-50%,-50%) scale(1) } }
      @keyframes gfCardOut { from { opacity:1 } to { opacity:0 } }
      #gf-prompt-card { animation: gfPromptIn 0.4s ease; }
      @keyframes gfPromptIn { from { opacity:0; transform:translateX(-50%) translateY(20px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
    `;
    document.head.appendChild(s);
  }

  // ----------------------------------------------------------
  // Main GPS check loop
  // ----------------------------------------------------------
  let _locations = [];   // populated from server
  let _checkTimer = null;

  async function loadLocations() {
    try {
      const resp = await fetch(`${API_BASE}/api/geofence/locations`);
      const data = await resp.json();
      if (data.ok && Array.isArray(data.locations)) {
        _locations = data.locations;
        console.log(`[geofence] Loaded ${_locations.length} geo-fence locations`);
      }
    } catch (e) {
      console.warn("[geofence] Could not load locations:", e.message);
    }
  }

  // In-memory throttle: after a "not close enough" response, don't retry that
  // location for PROXIMITY_RETRY_MS. This prevents N*30s server hammering for
  // every location the player is nowhere near.
  const PROXIMITY_RETRY_MS = 5 * 60 * 1000; // 5 minutes
  const _proximityRetryAt  = {};             // { locationId -> timestamp }

  function checkProximity(playerLat, playerLng) {
    if (!_locations.length) return;
    const collected = getLocalCollected();
    const now = Date.now();

    for (const loc of _locations) {
      // Skip already-collected or recently dismissed
      if (collected.includes(loc.id)) continue;
      if (isDismissed(loc.id)) continue;

      // Skip locations that recently returned "not close enough"
      if (_proximityRetryAt[loc.id] && now < _proximityRetryAt[loc.id]) continue;

      // The server does NOT expose exact coordinates (anti-spoofing). The client
      // sends its GPS position to the claim endpoint; the server computes the
      // haversine distance and rejects if the player is too far away.
      // Failed attempts are throttled by _proximityRetryAt to avoid spamming.
      trySilentCheck(loc, playerLat, playerLng);
    }
  }

  async function trySilentCheck(location, playerLat, playerLng) {
    const sid = sessionId();
    if (!sid) return; // not signed in, skip

    try {
      const resp = await fetch(`${API_BASE}/api/geofence/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sid}`
        },
        body: JSON.stringify({ locationId: location.id, lat: playerLat, lng: playerLng })
      });

      const data = await resp.json();

      if (resp.ok && data.ok) {
        // Claimed successfully — show reward card immediately
        markLocalCollected(location.id);
        showRewardCard(location, data.reward);
      } else if (resp.status === 409) {
        // Already claimed server-side — sync local cache
        markLocalCollected(location.id);
      } else if (resp.status === 400 && data.distanceMeters !== undefined) {
        // "Not close enough" — throttle retries for this location
        _proximityRetryAt[location.id] = Date.now() + PROXIMITY_RETRY_MS;
      }
      // Other errors (rate limit, server error) — silent, retry next tick
    } catch { /* network error — silent */ }
  }

  function startGPSLoop() {
    if (!navigator.geolocation) return;
    if (_checkTimer) return; // already running

    function doCheck() {
      navigator.geolocation.getCurrentPosition(
        pos => checkProximity(pos.coords.latitude, pos.coords.longitude),
        () => {}, // GPS denied — silent
        { timeout: 10_000, maximumAge: 20_000 }
      );
    }

    doCheck(); // immediate first check
    _checkTimer = setInterval(doCheck, CHECK_INTERVAL_MS);
  }

  // ----------------------------------------------------------
  // Collector panel renderer (for Pip-Boy UI integration)
  // ----------------------------------------------------------
  function renderCollectorPanel(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const collected = getLocalCollected();
    const total     = _locations.length;

    let html = '<div class="gf-panel">';
    html += `<div class="gf-header">// WASTELAND ARCHIVES — ${escapeHtml(collected.length)} / ${escapeHtml(total)} SITES VISITED //</div>`;
    html += '<div class="gf-subtitle">Geo-locked collector items. One per location. Cannot be traded or transferred.</div>';
    html += '<div class="gf-list">';

    for (const loc of _locations) {
      const isCollected = collected.includes(loc.id);
      const tierColor   = TIER_COLORS[loc.tier] || "#00ff41";
      const opacity     = isCollected ? "1" : "0.4";
      const icon        = isCollected ? "⚡" : "○";

      html += `<div class="gf-item" style="border-color:${tierColor};opacity:${opacity};">`;
      html += `<div class="gf-item-header">`;
      html += `<span class="gf-item-icon">${icon}</span>`;
      html += `<span class="gf-item-name">${escapeHtml(loc.name)}</span>`;
      html += `<span class="gf-item-tier" style="color:${tierColor};">${escapeHtml(loc.tier.toUpperCase())}</span>`;
      html += `</div>`;
      html += `<div class="gf-item-city">${escapeHtml(loc.city)}</div>`;
      if (isCollected) {
        html += `<div class="gf-item-collected">✓ BADGE COLLECTED</div>`;
      } else {
        html += `<div class="gf-item-lore">${escapeHtml(loc.falloutLore || "")}</div>`;
      }
      html += `</div>`;
    }

    html += "</div></div>";
    container.innerHTML = html;
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  const geofenceModule = {
    init() {
      injectCSS();
      loadLocations().then(() => startGPSLoop());
    },

    // Manually trigger a GPS check (e.g. when user opens the collector panel)
    checkNow() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        pos => checkProximity(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { timeout: 10_000, maximumAge: 5_000 }
      );
    },

    // Render the collector badge panel
    renderCollectorPanel,

    // How many sites the player has visited
    getCollectedCount() { return getLocalCollected().length; },
    getTotalCount()     { return _locations.length; },
    getCollected()      { return getLocalCollected(); },

    // Expose for boot.js / game integration
    locations: () => _locations
  };

  Game.modules.geofence = geofenceModule;

})();
