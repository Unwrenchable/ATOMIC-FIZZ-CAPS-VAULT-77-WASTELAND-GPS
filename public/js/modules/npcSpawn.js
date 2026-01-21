(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const npcSpawnModule = {
    npcs: [],
    loaded: false,
    spawnChance: 0.3, // 30% chance of NPC encounter at matching location

    async init() {
      if (this.loaded) return;
      await this.loadNPCs();
      this.loaded = true;
    },

    async loadNPCs() {
      try {
        const index = await fetch("/data/npc/index.json").then(res => res.json());
        
        for (const npcFile of index) {
          try {
            const npc = await fetch(`/data/npc/${npcFile}`).then(res => res.json());
            this.npcs.push(npc);
          } catch (err) {
            console.warn(`[npcSpawn] Failed to load ${npcFile}:`, err.message);
          }
        }

        console.log(`[npcSpawn] Loaded ${this.npcs.length} NPCs for encounters`);
      } catch (err) {
        console.error("[npcSpawn] Failed to load NPC index:", err.message);
      }
    },

    // Check if an NPC should spawn at this location
    checkForNPCEncounter(location) {
      if (!this.loaded || !location || !location.id) return null;

      // Find NPCs that can spawn at this location
      const matchingNPCs = this.npcs.filter(npc => {
        if (!npc.spawnPool || !Array.isArray(npc.spawnPool)) return false;
        
        // Check if location ID matches any spawn pool entry
        return npc.spawnPool.some(spawnId => {
          return location.id.toLowerCase().includes(spawnId.toLowerCase());
        });
      });

      if (matchingNPCs.length === 0) return null;

      // Random chance to spawn NPC
      if (Math.random() > this.spawnChance) return null;

      // Pick random NPC from matching ones
      const npc = matchingNPCs[Math.floor(Math.random() * matchingNPCs.length)];
      
      console.log(`[npcSpawn] NPC encounter: ${npc.name} at ${location.name}`);
      
      return {
        type: "npc",
        npc: npc,
        location: location
      };
    },

    // Trigger NPC to seek out player
    triggerNPCApproach(npc, location) {
      if (!Game.modules.npcEncounter) {
        console.warn("[npcSpawn] npcEncounter module not available");
        this.showNPCDialog(npc);
        return;
      }

      // Use the npcEncounter module to have NPC approach player
      Game.modules.npcEncounter.triggerEncounter(npc.id, {
        spawnRadius: 40,
        onComplete: () => {
          console.log(`[npcSpawn] Encounter with ${npc.name} completed`);
        }
      });
    },

    // Fallback: show NPC dialog directly
    showNPCDialog(npc) {
      const dialog = npc.dialogPool && npc.dialogPool.length > 0
        ? npc.dialogPool[Math.floor(Math.random() * npc.dialogPool.length)]
        : "...";

      const message = `${npc.name} approaches you.\n\n"${dialog}"`;
      
      if (Game.modules.worldmap && Game.modules.worldmap.showMapMessage) {
        Game.modules.worldmap.showMapMessage(message);
      } else {
        console.log("[npcSpawn]", message);
      }
    },

    // Get all NPCs that can spawn at a location
    getNPCsForLocation(locationId) {
      return this.npcs.filter(npc => {
        if (!npc.spawnPool) return false;
        return npc.spawnPool.some(spawnId => 
          locationId.toLowerCase().includes(spawnId.toLowerCase())
        );
      });
    }
  };

  Game.modules.npcSpawn = npcSpawnModule;
})();
