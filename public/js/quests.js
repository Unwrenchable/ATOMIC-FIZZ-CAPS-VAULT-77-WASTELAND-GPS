// quests.js
// ------------------------------------------------------------
// Unified Quest Engine (Steps + Objectives + Scripted Events)
// ------------------------------------------------------------

(function () {
  const gs = window.gameState;

  // ------------------------------------------------------------
  // QUEST DATABASE
  // Supports both step-based and objective-based quests
  // ------------------------------------------------------------
  const QUESTS_DB = {
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

    // Wake Up quest (objectives)
    wake_up: {
      id: "wake_up",
      name: "Wake Up",
      type: "objectives",
      description: "You awaken in the wasteland. Something is wrong.",
      objectives: {
        open_inventory: { completed: false },
        switch_tabs: { completed: false },
        pick_item: { completed: false },
        equip_item: { completed: false },
        turn_on_radio: { completed: false },
        open_map: { completed: false },
        npc_arrives: { completed: false }
      },
      order: [
        "open_inventory",
        "switch_tabs",
        "pick_item",
        "equip_item",
        "turn_on_radio",
        "open_map",
        "npc_arrives"
      ],
      rewards: { xp: 50, caps: 10 }
    }
  };

  // ------------------------------------------------------------
  // INTERNAL HELPERS
  // ------------------------------------------------------------
  function ensureQuestState(questId) {
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
  // STEP-BASED QUESTS
  // ------------------------------------------------------------
  function getCurrentStep(questId) {
    const q = QUESTS_DB[questId];
    const st = ensureQuestState(questId);
    if (!q || q.type !== "steps" || st.state !== "active") return null;
    return q.steps[st.currentStepIndex];
  }

  function checkStepCompletion(questId) {
    const q = QUESTS_DB[questId];
    const st = ensureQuestState(questId);
    if (!q || q.type !== "steps" || st.state !== "active") return false;

    const step = q.steps[st.currentStepIndex];
    if (!step) return false;

    const req = step.requires || {};

    if (req.item) {
      const hasItem =
        gs.inventory.questItems.some(i => i.id === req.item) ||
        gs.inventory.consumables.some(i => i.id === req.item) ||
        gs.inventory.weapons.some(i => i.id === req.item) ||
        gs.inventory.ammo.some(i => i.id === req.item);
      if (!hasItem) return false;
    }

    if (req.location) {
      const nearby = window.world.getNearbyPOIs(500);
      const atLoc = nearby.some(n => n.poi.id === req.location);
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
  // OBJECTIVE-BASED QUESTS
  // ------------------------------------------------------------
  function completeObjective(questId, objectiveId) {
    const q = QUESTS_DB[questId];
    if (!q || q.type !== "objectives") return false;

    const st = ensureQuestState(questId);
    if (st.state !== "active") return false;

    if (!q.objectives[objectiveId]) {
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
    const q = QUESTS_DB[questId];
    const st = ensureQuestState(questId);

    st.state = "completed";

    const r = q.rewards || {};
    gs.player.xp += r.xp || 0;
    gs.player.caps += r.caps || 0;

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
