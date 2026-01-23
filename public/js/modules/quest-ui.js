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

  // Get quest database from module if available
  const QUESTS_DB = questsModule.QUESTS_DB || {};

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
