// quest-ui.js — Pip-Boy QUESTS panel renderer

window.Game = window.Game || {};
Game.ui = Game.ui || {};

Game.ui.renderQuest = function () {
  const body = document.getElementById("questBody");
  if (!body) return;

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
};
