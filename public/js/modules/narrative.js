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
    _currentNPCPortrait: null,  // animated portrait element for current dialog

    init() {
      // Prevent double initialization
      if (this.isInitialized) {
        console.warn("[narrative] Already initialized, skipping");
        return;
      }
      this.isInitialized = true;

      // Restore flags from sessionStorage so they survive page reload
      try {
        const saved = sessionStorage.getItem("nrr_flags");
        if (saved) {
          const parsed = JSON.parse(saved);
          Object.assign(STATE.flags, parsed);
          console.log("[narrative] Restored", Object.keys(parsed).length, "flags from session");
        }
      } catch (_) {}
      
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

    // Persist narrative flags to sessionStorage so they survive page reload
    _saveFlags() {
      try {
        sessionStorage.setItem("nrr_flags", JSON.stringify(STATE.flags));
      } catch (_) {}
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

      // Explicit NPC id → dialog file mappings for NPCs whose data file id
      // differs from the dialog filename (e.g. npc_signal_runner → dialog_siren)
      const NPC_DIALOG_MAP = {
        "npc_signal_runner": "dialog_siren",
        "signal_runner":     "dialog_siren",
        "siren":             "dialog_siren",
        "pip":               "dialog_courier",
        "courier":           "dialog_courier",
        "dude":              "dialog_dude",
        "the_dude":          "dialog_dude",
        "lebronski":         "dialog_dude",
        "roy8":              "dialog_roy8",
        "roy-8":             "dialog_roy8",
        "replicant":         "dialog_roy8",
        "eli":               "dialog_eli",
        "eli_wandermoor":    "dialog_eli",
        "loxley":            "dialog_loxley",
        "robin":             "dialog_loxley",
        "robin_loxley":      "dialog_loxley",
        "hood":              "dialog_loxley",
        "arnie":             "dialog_arnie",
        "arnold":            "dialog_arnie",
        "dutch":             "dialog_arnie",
        "arnold_black":      "dialog_arnie",
        "kenny":             "dialog_kenny",
        "kenny_mccormick":   "dialog_kenny",
        "barney":            "dialog_barney",
        "barney_black":      "dialog_barney",
        "conan":             "dialog_barney",
        "doc":               "dialog_doc",
        "the_doctor":        "dialog_doc",
        "doctor_who":        "dialog_doc",
        "erich":             "dialog_erich",
        "bats":              "dialog_bats",
        "the_bat":           "dialog_bats",
        "batman":            "dialog_bats",
        "stilgar":           "dialog_stilgar",
        "fremen":            "dialog_stilgar",
        "padre":             "dialog_padre",
        "father_cain":       "dialog_padre",
        "priest":            "dialog_padre",
        "commissar_9":       "dialog_commissar",
        "commissar9":        "dialog_commissar",
        "commissar-9":       "dialog_commissar",
        "commissar":         "dialog_commissar",
        "red_commissar":     "dialog_commissar",
        "phaltron":          "dialog_phaltron",
        "phal":              "dialog_phaltron",
        "hakkasan_guardian": "dialog_phaltron",
        "hakkasan_bot":      "dialog_phaltron",
        "annie":             "dialog_annie",
        "little_ember":      "dialog_annie",
        "ember":             "dialog_annie",
        "warbucks":          "dialog_warbucks",
        "warmcaps":          "dialog_warbucks",
        "warren_capston":    "dialog_warbucks",
        "daddy_warmcaps":    "dialog_warbucks",
        "hannigan":          "dialog_hannigan",
        "iron_nan":          "dialog_hannigan",
        "nan_hannigan":      "dialog_hannigan",
        "bless":             "dialog_bless",
        "wasteland_healer":  "dialog_bless",
        "healer":            "dialog_bless"
      };
      const mapped = NPC_DIALOG_MAP[npcId.toLowerCase()];
      if (mapped) return mapped;

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
        this._saveFlags();
      }

      // Offer quest if present — delegate to _activateQuest to avoid duplication
      if (node.offers_quest) {
        this._activateQuest(node.offers_quest);
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
    _goToNode(nodeId, dialog, _visited) {
      if (!dialog) dialog = this.dialogs[this.currentDialogId];
      if (!dialog) return;

      // BUG-009 FIX: detect circular dialog loops. The _visited set tracks nodes
      // seen in the current synchronous traversal chain (auto-advance paths).
      // Each user click starts a fresh chain via _renderChoices → _goToNode.
      // If the same node appears twice in one chain, log an error and close.
      if (!_visited) _visited = new Set();
      if (_visited.has(nodeId)) {
        console.error("[narrative] Circular dialog loop detected at node:", nodeId, "— closing dialog");
        this.closeDialog();
        return;
      }
      _visited.add(nodeId);

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
        this._saveFlags();
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

      // Handle POI revelations from NPC dialogue nodes
      if (Array.isArray(node.reveal_pois) && node.reveal_pois.length > 0) {
        node.reveal_pois.forEach(poiId => {
          if (Game.modules && Game.modules.PlayerState && Game.modules.PlayerState.discoverPOI) {
            Game.modules.PlayerState.discoverPOI(poiId);
            console.log("[narrative] Revealed POI:", poiId);
          }
        });
        // Refresh map if available
        if (Game.modules.WorldMap && Game.modules.WorldMap.loadLocations) {
          Game.modules.WorldMap.loadLocations();
        }
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
          itemObj = found ? { ...found, quantity: 1 } : { id: item, name: item, type: "quest", quantity: 1 };
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
      const _npcName = escapeHtml(dialog.npc || dialog.title || "Unknown");
      panel.innerHTML = `<div id="nrrTextArea" class="dialog-text" style="min-height:4em;white-space:pre-wrap;"></div>`;

      const textArea = document.getElementById("nrrTextArea");
      const chars = text.replace(/\\n/g, "\n").split("");
      let idx = 0;
      let done = false;

      // Start NPC talking animation
      if (this._currentNPCPortrait && typeof this._currentNPCPortrait.startTalking === "function") {
        try { this._currentNPCPortrait.startTalking(); } catch (_) {}
      }

      const stopTalking = () => {
        if (this._currentNPCPortrait && typeof this._currentNPCPortrait.stopTalking === "function") {
          try { this._currentNPCPortrait.stopTalking(); } catch (_) {}
        }
      };

      const skipToEnd = () => {
        if (done) return;
        done = true;
        clearInterval(this._typewriterTick);
        textArea.textContent = text.replace(/\\n/g, "\n");
        stopTalking();
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
          stopTalking();
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
        this._saveFlags();
      }

      // Check if this is the courier intro and we should show starter gear
      let starterGearHtml = "";
      if (node.id === "courier_intro" && Game.modules?.quests?.STARTER_GEAR) {
        const starterGear = Game.modules.quests.STARTER_GEAR;
        starterGearHtml = `
          <div class="starter-gear-list" style="margin-top:10px; border-top:1px solid rgba(0,255,65,0.3); padding-top:8px;">
            <div style="color:#ffaa00; margin-bottom:6px; font-size:clamp(12px, 2vw, 13px);">📦 YOUR STARTING GEAR</div>
            ${starterGear.map(item => {
              const safeName = escapeHtml(item.name);
              const qty = item.quantity ? ` ×${item.quantity}` : "";
              return `<div class="starter-gear-item" style="font-size:clamp(12px, 2vw, 13px); padding:2px 0;">${safeName}${qty}</div>`;
            }).join("")}
          </div>
        `;
      }

      // Build the static frame (header + NPC text placeholder)
      const frameHtml = `
        <div class="dialog-header-row" style="margin-bottom:4px;">
          <span class="dialog-npc-name" style="color:#ffaa00; font-weight:bold;">${npcName}</span>
        </div>
        ${npcDescription ? `<div class="dialog-npc-desc" style="font-size:clamp(12px, 2vw, 13px); opacity:0.9; margin-bottom:6px;">${npcDescription}</div>` : ""}
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

      // Start NPC talking animation
      if (this._currentNPCPortrait && typeof this._currentNPCPortrait.startTalking === "function") {
        try { this._currentNPCPortrait.startTalking(); } catch (_) {}
      }

      const stopTalking = () => {
        if (this._currentNPCPortrait && typeof this._currentNPCPortrait.stopTalking === "function") {
          try { this._currentNPCPortrait.stopTalking(); } catch (_) {}
        }
      };

      const showChoices = () => {
        stopTalking();
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

      // Hook: play per-node video if NpcVideo module is loaded
      if (typeof Game !== 'undefined' && Game.modules && Game.modules.NpcVideo) {
        Game.modules.NpcVideo.playForNode(node, dialog);
      }
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
            style="width:100%; text-align:left; padding:12px 10px; margin:2px 0;
                   background:transparent; border:1px solid rgba(0,255,65,0.25);
                   color:#888; font-family:inherit; font-size:13px; cursor:pointer;
                   min-height:44px; transition:background 0.15s;"
            ontouchstart="this.style.background='rgba(0,255,65,0.15)'"
            ontouchend="this.style.background='transparent'"
            ontouchcancel="this.style.background='transparent'">
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
            style="display:block; width:100%; text-align:left; padding:12px 10px; margin:2px 0;
                   background:transparent; border:1px solid rgba(0,255,65,0.2);
                   color:${color}; font-family:inherit; font-size:13px; cursor:pointer;
                   min-height:44px; transition:background 0.15s, border-color 0.15s;"
            onmouseover="this.style.background='rgba(0,255,65,0.08)';this.style.borderColor='rgba(0,255,65,0.5)';"
            onmouseout="this.style.background='transparent';this.style.borderColor='rgba(0,255,65,0.2)';"
            ontouchstart="this.style.background='rgba(0,255,65,0.15)'"
            ontouchend="this.style.background='transparent'"
            ontouchcancel="this.style.background='transparent'">
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
            this._saveFlags();
          }

          // Special action: open merchant shop
          if (resp.action === "open_shop") {
            this._openMerchantShop(dialog);
            return;
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

      // Hook: play a video for inline replies using a synthetic node
      if (typeof Game !== 'undefined' && Game.modules && Game.modules.NpcVideo) {
        Game.modules.NpcVideo.playForNode({ id: 'inline_reply', text: text || '' }, dialog);
      }

      const _npcName = escapeHtml(dialog.npc || dialog.title || "Unknown");
      const rawText = (text || "").replace(/<br\s*\/?>/gi, "\n");
      panel.innerHTML = `
        <div style="color:#ffaa00; font-weight:bold; margin-bottom:6px;">${_npcName}</div>
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

      // Hide all panels — use class-based hiding to preserve pipboy.js tab-switch state
      document.querySelectorAll(".pipboy-panel").forEach((el) => {
        el.classList.remove("active");
        if (el.id !== "panel-dialog") {
          el.classList.add("hidden");
        }
      });

      // Deactivate all tabs
      document.querySelectorAll(".pipboy-tab").forEach((btn) => {
        btn.classList.remove("active");
      });

      // Show dialog panel — clear any inline display so CSS flex layout applies
      // (avoids layout bugs from display:block overriding .pipboy-panel { display:flex })
      dialogPanel.style.display = "";
      dialogPanel.classList.remove("hidden");
      dialogPanel.classList.add("active");

      // Load animated NPC portrait for this dialog
      const dialog = this.dialogs[this.currentDialogId];
      if (dialog) {
        this._loadNPCPortrait(dialog);
        this._updateNPCInfoPanel(dialog);
        // Hook: prime NPC video module if available
        if (typeof Game !== 'undefined' && Game.modules && Game.modules.NpcVideo) {
          Game.modules.NpcVideo.prepare(dialog);
        }
      }
    },

    // ============================================================
    // NPC LIVING STATE — visit counter, mood, relationship, traits
    // ============================================================
    _updateNPCInfoPanel(dialog) {
      if (!dialog) return;

      // --- Visit counter (sessionStorage) ---
      // currentDialogId is always set before showDialogPanel() calls this method
      const visitKey = "nrr_visits_" + this.currentDialogId;
      let visits = 0;
      try {
        visits = parseInt(sessionStorage.getItem(visitKey) || "0", 10);
        // Increment AFTER reading so relationship is based on prior visit count
        sessionStorage.setItem(visitKey, String(visits + 1));
      } catch (_) {}

      // --- Role / title ---
      const roleEl = document.getElementById("dialogNPCRole");
      if (roleEl) {
        const role = dialog.title || "";
        roleEl.textContent = escapeHtml(role);
        roleEl.style.display = role ? "" : "none";
      }

      // --- Relationship badge (based on visits before this one) ---
      const relEl = document.getElementById("dialogRelationship");
      if (relEl) {
        let label, color, bg;
        if (visits === 0) {
          label = "FIRST MEETING";
          color = "#7fd4f5";
          bg = "rgba(127,212,245,0.1)";
        } else if (visits <= 2) {
          label = "ACQUAINTANCE";
          color = "#00ff41";
          bg = "rgba(0,255,65,0.08)";
        } else if (visits <= 5) {
          label = "FAMILIAR";
          color = "#ffaa00";
          bg = "rgba(255,170,0,0.1)";
        } else {
          label = "TRUSTED ALLY";
          color = "#ff7744";
          bg = "rgba(255,119,68,0.12)";
        }
        relEl.textContent = label;
        relEl.style.color = color;
        relEl.style.background = bg;
        relEl.style.border = "1px solid " + color;
        relEl.style.display = "inline-block";
      }

      // --- Mood indicator ---
      const moodEl = document.getElementById("dialogNPCMood");
      if (moodEl) {
        const moodMap = {
          neutral:    { color: "#888888", label: "Neutral" },
          friendly:   { color: "#00ff41", label: "Friendly" },
          suspicious: { color: "#ffaa00", label: "Suspicious" },
          hostile:    { color: "#ff3333", label: "Hostile" },
          tense:      { color: "#ffdd00", label: "Tense" },
          excited:    { color: "#7fd4f5", label: "Excited" }
        };
        const mood = (dialog.mood || "neutral").toLowerCase();
        const moodData = moodMap[mood] || moodMap.neutral;
        moodEl.innerHTML =
          '<span class="npc-mood-dot" style="background:' + moodData.color + ';box-shadow:0 0 4px ' + moodData.color + '80;"></span>' +
          '<span style="color:' + moodData.color + ';">' + escapeHtml(moodData.label) + '</span>';
        moodEl.style.display = "flex";
      }

      // --- Personality trait badges ---
      const traitsEl = document.getElementById("dialogNPCTraits");
      if (traitsEl) {
        const traits = Array.isArray(dialog.personality) ? dialog.personality : [];
        if (traits.length > 0) {
          traitsEl.innerHTML = traits
            .map(t => '<span class="npc-trait-badge">' + escapeHtml(String(t)) + '</span>')
            .join("");
          traitsEl.style.display = "flex";
        } else {
          traitsEl.innerHTML = "";
          traitsEl.style.display = "none";
        }
      }
    },

    // ============================================================
    // NPC PORTRAIT LOADER — builds animated SMIL portrait in dialog
    // ============================================================
    // Per-NPC avatar part presets (head/eyes/hair/shirt from avatar SVG system)
    _NPC_PARTS: {
      siren:   { head: "head_round.svg",  eyes: "eyes_almond.svg",   hair: "hair_long.svg",      shirt: "shirt_wasteland_gear.svg" },
      courier: { head: "head_square.svg", eyes: "eyes_deepset.svg",  hair: "hair_short.svg",     shirt: "shirt_jacket.svg"         },
      pip:     { head: "head_oblong.svg", eyes: "eyes_round.svg",    hair: "hair_ponytail.svg",  shirt: "shirt_vault_suit.svg"     },
      dolores: { head: "head_round.svg",  eyes: "eyes_downturned.svg", hair: "hair_medium.svg",  shirt: "shirt_wasteland_gear.svg" },
      dude:    { head: "head_round.svg",  eyes: "eyes_set1.svg",     hair: "hair_medium.svg",    shirt: "shirt_wasteland_gear.svg" },
      roy8:    { head: "head_square.svg", eyes: "eyes_almond.svg",   hair: "hair_short.svg",     shirt: "shirt_vault_suit.svg"     },
      eli:     { head: "head_base.svg",   eyes: "eyes_downturned.svg", hair: "hair_short.svg",   shirt: "shirt_jacket.svg"         },
      loxley:  { head: "head_base.svg",   eyes: "eyes_almond.svg",   hair: "hair_medium.svg",    shirt: "shirt_wasteland_gear.svg" },
      arnie:   { head: "head_square.svg", eyes: "eyes_deepset.svg",  hair: "hair_short.svg",     shirt: "shirt_jacket.svg"         },
      kenny:   { head: "head_round.svg",  eyes: "eyes_round.svg",    hair: "hair_short.svg",     shirt: "shirt_vault_suit.svg"     },
      barney:  { head: "head_square.svg", eyes: "eyes_deepset.svg",  hair: "hair_short.svg",     shirt: "shirt_wasteland_gear.svg" },
      bats:    { head: "head_square.svg", eyes: "eyes_deepset.svg",  hair: "hair_short.svg",     shirt: "shirt_jacket.svg"         },
      doc:     { head: "head_oblong.svg", eyes: "eyes_almond.svg",   hair: "hair_medium.svg",    shirt: "shirt_jacket.svg"         },
      erich:   { head: "head_base.svg",   eyes: "eyes_downturned.svg", hair: "hair_short.svg",   shirt: "shirt_wasteland_gear.svg" },
      stilgar: { head: "head_square.svg", eyes: "eyes_almond.svg",   hair: "hair_short.svg",     shirt: "shirt_wasteland_gear.svg" },
      padre:   { head: "head_round.svg",  eyes: "eyes_downturned.svg", hair: "hair_short.svg",   shirt: "shirt_jacket.svg"         },
      bless:   { head: "head_round.svg",  eyes: "eyes_almond.svg",   hair: "hair_medium.svg",    shirt: "shirt_jacket.svg"         },
      default: { head: "head_base.svg",   eyes: "eyes_set1.svg",     hair: "hair_short.svg",     shirt: "shirt_jacket.svg"         }
    },

    async _loadNPCPortrait(dialog) {
      const container = document.getElementById("dialogPortraitContainer");
      if (!container) return;

      // Clean up previous portrait
      if (this._currentNPCPortrait && typeof this._currentNPCPortrait._cleanup === "function") {
        this._currentNPCPortrait._cleanup();
      }
      this._currentNPCPortrait = null;
      container.innerHTML = '<span style="font-size:48px;opacity:0.4;">⏳</span>';

      const portraitId = (dialog.portrait || "").toLowerCase();
      const parts = this._NPC_PARTS[portraitId] || this._NPC_PARTS.default;

      // Build an animated SMIL portrait using the avatar SVG system + SMIL overlays.
      // This gives us NPC-specific appearance (correct hair/eyes/shirt) plus
      // idle breathing, periodic blink, and talking lip-sync animations — no Pixi needed.
      if (window.Game?.Avatar?.compose) {
        try {
          const svgUrl = await Game.Avatar.compose(parts);
          container.innerHTML = "";
          container.style.position = "relative";
          container.style.overflow = "hidden";

          // Base portrait image
          const img = document.createElement("img");
          img.src = svgUrl;
          img.alt = escapeHtml(dialog.npc || "NPC");
          img.style.cssText = "width:100%;height:100%;object-fit:contain;display:block;transform-origin:50% 85%;animation:nrrBreathe 4s ease-in-out infinite;";
          container.appendChild(img);

          // Inject breathing keyframe once
          if (!document.getElementById("nrrPortraitStyles")) {
            const s = document.createElement("style");
            s.id = "nrrPortraitStyles";
            s.textContent = "@keyframes nrrBreathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.004)}}";
            document.head.appendChild(s);
          }

          // SMIL SVG overlay for blink + talking animations
          const ns = "http://www.w3.org/2000/svg";
          const svgOverlay = document.createElementNS(ns, "svg");
          svgOverlay.setAttribute("xmlns", ns);
          svgOverlay.setAttribute("width", "100%");
          svgOverlay.setAttribute("height", "100%");
          svgOverlay.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;";

          // Blink rect (covers eye zone, normally height=0)
          const eyeRect = document.createElementNS(ns, "rect");
          eyeRect.setAttribute("x", "18%");
          eyeRect.setAttribute("y", "32%");
          eyeRect.setAttribute("width", "64%");
          eyeRect.setAttribute("height", "0");
          eyeRect.setAttribute("rx", "4");
          eyeRect.setAttribute("fill", "rgba(10,16,10,0.92)");
          const blinkAnim = document.createElementNS(ns, "animate");
          blinkAnim.setAttribute("attributeName", "height");
          blinkAnim.setAttribute("values", "0;10%;0");
          blinkAnim.setAttribute("dur", "0.12s");
          blinkAnim.setAttribute("begin", "indefinite");
          blinkAnim.id = "nrrBlinkAnim_" + portraitId;
          eyeRect.appendChild(blinkAnim);
          svgOverlay.appendChild(eyeRect);

          // Mouth rect (lip-sync — toggles while talking)
          const mouthRect = document.createElementNS(ns, "rect");
          mouthRect.setAttribute("x", "30%");
          mouthRect.setAttribute("y", "62%");
          mouthRect.setAttribute("width", "40%");
          mouthRect.setAttribute("height", "1");
          mouthRect.setAttribute("rx", "4");
          mouthRect.setAttribute("fill", "rgba(18,10,8,0.80)");
          const mouthAnim = document.createElementNS(ns, "animate");
          mouthAnim.setAttribute("attributeName", "height");
          mouthAnim.setAttribute("values", "1;7;2;8;1");
          mouthAnim.setAttribute("dur", "0.18s");
          mouthAnim.setAttribute("repeatCount", "indefinite");
          mouthAnim.setAttribute("begin", "indefinite");
          mouthRect.appendChild(mouthAnim);
          svgOverlay.appendChild(mouthRect);

          container.appendChild(svgOverlay);

          // Periodic blink scheduler
          let blinkTimer = null;
          const scheduleBlink = () => {
            // 3–6 second intervals
            const rnd = new Uint32Array(1);
            crypto.getRandomValues(rnd);
            const delay = 3000 + (rnd[0] % 3000);
            blinkTimer = setTimeout(() => {
              try { blinkAnim.beginElement(); } catch (_) {}
              scheduleBlink();
            }, delay);
          };
          scheduleBlink();

          const portrait = {
            startTalking() { try { mouthAnim.beginElement(); } catch (_) {} },
            stopTalking()  { try { mouthAnim.endElement();   } catch (_) {} },
            _cleanup() {
              if (blinkTimer) clearTimeout(blinkTimer);
              try { mouthAnim.endElement(); } catch (_) {}
            }
          };

          this._currentNPCPortrait = portrait;
          return;
        } catch (e) {
          console.warn("[narrative] SMIL portrait failed:", e?.message || e);
        }
      }

      // Final fallback — plain emoji
      container.innerHTML = '<span style="font-size:64px;">🧍</span>';
      this._currentNPCPortrait = null;
    },

    // ============================================================
    // MERCHANT SHOP INTEGRATION
    // ============================================================
    _openMerchantShop(dialog) {
      // Close the dialogue panel first
      this.closeDialog();

      // Get shop data from dialog
      const shopData = dialog.shop || {
        name: `${dialog.npc || dialog.title || "NPC"}'s Shop`,
        inventory: [
          { id: "stimpack", quantity: 5 },
          { id: "radaway", quantity: 3 },
          { id: "ammo_9mm", quantity: 20 }
        ]
      };

      // Open merchant shop
      if (Game.modules?.merchant) {
        Game.modules.merchant.openShop(dialog.id || "unknown", shopData);
      } else {
        console.warn("[narrative] Merchant module not available");
      }
    },

    closeDialog() {
      const dialogPanel = document.getElementById("panel-dialog");
      const closingDialogId = this.currentDialogId;

      // Hook: clear NPC video module before hiding the panel
      if (typeof Game !== 'undefined' && Game.modules && Game.modules.NpcVideo) {
        Game.modules.NpcVideo.clear();
      }

      if (dialogPanel) {
        dialogPanel.classList.remove("active");
        dialogPanel.classList.add("hidden");
        dialogPanel.style.display = "";
      }

      // If closing the Siren dialogue, chain to Courier dialogue for first-time players
      if (closingDialogId === "dialog_siren") {
        if (typeof window._bootTriggerCourierDialogue === "function") {
          setTimeout(() => {
            window._bootTriggerCourierDialogue();
          }, 400);
        }
      }

      // If closing the Courier dialogue, show the GPS/map tutorial for first-time players
      if (closingDialogId === "dialog_courier") {
        if (typeof window._bootShowMapTutorial === "function") {
          setTimeout(() => {
            window._bootShowMapTutorial();
          }, 600);
        }
      }

      // Restore previous panel/tab
      const restoreId = this.lastPanelId || "panel-map";
      const restorePanel = document.getElementById(restoreId);
      if (restorePanel) {
        // Remove hidden class that showDialogPanel() added to all panels,
        // so pipboy.js tab-switch system can properly control visibility again
        document.querySelectorAll(".pipboy-panel").forEach(el => {
          if (el.id !== "panel-dialog") el.classList.remove("hidden");
        });

        restorePanel.classList.add("active");

        // Activate matching tab (if any)
        const tab = document.querySelector(`.pipboy-tab[data-pipboy-tab="${restoreId}"]`);
        if (tab) tab.classList.add("active");
      }

      // Clean up NPC portrait (stop animations, reset container)
      if (this._currentNPCPortrait) {
        if (typeof this._currentNPCPortrait.stopTalking === "function") {
          try { this._currentNPCPortrait.stopTalking(); } catch (_) {}
        }
        if (typeof this._currentNPCPortrait._cleanup === "function") {
          try { this._currentNPCPortrait._cleanup(); } catch (_) {}
        }
        this._currentNPCPortrait = null;
      }
      const portraitContainer = document.getElementById("dialogPortraitContainer");
      if (portraitContainer) portraitContainer.innerHTML = '<span style="font-size:64px;">🧍</span>';

      // Clear NPC info panel elements
      ["dialogNPCRole", "dialogNPCMood", "dialogRelationship", "dialogNPCTraits"].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.innerHTML = ""; el.style.display = "none"; }
      });

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

