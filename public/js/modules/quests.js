// quests.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Unified Quest Module (Resurrected)
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const QUESTS_DB = {
    quest_vault77_open: {
      id: "quest_vault77_open",
      name: "Open Vault 77",
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
      rewards: {
        xp: 100,
        caps: 50,
        items: []
      }
    }
  };

  const questsModule = {
    init(gameState) {
      this.gs = gameState;
      if (!this.gs.quests) this.gs.quests = {};
    },

    ensureQuestState(questId) {
      if (!this.gs.quests[questId]) {
        this.gs.quests[questId] = { state: "not_started", currentStepIndex: 0 };
      }
      return this.gs.quests[questId];
    },

    startQuest(questId) {
      const q = QUESTS_DB[questId];
      if (!q) return false;

      const st = this.ensureQuestState(questId);
      if (st.state === "completed") return false;

      st.state = "active";
      st.currentStepIndex = 0;

      return true;
    },

    getCurrentStep(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);

      if (!q || st.state !== "active") return null;
      return q.steps[st.currentStepIndex];
    },

    checkStepCompletion(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);
      if (!q || st.state !== "active") return false;

      const step = q.steps[st.currentStepIndex];
      if (!step) return false;

      const req = step.requires || {};

      // Item requirement
      if (req.item) {
        const inv = this.gs.inventory;
        const hasItem =
          inv.questItems.some(i => i.id === req.item) ||
          inv.consumables.some(i => i.id === req.item) ||
          inv.weapons.some(i => i.id === req.item) ||
          inv.ammo.some(i => i.id === req.item);

        if (!hasItem) return false;
      }

      // Location requirement
      if (req.location) {
        const nearby = Game.modules.worldmap.getNearbyPOIs(500);
        const atLoc = nearby.some(n => n.poi.id === req.location);
        if (!atLoc) return false;
      }

      return true;
    },

    advanceQuest(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);
      if (!q || st.state !== "active") return false;

      if (!this.checkStepCompletion(questId)) return false;

      st.currentStepIndex++;

      // Quest complete
      if (st.currentStepIndex >= q.steps.length) {
        st.state = "completed";

        const r = q.rewards || {};
        this.gs.player.xp += r.xp || 0;
        this.gs.player.caps += r.caps || 0;

        (r.items || []).forEach(id => {
          // TODO: item lookup + add to inventory
        });

        return true;
      }

      return true;
    },

    triggerQuest(questId) {
      const st = this.ensureQuestState(questId);
      if (st.state === "not_started") {
        return this.startQuest(questId);
      }
      return false;
    },

    // UI hook
    onOpen() {
      const container = document.getElementById("tab-quests");
      if (!container) return;

      container.innerHTML = "";

      Object.values(QUESTS_DB).forEach(q => {
        const st = this.ensureQuestState(q.id);

        const div = document.createElement("div");
        div.className = "quest-entry";

        div.innerHTML = `
          <h3>${q.name}</h3>
          <p>${q.description}</p>
          <p>Status: <strong>${st.state}</strong></p>
        `;

        if (st.state === "active") {
          const step = this.getCurrentStep(q.id);
          if (step) {
            div.innerHTML += `
              <p>Current Step: ${step.description}</p>
            `;
          }
        }

        container.appendChild(div);
      });
    }
  };

  Game.modules.quests = questsModule;
})();
