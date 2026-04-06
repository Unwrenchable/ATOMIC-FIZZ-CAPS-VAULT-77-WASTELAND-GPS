// loop.js (v1)
// ------------------------------------------------------------
// Core Game Loop
// Drives: region updates, weather, encounters, anomalies,
// timeline, Overseer reactions, and world ticks.
// ------------------------------------------------------------

(function () {
  "use strict";

  const WorldState = window.overseerWorldState;
  const Weather = window.overseerWeather;
  const Encounters = window.overseerEncounters;
  const Regions = window.overseerRegions;
  const _Timeline = window.overseerTimeline;
  const _Anomalies = window.overseerAnomalies;

  // ------------------------------------------------------------
  // CONFIG
  // ------------------------------------------------------------
  const TICK_INTERVAL = 5000; // 5 seconds per world tick
  // BUG-037 FIX: Reduced from 0.55 (55% — testing/high-visibility value) to 0.07
  // (7% per tick) for a production-appropriate encounter rate of ~1 per 71 seconds.
  // At 0.55 players were in back-to-back combat every ~9 seconds, making normal
  // GPS exploration, trading, and quest work impossible.
  const ENCOUNTER_CHANCE = 0.07; // 7% per tick ≈ 1 encounter per ~71 seconds
  const ENCOUNTER_COOLDOWN_MS = 20000; // 20 s cooldown between same-key encounters

  // _dynamicEncounterChance can be overridden at runtime by admin tools
  // (e.g. overseerGameLoop.setEncounterChance(0.9) from the admin dashboard).
  // When null the constant ENCOUNTER_CHANCE is used.
  let _dynamicEncounterChance = null;

  let lastRegion = null;
  let lastEncounterKey = null;
  let lastEncounterAt = 0;

  // ------------------------------------------------------------
  // Region Change Handler
  // ------------------------------------------------------------
  function handleRegionChange() {
    // Guard: ensure WorldState and Regions are available with required methods
    if (!WorldState || typeof WorldState.getRegion !== "function") {
      return;
    }
    if (!Regions || typeof Regions.get !== "function") {
      return;
    }

    const regionId = WorldState.getRegion();
    if (regionId !== lastRegion) {
      lastRegion = regionId;

      const region = Regions.get(regionId);

      // Weather reacts to region (guard: Weather may not be available)
      if (Weather && typeof Weather.updateWeather === "function") {
        Weather.updateWeather(region);
      }

      // Overseer reacts to region change
      if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
        window.overseer.handleGameEvent({
          type: "location",
          payload: { regionId }
        });
      }
    }
  }

  function getEncounterKey(encounter) {
    if (!encounter || !encounter.type) return null;
    const id =
      encounter.id ||
      encounter.quest?.id ||
      encounter.event?.id ||
      encounter.npc?.id ||
      encounter.merchant?.id;
    return id ? `${encounter.type}:${id}` : encounter.type;
  }

  // ------------------------------------------------------------
  // Secure RNG helper
  // BUG FIX: replaced all Math.random() calls with crypto.getRandomValues()
  // per coding standards ("No Math.random()"). Math.random() is a pseudo-RNG
  // that is not cryptographically secure and can be predictable in some
  // JavaScript engine implementations; crypto.getRandomValues() uses the
  // browser's CSPRNG, making tick rolls unguessable by external observers.
  // ------------------------------------------------------------
  const _rngBuf = new Uint32Array(1); // reused buffer — avoids per-call allocation
  function _secureRandom() {
    crypto.getRandomValues(_rngBuf);
    return _rngBuf[0] / 0x100000000; // float in [0, 1)
  }

  // ------------------------------------------------------------
  // World Tick
  // ------------------------------------------------------------
  function worldTick() {
    // 5. Random encounter is attempted on EVERY tick regardless of world modules.
    // This is the FIRST thing we do so that test/offline mode (where WorldState
    // is null) still gets encounters.
    _tickEncounters();

    // Guard: remaining simulation steps require WorldState + Regions.
    if (!WorldState || typeof WorldState.getRegion !== "function") {
      return;
    }

    const regionId = WorldState.getRegion();

    if (!Regions || typeof Regions.get !== "function") {
      return;
    }

    const region = Regions.get(regionId);

    // 1. Region change detection
    handleRegionChange();

    // 2. Weather update (guard: Weather may not be available)
    // Note: tick() is preferred if available, otherwise fall back to updateWeather()
    if (Weather) {
      if (typeof Weather.tick === "function") {
        Weather.tick(region);
      } else if (typeof Weather.updateWeather === "function") {
        Weather.updateWeather(region);
      }
    }

    // 3. Timeline instability tick (guard: methods may not exist)
    const hasInstabilityMethods =
      typeof WorldState.getGlobalInstability === "function" &&
      typeof WorldState.setGlobalInstability === "function";
    if (hasInstabilityMethods && _secureRandom() < 0.05) {
      const instability = WorldState.getGlobalInstability() + 0.01;
      WorldState.setGlobalInstability(instability);
    }

    // 4. Anomaly drift (guard: methods may not exist)
    const hasAnomalyMethods =
      typeof WorldState.getAnomalyLevel === "function" &&
      typeof WorldState.setAnomalyLevel === "function";
    if (hasAnomalyMethods) {
      const anomaly = WorldState.getAnomalyLevel(regionId);
      if (_secureRandom() < 0.1) {
        const drift = Math.max(0, Math.min(1, anomaly + (_secureRandom() * 0.1 - 0.05)));
        WorldState.setAnomalyLevel(regionId, drift);
      }
    }
  }

  // ------------------------------------------------------------
  // Encounter tick — runs every world tick regardless of world modules
  // ------------------------------------------------------------
  function _tickEncounters() {
    const activeChance = _dynamicEncounterChance !== null ? _dynamicEncounterChance : ENCOUNTER_CHANCE;
    const canRollEncounter = Encounters && typeof Encounters.rollEncounter === "function";

    if (canRollEncounter && _secureRandom() < activeChance) {
      const encounter = Encounters.rollEncounter();
      const key = getEncounterKey(encounter);
      const now = Date.now();

      if (key && key === lastEncounterKey && now - lastEncounterAt < ENCOUNTER_COOLDOWN_MS) {
        return;
      }

      if (key) {
        lastEncounterKey = key;
        lastEncounterAt = now;
      }
      handleEncounter(encounter);
    } else if (!canRollEncounter && _secureRandom() < activeChance) {
      // Test-mode fallback: world modules not loaded yet — use the legacy encounters.js
      // module if available, or synthesise a simple combat encounter directly.
      const legacy = window.encounters;
      if (legacy && typeof legacy.maybeTriggerEncounter === "function") {
        const enc = legacy.maybeTriggerEncounter();
        if (enc) handleEncounter({ type: "combat", enemies: enc.enemies || [], loot: enc.rewards || {} });
      } else {
        // Absolute fallback — produce a hard-coded wasteland mugger so the
        // battle system can be tested even with zero other modules loaded.
        const fallbackNow = Date.now();
        if (fallbackNow - lastEncounterAt >= ENCOUNTER_COOLDOWN_MS) {
          lastEncounterAt = fallbackNow;
          handleEncounter({
            type: "combat",
            enemies: [{ id: "raider", name: "Wasteland Raider", hp: 30, damage: 8 }],
            loot: { caps: 15, xp: 20 }
          });
        }
      }
    }
  }

  // ------------------------------------------------------------
  // Encounter Handler
  // ------------------------------------------------------------
  function handleEncounter(encounter) {
    if (!encounter) return;
    if (encounter.type === "none") return;

    // 1. Push to encounter feed (#encounterFeed)
    _pushEncounterFeed(encounter);

    // 2. Notify Overseer
    if (window.overseer && typeof window.overseer.handleGameEvent === "function") {
      window.overseer.handleGameEvent({
        type: "encounter",
        payload: { encounterType: encounter.type }
      });
    }

    // 3. Push to UI event bus (if present)
    if (window.gameUI && typeof window.gameUI.pushEncounter === "function") {
      window.gameUI.pushEncounter(encounter);
    }

    // 4. For combat encounters, start the battle module and switch to the COMBAT tab
    if (encounter.type === "combat" && Array.isArray(encounter.enemies) && encounter.enemies.length > 0) {
      const battleModule = window.Game && window.Game.modules && window.Game.modules.battle;
      if (battleModule && typeof battleModule.start === "function") {
        // Normalise enemy objects for the battle module
        const enemies = encounter.enemies.map(function (e) {
          return {
            id:     e.id   || "enemy",
            name:   e.name || (e.id ? String(e.id).replace(/_/g, " ") : "Wasteland Enemy"),
            hp:     typeof e.hp === "number"     ? e.hp     : 30,
            damage: typeof e.damage === "number" ? e.damage : (typeof e.attack === "number" ? e.attack : 8)
          };
        });
        battleModule.start({
          id:      "world_enc_" + Date.now(),
          name:    encounter.modifier || "Wasteland Encounter",
          enemies: enemies,
          rewards: encounter.loot || {}
        });

        // Switch Pip-Boy to the COMBAT panel so the player sees the battle UI
        if (window.Game && typeof window.Game.pipboy?.setActivePanel === 'function') {
          window.Game.pipboy.setActivePanel('battle');
        }
      }
    }
  }

  // ------------------------------------------------------------
  // Encounter Feed Helper — appends a short toast to #encounterFeed
  // ------------------------------------------------------------
  function _pushEncounterFeed(encounter) {
    var feed = document.getElementById("encounterFeed");
    if (!feed) return;
    var label = "";
    switch (encounter.type) {
      case "combat":      label = "☢ HOSTILES DETECTED!"; break;
      case "ambient":     label = "📡 " + (encounter.description || "Wasteland activity nearby."); break;
      case "merchant":    label = "🛒 Merchant caravan spotted."; break;
      case "traveler":    label = "👤 A traveler approaches."; break;
      case "microquest":  label = "📋 New wasteland job available."; break;
      case "ally_patrol": label = "🤝 Friendly patrol passes."; break;
      default:            label = "⚡ " + encounter.type;
    }
    var toast = document.createElement("div");
    toast.className = "pip-feed-item";
    toast.textContent = label;
    feed.prepend(toast);
    // Keep feed short — remove old items beyond 5
    while (feed.children.length > 5) {
      feed.removeChild(feed.lastChild);
    }
    // Fade out after 6 s
    setTimeout(function () { toast.classList.add("faded"); }, 6000);
  }

  // ------------------------------------------------------------
  // Start Loop
  // ------------------------------------------------------------
  function start() {
    setInterval(worldTick, TICK_INTERVAL);
  }

  // Expose globally
  window.overseerGameLoop = {
    start,
    setEncounterChance(rate) {
      // Allow admin tools and test harnesses to override the encounter chance
      // at runtime without a page reload.  Rate should be a float in [0, 1].
      if (typeof rate === "number" && rate >= 0 && rate <= 1) {
        _dynamicEncounterChance = rate;
      }
    }
  };
})();
