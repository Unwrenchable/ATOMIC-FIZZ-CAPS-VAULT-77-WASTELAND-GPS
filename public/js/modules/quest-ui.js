// quest-ui.js — Pip-Boy QUESTS panel renderer

window.Game = window.Game || {};
Game.ui = Game.ui || {};

Game.ui.renderQuest = function () {
  const body = document.getElementById("questBody");
  if (!body) return;

  // Try to get quests from Game.modules.quests or Game.quests
  const questsModule = Game.modules?.quests || Game.quests;
  
  if (!questsModule || !questsModule.gs) {
    // Fallback to old rendering if quest module not initialized
    const q = Game.player && Game.player.activeQuest;
    if (!q || !Array.isArray(q.stages) || q.currentStage == null) {
      body.innerHTML = "<div>No active quest.</div>";
      return;
    }

    const stage = q.stages[q.currentStage];
    body.innerHTML = `
      <div class="quest-title">${q.name}</div>
      <div class="quest-stage">Stage ${q.currentStage + 1}</div>
      <div class="quest-objective">${stage.objective}</div>
    `;
    return;
  }

  // Render quests from the quests module
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
      ]
    },
    quest_vault77_open: {
      id: "quest_vault77_open",
      name: "Open Vault 77",
      type: "steps",
      description: "Find a way to unlock Vault 77."
    }
  };

  let html = "";
  let hasActiveQuests = false;

  // Check each quest's state
  Object.values(QUESTS_DB).forEach(q => {
    const st = questsModule.gs.quests?.[q.id];
    if (!st || st.state !== "active") return;

    hasActiveQuests = true;

    html += `<div class="quest-entry active">`;
    html += `<div class="quest-title">${q.name}</div>`;
    html += `<div class="quest-description">${q.description}</div>`;

    // Render objectives for objective-based quests
    if (q.type === "objectives" && q.objectives && q.order) {
      html += `<div class="quest-objectives">`;
      q.order.forEach(objId => {
        const obj = q.objectives[objId];
        const completed = st.objectives?.[objId] === true;
        const checkmark = completed ? "☑" : "☐";
        const completedClass = completed ? "completed" : "";
        html += `<div class="quest-objective ${completedClass}">${checkmark} ${obj.text}</div>`;
      });
      html += `</div>`;
    }

    html += `</div>`;
  });

  if (!hasActiveQuests) {
    body.innerHTML = "<div>No active quests.</div>";
  } else {
    body.innerHTML = html;
  }
};
