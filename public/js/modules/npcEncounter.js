// npcEncounter.js
// ------------------------------------------------------------
// Scripted NPC Encounter Manager
// Handles story-driven NPC arrivals (e.g., Wake Up quest NPC)
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const npcEncounter = {
    activeEncounter: null,

    // ------------------------------------------------------------
    // Trigger a scripted encounter
    // npcId: string (your NPC template ID)
    // options: { spawnRadius, dialogId, onComplete }
    // ------------------------------------------------------------
    triggerEncounter(npcId, options = {}) {
      if (this.activeEncounter) {
        console.warn("[NPC Encounter] Encounter already active");
        return;
      }

      const radius = options.spawnRadius || 40; // meters
      const dialogId = options.dialogId || null;

      console.log(`[NPC Encounter] Triggering encounter with ${npcId}`);

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
    // Spawn NPC near player using your NPC generator + worldmap
    // ------------------------------------------------------------
    _spawnNPCNearPlayer(npcId, radius) {
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
    // ------------------------------------------------------------
    _beginApproach(npc) {
      console.log("[NPC Encounter] NPC approaching player…");

      const interval = setInterval(() => {
        const playerPos = Game.modules.worldmap.getPlayerPosition();
        if (!playerPos) return;

        const dist = Game.modules.worldmap.distanceBetween(
          npc.position,
          playerPos
        );

        // Move NPC toward player
        this._moveToward(npc, playerPos);

        // Greeting distance reached
        if (dist < 5) {
          clearInterval(interval);
          this._beginDialog(npc);
        }
      }, 1000);
    },

    // ------------------------------------------------------------
    // Move NPC toward a target position
    // ------------------------------------------------------------
    _moveToward(npc, targetPos) {
      const speed = 0.00003; // tune for your world scale

      const dx = targetPos.lat - npc.position.lat;
      const dy = targetPos.lng - npc.position.lng;

      npc.position.lat += dx * speed;
      npc.position.lng += dy * speed;

      Game.modules.worldmap.updateNPCPosition(npc);
    },

    // ------------------------------------------------------------
    // Trigger dialog (placeholder until your dialog system is ready)
    // ------------------------------------------------------------
    _beginDialog(npc) {
      console.log("[NPC Encounter] NPC reached player, starting dialog…");

      // Placeholder dialog
      alert(`${npc.name} approaches you.\n\n"${npc.introLine || "..." }"`);

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
