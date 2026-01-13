// public/js/modules/narrative.js
(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Simple global-ish state for flags + stats
  // Stats can be synced from your existing player/state systems.
  if (!window.GAME_STATE) window.GAME_STATE = {};
  const STATE = window.GAME_STATE;

  STATE.flags = STATE.flags || {};
  STATE.stats = STATE.stats || {
    hp: 100,
    rads: 0
  };

  const narrative = {
    dialogs: {},          // dialogId -> dialog JSON
    loadingDialogs: {},   // dialogId -> Promise
    currentDialogId: null,
    lastPanelId: null,

    init() {
      // Wire dialog close button
      document.addEventListener("DOMContentLoaded", () => {
        const closeBtn = document.getElementById("dialogCloseBtn");
        if (closeBtn) {
          closeBtn.addEventListener("click", (e) => {
            e.preventDefault();
            this.closeDialog();
          });
        }
      });
    },

    // Public API: open dialog for an NPC id, e.g. "rex", "mother", "jax"
    openForNpc(npcId) {
      const dialogId = this.resolveDialogIdFromNpc(npcId);
      this.openByDialogId(dialogId);
    },

    // Public API: open dialog directly by dialog id, e.g. "dialog_rex"
    openByDialogId(dialogId) {
      // Fire-and-forget async
      this._openByDialogIdAsync(dialogId);
    },

    async _openByDialogIdAsync(dialogId) {
      if (!dialogId) return;

      const dialog = await this.ensureDialogLoaded(dialogId);
      if (!dialog) {
        console.warn("narrative: no dialog found for", dialogId);
        return;
      }

      this.currentDialogId = dialogId;
      this.showDialogPanel();
      this.renderCurrentBestNode();
    },

    resolveDialogIdFromNpc(npcId) {
      if (!npcId) return null;

      // If they pass "dialog_rex" already, use it as-is
      if (npcId.startsWith("dialog_")) return npcId;

      // Default: assume "rex" -> "dialog_rex"
      return "dialog_" + npcId.toLowerCase();
    },

    async ensureDialogLoaded(dialogId) {
      if (this.dialogs[dialogId]) return this.dialogs[dialogId];
      if (this.loadingDialogs[dialogId]) return this.loadingDialogs[dialogId];

      // Load from /data/dialog_<id>.json
      const url = "/data/" + dialogId + ".json";

      const p = fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then((json) => {
          this.dialogs[dialogId] = json;
          return json;
        })
        .catch((err) => {
          console.error("narrative: failed to load dialog", dialogId, err);
          return null;
        })
        .finally(() => {
          delete this.loadingDialogs[dialogId];
        });

      this.loadingDialogs[dialogId] = p;
      return p;
    },

    // Main brain: pick which node should speak right now
    renderCurrentBestNode() {
      const dialogId = this.currentDialogId;
      if (!dialogId) return;

      const dialog = this.dialogs[dialogId];
      if (!dialog) return;

      const node = this.pickBestNode(dialog);

      if (!node) {
        console.warn("narrative: no valid node found, using fallback");
        this.renderNode(dialog.fallback || {
          id: "fallback",
          text: "..."
        }, dialog);
        return;
      }

      // Apply flags
      if (Array.isArray(node.set_flags)) {
        node.set_flags.forEach((flag) => {
          if (flag && typeof flag === "string") {
            STATE.flags[flag] = true;
          }
        });
      }

      // Offer quest if present
      if (node.offers_quest && Game.modules && Game.modules.main && typeof Game.modules.main.activateQuest === "function") {
        try {
          Game.modules.main.activateQuest(node.offers_quest);
        } catch (e) {
          console.error("narrative: failed to activate quest", node.offers_quest, e);
        }
      }

      this.renderNode(node, dialog);
    },

    pickBestNode(dialog) {
      // Priority order:
      // 1) intro
      // 2) quest_nodes
      // 3) emotional_nodes
      // 4) knowledge_nodes
      // 5) fallback
      const ctx = {
        flags: STATE.flags,
        stats: STATE.stats
      };

      // Intro
      if (dialog.intro && this.checkConditions(dialog.intro.conditions, ctx)) {
        return dialog.intro;
      }

      // Quest nodes
      const questNodes = Array.isArray(dialog.quest_nodes) ? dialog.quest_nodes : [];
      for (const node of questNodes) {
        if (this.checkConditions(node.conditions, ctx)) {
          return node;
        }
      }

      // Emotional nodes
      const emotionalNodes = Array.isArray(dialog.emotional_nodes) ? dialog.emotional_nodes : [];
      for (const node of emotionalNodes) {
        if (this.checkConditions(node.conditions, ctx)) {
          return node;
        }
      }

      // Knowledge nodes
      const knowledgeNodes = Array.isArray(dialog.knowledge_nodes) ? dialog.knowledge_nodes : [];
      for (const node of knowledgeNodes) {
        if (this.checkConditions(node.conditions, ctx)) {
          return node;
        }
      }

      // Fallback
      if (dialog.fallback) return dialog.fallback;

      return null;
    },

    checkConditions(conditions, ctx) {
      if (!conditions || !conditions.length) return true;

      for (const cond of conditions) {
        if (!this.checkSingleCondition(cond, ctx)) {
          return false;
        }
      }
      return true;
    },

    checkSingleCondition(cond, ctx) {
      if (!cond || typeof cond !== "string") return true;

      // Flags
      if (cond.startsWith("flag:")) {
        const flagName = cond.slice("flag:".length);
        return !!ctx.flags[flagName];
      }

      if (cond.startsWith("!flag:")) {
        const flagName = cond.slice("!flag:".length);
        return !ctx.flags[flagName];
      }

      // Stats: e.g. "stat:hp<=30", "stat:rads>=200"
      if (cond.startsWith("stat:")) {
        const expr = cond.slice("stat:".length); // e.g. "hp<=30"
        return this.evaluateStatExpression(expr, ctx.stats);
      }

      // Unknown condition types are treated as true (non-blocking)
      return true;
    },

    evaluateStatExpression(expr, stats) {
      // Very small parser for patterns like "hp<=30", "rads>=200"
      // Supported operators: <=, >=, <, >, ==, !=
      const ops = ["<=", ">=", "==", "!=", "<", ">"];

      let opFound = null;
      for (const op of ops) {
        const idx = expr.indexOf(op);
        if (idx !== -1) {
          opFound = op;
          break;
        }
      }

      if (!opFound) return true;

      const [left, right] = expr.split(opFound);
      const statKey = left.trim();
      const targetVal = Number(right.trim());

      const currentVal = Number(stats[statKey] ?? 0);

      switch (opFound) {
        case "<=": return currentVal <= targetVal;
        case ">=": return currentVal >= targetVal;
        case "<": return currentVal < targetVal;
        case ">": return currentVal > targetVal;
        case "==": return currentVal === targetVal;
        case "!=": return currentVal !== targetVal;
        default: return true;
      }
    },

    renderNode(node, dialog) {
      const panel = document.getElementById("dialogBody");
      if (!panel) {
        console.warn("narrative: #dialogBody not found");
        return;
      }

      const npcName = dialog.npc || dialog.title || dialog.id || "Unknown";

      const html = `
        <div class="dialog-header-row">
          <span class="dialog-npc-name">${npcName}</span>
        </div>
        <div class="dialog-text">
          ${node.text || ""}
        </div>
      `;

      panel.innerHTML = html;
    },

    showDialogPanel() {
      const dialogPanel = document.getElementById("panel-dialog");
      if (!dialogPanel) {
        console.warn("narrative: #panel-dialog not found");
        return;
      }

      // Remember currently active panel (so we can restore it later)
      if (!this.lastPanelId) {
        const activePanel = document.querySelector(".pipboy-panel.active");
        this.lastPanelId = activePanel ? activePanel.id : "panel-map";
      }

      // Hide all panels
      document.querySelectorAll(".pipboy-panel").forEach((el) => {
        el.classList.remove("active");
        el.style.display = "none";
      });

      // Deactivate all tabs
      document.querySelectorAll(".pipboy-tab").forEach((btn) => {
        btn.classList.remove("active");
      });

      // Show dialog panel
      dialogPanel.style.display = "block";
      dialogPanel.classList.add("active");
    },

    closeDialog() {
      const dialogPanel = document.getElementById("panel-dialog");
      if (dialogPanel) {
        dialogPanel.classList.remove("active");
        dialogPanel.style.display = "none";
      }

      // Restore previous panel/tab
      const restoreId = this.lastPanelId || "panel-map";
      const restorePanel = document.getElementById(restoreId);
      if (restorePanel) {
        restorePanel.style.display = "block";
        restorePanel.classList.add("active");

        // Activate matching tab (if any)
        const tab = document.querySelector(`.pipboy-tab[data-pipboy-tab="${restoreId}"]`);
        if (tab) tab.classList.add("active");
      }

      this.currentDialogId = null;
      this.lastPanelId = null;
    }
  };

  Game.modules.narrative = narrative;

  document.addEventListener("DOMContentLoaded", () => {
    try {
      narrative.init();
    } catch (e) {
      console.error("narrative: init failed", e);
    }
  });
})();

