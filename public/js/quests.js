// quests.js
// Quest data + engine

(function () {
  const gs = window.gameState;

  const QUESTS_DB = {
    quest_vault77_open: {
      id: "quest_vault77_open",
      name: "Open Vault 77",
      description: "Find a way to unlock Vault 77.",
      steps: [
        {
          id: "find_keycard",
          description: "Find the Vault 77 keycard.",
          requires: { item: "vault77_keycard" },
        },
        {
          id: "go_to_vault",
          description: "Travel to the Vault 77 entrance.",
          requires: { location: "vault77" },
        },
      ],
      rewards: {
        xp: 100,
        caps: 50,
        items: [],
      },
    },
  };

  function ensureQuestState(questId) {
    if (!gs.quests[questId]) {
      gs.quests[questId] = { state: "not_started", currentStepIndex: 0 };
    }
    return gs.quests[questId];
  }

  function startQuest(questId) {
    const q = QUESTS_DB[questId];
    if (!q) return false;
    const st = ensureQuestState(questId);
    if (st.state === "completed") return false;
    st.state = "active";
    st.currentStepIndex = 0;
    return true;
  }

  function getCurrentStep(questId) {
    const q = QUESTS_DB[questId];
    const st = ensureQuestState(questId);
    if (!q || st.state !== "active") return null;
    return q.steps[st.currentStepIndex];
  }

  function checkStepCompletion(questId) {
    const q = QUESTS_DB[questId];
    const st = ensureQuestState(questId);
    if (!q || st.state !== "active") return false;

    const step = q.steps[st.currentStepIndex];
    if (!step) return false;

    const req = step.requires || {};

    if (req.item) {
      const hasItem = gs.inventory.questItems.some((i) => i.id === req.item) ||
        gs.inventory.consumables.some((i) => i.id === req.item) ||
        gs.inventory.weapons.some((i) => i.id === req.item) ||
        gs.inventory.ammo.some((i) => i.id === req.item);
      if (!hasItem) return false;
    }

    if (req.location) {
      const nearby = window.world.getNearbyPOIs(500);
      const atLoc = nearby.some((n) => n.poi.id === req.location);
      if (!atLoc) return false;
    }

    return true;
  }

  function advanceQuest(questId) {
    const q = QUESTS_DB[questId];
    const st = ensureQuestState(questId);
    if (!q || st.state !== "active") return false;

    if (!checkStepCompletion(questId)) return false;

    st.currentStepIndex += 1;
    if (st.currentStepIndex >= q.steps.length) {
      st.state = "completed";
      const r = q.rewards || {};
      gs.player.xp += r.xp || 0;
      gs.player.caps += r.caps || 0;
      (r.items || []).forEach((id) => {
        // similar item lookup as battle
      });
    }

    return true;
  }

  function triggerQuest(questId) {
    const st = ensureQuestState(questId);
    if (st.state === "not_started") {
      return startQuest(questId);
    }
    return false;
  }

  window.quests = {
    QUESTS_DB,
    triggerQuest,
    startQuest,
    advanceQuest,
    getCurrentStep,
    checkStepCompletion,
  };
})();
