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
        const idxRes = await fetch("/data/npc/index.json");
        if (!idxRes.ok) {
          console.warn('[npcSpawn] index.json not available', idxRes.status);
          return;
        }
        const index = await idxRes.json();

        if (!Array.isArray(index)) {
          console.warn('[npcSpawn] npc index is not an array');
          return;
        }

        for (const npcFile of index) {
          try {
            const res = await fetch(`/data/npc/${npcFile}`);
            if (!res.ok) {
              console.warn(`[npcSpawn] failed to fetch ${npcFile}: ${res.status}`);
              continue;
            }
            const npc = await res.json();
            if (npc && npc.id) {
              this.npcs.push(npc);
              // register NPC in global registry for portrait/swap usage
              if (window.NPCRegistry) {
                // ensure parts exist
                if (!npc.parts) {
                  // derive parts from npc appearance if available
                  if (npc.appearance) {
                    npc.parts = npc.appearance.parts || {};
                  } else {
                    npc.parts = {};
                  }
                }
                window.NPCRegistry.register(npc);
                // Preload portrait (SVG) immediately
                if (window.NPCPortraits) {
                  try { window.NPCPortraits.preloadSVG(npc); } catch (e) {}
                  // If NPC provides armatureBase, try DragonBones preload in background
                  // If NPC has appearance data, randomly assign the demo armature for variety (demo only)
                  if (!npc.armatureBase && npc.appearance && Math.random() < 0.25) {
                    npc.armatureBase = '/assets/dragonbones/demo/hero';
                  }
                  if (npc.armatureBase) {
                    try { window.NPCPortraits.preloadDragonbones(npc, npc.armatureBase); } catch (e) {}
                  }
                }
              }
            }
          } catch (err) {
            console.warn(`[npcSpawn] Failed to load ${npcFile}:`, err && err.message ? err.message : err);
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
        // Use word boundaries to avoid false positives
        return npc.spawnPool.some(spawnId => {
          const spawnIdLower = spawnId.toLowerCase();
          const locationIdLower = location.id.toLowerCase();
          
          // Exact match or location contains spawn pool term with word boundaries
          return locationIdLower === spawnIdLower || 
                 locationIdLower.split('_').includes(spawnIdLower) ||
                 locationIdLower.startsWith(spawnIdLower + '_') ||
                 locationIdLower.endsWith('_' + spawnIdLower) ||
                 locationIdLower.includes('_' + spawnIdLower + '_');
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
      // Handle both 'dialog' and 'dialogPool' structures
      const dialogArray = npc.dialogPool || npc.dialog || [];
      const dialog = dialogArray.length > 0
        ? dialogArray[Math.floor(Math.random() * dialogArray.length)]
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
        return npc.spawnPool.some(spawnId => {
          const spawnIdLower = spawnId.toLowerCase();
          const locationIdLower = locationId.toLowerCase();
          
          // Exact match or location contains spawn pool term with word boundaries
          return locationIdLower === spawnIdLower || 
                 locationIdLower.split('_').includes(spawnIdLower) ||
                 locationIdLower.startsWith(spawnIdLower + '_') ||
                 locationIdLower.endsWith('_' + spawnIdLower) ||
                 locationIdLower.includes('_' + spawnIdLower + '_');
        });
      });
    }
  };

  Game.modules.npcSpawn = npcSpawnModule;
})();
