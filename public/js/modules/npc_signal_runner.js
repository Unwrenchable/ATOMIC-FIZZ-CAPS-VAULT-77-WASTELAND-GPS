// npc_signal_runner.js
// ------------------------------------------------------------
// Handcrafted Story NPC: The Signal Runner
// Delivers the Wake Up quest - travels to wherever the player is
// Uses Overseer AI (HuggingFace API) for dynamic dialogue
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const SignalRunner = {
    id: "signal_runner",
    name: "The Signal Runner",
    npcData: null,
    currentPosition: null,
    isTracking: false,
    trackingInterval: null,
    conversationState: null,
    
    // Approach distance in meters
    APPROACH_DISTANCE: 5,
    // Movement speed (coordinate units per tick)
    MOVEMENT_SPEED: 0.00005,
    // Tracking update interval (ms)
    TRACKING_INTERVAL: 1000,

    // Static dialogue fallbacks
    dialogueFallbacks: {
      approach: [
        "Easy there... your signal's spiking. That's normal after a displacement.",
        "Found you. Your echo was louder than most.",
        "Don't move too fast. Your body's still syncing with this timeline."
      ],
      wake_up_intro: [
        "You weren't supposed to wake up here. Not like this. But here we are.",
        "I've been tracking your signal since the moment you slipped into this timeline.",
        "The Overseer flagged your emergence. I came as fast as I could."
      ],
      guidance: [
        "Check your inventory. Make sure everything made the jump with you.",
        "The radio might help. Atomic Fizz broadcasts on frequencies that cut through timeline noise.",
        "Your map should show where you are... or at least, where this timeline thinks you are."
      ],
      farewell: [
        "You'll find your footing. They always do. Eventually.",
        "I'll be watching your signal. Try not to flatline.",
        "The wasteland has its own rules. Learn them fast."
      ]
    },

    // AI dialogue configuration
    aiConfig: {
      enabled: true,
      systemPrompt: "You are The Signal Runner, a cryptic but caring guide in a post-apocalyptic wasteland. You track displaced consciousnesses across timelines. Speak in short, mysterious sentences with hints of deeper knowledge. You work with (but don't fully trust) an AI called the Overseer. Keep responses under 50 words.",
      maxTokens: 60,
      temperature: 0.8
    },

    // ------------------------------------------------------------
    // Initialize NPC data from JSON
    // ------------------------------------------------------------
    async init() {
      try {
        const response = await fetch('/data/npc/npc_signal_runner.json');
        if (response.ok) {
          this.npcData = await response.json();
          console.log("[Signal Runner] NPC data loaded");
        }
      } catch (err) {
        console.warn("[Signal Runner] Failed to load NPC data:", err);
      }
    },

    // ------------------------------------------------------------
    // Create NPC entity at a position
    // ------------------------------------------------------------
    createNPC(position) {
      const npc = {
        id: "signal_runner",
        name: "The Signal Runner",
        type: "story_npc",
        unique: true,
        position: { ...position },
        introLine: this.getRandomLine('approach'),
        travelsToPlayer: true,
        aiEnabled: this.aiConfig.enabled
      };
      
      this.currentPosition = npc.position;
      return npc;
    },

    // ------------------------------------------------------------
    // Start tracking and traveling to the player
    // ------------------------------------------------------------
    startTrackingPlayer() {
      if (this.isTracking) return;
      
      this.isTracking = true;
      console.log("[Signal Runner] Started tracking player location");
      
      this.trackingInterval = setInterval(() => {
        this._updatePositionTowardsPlayer();
      }, this.TRACKING_INTERVAL);
    },

    // ------------------------------------------------------------
    // Stop tracking the player
    // ------------------------------------------------------------
    stopTracking() {
      this.isTracking = false;
      if (this.trackingInterval) {
        clearInterval(this.trackingInterval);
        this.trackingInterval = null;
      }
      console.log("[Signal Runner] Stopped tracking player");
    },

    // ------------------------------------------------------------
    // Update position to move towards player
    // ------------------------------------------------------------
    _updatePositionTowardsPlayer() {
      if (!this.currentPosition) return;
      if (!Game.modules.worldmap) return;
      
      const playerPos = Game.modules.worldmap.getPlayerPosition();
      if (!playerPos) return;
      
      const distance = this._calculateDistance(this.currentPosition, playerPos);
      
      // If within approach distance, trigger interaction
      if (distance < this.APPROACH_DISTANCE) {
        this.stopTracking();
        this._onReachedPlayer();
        return;
      }
      
      // Move towards player
      const dx = playerPos.lat - this.currentPosition.lat;
      const dy = playerPos.lng - this.currentPosition.lng;
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      
      if (magnitude > 0) {
        this.currentPosition.lat += (dx / magnitude) * this.MOVEMENT_SPEED;
        this.currentPosition.lng += (dy / magnitude) * this.MOVEMENT_SPEED;
        
        // Update NPC position on map if worldmap supports it
        if (Game.modules.worldmap.updateNPCPosition) {
          Game.modules.worldmap.updateNPCPosition({
            id: this.id,
            position: this.currentPosition
          });
        }
      }
    },

    // ------------------------------------------------------------
    // Calculate distance between two positions
    // ------------------------------------------------------------
    _calculateDistance(pos1, pos2) {
      const dx = pos2.lat - pos1.lat;
      const dy = pos2.lng - pos1.lng;
      // Approximate meters (rough conversion)
      return Math.sqrt(dx * dx + dy * dy) * 111111;
    },

    // ------------------------------------------------------------
    // Called when Signal Runner reaches the player
    // ------------------------------------------------------------
    _onReachedPlayer() {
      console.log("[Signal Runner] Reached player, initiating dialogue");
      this.beginConversation();
    },

    // ------------------------------------------------------------
    // Begin conversation with player
    // ------------------------------------------------------------
    async beginConversation() {
      this.conversationState = {
        currentNode: 'root',
        history: []
      };
      
      // Load conversation tree from NPC data or use defaults
      const tree = this.npcData?.conversationTree || this._getDefaultConversationTree();
      const rootNode = tree.root;
      
      // Get NPC line (potentially AI-generated)
      const npcLine = await this._getNPCLine(rootNode);
      
      // Display dialogue (integrate with your dialogue UI system)
      this._displayDialogue(npcLine, rootNode.options);
    },

    // ------------------------------------------------------------
    // Get NPC dialogue line (AI or fallback)
    // ------------------------------------------------------------
    async _getNPCLine(node) {
      // If AI is enabled and node supports it, try AI generation
      if (this.aiConfig.enabled && node.useAI) {
        const aiLine = await this._generateAIDialogue(node.aiPromptContext || node.npc_line);
        if (aiLine) return aiLine;
      }
      
      // Return static line
      return node.npc_line;
    },

    // ------------------------------------------------------------
    // Generate AI-powered dialogue using Overseer personality
    // ------------------------------------------------------------
    async _generateAIDialogue(context) {
      // Use Overseer personality if available
      if (window.overseerPersonality?.speak) {
        try {
          const prompt = "[Context: " + context + "] Respond as The Signal Runner:";
          const response = await window.overseerPersonality.speak(prompt);
          if (response) {
            return response;
          }
        } catch (err) {
          console.warn("[Signal Runner] AI dialogue generation failed:", err);
        }
      }
      
      return null;
    },

    // ------------------------------------------------------------
    // Display dialogue to player (integrate with UI system)
    // ------------------------------------------------------------
    _displayDialogue(npcLine, options) {
      console.log("[Signal Runner] \"" + npcLine + "\"");
      
      // If Game has a dialogue UI, use it
      if (Game.modules.dialogueUI?.show) {
        Game.modules.dialogueUI.show({
          speaker: this.name,
          text: npcLine,
          options: options,
          onSelect: (choice) => this._handlePlayerChoice(choice)
        });
        return;
      }
      
      // Fallback: simple alert-based dialogue
      if (options && options.length > 0) {
        const optionText = options.map((opt, i) => (i + 1) + ". " + opt.player_choice).join('\n');
        const result = prompt(this.name + ":\n\n\"" + npcLine + "\"\n\nChoose (enter number):\n" + optionText);
        
        const choiceIndex = parseInt(result) - 1;
        if (choiceIndex >= 0 && choiceIndex < options.length) {
          this._handlePlayerChoice(options[choiceIndex]);
        }
      } else {
        alert(this.name + ":\n\n\"" + npcLine + "\"");
        this._endConversation();
      }
    },

    // ------------------------------------------------------------
    // Handle player dialogue choice
    // ------------------------------------------------------------
    async _handlePlayerChoice(choice) {
      if (!this.conversationState) return;
      
      this.conversationState.history.push({
        choice: choice.player_choice,
        node: this.conversationState.currentNode
      });
      
      const tree = this.npcData?.conversationTree || this._getDefaultConversationTree();
      const nextNode = tree[choice.next];
      
      if (!nextNode) {
        this._endConversation();
        return;
      }
      
      this.conversationState.currentNode = choice.next;
      
      // Check if this node completes something
      if (nextNode.completes) {
        this._onConversationComplete(nextNode.completes);
      }
      
      // Get NPC response
      const npcLine = await this._getNPCLine(nextNode);
      
      // Continue dialogue
      this._displayDialogue(npcLine, nextNode.options);
    },

    // ------------------------------------------------------------
    // Called when conversation completes a quest objective
    // ------------------------------------------------------------
    _onConversationComplete(completionId) {
      console.log("[Signal Runner] Conversation completed: " + completionId);
      
      // Trigger quest completion if applicable
      if (window.quests?.completeObjective) {
        window.quests.completeObjective('wake_up', 'npc_arrives');
      }
      
      // Fire custom event
      window.dispatchEvent(new CustomEvent('npc_conversation_complete', {
        detail: { npcId: this.id, completionId: completionId }
      }));
    },

    // ------------------------------------------------------------
    // End the conversation
    // ------------------------------------------------------------
    _endConversation() {
      console.log("[Signal Runner] Conversation ended");
      this.conversationState = null;
      
      // Fire conversation end event
      window.dispatchEvent(new CustomEvent('npc_conversation_end', {
        detail: { npcId: this.id }
      }));
    },

    // ------------------------------------------------------------
    // Get a random line from a dialogue category
    // ------------------------------------------------------------
    getRandomLine(category) {
      const lines = this.npcData?.dialog?.[category] || this.dialogueFallbacks[category];
      if (!lines || lines.length === 0) {
        return "...";
      }
      return lines[Math.floor(Math.random() * lines.length)];
    },

    // ------------------------------------------------------------
    // Default conversation tree (used if JSON not loaded)
    // ------------------------------------------------------------
    _getDefaultConversationTree() {
      return {
        root: {
          npc_line: "Easy... your pulse is spiking. That's normal after a wake signal.",
          options: [
            { player_choice: "Who are you?", next: "who_are_you" },
            { player_choice: "Where am I?", next: "where_am_i" },
            { player_choice: "What should I do?", next: "what_to_do" }
          ]
        },
        who_are_you: {
          npc_line: "Names don't mean much out here. But you can call me the Signal Runner. I track displaced consciousnesses like yours.",
          options: [
            { player_choice: "Thanks for finding me.", next: "end_positive" }
          ]
        },
        where_am_i: {
          npc_line: "The Mojave. Or what's left of it. But the real question isn't where... it's when.",
          options: [
            { player_choice: "I understand.", next: "end_positive" }
          ]
        },
        what_to_do: {
          npc_line: "First things first. Check your Pip-Boy. Inventory, map, radio. Get your bearings. Then start moving.",
          options: [
            { player_choice: "Got it.", next: "end_positive" }
          ]
        },
        end_positive: {
          npc_line: "Good luck out there. Your signal's stabilizing. You're going to be fine.",
          completes: "wake_up_npc_intro",
          options: []
        }
      };
    }
  };

  // Initialize on load
  SignalRunner.init();

  Game.modules.SignalRunner = SignalRunner;
})();
