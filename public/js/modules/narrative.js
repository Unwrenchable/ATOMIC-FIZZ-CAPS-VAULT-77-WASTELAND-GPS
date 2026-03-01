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

  // HTML sanitization helper to prevent XSS
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  const narrative = {
    dialogs: {},          // dialogId -> dialog JSON
    loadingDialogs: {},   // dialogId -> Promise
    currentDialogId: null,
    lastPanelId: null,
    isInitialized: false,
    escKeyHandler: null,

    init() {
      // Prevent double initialization
      if (this.isInitialized) {
        console.warn("[narrative] Already initialized, skipping");
        return;
      }
      this.isInitialized = true;
      
      // Wire dialog close button (remove nested DOMContentLoaded - we're already in one!)
      const closeBtn = document.getElementById("dialogCloseBtn");
      if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
          e.preventDefault();
          this.closeDialog();
        });
        console.log("[narrative] Close button wired");
      } else {
        console.warn("[narrative] Close button not found in DOM");
      }
      
      // Add ESC key listener as backup exit method (store reference to prevent duplicates)
      this.escKeyHandler = (e) => {
        if (e.key === "Escape" && this.currentDialogId) {
          console.log("[narrative] ESC pressed, closing dialogue");
          this.closeDialog();
        }
      };
      document.addEventListener("keydown", this.escKeyHandler);
      
      console.log("[narrative] Initialized with close handlers");
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

      // Try loading from /data/narrative/ first, then fallback to /data/
      const urls = [
        "/data/narrative/" + dialogId + ".json",
        "/data/" + dialogId + ".json"
      ];

      const p = (async () => {
        for (const url of urls) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const json = await res.json();
              this.dialogs[dialogId] = json;
              return json;
            }
          } catch (err) {
            console.warn("narrative: error loading from", url, err.message);
            // Continue to try next URL
          }
        }
        console.error("narrative: failed to load dialog", dialogId);
        return null;
      })();

      this.loadingDialogs[dialogId] = p;
      p.finally(() => {
        delete this.loadingDialogs[dialogId];
      });

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

      // Offer quest if present - try multiple quest systems for compatibility
      if (node.offers_quest) {
        const questId = node.offers_quest;
        let questActivated = false;
        
        // Try the unified quests module first (newer system)
        if (Game.modules?.quests) {
          try {
            // Accept the quest if it's available, otherwise start it directly
            if (Game.modules.quests.availableQuests?.[questId]) {
              Game.modules.quests.acceptQuest(questId);
              questActivated = true;
              console.log("[narrative] Quest accepted via unified quests module:", questId);
            } else {
              Game.modules.quests.startQuest(questId);
              questActivated = true;
              console.log("[narrative] Quest started via unified quests module:", questId);
            }
          } catch (e) {
            console.warn("[narrative] unified quests module failed:", e);
          }
        }
        
        // Fallback to Game.quests (also points to quests module)
        if (!questActivated && Game.quests) {
          try {
            if (Game.quests.availableQuests?.[questId]) {
              Game.quests.acceptQuest(questId);
              questActivated = true;
              console.log("[narrative] Quest accepted via Game.quests:", questId);
            } else {
              Game.quests.startQuest(questId);
              questActivated = true;
              console.log("[narrative] Quest started via Game.quests:", questId);
            }
          } catch (e) {
            console.warn("[narrative] Game.quests failed:", e);
          }
        }
        
        // Final fallback to main.js activateQuest (legacy system)
        if (!questActivated && Game.modules?.main?.activateQuest) {
          try {
            Game.modules.main.activateQuest(questId);
            questActivated = true;
            console.log("[narrative] Quest activated via main module:", questId);
          } catch (e) {
            console.error("[narrative] failed to activate quest via main:", questId, e);
          }
        }
        
        if (!questActivated) {
          console.warn("[narrative] Could not activate quest - no quest system available:", questId);
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

    // ============================================================
    // BRANCHING NAVIGATION — navigate to a named node in dialog.nodes map
    // ============================================================
    _goToNode(nodeId, dialog) {
      if (!dialog) dialog = this.dialogs[this.currentDialogId];
      if (!dialog) return;

      // Check dialog.nodes map first, then fall back to searching all node arrays
      const nodesMap = dialog.nodes || {};
      const node = nodesMap[nodeId]
        || (dialog.quest_nodes || []).find(n => n.id === nodeId)
        || (dialog.emotional_nodes || []).find(n => n.id === nodeId)
        || (dialog.knowledge_nodes || []).find(n => n.id === nodeId)
        || (nodeId === dialog.intro?.id ? dialog.intro : null)
        || (nodeId === dialog.fallback?.id ? dialog.fallback : null);

      if (!node) {
        console.warn("[narrative] Node not found:", nodeId);
        return;
      }

      // Apply flags if any
      if (Array.isArray(node.set_flags)) {
        node.set_flags.forEach(f => { if (f) STATE.flags[f] = true; });
      }

      // Handle quest offers on nodes
      if (node.offers_quest) {
        this._activateQuest(node.offers_quest);
      }

      // Handle item grants from NPC dialogue nodes
      // Format: grant_items: [{ id, name, type, ... }] or grant_items: ["item_id"]
      if (Array.isArray(node.grant_items) && node.grant_items.length > 0) {
        this._grantDialogItems(node.grant_items, node.grant_from || dialog.npcName || "NPC");
      }

      // End dialogue if node is terminal
      if (node.end) {
        this._typewriterRender(node.text || "", dialog, null, () => this.closeDialog());
        return;
      }

      this.renderNode(node, dialog);
    },

    // ============================================================
    // NPC ITEM GRANT HELPER
    // ============================================================
    _grantDialogItems(items, npcName) {
      if (!Array.isArray(items) || !items.length) return;

      items.forEach(function (item) {
        var itemObj;
        if (typeof item === "string") {
          // Try to resolve from items database; fall back to minimal placeholder
          var found = Game.player && Array.isArray(Game.player.items) &&
            Game.player.items.find(function (i) { return i.id === item; });
          itemObj = found ? { ...found, quantity: 1 } : { id: item, name: item, type: "questItem", quantity: 1 };
        } else {
          itemObj = { ...item, quantity: item.quantity || 1 };
        }

        // Use unified PlayerState for persistence
        if (Game.modules && Game.modules.PlayerState && Game.modules.PlayerState.receiveItemFromNPC) {
          Game.modules.PlayerState.receiveItemFromNPC(itemObj, npcName);
        } else if (Game.giveItem) {
          Game.giveItem(itemObj, itemObj.quantity || 1);
          console.log("[narrative] " + npcName + " gave: " + itemObj.name);
        }
      });
    },

    // ============================================================
    // QUEST ACTIVATION HELPER
    // ============================================================
    _activateQuest(questId) {
      if (!questId) return;
      let activated = false;

      if (Game.modules?.quests) {
        try {
          if (Game.modules.quests.availableQuests?.[questId]) {
            Game.modules.quests.acceptQuest(questId);
          } else {
            Game.modules.quests.startQuest(questId);
          }
          activated = true;
        } catch (e) {
          console.warn("[narrative] quests module error:", e);
        }
      }

      if (!activated && Game.modules?.main?.activateQuest) {
        try { Game.modules.main.activateQuest(questId); activated = true; } catch (e) {}
      }

      if (!activated) {
        console.warn("[narrative] Could not activate quest:", questId);
      }
    },

    // ============================================================
    // TYPEWRITER HELPER — renders text char-by-char into dialogBody
    // then calls onDone() when finished.  Skip on click/enter.
    // ============================================================
    _typewriterRender(text, dialog, node, onDone) {
      const panel = document.getElementById("dialogBody");
      if (!panel) { if (onDone) onDone(); return; }

      // Re-render the static frame (name, header) but leave text area blank
      const npcName = escapeHtml(dialog.npc || dialog.title || "Unknown");
      panel.innerHTML = `<div id="nrrTextArea" class="dialog-text" style="min-height:4em;white-space:pre-wrap;"></div>`;

      const textArea = document.getElementById("nrrTextArea");
      const chars = text.replace(/\\n/g, "\n").split("");
      let idx = 0;
      let done = false;

      const skipToEnd = () => {
        if (done) return;
        done = true;
        clearInterval(this._typewriterTick);
        textArea.textContent = text.replace(/\\n/g, "\n");
        if (onDone) onDone();
      };

      // Allow skip by clicking anywhere in the dialog panel or pressing Enter
      const skipHandler = (e) => {
        if (e.type === "keydown" && e.key !== "Enter" && e.code !== "Space") return;
        skipToEnd();
        panel.removeEventListener("click", skipHandler);
        document.removeEventListener("keydown", skipHandler);
      };
      panel.addEventListener("click", skipHandler);
      document.addEventListener("keydown", skipHandler);

      this._typewriterTick = setInterval(() => {
        if (idx < chars.length) {
          textArea.textContent += chars[idx++];
        } else {
          done = true;
          clearInterval(this._typewriterTick);
          panel.removeEventListener("click", skipHandler);
          document.removeEventListener("keydown", skipHandler);
          if (onDone) onDone();
        }
      }, 22); // ms per character — Fallout NV pace
    },

    // ============================================================
    // RENDER A NODE (NPC speech + player choices)
    // ============================================================
    renderNode(node, dialog) {
      const panel = document.getElementById("dialogBody");
      if (!panel) {
        console.warn("narrative: #dialogBody not found");
        return;
      }

      // Clear any running typewriter
      if (this._typewriterTick) {
        clearInterval(this._typewriterTick);
        this._typewriterTick = null;
      }

      // Sanitize text content to prevent XSS
      const npcName = escapeHtml(dialog.npc || dialog.title || dialog.id || "Unknown");
      const npcDescription = escapeHtml(dialog.description || "");
      
      // Update the NPC name label in the portrait area
      const npcNameEl = document.getElementById("dialogNPCName");
      if (npcNameEl) {
        npcNameEl.textContent = npcName;
      }

      // Apply any flags set by this node
      if (Array.isArray(node.set_flags)) {
        node.set_flags.forEach(f => { if (f) STATE.flags[f] = true; });
      }

      // Handle quest offers on the node itself (e.g. intro)
      if (node.offers_quest) {
        this._activateQuest(node.offers_quest);
      }

      // Check if this is the courier intro and we should show starter gear
      let starterGearHtml = "";
      if (node.id === "courier_intro" && Game.modules?.quests?.STARTER_GEAR) {
        const starterGear = Game.modules.quests.STARTER_GEAR;
        starterGearHtml = `
          <div class="starter-gear-list" style="margin-top:10px; border-top:1px solid rgba(0,255,65,0.3); padding-top:8px;">
            <div style="color:#ffaa00; margin-bottom:6px; font-size:11px;">📦 YOUR STARTING GEAR</div>
            ${starterGear.map(item => {
              const safeName = escapeHtml(item.name);
              const qty = item.quantity ? ` ×${item.quantity}` : "";
              return `<div class="starter-gear-item" style="font-size:11px; padding:2px 0;">${safeName}${qty}</div>`;
            }).join("")}
          </div>
        `;
      }

      // Build the static frame (header + NPC text placeholder)
      const frameHtml = `
        <div class="dialog-header-row" style="margin-bottom:4px;">
          <span class="dialog-npc-name" style="color:#ffaa00; font-weight:bold;">${npcName}</span>
        </div>
        ${npcDescription ? `<div class="dialog-npc-desc" style="font-size:11px; opacity:0.6; margin-bottom:6px;">${npcDescription}</div>` : ""}
        <div class="dialog-divider" style="border-top:1px solid rgba(0,255,65,0.3); margin-bottom:8px;"></div>
        <div id="nrrTextArea" class="dialog-text" style="white-space:pre-wrap; min-height:4em;"></div>
        ${starterGearHtml}
        <div id="nrrChoiceArea" class="dialog-choices" style="margin-top:12px;"></div>
      `;
      panel.innerHTML = frameHtml;

      // Typewriter the NPC text, then show player choices
      const rawText = (node.text || "").replace(/<br\s*\/?>/gi, "\n");
      const textArea = document.getElementById("nrrTextArea");
      const choiceArea = document.getElementById("nrrChoiceArea");
      const chars = rawText.split("");
      let idx = 0;
      let skipDone = false;

      const showChoices = () => {
        if (!choiceArea) return;
        this._renderChoices(choiceArea, node, dialog);
      };

      const skipToEnd = () => {
        if (skipDone) return;
        skipDone = true;
        clearInterval(this._typewriterTick);
        if (textArea) textArea.textContent = rawText;
        showChoices();
        panel.removeEventListener("click", onSkip);
        document.removeEventListener("keydown", onKeySkip);
      };

      const onSkip = () => skipToEnd();
      const onKeySkip = (e) => {
        // Only skip on Enter/Space so arrow keys don't interfere
        if (e.key === "Enter" || e.code === "Space") skipToEnd();
      };

      panel.addEventListener("click", onSkip);
      document.addEventListener("keydown", onKeySkip);

      this._typewriterTick = setInterval(() => {
        if (!textArea) { clearInterval(this._typewriterTick); showChoices(); return; }
        if (idx < chars.length) {
          textArea.textContent += chars[idx++];
        } else {
          skipDone = true;
          clearInterval(this._typewriterTick);
          this._typewriterTick = null;
          panel.removeEventListener("click", onSkip);
          document.removeEventListener("keydown", onKeySkip);
          showChoices();
        }
      }, 22);

      console.log("[narrative] Rendered node:", node.id, "for NPC:", npcName);
    },

    // ============================================================
    // RENDER PLAYER CHOICE BUTTONS (Fallout NV dialogue wheel list)
    // ============================================================
    _renderChoices(container, node, dialog) {
      if (!container) return;

      const responses = node.responses || [];

      // Tone colour palette matching Fallout NV
      const toneColors = {
        question:  "#7fd4f5",  // blue — curiosity
        kind:      "#a0e890",  // green — warmth
        sarcastic: "#ffcc55",  // amber — snark
        direct:    "#ff9966",  // orange — brusque
        neutral:   "#c8c8c8",  // grey
        end:       "#888888"
      };

      if (responses.length === 0) {
        // No choices — only show a "Continue / [END]" prompt
        const closeText = node.end ? "[END CONVERSATION]" : "[ Continue ]";
        container.innerHTML = `
          <button class="nrr-choice-btn" data-action="close"
            style="width:100%; text-align:left; padding:7px 10px; margin:2px 0;
                   background:transparent; border:1px solid rgba(0,255,65,0.25);
                   color:#888; font-family:inherit; font-size:12px; cursor:pointer;
                   transition:background 0.15s;">
            ${escapeHtml(closeText)}
          </button>`;
        container.querySelector("[data-action='close']").addEventListener("click", () => this.closeDialog());
        return;
      }

      let choiceHtml = "";
      responses.forEach((resp, i) => {
        const color = toneColors[resp.tone] || toneColors.neutral;
        const safeText = escapeHtml(resp.text || "");
        choiceHtml += `
          <button class="nrr-choice-btn" data-idx="${i}"
            style="display:block; width:100%; text-align:left; padding:7px 10px; margin:2px 0;
                   background:transparent; border:1px solid rgba(0,255,65,0.2);
                   color:${color}; font-family:inherit; font-size:12px; cursor:pointer;
                   transition:background 0.15s, border-color 0.15s;"
            onmouseover="this.style.background='rgba(0,255,65,0.08)';this.style.borderColor='rgba(0,255,65,0.5)';"
            onmouseout="this.style.background='transparent';this.style.borderColor='rgba(0,255,65,0.2)';">
            ${safeText}
          </button>`;
      });
      container.innerHTML = choiceHtml;

      // Wire click handlers
      container.querySelectorAll(".nrr-choice-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const resp = responses[idx];
          if (!resp) return;

          // Quest offer on choice
          if (resp.offers_quest) this._activateQuest(resp.offers_quest);

          // Apply flags on choice
          if (Array.isArray(resp.set_flags)) {
            resp.set_flags.forEach(f => { if (f) STATE.flags[f] = true; });
          }

          if (resp.end) {
            this.closeDialog();
            return;
          }

          // Inline one-liner NPC reply (no branching node, just a quick answer then close)
          if (resp.next_inline) {
            this._showInlineReply(resp.next_inline, dialog);
            return;
          }

          if (resp.next) {
            this._goToNode(resp.next, dialog);
            return;
          }

          // No next — close
          this.closeDialog();
        });
      });
    },

    // Quick inline reply (NPC one-liner after player choice, then closes)
    _showInlineReply(text, dialog) {
      const panel = document.getElementById("dialogBody");
      if (!panel) { this.closeDialog(); return; }

      if (this._typewriterTick) { clearInterval(this._typewriterTick); this._typewriterTick = null; }

      const npcName = escapeHtml(dialog.npc || dialog.title || "Unknown");
      const rawText = (text || "").replace(/<br\s*\/?>/gi, "\n");
      panel.innerHTML = `
        <div style="color:#ffaa00; font-weight:bold; margin-bottom:6px;">${npcName}</div>
        <div id="nrrInlineText" style="white-space:pre-wrap; min-height:2em;"></div>
        <div id="nrrInlineBtn" style="margin-top:12px;"></div>`;

      const textEl = document.getElementById("nrrInlineText");
      const btnArea = document.getElementById("nrrInlineBtn");
      const chars = rawText.split("");
      let idx = 0;

      const finish = () => {
        clearInterval(this._typewriterTick);
        if (textEl) textEl.textContent = rawText;
        if (btnArea) {
          btnArea.innerHTML = `<button class="nrr-choice-btn" style="padding:6px 12px; background:transparent;
            border:1px solid rgba(0,255,65,0.3); color:#888; font-family:inherit; font-size:12px; cursor:pointer;">
            [END CONVERSATION]</button>`;
          btnArea.querySelector("button").addEventListener("click", () => this.closeDialog());
        }
      };

      this._typewriterTick = setInterval(() => {
        if (idx < chars.length) {
          if (textEl) textEl.textContent += chars[idx++];
        } else {
          clearInterval(this._typewriterTick);
          finish();
        }
      }, 22);
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
      const closingDialogId = this.currentDialogId;
      
      if (dialogPanel) {
        dialogPanel.classList.remove("active");
        dialogPanel.style.display = "none";
      }

      // If closing the Siren dialogue, chain to Courier dialogue for first-time players
      if (closingDialogId === "dialog_siren") {
        if (typeof window._bootTriggerCourierDialogue === "function") {
          setTimeout(() => {
            window._bootTriggerCourierDialogue();
          }, 400);
        }
      }

      // If closing the courier dialogue, start the wake_up quest
      if (closingDialogId === "dialog_courier") {
        if (Game.modules?.quests?.startQuest) {
          try {
            Game.modules.quests.startQuest("wake_up");
            console.log("[narrative] Wake up quest started after courier dialogue");
          } catch (err) {
            console.warn("[narrative] Failed to start wake_up quest:", err);
          }
        }
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

