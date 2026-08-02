// public/js/modules/camp.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Camp / Settlement Module
// Sets up and manages the player's wasteland camp.
// Exposes: Game.modules.camp
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!window.Game.modules) window.Game.modules = {};

  // ----------------------------------------------------------
  // Constants
  // ----------------------------------------------------------
  const LS_KEY          = "afc_camp_data";
  const _REST_COOLDOWN_MS = 6 * 3600 * 1000; // 6 hours in ms
  const REST_RADIUS_M   = 500;

  // ----------------------------------------------------------
  // XSS-safe HTML escaper
  // ----------------------------------------------------------
  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

  // ----------------------------------------------------------
  // Toast notification (self-contained)
  // ----------------------------------------------------------
  function showCampToast(msg, type) {
    type = type || "info";
    const t = document.createElement("div");
    t.style.cssText = [
      "position:fixed",
      "bottom:80px",
      "left:50%",
      "transform:translateX(-50%)",
      "background:rgba(0,20,10,0.95)",
      "border:1px solid #00ff41",
      "color:#00ff41",
      "font-family:monospace",
      "padding:10px 20px",
      "z-index:9999",
      "font-size:13px",
      "animation:campFade 3s forwards",
      "pointer-events:none",
    ].join(";");
    if (type === "error") {
      t.style.borderColor = "#ff4444";
      t.style.color = "#ff4444";
    }
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 3000);
  }

  // ----------------------------------------------------------
  // Haversine distance (metres)
  // ----------------------------------------------------------
  function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ----------------------------------------------------------
  // Auth header helper
  // ----------------------------------------------------------
  function authHeaders() {
    const sessionId = localStorage.getItem("sessionId") || "";
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + sessionId,
    };
  }

  // ----------------------------------------------------------
  // API base (mirrors api-client.js convention)
  // ----------------------------------------------------------
  function apiBase() {
    return (window.API_BASE || window.BACKEND_URL || "").replace(/\/+$/, "");
  }

  // ----------------------------------------------------------
  // Countdown string (e.g. "5h 23m")
  // ----------------------------------------------------------
  function formatCountdown(targetIso) {
    const ms = new Date(targetIso).getTime() - Date.now();
    if (ms <= 0) return "Ready";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) return h + "h " + m + "m";
    return m + "m " + (totalSec % 60) + "s";
  }

  // ----------------------------------------------------------
  // Module
  // ----------------------------------------------------------
  var campModule = {
    gs: null,
    _campData: null,   // { wallet, lat, lng, name, createdAt, buffs }
    _nextRestAt: null, // ISO string from last rest response

    // --------------------------------------------------------
    // init — load persisted camp from localStorage
    // --------------------------------------------------------
    init: function (gameState) {
      this.gs = gameState;
      try {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) {
          this._campData = JSON.parse(raw);
        }
      } catch (_) {
        this._campData = null;
      }
    },

    // --------------------------------------------------------
    // setupCamp — geolocate then POST /api/camp/set
    // --------------------------------------------------------
    setupCamp: function (name) {
      var self = this;
      if (!navigator.geolocation) {
        showCampToast("Geolocation not available on this device.", "error");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          fetch(apiBase() + "/api/camp/set", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ lat: lat, lng: lng, name: name || "" }),
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data.ok) {
                self._campData = data.camp;
                try {
                  localStorage.setItem(LS_KEY, JSON.stringify(data.camp));
                } catch (_) {}
                showCampToast("⛺ Camp established: " + escapeHtml(data.camp.name));
              } else {
                showCampToast("Failed to set camp: " + (data.error || "Unknown error"), "error");
              }
            })
            .catch(function (err) {
              console.error("[camp] setupCamp error:", err);
              showCampToast("Network error setting up camp.", "error");
            });
        },
        function (err) {
          console.error("[camp] geolocation error:", err);
          showCampToast("Could not get your location. Check GPS permissions.", "error");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    },

    // --------------------------------------------------------
    // breakCamp — DELETE /api/camp/break
    // --------------------------------------------------------
    breakCamp: function () {
      var self = this;
      fetch(apiBase() + "/api/camp/break", {
        method: "DELETE",
        headers: authHeaders(),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.ok) {
            self._campData = null;
            self._nextRestAt = null;
            try {
              localStorage.removeItem(LS_KEY);
            } catch (_) {}
            showCampToast("Camp dismantled. Carry on, Wastelander.");
          } else {
            showCampToast("Failed to break camp: " + (data.error || "Unknown error"), "error");
          }
        })
        .catch(function (err) {
          console.error("[camp] breakCamp error:", err);
          showCampToast("Network error breaking camp.", "error");
        });
    },

    // --------------------------------------------------------
    // collectRest — geolocate then POST /api/camp/rest
    //   The backend now awards XP and caps server-side. The
    //   response includes xpBonus and capsBonus for display only.
    // --------------------------------------------------------
    collectRest: function () {
      var self = this;
      if (!navigator.geolocation) {
        showCampToast("Geolocation not available on this device.", "error");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          fetch(apiBase() + "/api/camp/rest", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ lat: lat, lng: lng }),
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data.ok) {
                self._nextRestAt = data.nextRestAt;
                // XP and caps were awarded server-side; show what was awarded
                var xpMsg = data.xpBonus > 0 ? " +" + data.xpBonus + " XP" : "";
                var capsMsg = data.capsBonus > 0 ? " +" + data.capsBonus + " Caps" : "";
                showCampToast(
                  "⛺ Rested!" + xpMsg + capsMsg + ". Next rest: " +
                    formatCountdown(data.nextRestAt)
                );
              } else if (data.nextRestAt) {
                showCampToast(
                  "Already rested. Next rest in: " + formatCountdown(data.nextRestAt),
                  "error"
                );
              } else {
                showCampToast(
                  "Could not rest: " + (data.error || "Unknown error"),
                  "error"
                );
              }
            })
            .catch(function (err) {
              console.error("[camp] collectRest error:", err);
              showCampToast("Network error collecting rest bonus.", "error");
            });
        },
        function (err) {
          console.error("[camp] geolocation error:", err);
          showCampToast("Could not get your location. Check GPS permissions.", "error");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    },

    // --------------------------------------------------------
    // getActiveCamp — returns camp object or null
    // --------------------------------------------------------
    getActiveCamp: function () {
      return this._campData || null;
    },

    // --------------------------------------------------------
    // getCampBuffs — returns buff object or null if no camp
    // --------------------------------------------------------
    getCampBuffs: function () {
      if (!this._campData) return null;
      return this._campData.buffs || null;
    },

    // --------------------------------------------------------
    // isNearCamp — haversine check against stored camp coords
    // --------------------------------------------------------
    isNearCamp: function (lat, lng, radiusMeters) {
      if (radiusMeters === undefined) radiusMeters = REST_RADIUS_M;
      if (!this._campData) return false;
      var dist = haversineMeters(lat, lng, this._campData.lat, this._campData.lng);
      return dist <= radiusMeters;
    },

    // --------------------------------------------------------
    // renderCampUI — render camp panel into containerId
    // --------------------------------------------------------
    renderCampUI: function (containerId) {
      var container = document.getElementById(containerId);
      if (!container) {
        console.warn("[camp] renderCampUI: container not found:", containerId);
        return;
      }

      var self = this;
      var camp = this._campData;

      if (!camp) {
        // ---- No active camp: show setup form ----
        container.innerHTML =
          '<div class="camp-panel">' +
            '<div style="margin-bottom:10px;color:#00ff41;">NO ACTIVE CAMP</div>' +
            '<div class="camp-setup">' +
              '<input class="camp-name-input" id="camp-name-input" type="text" ' +
                'maxlength="40" placeholder="Camp name (optional)" />' +
              '<button class="camp-btn" id="camp-set-btn">⛺ SET UP CAMP</button>' +
            "</div>" +
          "</div>";

        var setBtn = document.getElementById("camp-set-btn");
        if (setBtn) {
          setBtn.addEventListener("click", function () {
            var nameEl = document.getElementById("camp-name-input");
            var name = nameEl ? nameEl.value.trim() : "";
            self.setupCamp(name);
            setTimeout(function () { self.renderCampUI(containerId); }, 3500);
          });
        }
      } else {
        // ---- Active camp: show info panel ----
        var buffs = camp.buffs || {};
        var buffLines = "";
        if (buffs.encounterReduction) {
          buffLines +=
            '<div class="camp-buff-item">-' +
            Math.round(buffs.encounterReduction * 100) +
            "% Enemy Encounters</div>";
        }
        if (buffs.craftingBonus) {
          buffLines +=
            '<div class="camp-buff-item">+' +
            Math.round(buffs.craftingBonus * 100) +
            "% Crafting Success</div>";
        }
        if (buffs.restBonus) {
          buffLines +=
            '<div class="camp-buff-item">+' +
            escapeHtml(buffs.restBonus) +
            " Caps per rest</div>";
        }

        var restCooldownHtml = "";
        if (self._nextRestAt && new Date(self._nextRestAt).getTime() > Date.now()) {
          restCooldownHtml =
            '<div class="camp-cooldown">⏳ Next rest in: ' +
            escapeHtml(formatCountdown(self._nextRestAt)) +
            "</div>";
        }

        container.innerHTML =
          '<div class="camp-panel">' +
            '<div class="camp-active">' +
              '<div style="font-size:14px;color:#00ff41;margin-bottom:6px;">⛺ ' +
              escapeHtml(camp.name) +
              "</div>" +
              '<div class="camp-coords">LAT: ' +
              escapeHtml(camp.lat.toFixed(5)) +
              " | LNG: " +
              escapeHtml(camp.lng.toFixed(5)) +
              "</div>" +
              '<div class="camp-buffs">' +
                '<div style="margin-bottom:4px;text-decoration:underline;">ACTIVE BUFFS:</div>' +
                buffLines +
              "</div>" +
              restCooldownHtml +
              '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">' +
                '<button class="camp-btn" id="camp-rest-btn">💤 COLLECT REST BONUS</button>' +
                '<button class="camp-btn danger" id="camp-break-btn">🔥 BREAK CAMP</button>' +
              "</div>" +
            "</div>" +
          "</div>";

        var restBtn = document.getElementById("camp-rest-btn");
        if (restBtn) {
          // Disable button if on cooldown
          if (
            self._nextRestAt &&
            new Date(self._nextRestAt).getTime() > Date.now()
          ) {
            restBtn.disabled = true;
            restBtn.style.opacity = "0.5";
            restBtn.style.cursor = "not-allowed";
          }
          restBtn.addEventListener("click", function () {
            self.collectRest();
            setTimeout(function () { self.renderCampUI(containerId); }, 3500);
          });
        }

        var breakBtn = document.getElementById("camp-break-btn");
        if (breakBtn) {
          breakBtn.addEventListener("click", function () {
            if (confirm("Break down your camp? This cannot be undone.")) {
              self.breakCamp();
              setTimeout(function () { self.renderCampUI(containerId); }, 1500);
            }
          });
        }
      }
    },
  };

  // ----------------------------------------------------------
  // Register module
  // ----------------------------------------------------------
  window.Game.modules.camp = campModule;
})();
