// npcEncounter.js
// ------------------------------------------------------------
// Scripted NPC Encounter Manager
// Handles story-driven NPC arrivals (e.g., Wake Up quest NPC)
// Supports NPCs that track and travel to player location
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const npcEncounter = {
    activeEncounter: null,

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
            lat: playerPos.lat + (Math.cos(angle) * dist) / 111111,
            lng: playerPos.lng + (Math.sin(angle) * dist) / 111111
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
          lat: playerPos.lat + (Math.cos(angle) * dist) / 111111,
          lng: playerPos.lng + (Math.sin(angle) * dist) / 111111
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
        lat: playerPos.lat + (Math.cos(angle) * dist) / 111111,
        lng: playerPos.lng + (Math.sin(angle) * dist) / 111111
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
      return Math.sqrt(dx * dx + dy * dy) * 111111;
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
    // Trigger dialog - uses Signal Runner's conversation system if available
    // ------------------------------------------------------------
    _beginDialog(npc) {
      console.log("[NPC Encounter] NPC reached player, starting dialog...");

      // If it's the Signal Runner, use its conversation system
      if (npc.id === "signal_runner" && Game.modules.SignalRunner) {
        Game.modules.SignalRunner.beginConversation();
        return;
      }

      // Placeholder dialog for other NPCs
      alert(npc.name + " approaches you.\n\n\"" + (npc.introLine || "...") + "\"");

      this._finishEncounter();
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
    }
  };

  Game.modules.npcEncounter = npcEncounter;
})();
