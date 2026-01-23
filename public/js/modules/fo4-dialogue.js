// fo4-dialogue.js
// ============================================================
// Fallout 4 Style Dialogue System
// Cinematic dialogue with character portraits and branching options
// ============================================================

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Dialogue system module
  const FO4Dialogue = {
    isOpen: false,
    overlayEl: null,
    currentDialogue: null,
    currentNPC: null,
    currentNodeIndex: 0,
    typewriterInterval: null,
    onCompleteCallback: null,
    playerAppearance: null,

    // ============================================================
    // INITIALIZATION
    // ============================================================
    init() {
      this._createOverlay();
      this._bindKeyboardEvents();
      
      // Load player appearance if available
      this._loadPlayerAppearance();
      
      console.log("[FO4Dialogue] Initialized");
    },

    // ============================================================
    // START DIALOGUE
    // ============================================================
    startDialogue(npc, dialogueData, onComplete = null) {
      if (this.isOpen) {
        console.warn("[FO4Dialogue] Dialogue already open");
        return;
      }

      this.currentNPC = npc;
      this.currentDialogue = dialogueData;
      this.currentNodeIndex = 0;
      this.onCompleteCallback = onComplete;
      this.isOpen = true;

      // Load player appearance
      this._loadPlayerAppearance();

      // Show overlay
      this.overlayEl.classList.remove('hidden');
      this.overlayEl.classList.add('opening');

      // Render portraits
      this._renderPortraits();

      // Start with first node
      if (dialogueData.nodes && dialogueData.nodes.length > 0) {
        this._displayNode(dialogueData.nodes[0]);
      } else if (dialogueData.intro) {
        this._displayNode(dialogueData.intro);
      } else if (dialogueData.text) {
        // Simple dialogue with just text
        this._displayNode({ text: dialogueData.text, responses: dialogueData.responses });
      }

      // Dispatch event
      window.dispatchEvent(new CustomEvent('dialogueStarted', {
        detail: { npc: npc, dialogue: dialogueData }
      }));
    },

    // ============================================================
    // END DIALOGUE
    // ============================================================
    endDialogue() {
      this.isOpen = false;
      
      // Stop typewriter
      if (this.typewriterInterval) {
        clearInterval(this.typewriterInterval);
        this.typewriterInterval = null;
      }

      // Hide overlay
      this.overlayEl.classList.add('hidden');
      this.overlayEl.classList.remove('opening');

      // Callback
      if (this.onCompleteCallback) {
        this.onCompleteCallback(this.currentNPC);
      }

      // Dispatch event
      window.dispatchEvent(new CustomEvent('dialogueEnded', {
        detail: { npc: this.currentNPC }
      }));

      // Clear state
      this.currentNPC = null;
      this.currentDialogue = null;
      this.currentNodeIndex = 0;
    },

    // ============================================================
    // DISPLAY A DIALOGUE NODE
    // ============================================================
    _displayNode(node) {
      const dialogueBox = this.overlayEl.querySelector('.fo4-dialogue-box');
      const textEl = dialogueBox.querySelector('.fo4-dialogue-text');
      const responseArea = dialogueBox.querySelector('.fo4-response-area');
      const continuePrompt = dialogueBox.querySelector('.fo4-continue-prompt');

      // Update speaker indicator
      this._updateSpeakerIndicator(node.speaker || this.currentNPC?.name || "Unknown");

      // Activate NPC portrait
      this._setActivePortrait('npc');

      // Clear previous content
      textEl.innerHTML = '';
      responseArea.innerHTML = '';
      responseArea.classList.remove('visible');
      continuePrompt.style.display = 'none';

      // Process text (support HTML formatting)
      let displayText = node.text || '';
      displayText = displayText.replace(/<br\s*\/?>/gi, '\n');
      displayText = displayText.replace(/<[^>]+>/g, ''); // Strip other HTML for typewriter

      // Typewriter effect
      this._typewriterEffect(textEl, displayText, () => {
        // After text is done, show responses or continue prompt
        if (node.responses && node.responses.length > 0) {
          this._showResponses(node.responses);
        } else if (node.next) {
          continuePrompt.style.display = 'block';
          continuePrompt.onclick = () => this._goToNode(node.next);
        } else {
          // End of dialogue
          continuePrompt.textContent = '[END CONVERSATION]';
          continuePrompt.style.display = 'block';
          continuePrompt.onclick = () => this.endDialogue();
        }
      });

      // Handle flags
      if (node.set_flags && Game.flags) {
        node.set_flags.forEach(flag => Game.flags.set(flag, true));
      }

      // Handle quest offers
      if (node.offers_quest && Game.quests) {
        // Could show quest accept/decline options
      }
    },

    // ============================================================
    // TYPEWRITER EFFECT
    // ============================================================
    _typewriterEffect(element, text, onComplete) {
      const speed = 25; // ms per character
      let index = 0;

      element.classList.add('typing');

      this.typewriterInterval = setInterval(() => {
        if (index < text.length) {
          element.textContent += text[index];
          index++;
        } else {
          clearInterval(this.typewriterInterval);
          this.typewriterInterval = null;
          element.classList.remove('typing');
          if (onComplete) onComplete();
        }
      }, speed);
    },

    // ============================================================
    // SKIP TYPEWRITER (click to skip)
    // ============================================================
    _skipTypewriter() {
      if (this.typewriterInterval) {
        clearInterval(this.typewriterInterval);
        this.typewriterInterval = null;

        const textEl = this.overlayEl.querySelector('.fo4-dialogue-text');
        textEl.classList.remove('typing');
        
        // Could trigger the callback here if needed
      }
    },

    // ============================================================
    // SHOW RESPONSE OPTIONS
    // ============================================================
    _showResponses(responses) {
      const responseArea = this.overlayEl.querySelector('.fo4-response-area');
      responseArea.innerHTML = '';

      // Activate player portrait when showing responses
      this._setActivePortrait('player');

      responses.forEach((response, index) => {
        const btn = document.createElement('button');
        btn.className = 'fo4-response-option';
        btn.innerHTML = `
          <span class="fo4-response-key">${index + 1}</span>
          <span class="fo4-response-text">${response.text || response.label || 'Continue'}</span>
          ${response.tone ? `<span class="fo4-response-tone">[${response.tone}]</span>` : ''}
        `;

        btn.addEventListener('click', () => this._selectResponse(response));
        responseArea.appendChild(btn);
      });

      // Show with animation
      setTimeout(() => {
        responseArea.classList.add('visible');
      }, 100);
    },

    // ============================================================
    // SELECT A RESPONSE
    // ============================================================
    _selectResponse(response) {
      // Handle affinity changes
      if (response.affinity && this.currentNPC) {
        this._showAffinityChange(this.currentNPC.name, response.affinity);
      }

      // Handle karma changes
      if (response.karma && Game.karma) {
        Game.karma.modify(response.karma);
      }

      // Handle flags
      if (response.set_flags && Game.flags) {
        response.set_flags.forEach(flag => Game.flags.set(flag, true));
      }

      // Handle quest progress
      if (response.complete_objective && Game.quests) {
        Game.quests.completeObjective(response.complete_objective.quest, response.complete_objective.objective);
      }

      // Go to next node
      if (response.next) {
        this._goToNode(response.next);
      } else if (response.end) {
        this.endDialogue();
      } else {
        // Default: end dialogue
        this.endDialogue();
      }
    },

    // ============================================================
    // GO TO SPECIFIC NODE
    // ============================================================
    _goToNode(nodeId) {
      if (!this.currentDialogue) return;

      // Find node by ID
      let node = null;
      
      if (this.currentDialogue.nodes) {
        node = this.currentDialogue.nodes.find(n => n.id === nodeId);
      }
      
      // Check knowledge nodes
      if (!node && this.currentDialogue.knowledge_nodes) {
        node = this.currentDialogue.knowledge_nodes.find(n => n.id === nodeId);
      }

      // Check quest nodes
      if (!node && this.currentDialogue.quest_nodes) {
        node = this.currentDialogue.quest_nodes.find(n => n.id === nodeId);
      }

      // Check wildcards
      if (!node && this.currentDialogue.wildcards) {
        node = this.currentDialogue.wildcards.find(n => n.id === nodeId);
      }

      // Fallback
      if (!node && this.currentDialogue.fallback) {
        node = this.currentDialogue.fallback;
      }

      if (node) {
        this._displayNode(node);
      } else {
        console.warn("[FO4Dialogue] Node not found:", nodeId);
        this.endDialogue();
      }
    },

    // ============================================================
    // UPDATE SPEAKER INDICATOR
    // ============================================================
    _updateSpeakerIndicator(name) {
      const indicator = this.overlayEl.querySelector('.fo4-speaker-indicator');
      const nameEl = indicator.querySelector('.fo4-speaker-name');
      const iconEl = indicator.querySelector('.fo4-speaker-icon');

      nameEl.textContent = name;

      // Get NPC icon if available
      if (this.currentNPC?.icon) {
        iconEl.textContent = this.currentNPC.icon;
      } else {
        // Default icon based on race
        const race = this.currentNPC?.appearance?.race || this.currentNPC?.type || 'human';
        const icons = {
          human: '🧑',
          ghoul: '🧟',
          synth: '🤖',
          robot: '🤖',
          mutant: '👹',
          default: '💬'
        };
        iconEl.textContent = icons[race] || icons.default;
      }
    },

    // ============================================================
    // RENDER PORTRAITS
    // ============================================================
    _renderPortraits() {
      const playerPortrait = this.overlayEl.querySelector('.fo4-portrait-container.player');
      const npcPortrait = this.overlayEl.querySelector('.fo4-portrait-container.npc');

      // Player portrait
      if (playerPortrait && Game.modules.CharacterCreator) {
        const playerSvg = playerPortrait.querySelector('.fo4-portrait-svg');
        const playerName = playerPortrait.querySelector('.fo4-portrait-name');
        
        const appearance = this.playerAppearance || Game.modules.CharacterCreator.getAppearance();
        playerSvg.innerHTML = Game.modules.CharacterCreator.generatePortraitSVG(appearance, 160);
        playerName.textContent = appearance?.name || 'WANDERER';
      }

      // NPC portrait
      if (npcPortrait && this.currentNPC) {
        const npcSvg = npcPortrait.querySelector('.fo4-portrait-svg');
        const npcName = npcPortrait.querySelector('.fo4-portrait-name');
        const npcRole = npcPortrait.querySelector('.fo4-portrait-role');

        // Generate or use existing NPC appearance
        let npcAppearance = this.currentNPC.appearance;
        
        if (!npcAppearance && Game.modules.CharacterCreator) {
          // Generate appearance based on NPC data
          npcAppearance = Game.modules.CharacterCreator.generateNPCAppearance({
            gender: this.currentNPC.gender,
            race: this._mapNPCRace(this.currentNPC.type),
            expression: this._mapNPCExpression(this.currentNPC.mood || this.currentNPC.disposition)
          });
        }

        if (npcAppearance && Game.modules.CharacterCreator) {
          npcSvg.innerHTML = Game.modules.CharacterCreator.generatePortraitSVG(npcAppearance, 160);
        } else {
          // Fallback icon
          const icon = this.currentNPC.icon || '👤';
          npcSvg.innerHTML = `<div style="font-size: 80px; display: flex; align-items: center; justify-content: center; height: 100%;">${icon}</div>`;
        }

        npcName.textContent = this.currentNPC.name || 'UNKNOWN';
        npcRole.textContent = this.currentNPC.role || this.currentNPC.faction || '';
      }
    },

    // ============================================================
    // SET ACTIVE PORTRAIT
    // ============================================================
    _setActivePortrait(which) {
      const playerPortrait = this.overlayEl.querySelector('.fo4-portrait-container.player');
      const npcPortrait = this.overlayEl.querySelector('.fo4-portrait-container.npc');

      if (which === 'player') {
        playerPortrait?.classList.add('active');
        npcPortrait?.classList.remove('active');
      } else {
        playerPortrait?.classList.remove('active');
        npcPortrait?.classList.add('active');
      }
    },

    // ============================================================
    // MAP NPC TYPE TO RACE
    // ============================================================
    _mapNPCRace(type) {
      if (!type) return 'human';
      const lower = type.toLowerCase();
      
      if (lower.includes('ghoul')) return 'ghoul';
      if (lower.includes('synth') || lower.includes('robot') || lower.includes('ai')) return 'synth';
      return 'human';
    },

    // ============================================================
    // MAP NPC MOOD TO EXPRESSION
    // ============================================================
    _mapNPCExpression(mood) {
      if (!mood) return 'neutral';
      const lower = mood.toLowerCase();
      
      if (lower.includes('friendly') || lower.includes('happy')) return 'friendly';
      if (lower.includes('hostile') || lower.includes('angry')) return 'stern';
      if (lower.includes('suspicious') || lower.includes('wary')) return 'suspicious';
      if (lower.includes('sad') || lower.includes('tired')) return 'weary';
      return 'neutral';
    },

    // ============================================================
    // SHOW AFFINITY CHANGE
    // ============================================================
    _showAffinityChange(npcName, amount) {
      const popup = document.createElement('div');
      popup.className = `fo4-affinity-popup ${amount < 0 ? 'negative' : ''}`;
      
      const text = amount > 0 
        ? `${npcName} liked that.` 
        : `${npcName} disliked that.`;
      
      popup.innerHTML = `<div class="fo4-affinity-text">${text}</div>`;
      
      document.body.appendChild(popup);
      
      setTimeout(() => {
        popup.remove();
      }, 2000);
    },

    // ============================================================
    // SHOW QUEST UPDATE
    // ============================================================
    showQuestUpdate(title, text) {
      const notification = document.createElement('div');
      notification.className = 'fo4-quest-update';
      notification.innerHTML = `
        <div class="fo4-quest-update-title">${title}</div>
        <div class="fo4-quest-update-text">${text}</div>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    },

    // ============================================================
    // LOAD PLAYER APPEARANCE
    // ============================================================
    _loadPlayerAppearance() {
      if (Game.modules.CharacterCreator) {
        this.playerAppearance = Game.modules.CharacterCreator.loadSavedAppearance() 
          || Game.modules.CharacterCreator.getAppearance();
      }
    },

    // ============================================================
    // CREATE OVERLAY
    // ============================================================
    _createOverlay() {
      const existing = document.getElementById('fo4DialogueOverlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'fo4DialogueOverlay';
      overlay.className = 'fo4-dialogue-overlay hidden';
      
      overlay.innerHTML = `
        <!-- Portrait Area -->
        <div class="fo4-portrait-area">
          <!-- Player Portrait (Left) -->
          <div class="fo4-portrait-container player">
            <div class="fo4-portrait-frame">
              <div class="fo4-portrait-svg"></div>
            </div>
            <div class="fo4-portrait-name">WANDERER</div>
            <div class="fo4-portrait-role">VAULT DWELLER</div>
          </div>

          <!-- NPC Portrait (Right) -->
          <div class="fo4-portrait-container npc active">
            <div class="fo4-portrait-frame npc">
              <div class="fo4-portrait-svg"></div>
              <div class="fo4-mood-indicator neutral">NEUTRAL</div>
            </div>
            <div class="fo4-portrait-name">NPC NAME</div>
            <div class="fo4-portrait-role">ROLE</div>
          </div>
        </div>

        <!-- Dialogue Box -->
        <div class="fo4-dialogue-box">
          <!-- Speaker Indicator -->
          <div class="fo4-speaker-indicator">
            <div class="fo4-speaker-icon">💬</div>
            <div class="fo4-speaker-name">SPEAKER</div>
          </div>

          <!-- Dialogue Text -->
          <div class="fo4-dialogue-text"></div>

          <!-- Response Options -->
          <div class="fo4-response-area"></div>

          <!-- Continue Prompt -->
          <button class="fo4-continue-prompt" style="display: none;">
            [CONTINUE]
          </button>
        </div>

        <!-- Close Button -->
        <button class="fo4-dialogue-close">✕ EXIT</button>
      `;

      document.body.appendChild(overlay);
      this.overlayEl = overlay;

      // Bind close button
      overlay.querySelector('.fo4-dialogue-close').addEventListener('click', () => this.endDialogue());

      // Click on text to skip typewriter
      overlay.querySelector('.fo4-dialogue-text').addEventListener('click', () => this._skipTypewriter());
    },

    // ============================================================
    // KEYBOARD EVENTS
    // ============================================================
    _bindKeyboardEvents() {
      document.addEventListener('keydown', (e) => {
        if (!this.isOpen) return;

        // Number keys 1-4 for responses
        if (e.key >= '1' && e.key <= '4') {
          const index = parseInt(e.key) - 1;
          const responseBtn = this.overlayEl.querySelectorAll('.fo4-response-option')[index];
          if (responseBtn) responseBtn.click();
        }

        // Space/Enter to continue
        if (e.key === ' ' || e.key === 'Enter') {
          const continueBtn = this.overlayEl.querySelector('.fo4-continue-prompt');
          if (continueBtn && continueBtn.style.display !== 'none') {
            continueBtn.click();
          } else {
            this._skipTypewriter();
          }
        }

        // Escape to close
        if (e.key === 'Escape') {
          this.endDialogue();
        }
      });
    },

    // ============================================================
    // QUICK DIALOGUE (Simple one-liner with responses)
    // ============================================================
    quickDialogue(npc, text, responses = null, onComplete = null) {
      const dialogueData = {
        text: text,
        responses: responses || [{ text: 'Okay.', end: true }]
      };
      
      this.startDialogue(npc, dialogueData, onComplete);
    },

    // ============================================================
    // NPC SAYS (Simple NPC statement, no responses needed)
    // ============================================================
    npcSays(npc, text, onComplete = null) {
      this.quickDialogue(npc, text, null, onComplete);
    }
  };

  // Export to Game.modules
  Game.modules.FO4Dialogue = FO4Dialogue;

  // Also export globally
  window.FO4Dialogue = FO4Dialogue;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => FO4Dialogue.init());
  } else {
    FO4Dialogue.init();
  }

})();
