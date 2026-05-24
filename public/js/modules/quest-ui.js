// quest-ui.js — Pocket-Boy QUESTS panel renderer

window.Game = window.Game || {};
Game.ui = Game.ui || {};

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = String(str == null ? "" : str);
  return d.innerHTML;
}

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
      <div class="quest-title">${escapeHtml(q.name)}</div>
      <div class="quest-stage">Stage ${q.currentStage + 1}</div>
      <div class="quest-objective">${escapeHtml(stage.objective)}</div>
    `;
    return;
  }

  // Get quest database from module if available
  const QUESTS_DB = questsModule.QUESTS_DB || {};

  let html = "";
  let hasContent = false;

  // ── AVAILABLE QUESTS (offered but not yet accepted) ──────────────
  const availableList = questsModule.getAvailableQuests ? questsModule.getAvailableQuests() : [];
  if (availableList.length > 0) {
    hasContent = true;
    html += `<div class="quest-section available-quests-section">`;
    html += `<div class="quest-section-header" style="color:#ffaa00; margin-bottom:8px;">📜 AVAILABLE QUESTS</div>`;
    availableList.forEach(q => {
      const escapedId = q.id.replace(/"/g, "&quot;");
      html += `<div class="quest-entry quest-available" style="border-color:#ffaa00; margin-bottom:10px;">`;
      html += `<div class="quest-title" style="color:#ffaa00;">${escapeHtml(q.name)}</div>`;
      html += `<div class="quest-description" style="font-size:12px; margin:4px 0;">${escapeHtml(q.offer?.message || q.description)}</div>`;
      html += `<div style="display:flex; gap:8px; margin-top:6px;">`;
      html += `<button class="pipboy-button-small quest-accept-btn" data-quest-id="${escapedId}" style="cursor:pointer;">ACCEPT</button>`;
      html += `<button class="pipboy-button-small quest-decline-btn" data-quest-id="${escapedId}" style="opacity:0.7; cursor:pointer;">DECLINE</button>`;
      html += `</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  // ── ACTIVE QUESTS ────────────────────────────────────────────────
  const activeQuestHtml = [];
  Object.values(QUESTS_DB).forEach(q => {
    const st = questsModule.gs.quests?.[q.id];
    if (!st || st.state !== "active") return;

    hasContent = true;

    let entry = `<div class="quest-entry active" style="margin-bottom:10px;">`;
    entry += `<div class="quest-title">${escapeHtml(q.name)}</div>`;
    entry += `<div class="quest-description">${escapeHtml(q.description)}</div>`;

    // Render objectives for objective-based quests
    if (q.type === "objectives" && q.objectives && q.order) {
      entry += `<div class="quest-objectives">`;
      q.order.forEach(objId => {
        const obj = q.objectives[objId];
        const completed = st.objectives?.[objId] === true;
        const checkmark = completed ? "☑" : "☐";
        const completedClass = completed ? "completed" : "";
        const objText = (obj && obj.text) ? obj.text : objId.replace(/_/g, " ");
        entry += `<div class="quest-objective ${completedClass}">${checkmark} ${escapeHtml(objText)}</div>`;
      });
      entry += `</div>`;
    }

    entry += `</div>`;
    activeQuestHtml.push(entry);
  });

  if (activeQuestHtml.length > 0) {
    html += `<div class="quest-section" style="margin-top:8px;">`;
    html += `<div class="quest-section-header" style="color:#39ff14; margin-bottom:8px;">⚡ ACTIVE QUESTS</div>`;
    html += activeQuestHtml.join("");
    html += `</div>`;
  }

  // ── COMPLETED QUESTS ─────────────────────────────────────────────
  const completedQuestHtml = [];
  Object.values(QUESTS_DB).forEach(q => {
    const st = questsModule.gs.quests?.[q.id];
    if (!st || st.state !== "completed") return;

    hasContent = true;

    let entry = `<div class="quest-entry completed" style="margin-bottom:6px; opacity:0.7;">`;
    entry += `<div class="quest-title" style="text-decoration:line-through;">`;
    entry += `☑ ${escapeHtml(q.name)}</div>`;
    entry += `</div>`;
    completedQuestHtml.push(entry);
  });

  if (completedQuestHtml.length > 0) {
    html += `<div class="quest-section" style="margin-top:12px;">`;
    html += `<div class="quest-section-header" style="color:#888; margin-bottom:6px;">☑ COMPLETED</div>`;
    html += completedQuestHtml.join("");
    html += `</div>`;
  }

  // ── QUEST KEY ITEMS the player currently holds ───────────────────
  const allItems = Game.modules?.PlayerState?.getInventory?.() || Game.player?.inventory || [];
  const questItems = allItems.filter(i => i.type === "quest" || i.type === "questItem");
  if (questItems.length > 0) {
    hasContent = true;
    html += `<div class="quest-section" style="margin-top:12px;">`;
    html += `<div class="quest-section-header" style="color:#7fd4f5; margin-bottom:6px;">🗝 QUEST KEY ITEMS</div>`;
    questItems.forEach(item => {
      const desc = item.description ? escapeHtml(item.description.slice(0, 60)) : ""; // 60 chars keeps the list readable
      html += `<div class="quest-objective" style="margin-bottom:4px;">`;
      html += `<span style="color:#a0e890;">▸ ${escapeHtml(item.name || item.id)}</span>`;
      if (desc) html += ` <span style="opacity:0.75; font-size:11px;">— ${desc}</span>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  if (!hasContent) {
    body.innerHTML = "<div>No active quests. Explore the wasteland to find new missions.</div>";
  } else {
    body.innerHTML = html;
  }

  // Attach accept/decline button handlers
  body.querySelectorAll(".quest-accept-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const questId = e.currentTarget.getAttribute("data-quest-id");
      if (questsModule.acceptQuest) {
        await questsModule.acceptQuest(questId);
      }
      Game.ui.renderQuest(); // refresh panel
    });
  });

  body.querySelectorAll(".quest-decline-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const questId = e.currentTarget.getAttribute("data-quest-id");
      if (questsModule.declineQuest) {
        questsModule.declineQuest(questId);
      }
      Game.ui.renderQuest(); // refresh panel
    });
  });
};

// Auto-refresh the quest panel whenever quest state changes (completed, offered, accepted).
// Guard with a flag so reloading the script never double-registers these listeners.
if (!window._questUiEventsRegistered) {
  window._questUiEventsRegistered = true;
  ["questCompleted", "questOffered", "questAccepted"].forEach(function(evtName) {
    window.addEventListener(evtName, function() {
      // Only re-render if the quest panel is currently visible
      const panel = document.getElementById("panel-quests");
      if (panel && panel.classList.contains("active")) {
        if (Game.ui?.renderQuest) Game.ui.renderQuest();
      }
    });
  });
}
