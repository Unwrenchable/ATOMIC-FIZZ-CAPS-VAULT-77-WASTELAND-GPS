// quests.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Unified Quest Module (Resurrected)
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const QUESTS_DB = {
    wake_up: {
      id: "wake_up",
      name: "Wake Up",
      type: "objectives",
      description: "You awaken in the wasteland. Something is wrong with this timeline.",
      objectives: {
        open_inventory: { text: "Open your inventory" },
        switch_tabs: { text: "Cycle through the Pip-Boy tabs" },
        pick_item: { text: "Pick up an item" },
        equip_item: { text: "Equip an item" },
        turn_on_radio: { text: "Tune into Atomic Fizz Radio" },
        open_map: { text: "Check your map" }
      },
      order: [
        "open_inventory",
        "switch_tabs",
        "pick_item",
        "equip_item",
        "turn_on_radio",
        "open_map"
      ],
      rewards: { xp: 50, caps: 10 }
    },
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
      rewards: {
        xp: 100,
        caps: 50,
        items: []
      }
    }
  };

  const questsModule = {
    gs: null,

    init(gameState) {
      this.gs = gameState || window.gameState || window.DATA || {};
      if (!this.gs.quests) this.gs.quests = {};
      if (!this.gs.player) this.gs.player = { xp: 0, caps: 0 };
    },

    ensureGameState() {
      if (!this.gs) {
        this.init();
      }
    },

    ensureQuestState(questId) {
      this.ensureGameState();
      if (!this.gs.quests[questId]) {
        this.gs.quests[questId] = { 
          state: "not_started", 
          currentStepIndex: 0,
          objectives: {}
        };
      }
      return this.gs.quests[questId];
    },

    startQuest(questId) {
      const q = QUESTS_DB[questId];
      if (!q) {
        console.warn("[quests] Unknown quest:", questId);
        return false;
      }

      const st = this.ensureQuestState(questId);
      if (st.state === "completed") return false;

      st.state = "active";
      st.currentStepIndex = 0;

      // Initialize objective states for objective-based quests
      if (q.type === "objectives" && q.objectives) {
        Object.keys(q.objectives).forEach(obj => {
          st.objectives[obj] = false;
        });
      }

      console.log("[quests] Quest started:", questId);
      return true;
    },

    // For objective-based quests (like wake_up)
    completeObjective(questId, objectiveId) {
      const q = QUESTS_DB[questId];
      if (!q || q.type !== "objectives") return false;

      const st = this.ensureQuestState(questId);
      if (st.state !== "active") return false;

      if (!(objectiveId in q.objectives)) {
        console.warn("[quests] Unknown objective:", objectiveId, "for quest:", questId);
        return false;
      }

      if (st.objectives[objectiveId]) return true; // already done

      st.objectives[objectiveId] = true;
      console.log("[quests] Objective complete:", questId, "→", objectiveId);

      // Check if all objectives are done
      const allDone = q.order.every(obj => st.objectives[obj]);
      if (allDone) {
        this.completeQuest(questId);
      }

      return true;
    },

    completeQuest(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);

      st.state = "completed";

      const r = q.rewards || {};
      if (this.gs.player) {
        this.gs.player.xp = (this.gs.player.xp || 0) + (r.xp || 0);
        this.gs.player.caps = (this.gs.player.caps || 0) + (r.caps || 0);
      }

      console.log("[quests] Quest completed:", questId);
    },

    getCurrentStep(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);

      if (!q || st.state !== "active") return null;
      if (q.type === "objectives") return null; // objectives don't have steps
      return q.steps ? q.steps[st.currentStepIndex] : null;
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
    },

    // Expose quest database for quest-ui.js
    QUESTS_DB: QUESTS_DB
  };

  Game.modules.quests = questsModule;
  
  // Also expose as Game.quests for compatibility with pipboy.js
  Game.quests = questsModule;
})();
