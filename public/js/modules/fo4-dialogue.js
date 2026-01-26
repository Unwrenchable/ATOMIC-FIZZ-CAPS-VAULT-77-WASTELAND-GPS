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
    useWheelLayout: false, // Toggle between wheel and list
    currentDragonBonesDisplay: null,
    lipSyncInterval: null,

    // ============================================================
    // INITIALIZATION
    // ============================================================
    init() {
      this._createOverlay();
      this._bindKeyboardEvents();
      
      // Load player appearance if available
      this._loadPlayerAppearance();
      
      // Initialize companion affinity system
      this._initCompanionAffinity();
      
      console.log("[FO4Dialogue] Initialized with enhanced F4 features");
    },

    // ============================================================
    // COMPANION AFFINITY SYSTEM
    // ============================================================
    _initCompanionAffinity() {
      if (!Game.companions) {
        Game.companions = {};
      }
      
      // Ensure each companion has an affinity value (-1000 to +1000)
      if (!Game.companions.affinity) {
        Game.companions.affinity = {};
      }
      
      // Load saved affinity from localStorage
      try {
        const saved = localStorage.getItem('companion_affinity');
        if (saved) {
          const savedAffinity = JSON.parse(saved);
          Game.companions.affinity = { ...Game.companions.affinity, ...savedAffinity };
          console.log('[FO4Dialogue] Loaded companion affinity from storage');
        }
      } catch (e) {
        console.warn('[FO4Dialogue] Could not load saved affinity', e);
      }
    },

    getCompanionAffinity(companionId) {
      return Game.companions.affinity[companionId] || 0;
    },

    modifyCompanionAffinity(companionId, amount) {
      if (!Game.companions.affinity[companionId]) {
        Game.companions.affinity[companionId] = 0;
      }
      
      Game.companions.affinity[companionId] += amount;
      
      // Clamp between -1000 and +1000
      Game.companions.affinity[companionId] = Math.max(-1000, 
        Math.min(1000, Game.companions.affinity[companionId]));
      
      // Save to localStorage
      try {
        localStorage.setItem('companion_affinity', 
          JSON.stringify(Game.companions.affinity));
      } catch (e) {
        console.warn('[FO4Dialogue] Could not save affinity', e);
      }
      
      return Game.companions.affinity[companionId];
    },

    getAffinityLevel(companionId) {
      const affinity = this.getCompanionAffinity(companionId);
      
      if (affinity >= 750) return 'idolizes';
      if (affinity >= 500) return 'admires';
      if (affinity >= 250) return 'likes';
      if (affinity >= -250) return 'neutral';
      if (affinity >= -500) return 'dislikes';
      if (affinity >= -750) return 'hates';
      return 'despises';
    },

    // Toggle between wheel and list layout
    toggleWheelLayout(useWheel) {
      this.useWheelLayout = useWheel;
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
      
      // Stop lip sync
      if (this.lipSyncInterval) {
        clearInterval(this.lipSyncInterval);
        this.lipSyncInterval = null;
      }
      
      // Cleanup DragonBones display
      if (this.currentDragonBonesDisplay) {
        this._cleanupDragonBones();
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

      // Activate NPC portrait with zoom effect
      this._setActivePortrait('npc');
      this._applyPortraitZoom('npc');

      // Apply NPC type visual effects
      this._applyNPCVisualEffects();

      // Clear previous content
      textEl.innerHTML = '';
      responseArea.innerHTML = '';
      responseArea.classList.remove('visible');
      continuePrompt.style.display = 'none';

      // Process and sanitize text for display
      let displayText = node.text || '';
      // Convert <br> to newlines first
      displayText = displayText.replace(/<br\s*\/?>/gi, '\n');
      // Use a DOM-based approach for safe HTML stripping
      const tempDiv = document.createElement('div');
      tempDiv.textContent = displayText; // This escapes any HTML
      displayText = tempDiv.textContent;
      // Restore newlines that we intentionally converted
      displayText = displayText.replace(/\\n/g, '\n');

      // Start lip sync animation during text display
      this._startLipSync();

      // Typewriter effect
      this._typewriterEffect(textEl, displayText, () => {
        // Stop lip sync when done
        this._stopLipSync();

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
        this._handleQuestOffer(node);
      }

      // Handle barter option
      if (node.barter && Game.economy) {
        this._showBarterOption(node);
      }

      // Handle rumor system
      if (node.rumor) {
        this._handleRumor(node.rumor);
      }

      // Handle knowledge unlocks
      if (node.knowledge_unlock) {
        this._handleKnowledgeUnlock(node.knowledge_unlock);
      }

      // Handle rewards
      if (node.rewards) {
        this._giveRewards(node.rewards);
      }
    },

    // ============================================================
    // TYPEWRITER EFFECT
    // ============================================================
    _typewriterEffect(element, text, onComplete) {
      const speed = 25; // ms per character
      let index = 0;

      // Store current state for skip functionality
      this._currentTypewriterText = text;
      this._currentTypewriterCallback = onComplete;
      this._currentTypewriterElement = element;

      element.classList.add('typing');

      this.typewriterInterval = setInterval(() => {
        if (index < text.length) {
          element.textContent += text[index];
          index++;
        } else {
          clearInterval(this.typewriterInterval);
          this.typewriterInterval = null;
          element.classList.remove('typing');
          this._currentTypewriterText = null;
          this._currentTypewriterCallback = null;
          this._currentTypewriterElement = null;
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

        // Complete the text immediately
        if (this._currentTypewriterElement && this._currentTypewriterText) {
          this._currentTypewriterElement.textContent = this._currentTypewriterText;
          this._currentTypewriterElement.classList.remove('typing');
        }

        // Trigger the callback
        const callback = this._currentTypewriterCallback;
        this._currentTypewriterText = null;
        this._currentTypewriterCallback = null;
        this._currentTypewriterElement = null;

        if (callback) callback();
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

      // Check if we should use wheel layout
      if (this.useWheelLayout && responses.length <= 4) {
        this._showWheelResponses(responses);
        return;
      }

      // Standard list layout
      responses.forEach((response, index) => {
        const btn = document.createElement('button');
        btn.className = 'fo4-response-option';
        
        // Build response HTML with speech check if present
        let innerHTML = `<span class="fo4-response-key">${index + 1}</span>`;
        
        // Add speech check badge
        if (response.speechCheck || response.skillCheck) {
          const check = response.speechCheck || response.skillCheck;
          const difficulty = check.difficulty || 'medium';
          const stat = check.stat || 'charisma';
          innerHTML += `<span class="fo4-speech-badge ${difficulty}">[${stat.toUpperCase()}]</span>`;
        }
        
        innerHTML += `<span class="fo4-response-text">${response.text || response.label || 'Continue'}</span>`;
        
        if (response.tone) {
          innerHTML += `<span class="fo4-response-tone">[${response.tone}]</span>`;
        }
        
        btn.innerHTML = innerHTML;

        btn.addEventListener('click', () => this._selectResponse(response));
        responseArea.appendChild(btn);
      });

      // Show with animation
      setTimeout(() => {
        responseArea.classList.add('visible');
      }, 100);
    },

    // ============================================================
    // SHOW WHEEL LAYOUT RESPONSES (Fallout 4 Diamond)
    // ============================================================
    _showWheelResponses(responses) {
      const responseArea = this.overlayEl.querySelector('.fo4-response-area');
      
      // Create wheel container
      const wheel = document.createElement('div');
      wheel.className = 'fo4-response-wheel active';
      
      // Add center indicator
      const center = document.createElement('div');
      center.className = 'fo4-wheel-center';
      center.textContent = 'WASD';
      wheel.appendChild(center);

      // Position mapping for diamond layout
      const positions = ['top', 'right', 'bottom', 'left'];
      const keys = ['W', 'D', 'S', 'A'];

      responses.forEach((response, index) => {
        if (index >= 4) return; // Max 4 options in wheel
        
        const btn = document.createElement('button');
        btn.className = `fo4-wheel-option ${positions[index]}`;
        
        let innerHTML = `<span class="fo4-wheel-key">${keys[index]}</span>`;
        
        // Add speech check if present
        if (response.speechCheck || response.skillCheck) {
          const check = response.speechCheck || response.skillCheck;
          const difficulty = check.difficulty || 'medium';
          innerHTML += `<span class="fo4-speech-badge ${difficulty}" style="font-size: 8px; margin: 2px 0;">[CHECK]</span>`;
        }
        
        innerHTML += `<span>${response.text || 'Continue'}</span>`;
        
        btn.innerHTML = innerHTML;
        btn.addEventListener('click', () => this._selectResponse(response));
        
        wheel.appendChild(btn);
      });

      responseArea.appendChild(wheel);
      
      // Animate in
      setTimeout(() => {
        wheel.classList.add('visible');
      }, 100);
    },

    // ============================================================
    // SELECT A RESPONSE
    // ============================================================
    _selectResponse(response) {
      // Handle speech/skill checks
      if (response.speechCheck || response.skillCheck) {
        const checkPassed = this._performSkillCheck(response.speechCheck || response.skillCheck);
        
        if (!checkPassed) {
          // Failed check - show failure and potentially different path
          if (response.onFailure) {
            this._goToNode(response.onFailure);
          } else {
            this.showQuestUpdate('CHECK FAILED', 'Your persuasion attempt failed.');
            this.endDialogue();
          }
          return;
        }
        
        // Success - show feedback
        this.showQuestUpdate('CHECK PASSED', 'Persuasion successful!');
      }

      // Handle companion affinity changes
      if (response.affinity) {
        const activeCompanion = this._getActiveCompanion();
        if (activeCompanion) {
          const newAffinity = this.modifyCompanionAffinity(activeCompanion.id, response.affinity);
          this._showAffinityChange(activeCompanion.name, response.affinity);
          
          // Check for affinity threshold events
          this._checkAffinityThresholds(activeCompanion.id, newAffinity);
        }
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
    // PERFORM SKILL CHECK (Speech/Charisma/etc)
    // ============================================================
    _performSkillCheck(check) {
      const difficulty = check.difficulty || 'medium';
      const stat = check.stat || 'charisma';
      
      // Get player stats
      const playerStats = this._getPlayerStats();
      const statValue = playerStats[stat] || 5;
      
      // Difficulty thresholds and success chances
      const thresholds = {
        easy: { required: 3, baseChance: 0.75 },
        medium: { required: 5, baseChance: 0.50 },
        hard: { required: 7, baseChance: 0.25 }
      };
      
      const threshold = thresholds[difficulty] || thresholds.medium;
      
      // Calculate success chance
      let successChance = threshold.baseChance;
      
      // Stat bonus: each point above threshold adds 10%
      if (statValue >= threshold.required) {
        successChance = Math.min(0.95, threshold.baseChance + (statValue - threshold.required) * 0.1);
      } else {
        // Stat penalty: each point below threshold removes 10%
        successChance = Math.max(0.05, threshold.baseChance - (threshold.required - statValue) * 0.1);
      }
      
      // Perform check using crypto random
      const randomArray = new Uint32Array(1);
      crypto.getRandomValues(randomArray);
      const roll = randomArray[0] / (0xFFFFFFFF + 1); // 0-1
      
      const passed = roll < successChance;
      
      // Show result UI
      this._showSpeechCheckResult(passed, difficulty);
      
      console.log(`[F04Dialogue] Skill check: ${stat} ${difficulty} - Roll: ${roll.toFixed(2)}, Chance: ${successChance.toFixed(2)}, Result: ${passed ? 'PASS' : 'FAIL'}`);
      
      return passed;
    },

    // ============================================================
    // SHOW SPEECH CHECK RESULT
    // ============================================================
    _showSpeechCheckResult(success, difficulty) {
      const result = document.createElement('div');
      result.className = `fo4-speech-result ${success ? 'success' : 'failure'}`;
      result.textContent = success ? '✓ SUCCESS' : '✗ FAILED';
      
      document.body.appendChild(result);
      
      setTimeout(() => {
        result.remove();
      }, 2500);
    },

    // ============================================================
    // GET PLAYER STATS
    // ============================================================
    _getPlayerStats() {
      // Try to get from character system
      if (Game.modules?.CharacterCreator?.getStats) {
        return Game.modules.CharacterCreator.getStats();
      }
      
      // Try from player object
      if (Game.player?.stats) {
        return Game.player.stats;
      }
      
      // Default stats
      return {
        charisma: 5,
        intelligence: 5,
        luck: 5,
        strength: 5,
        perception: 5,
        endurance: 5,
        agility: 5
      };
    },

    // ============================================================
    // GET ACTIVE COMPANION
    // ============================================================
    _getActiveCompanion() {
      if (Game.companions?.active) {
        return Game.companions.active;
      }
      
      // Check for companions in party
      if (Game.party?.members && Game.party.members.length > 0) {
        return Game.party.members[0];
      }
      
      return null;
    },

    // ============================================================
    // CHECK AFFINITY THRESHOLDS
    // ============================================================
    _checkAffinityThresholds(companionId, affinity) {
      // Check for special events at affinity milestones
      const thresholds = [
        { value: 1000, event: 'companion_idolizes' },
        { value: 750, event: 'companion_admires' },
        { value: 500, event: 'companion_likes' },
        { value: -500, event: 'companion_dislikes' },
        { value: -750, event: 'companion_hates' },
        { value: -1000, event: 'companion_despises' }
      ];
      
      thresholds.forEach(threshold => {
        const key = `${companionId}_${threshold.event}`;
        // Skip if flag already set OR if Game.flags not available
        if (!Game.flags || Game.flags.get(key)) return;
        
        if (affinity >= threshold.value && threshold.value > 0) {
          Game.flags.set(key, true);
          window.dispatchEvent(new CustomEvent(threshold.event, {
            detail: { companionId, affinity }
          }));
        } else if (affinity <= threshold.value && threshold.value < 0) {
          Game.flags.set(key, true);
          window.dispatchEvent(new CustomEvent(threshold.event, {
            detail: { companionId, affinity }
          }));
        }
      });
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
    async _renderPortraits() {
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

      // NPC portrait with enhanced DragonBones support
      if (npcPortrait && this.currentNPC) {
        const npcSvg = npcPortrait.querySelector('.fo4-portrait-svg');
        const npcName = npcPortrait.querySelector('.fo4-portrait-name');
        const npcRole = npcPortrait.querySelector('.fo4-portrait-role');

        // Try DragonBones first if NPC has armatureBase
        if (this.currentNPC.armatureBase && Game.modules.Dragon) {
          try {
            // Initialize DragonBones in a dedicated container
            const dbContainer = document.createElement('div');
            dbContainer.id = 'dialogDragonBonesStage';
            dbContainer.style.width = '160px';
            dbContainer.style.height = '200px';
            npcSvg.innerHTML = '';
            npcSvg.appendChild(dbContainer);
            
            await Game.modules.Dragon.init('dialogDragonBonesStage');
            await Game.modules.Dragon.loadArmatureJSON(this.currentNPC.armatureBase);
            
            // Get variation for this NPC
            const variation = Game.modules.Dragon.getRandomVariation(this.currentNPC.id || 'default');
            
            this.currentDragonBonesDisplay = await Game.modules.Dragon.createArmatureDisplay(
              this.currentNPC.armatureName || 'hero',
              'idle',
              this.currentNPC.id
            );
            
            console.log('[FO4Dialogue] DragonBones display created for', this.currentNPC.name);
          } catch (e) {
            console.warn('[FO4Dialogue] DragonBones failed, falling back to SVG', e);
            this.currentDragonBonesDisplay = null;
          }
        }

        // Fallback to SVG if DragonBones not available
        if (!this.currentDragonBonesDisplay) {
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
            // Final fallback icon
            const icon = this.currentNPC.icon || '👤';
            npcSvg.innerHTML = `<div style="font-size: 80px; display: flex; align-items: center; justify-content: center; height: 100%;">${icon}</div>`;
          }
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
    // DRAGONBONES LIP SYNC
    // ============================================================
    _startLipSync() {
      if (!this.currentDragonBonesDisplay) return;
      
      this.lipSyncInterval = setInterval(() => {
        // Simplified lip sync - toggle mouth animation
        if (this.currentDragonBonesDisplay.animation) {
          // Random chance to open mouth during speech
          const random = new Uint32Array(1);
          crypto.getRandomValues(random);
          if (random[0] / 0xFFFFFFFF > 0.5) {
            // Trigger talk animation or mouth open slot
            try {
              this.currentDragonBonesDisplay.animation.play('talk', 1);
            } catch (e) {
              // Fallback: just keep idle animation
            }
          }
        }
      }, 150);
    },

    _stopLipSync() {
      if (this.lipSyncInterval) {
        clearInterval(this.lipSyncInterval);
        this.lipSyncInterval = null;
      }
      
      // Return to idle animation
      if (this.currentDragonBonesDisplay?.animation) {
        try {
          this.currentDragonBonesDisplay.animation.play('idle');
        } catch (e) {
          // Silent fail
        }
      }
    },

    _cleanupDragonBones() {
      if (this.currentDragonBonesDisplay) {
        try {
          if (this.currentDragonBonesDisplay._idleTicker && Game.modules.Dragon?.app) {
            Game.modules.Dragon.app.ticker.remove(this.currentDragonBonesDisplay._idleTicker);
          }
          if (Game.modules.Dragon?.app?.stage) {
            Game.modules.Dragon.app.stage.removeChild(this.currentDragonBonesDisplay);
          }
          this.currentDragonBonesDisplay.destroy?.({ children: true });
        } catch (e) {
          console.warn('[FO4Dialogue] DragonBones cleanup error', e);
        }
        this.currentDragonBonesDisplay = null;
      }
    },

    // ============================================================
    // NPC VISUAL EFFECTS
    // ============================================================
    _applyNPCVisualEffects() {
      const npcFrame = this.overlayEl.querySelector('.fo4-portrait-frame.npc');
      if (!npcFrame || !this.currentNPC) return;
      
      // Remove all effect classes first
      npcFrame.classList.remove('glitch', 'ghoul', 'synth', 'robot');
      
      // Apply based on NPC type/mood
      const npcType = (this.currentNPC.type || '').toLowerCase();
      const npcRace = (this.currentNPC.appearance?.race || '').toLowerCase();
      const npcMood = (this.currentNPC.mood || this.currentNPC.disposition || '').toLowerCase();
      
      if (npcType.includes('ghoul') || npcRace.includes('ghoul')) {
        npcFrame.classList.add('ghoul');
      } else if (npcType.includes('synth') || npcRace.includes('synth')) {
        npcFrame.classList.add('synth');
      } else if (npcType.includes('robot') || npcType.includes('bot')) {
        npcFrame.classList.add('robot');
      } else if (npcMood.includes('hostile') || npcMood.includes('suspicious')) {
        npcFrame.classList.add('glitch');
      }
    },

    _applyPortraitZoom(which) {
      const portrait = which === 'player' 
        ? this.overlayEl.querySelector('.fo4-portrait-frame:not(.npc)')
        : this.overlayEl.querySelector('.fo4-portrait-frame.npc');
      
      if (!portrait) return;
      
      portrait.classList.remove('zoom');
      // Trigger reflow
      void portrait.offsetWidth;
      portrait.classList.add('zoom');
    },

    // ============================================================
    // QUEST HANDLING
    // ============================================================
    _handleQuestOffer(node) {
      const questId = node.offers_quest;
      
      // Show quest accept UI after dialogue
      setTimeout(() => {
        const accept = confirm(`New Quest: ${questId}\n\nAccept this quest?`);
        
        if (accept && Game.quests) {
          Game.quests.startQuest(questId);
          this.showQuestUpdate('NEW QUEST', `${questId} added to your Pip-Boy`);
        }
      }, 500);
    },

    _giveRewards(rewards) {
      // Give caps
      if (rewards.caps && Game.economy) {
        Game.economy.addCaps(rewards.caps);
        this.showQuestUpdate('CAPS', `+${rewards.caps} bottle caps`);
      }
      
      // Give XP
      if (rewards.xp && Game.player) {
        Game.player.addXP(rewards.xp);
        this.showQuestUpdate('EXPERIENCE', `+${rewards.xp} XP`);
      }
      
      // Give items
      if (rewards.items && Game.inventory) {
        rewards.items.forEach(itemId => {
          Game.inventory.addItem(itemId);
        });
        this.showQuestUpdate('ITEMS', `Received ${rewards.items.length} item(s)`);
      }
    },

    // ============================================================
    // BARTER SYSTEM
    // ============================================================
    _showBarterOption(node) {
      // Add a barter response option dynamically
      setTimeout(() => {
        const responseArea = this.overlayEl.querySelector('.fo4-response-area');
        
        const barterBtn = document.createElement('button');
        barterBtn.className = 'fo4-response-option';
        barterBtn.innerHTML = `
          <span class="fo4-response-key">$</span>
          <span class="fo4-response-text">TRADE</span>
          <span class="fo4-response-tone">[Barter]</span>
        `;
        
        barterBtn.addEventListener('click', () => {
          if (Game.economy?.openTrade) {
            Game.economy.openTrade(this.currentNPC);
          } else {
            alert('Trading system not available');
          }
        });
        
        responseArea.appendChild(barterBtn);
      }, 200);
    },

    // ============================================================
    // RUMOR SYSTEM
    // ============================================================
    _handleRumor(rumor) {
      // Add to rumor log
      if (!Game.rumors) {
        Game.rumors = [];
      }
      
      Game.rumors.push({
        text: rumor,
        source: this.currentNPC?.name || 'Unknown',
        timestamp: Date.now()
      });
      
      // Save to localStorage
      try {
        localStorage.setItem('rumors', JSON.stringify(Game.rumors));
      } catch (e) {
        console.warn('[FO4Dialogue] Could not save rumor', e);
      }
      
      console.log('[FO4Dialogue] Rumor added:', rumor);
    },

    // ============================================================
    // KNOWLEDGE UNLOCKS
    // ============================================================
    _handleKnowledgeUnlock(knowledge) {
      // Reveal map markers
      if (knowledge.map_markers && Game.modules.worldmap) {
        knowledge.map_markers.forEach(markerId => {
          Game.modules.worldmap.revealMarker(markerId);
        });
        this.showQuestUpdate('LOCATION DISCOVERED', `New map markers revealed`);
      }
      
      // Add lore entries
      if (knowledge.lore && Game.lore) {
        Game.lore.unlock(knowledge.lore);
      }
      
      // Unlock perks
      if (knowledge.perks && Game.player) {
        knowledge.perks.forEach(perkId => {
          Game.player.unlockPerk(perkId);
        });
      }
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

        // Check if wheel layout is active
        const wheel = this.overlayEl.querySelector('.fo4-response-wheel.active');
        
        if (wheel) {
          // WASD navigation for wheel
          const wheelOptions = wheel.querySelectorAll('.fo4-wheel-option');
          
          if (e.key === 'w' || e.key === 'W') {
            wheelOptions[0]?.click(); // Top
          } else if (e.key === 'd' || e.key === 'D') {
            wheelOptions[1]?.click(); // Right
          } else if (e.key === 's' || e.key === 'S') {
            wheelOptions[2]?.click(); // Bottom
          } else if (e.key === 'a' || e.key === 'A') {
            wheelOptions[3]?.click(); // Left
          }
        } else {
          // Number keys 1-4 for list responses
          if (e.key >= '1' && e.key <= '4') {
            const index = parseInt(e.key) - 1;
            const responseBtn = this.overlayEl.querySelectorAll('.fo4-response-option')[index];
            if (responseBtn) responseBtn.click();
          }
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
        
        // Tab to toggle layout (for testing)
        if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          this.useWheelLayout = !this.useWheelLayout;
          console.log('[FO4Dialogue] Layout toggled:', this.useWheelLayout ? 'WHEEL' : 'LIST');
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
