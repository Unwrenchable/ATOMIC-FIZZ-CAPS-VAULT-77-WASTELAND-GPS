// public/js/stat-panel.js
// Handles updating the STAT panel from Game state

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.ui) Game.ui = {};

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setBar(id, fraction) {
    const el = document.getElementById(id);
    if (!el) return;
    const clamped = Math.max(0, Math.min(1, fraction || 0));
    el.style.width = (clamped * 100).toFixed(0) + "%";
  }

  Game.ui.updateStatPanel = function () {
    const state = Game.player || {};
    const world = Game.worldState || {};
    const loc = world.currentLocation || {};
    const weather = world.currentWeather || {};

    const name = state.name || "WANDERER";
    const level = state.level || 1;
    const xp = state.xp || 0;
    const xpNext = state.xpNext || 100;

    const hp = state.hp || 100;
    const maxHp = state.maxHp || 100;
    const rad = state.rad || 0; // 0 - 100

    const wallet = state.walletAddress || null;
    const caps = state.caps || 0;

    const weapon = state.equippedWeaponName || "NONE";
    const armor = state.equippedArmorName || "NONE";

    const faction = state.faction || "UNALIGNED";
    const rep = state.repStatus || "NEUTRAL";

    const locationName = loc.name || "UNKNOWN";
    const weatherName = weather.type || "CLEAR";

    setText("stat-name", name);
    setText("stat-level", level);
    setText("stat-xp", `${xp} / ${xpNext}`);

    setText("stat-hp-label", `${hp} / ${maxHp}`);
    setBar("stat-hp-bar", maxHp > 0 ? hp / maxHp : 0);

    setText("stat-rad-label", `${rad}%`);
    setBar("stat-rad-bar", rad / 100);

    setText("stat-wallet", wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : "DISCONNECTED");
    setText("stat-caps", caps);

    setText("stat-weapon", weapon);
    setText("stat-armor", armor);

    setText("stat-faction", faction);
    setText("stat-rep", rep);
    setText("stat-location", locationName);
    setText("stat-weather", weatherName);
  };
})();
