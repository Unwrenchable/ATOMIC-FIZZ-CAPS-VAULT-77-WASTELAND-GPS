// npc_traits.js (v2)
// ------------------------------------------------------------
// NPC Trait Engine
// Applies personality, behavior, anomaly effects, combat mods,
// loot influence, and encounter flavor.
// ------------------------------------------------------------

(function () {
  "use strict";

  const WorldState = window.overseerWorldState;
  const Weather = window.overseerWeather;
  const Regions = window.overseerRegions;

  // ------------------------------------------------------------
  // Trait definitions
  // ------------------------------------------------------------
  const TRAITS = {
    brave: {
      id: "brave",
      combat: { atk: +1, morale: +2 },
      flavor: "Stands their ground even when outnumbered."
    },
    cowardly: {
      id: "cowardly",
      combat: { atk: -1, morale: -2 },
      flavor: "Likely to flee when injured."
    },
    greedy: {
      id: "greedy",
      lootBias: +0.2,
      flavor: "Carries extra valuables scavenged from others."
    },
    elite: {
      id: "elite",
      combat: { atk: +2, def: +2, hp: +10 },
      lootBias: +0.3,
      flavor: "Highly trained and well‑equipped."
    },
    anomaly_touched: {
      id: "anomaly_touched",
      anomalyAffinity: +0.4,
      combat: { atk: +1, def: -1 },
      flavor: "Reality flickers around them."
    },
    glitch_scarred: {
      id: "glitch_scarred",
      anomalyAffinity: +0.2,
      flavor: "Temporal scars distort their movements."
    },
    drunk: {
      id: "drunk",
      combat: { atk: +1, def: -2 },
      flavor: "Stumbles unpredictably."
    },
    jittery: {
      id: "jittery",
      combat: { atk: -1, morale: -1 },
      flavor: "Nervous and twitchy."
    },
    storyteller: {
      id: "storyteller",
      dialog: true,
      flavor: "Knows rumors and secrets of the wasteland."
    },
    silent: {
      id: "silent",
      dialog: false,
      flavor: "Speaks only when necessary."
    }
  };

  const TRAIT_LIST = Object.values(TRAITS);

  // ------------------------------------------------------------
  // Random trait picker
  // ------------------------------------------------------------
  function pickRandomTraits(count = 1) {
    const traits = [];
    for (let i = 0; i < count; i++) {
      const t = TRAIT_LIST[Math.floor(Math.random() * TRAIT_LIST.length)];
      if (!traits.includes(t.id)) traits.push(t.id);
    }
    return traits;
  }

  // ------------------------------------------------------------
  // Apply traits to a single NPC
  // ------------------------------------------------------------
  function applyToNpc(npc, region, weather) {
    const traitIds = pickRandomTraits(Math.random() < 0.2 ? 2 : 1);
    npc.traits = traitIds;

    traitIds.forEach(id => {
      const t = TRAITS[id];
      if (!t) return;

      // Combat mods
      if (t.combat) {
        npc.atk = (npc.atk || 1) + (t.combat.atk || 0);
        npc.def = (npc.def || 1) + (t.combat.def || 0);
        npc.hp = (npc.hp || 10) + (t.combat.hp || 0);
        npc.morale = (npc.morale || 0) + (t.combat.morale || 0);
      }

      // Anomaly affinity
      if (t.anomalyAffinity && WorldState.getAnomalyLevel(region.id) > 0.3) {
        npc.atk += 1;
        npc.hp += 2;
      }

      // Weather influence
      if (weather.type === "rad_storm" && id === "anomaly_touched") {
        npc.hp += 3;
      }
    });

    return npc;
  }

  // ------------------------------------------------------------
  // Apply traits to a group of NPCs
  // ------------------------------------------------------------
  function applyToGroup(npcs, region, weather) {
    return npcs.map(npc => applyToNpc(npc, region, weather));
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  window.overseerNpcTraits = {
    applyToNpc,
    applyToGroup,
    pickRandomTraits
  };
})();
