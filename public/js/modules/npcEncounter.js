// npcEncounter.js
// ------------------------------------------------------------
// Scripted NPC Encounter Manager
// Handles story-driven NPC arrivals (e.g., Wake Up quest NPC)
// Supports NPCs that track and travel to player location
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Approximate meters per degree of latitude/longitude at mid-latitudes
  const METERS_PER_DEGREE = 111111;

  const npcEncounter = {
    activeEncounter: null,
    ambientNPCs: [], // Track background NPCs for ambient comments
    lastGreetingTime: 0,

    // ------------------------------------------------------------
    // Trigger a scripted encounter
    // npcId: string (your NPC template ID)
    // options: { spawnRadius, dialogId, onComplete, useSignalRunner }
    // ------------------------------------------------------------
    triggerEncounter(npcId, options = {}) {
      if (this.activeEncounter) {
        console.warn("[NPC Encounter] Encounter already active");
        return;
      }

      const radius = options.spawnRadius || 40; // meters
      const dialogId = options.dialogId || null;

      console.log("[NPC Encounter] Triggering encounter with " + npcId);

      // Special handling for Signal Runner - uses dedicated module
      if (npcId === "signal_runner" && Game.modules.SignalRunner) {
        this._triggerSignalRunnerEncounter(options);
        return;
      }

      // 1. Spawn NPC near player
      const npc = this._spawnNPCNearPlayer(npcId, radius);
      if (!npc) {
        console.warn("[NPC Encounter] Failed to spawn NPC");
        return;
      }

      this.activeEncounter = {
        npc,
        dialogId,
        onComplete: options.onComplete || null
      };

      // 2. Begin approach behavior
      this._beginApproach(npc);
    },

    // ------------------------------------------------------------
    // Signal Runner specific encounter handling
    // Uses the Signal Runner module for tracking and AI dialogue
    // ------------------------------------------------------------
    _triggerSignalRunnerEncounter(options) {
      const SignalRunner = Game.modules.SignalRunner;
      
      // Get player position for spawn
      let spawnPos = { lat: 36.1699, lng: -115.1398 }; // Default Vegas position
      if (Game.modules.worldmap?.getPlayerPosition) {
        const playerPos = Game.modules.worldmap.getPlayerPosition();
        if (playerPos) {
          // Spawn at a distance from player
          const angle = Math.random() * Math.PI * 2;
          const dist = options.spawnRadius || 50;
          spawnPos = {
            lat: playerPos.lat + (Math.cos(angle) * dist) / METERS_PER_DEGREE,
            lng: playerPos.lng + (Math.sin(angle) * dist) / METERS_PER_DEGREE
          };
        }
      }

      // Create the NPC entity
      const npc = SignalRunner.createNPC(spawnPos);
      
      // Add to world if possible
      if (Game.modules.worldmap?.addNPC) {
        Game.modules.worldmap.addNPC(npc);
      }

      this.activeEncounter = {
        npc,
        dialogId: options.dialogId,
        onComplete: options.onComplete || null,
        isSignalRunner: true
      };

      // Start tracking - Signal Runner will travel to player
      SignalRunner.startTrackingPlayer();

      // Listen for conversation completion
      const completeHandler = (event) => {
        if (event.detail.npcId === "signal_runner") {
          window.removeEventListener('npc_conversation_complete', completeHandler);
          this._finishEncounter();
        }
      };
      window.addEventListener('npc_conversation_complete', completeHandler);
    },

    // ------------------------------------------------------------
    // Spawn NPC near player using your NPC generator + worldmap
    // ------------------------------------------------------------
    _spawnNPCNearPlayer(npcId, radius) {
      // Check for Signal Runner module first
      if (npcId === "signal_runner" && Game.modules.SignalRunner) {
        const playerPos = Game.modules.worldmap?.getPlayerPosition() || { lat: 36.1699, lng: -115.1398 };
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        const spawnPos = {
          lat: playerPos.lat + (Math.cos(angle) * dist) / METERS_PER_DEGREE,
          lng: playerPos.lng + (Math.sin(angle) * dist) / METERS_PER_DEGREE
        };
        return Game.modules.SignalRunner.createNPC(spawnPos);
      }

      if (!Game.modules.worldmap || !Game.modules.npcGenerator) {
        console.warn("[NPC Encounter] Missing worldmap or npcGenerator");
        return null;
      }

      const playerPos = Game.modules.worldmap.getPlayerPosition();
      if (!playerPos) {
        console.warn("[NPC Encounter] No player position available");
        return null;
      }

      // Random offset around player
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;

      const spawnPos = {
        lat: playerPos.lat + (Math.cos(angle) * dist) / METERS_PER_DEGREE,
        lng: playerPos.lng + (Math.sin(angle) * dist) / METERS_PER_DEGREE
      };

      console.log("[NPC Encounter] Spawning NPC at:", spawnPos);

      // Use your NPC generator
      const npc = Game.modules.npcGenerator.createNPC(npcId, spawnPos);

      // Add to world
      Game.modules.worldmap.addNPC(npc);

      return npc;
    },

    // ------------------------------------------------------------
    // NPC walks toward player until within greeting distance
    // Continuously tracks player position
    // ------------------------------------------------------------
    _beginApproach(npc) {
      console.log("[NPC Encounter] NPC approaching player...");

      const interval = setInterval(() => {
        if (!Game.modules.worldmap) {
          clearInterval(interval);
          return;
        }

        const playerPos = Game.modules.worldmap.getPlayerPosition();
        if (!playerPos) return;

        const dist = Game.modules.worldmap.distanceBetween
          ? Game.modules.worldmap.distanceBetween(npc.position, playerPos)
          : this._calculateDistance(npc.position, playerPos);

        // Move NPC toward player (continuously tracking)
        this._moveToward(npc, playerPos);

        // Greeting distance reached
        if (dist < 5) {
          clearInterval(interval);
          this._beginDialog(npc);
        }
      }, 1000);
    },

    // ------------------------------------------------------------
    // Calculate distance between two positions (fallback)
    // ------------------------------------------------------------
    _calculateDistance(pos1, pos2) {
      const dx = pos2.lat - pos1.lat;
      const dy = pos2.lng - pos1.lng;
      return Math.sqrt(dx * dx + dy * dy) * METERS_PER_DEGREE;
    },

    // ------------------------------------------------------------
    // Move NPC toward a target position
    // ------------------------------------------------------------
    _moveToward(npc, targetPos) {
      const speed = 0.00003; // tune for your world scale

      const dx = targetPos.lat - npc.position.lat;
      const dy = targetPos.lng - npc.position.lng;
      const magnitude = Math.sqrt(dx * dx + dy * dy);

      if (magnitude > 0) {
        npc.position.lat += (dx / magnitude) * speed;
        npc.position.lng += (dy / magnitude) * speed;

        if (Game.modules.worldmap?.updateNPCPosition) {
          Game.modules.worldmap.updateNPCPosition(npc);
        }
      }
    },

    // ------------------------------------------------------------
    // Trigger dialog - uses Fallout 4 style dialogue system
    // ------------------------------------------------------------
    _beginDialog(npc) {
      console.log("[NPC Encounter] NPC reached player, starting dialog...");

      // If it's the Signal Runner, use its conversation system
      if (npc.id === "signal_runner" && Game.modules.SignalRunner) {
        Game.modules.SignalRunner.beginConversation();
        return;
      }

      // Use Fallout 4 style dialogue system if available
      if (Game.modules.FO4Dialogue) {
        // Create dialogue data from NPC
        const dialogueData = this._buildNPCDialogue(npc);
        
        Game.modules.FO4Dialogue.startDialogue(npc, dialogueData, () => {
          this._finishEncounter();
        });
        return;
      }

      // Fallback: Placeholder dialog for other NPCs
      alert(npc.name + " approaches you.\n\n\"" + (npc.introLine || "...") + "\"");

      this._finishEncounter();
    },

    // ------------------------------------------------------------
    // Build dialogue data from NPC definition
    // ------------------------------------------------------------
    _buildNPCDialogue(npc) {
      const dialogue = {
        nodes: []
      };

      // Build intro node
      const introNode = {
        id: 'intro',
        text: npc.introLine || npc.dialog?.idle?.[0] || "...",
        responses: []
      };

      // Add basic responses
      if (npc.dialog?.player_choice) {
        npc.dialog.player_choice.forEach((choice, i) => {
          introNode.responses.push({
            text: choice,
            tone: 'question',
            next: `response_${i}`
          });
        });
      }

      // Add a goodbye option
      introNode.responses.push({
        text: 'Goodbye.',
        tone: 'neutral',
        end: true
      });

      dialogue.nodes.push(introNode);

      // Add response nodes if NPC has additional dialog
      if (npc.dialog) {
        // Add knowledge nodes
        if (npc.dialog.human_moment) {
          npc.dialog.human_moment.forEach((text, i) => {
            dialogue.nodes.push({
              id: `response_${i}`,
              text: text,
              responses: [{ text: 'I see...', end: true }]
            });
          });
        }

        // Add glitch dialog for special NPCs
        if (npc.dialog.glitch) {
          dialogue.nodes.push({
            id: 'glitch',
            text: npc.dialog.glitch[Math.floor(Math.random() * npc.dialog.glitch.length)],
            responses: [{ text: 'What?', next: 'intro' }]
          });
        }
      }

      return dialogue;
    },

    // ------------------------------------------------------------
    // Cleanup + quest callback
    // ------------------------------------------------------------
    _finishEncounter() {
      console.log("[NPC Encounter] Encounter complete");

      const enc = this.activeEncounter;
      this.activeEncounter = null;

      if (enc && typeof enc.onComplete === "function") {
        enc.onComplete();
      }
    },

    // ============================================================
    // AMBIENT NPC REACTIONS
    // ============================================================
    
    // Register an NPC for ambient behaviors
    registerAmbientNPC(npc) {
      if (!this.ambientNPCs.find(n => n.id === npc.id)) {
        this.ambientNPCs.push(npc);
        console.log('[NPC Encounter] Ambient NPC registered:', npc.name);
      }
    },

    // Check if player is near any ambient NPCs
    checkAmbientReactions(playerPos) {
      if (!playerPos || !Game.modules.worldmap) return;
      
      const now = Date.now();
      
      this.ambientNPCs.forEach(npc => {
        if (!npc.position) return;
        
        const dist = Game.modules.worldmap.distanceBetween
          ? Game.modules.worldmap.distanceBetween(npc.position, playerPos)
          : this._calculateDistance(npc.position, playerPos);
        
        // Player approaching (10-15m range)
        if (dist < 15 && dist > 10) {
          this._npcTurnToPlayer(npc, playerPos);
        }
        
        // Player very close (< 5m) - greeting
        if (dist < 5 && now - this.lastGreetingTime > 5000) {
          this._npcGreetPlayer(npc);
          this.lastGreetingTime = now;
        }
        
        // Background comments (random, 15-25m range)
        if (dist > 15 && dist < 25) {
          this._npcAmbientComment(npc);
        }
      });
    },

    // NPC turns to face player
    _npcTurnToPlayer(npc, playerPos) {
      // Calculate angle to player
      const dx = playerPos.lat - npc.position.lat;
      const dy = playerPos.lng - npc.position.lng;
      const angle = Math.atan2(dy, dx);
      
      // Update NPC rotation if supported
      if (npc.rotation !== undefined) {
        npc.rotation = angle;
        
        if (Game.modules.worldmap?.updateNPCRotation) {
          Game.modules.worldmap.updateNPCRotation(npc);
        }
      }
      
      // Trigger greeting animation if available
      if (npc.animations?.greet && Game.modules.Dragon) {
        // Play greeting animation
        console.log(`[NPC Encounter] ${npc.name} notices player`);
      }
    },

    // NPC greets player
    _npcGreetPlayer(npc) {
      const greetings = this._getTimeBasedGreetings();
      
      // Random greeting based on NPC disposition
      let greeting;
      if (npc.disposition === 'hostile') {
        greeting = this._getHostileComment();
      } else if (npc.disposition === 'suspicious') {
        greeting = this._getSuspiciousComment();
      } else {
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        const index = random[0] % greetings.length;
        greeting = greetings[index];
      }
      
      // Show greeting popup
      this._showAmbientPopup(npc.name, greeting);
    },

    // Background ambient comments
    _npcAmbientComment(npc) {
      // Random chance to comment (low probability to avoid spam)
      const random = new Uint32Array(1);
      crypto.getRandomValues(random);
      
      if (random[0] / 0xFFFFFFFF > 0.998) { // 0.2% chance per check
        const comments = [
          "Another day in the wasteland...",
          "Think it might rain radiation?",
          "Seen any good scrap lately?",
          "Hope the raiders don't come through today.",
          "Caps are getting harder to come by.",
          "That Atomic Fizz stuff... makes you glow.",
          "Vault dwellers... always thinking they're special.",
          "Watch out for the radscorpions.",
          "Trade routes are getting dangerous.",
          "Wonder what's in those old ruins..."
        ];
        
        const index = random[0] % comments.length;
        this._showAmbientPopup(npc.name, comments[index], true);
      }
    },

    // Get time-of-day appropriate greetings
    _getTimeBasedGreetings() {
      const hour = new Date().getHours();
      
      if (hour >= 5 && hour < 12) {
        return [
          "Morning, wanderer.",
          "Early start today?",
          "Another sunrise in the wasteland.",
          "Good morning... if you can call it that."
        ];
      } else if (hour >= 12 && hour < 18) {
        return [
          "Afternoon.",
          "How's the day treating you?",
          "Hot one today.",
          "Making any progress out there?"
        ];
      } else if (hour >= 18 && hour < 22) {
        return [
          "Evening.",
          "Getting dark soon.",
          "Heading back before nightfall?",
          "Better find shelter soon."
        ];
      } else {
        return [
          "Can't sleep either?",
          "Dangerous to be out this late.",
          "What brings you out at this hour?",
          "Night patrols are active."
        ];
      }
    },

    _getHostileComment() {
      const comments = [
        "Get lost.",
        "Move along.",
        "You don't belong here.",
        "Keep walking.",
        "This is my territory."
      ];
      const random = new Uint32Array(1);
      crypto.getRandomValues(random);
      return comments[random[0] % comments.length];
    },

    _getSuspiciousComment() {
      const comments = [
        "Who are you?",
        "What do you want?",
        "I'm watching you...",
        "Don't try anything.",
        "State your business."
      ];
      const random = new Uint32Array(1);
      crypto.getRandomValues(random);
      return comments[random[0] % comments.length];
    },

    // Show ambient comment popup
    _showAmbientPopup(name, text, whisper = false) {
      const popup = document.createElement('div');
      popup.style.cssText = `
        position: fixed;
        top: 20%;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 20, 10, 0.95);
        border: 1px solid ${whisper ? 'rgba(255, 170, 0, 0.3)' : 'rgba(0, 255, 65, 0.5)'};
        padding: 12px 20px;
        font-family: 'Consolas', monospace;
        font-size: ${whisper ? '11px' : '13px'};
        color: ${whisper ? '#ffaa00' : '#00ff41'};
        text-shadow: 0 0 5px currentColor;
        z-index: 9000;
        animation: ambientFade 4s forwards;
        pointer-events: none;
        max-width: 400px;
        text-align: center;
      `;
      
      popup.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px; opacity: 0.7;">${name}</div>
        <div>${text}</div>
      `;
      
      // Add animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes ambientFade {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          15% { opacity: 1; transform: translateX(-50%) translateY(0); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(10px); }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(popup);
      
      setTimeout(() => {
        popup.remove();
        style.remove();
      }, 4000);
    },

    // Initialize ambient behavior monitoring
    startAmbientMonitoring() {
      if (this._ambientInterval) return;
      
      this._ambientInterval = setInterval(() => {
        if (!Game.modules.worldmap) return;
        
        const playerPos = Game.modules.worldmap.getPlayerPosition();
        if (playerPos) {
          this.checkAmbientReactions(playerPos);
        }
      }, 2000); // Check every 2 seconds
      
      console.log('[NPC Encounter] Ambient monitoring started');
    },

    stopAmbientMonitoring() {
      if (this._ambientInterval) {
        clearInterval(this._ambientInterval);
        this._ambientInterval = null;
        console.log('[NPC Encounter] Ambient monitoring stopped');
      }
    }
  };

  Game.modules.npcEncounter = npcEncounter;
})();
