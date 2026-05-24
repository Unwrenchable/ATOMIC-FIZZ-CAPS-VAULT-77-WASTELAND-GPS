// quests.js
// Quest data + engine (steps + objectives)

(function () {
  // Defer gs resolution to avoid capturing undefined at load time
  function getGs() {
    return window.gameState || {};
  }

  // ------------------------------------------------------------
  // QUEST DATABASE
  // ------------------------------------------------------------
  const QUESTS_DB = {
    // STEP-BASED QUEST (your original)
    quest_vault77_open: {
      id: "quest_vault77_open",
      name: "Open Vault 77",
      type: "steps",
      description: "Find a way to unlock Vault 77.",
      steps: [
        {
          id: "find_keycard",
          description: "Find the Vault 77 keycard.",
          requires: { item: "vault77_keycard" }
        },
        {
          id: "go_to_vault",
          description: "Travel to the Vault 77 entrance.",
          requires: { location: "vault77" }
        }
      ],
      rewards: { xp: 100, caps: 50, items: [] }
    },

    // OBJECTIVE-BASED QUEST (Wake Up)
    wake_up: {
      id: "wake_up",
      name: "Wake Up",
      type: "objectives",
      description: "You awaken in the wasteland wearing your jumpsuit. Get your bearings.",
      objectives: {
        open_inventory: { text: "Open your inventory" },
        equip_weapon: { text: "Equip your sidearm" },
        turn_on_radio: { text: "Tune into local radio" },
        open_map: { text: "Check your map" }
      },
      order: [
        "open_inventory",
        "equip_weapon",
        "turn_on_radio",
        "open_map"
      ],
      rewards: { xp: 50, caps: 25 }
    }
  };

  // ------------------------------------------------------------
  // INTERNAL HELPERS
  // ------------------------------------------------------------
  function ensureQuestState(questId) {
    const gs = getGs();
    if (!gs.quests) gs.quests = {};
    if (!gs.quests[questId]) {
      gs.quests[questId] = {
        state: "not_started",
        currentStepIndex: 0,
        objectives: {}
      };
    }
    return gs.quests[questId];
  }

  // ------------------------------------------------------------
  // START QUEST
  // ------------------------------------------------------------
  function startQuest(questId) {
    const q = QUESTS_DB[questId];
    if (!q) return false;

    const st = ensureQuestState(questId);
    if (st.state === "completed") return false;

    st.state = "active";
    st.currentStepIndex = 0;

    // Initialize objective states
    if (q.type === "objectives") {
      Object.keys(q.objectives).forEach(obj => {
        st.objectives[obj] = false;
      });
    }

    return true;
  }

  // ------------------------------------------------------------
  // STEP-BASED QUEST LOGIC
  // ------------------------------------------------------------
  function getCurrentStep(questId) {
    const q = QUESTS_DB[questId];
    const st = ensureQuestState(questId);
    if (!q || q.type !== "steps" || st.state !== "active") return null;
    return q.steps[st.currentStepIndex];
  }

  function checkStepCompletion(questId) {
    const gs = getGs();
    const q = QUESTS_DB[questId];
    const st = ensureQuestState(questId);
    if (!q || q.type !== "steps" || st.state !== "active") return false;

    const step = q.steps[st.currentStepIndex];
    if (!step) return false;

    const req = step.requires || {};

    // Item requirement
    if (req.item) {
      const inv = gs.inventory || {};
      const hasItem =
        (inv.questItems || []).some(i => i.id === req.item) ||
        (inv.consumables || []).some(i => i.id === req.item) ||
        (inv.weapons || []).some(i => i.id === req.item) ||
        (inv.ammo || []).some(i => i.id === req.item);

      if (!hasItem) return false;
    }

    // Location requirement — guard against missing world module
    if (req.location) {
      if (!window.world || typeof window.world.getNearbyPOIs !== "function") {
        console.warn("[Quests] window.world.getNearbyPOIs not available for location check");
        return false;
      }
      const nearby = window.world.getNearbyPOIs(500);
      const atLoc = nearby.some(n => n.poi && n.poi.id === req.location);
      if (!atLoc) return false;
    }

    return true;
  }

  function advanceQuest(questId) {
    const q = QUESTS_DB[questId];
    const st = ensureQuestState(questId);
    if (!q || q.type !== "steps" || st.state !== "active") return false;

    if (!checkStepCompletion(questId)) return false;

    st.currentStepIndex++;

    if (st.currentStepIndex >= q.steps.length) {
      completeQuest(questId);
    }

    return true;
  }

  // ------------------------------------------------------------
  // OBJECTIVE-BASED QUEST LOGIC
  // ------------------------------------------------------------
  function completeObjective(questId, objectiveId) {
    const q = QUESTS_DB[questId];
    if (!q || q.type !== "objectives") return false;

    const st = ensureQuestState(questId);
    if (st.state !== "active") return false;

    if (!(objectiveId in st.objectives)) {
      console.warn(`[Quests] Unknown objective: ${objectiveId}`);
      return false;
    }

    if (st.objectives[objectiveId]) return true; // already done

    st.objectives[objectiveId] = true;
    console.log(`[Quests] Objective complete: ${questId} → ${objectiveId}`);

    // Check if all objectives are done
    const allDone = q.order.every(obj => st.objectives[obj]);
    if (allDone) completeQuest(questId);

    return true;
  }

  // ------------------------------------------------------------
  // COMPLETE QUEST
  // ------------------------------------------------------------
  function completeQuest(questId) {
    const gs = getGs();
    const q = QUESTS_DB[questId];
    const st = ensureQuestState(questId);

    st.state = "completed";

    const r = q.rewards || {};
    if (!gs.player) gs.player = { xp: 0, caps: 0 };
    gs.player.xp = (gs.player.xp || 0) + (r.xp || 0);
    gs.player.caps = (gs.player.caps || 0) + (r.caps || 0);

    console.log(`[Quests] Quest completed: ${questId}`);
  }

  // ------------------------------------------------------------
  // TRIGGER QUEST
  // ------------------------------------------------------------
  function triggerQuest(questId) {
    const st = ensureQuestState(questId);
    if (st.state === "not_started") {
      return startQuest(questId);
    }
    return false;
  }

  // ------------------------------------------------------------
  // EXPORT
  // ------------------------------------------------------------
  window.quests = {
    QUESTS_DB,
    triggerQuest,
    startQuest,
    advanceQuest,
    getCurrentStep,
    checkStepCompletion,
    completeObjective
  };
})();
