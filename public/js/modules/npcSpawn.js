(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // BUG FIX: Cryptographically-secure random float in [0, 1) replacing Math.random().
  // NPC spawn chance and NPC selection directly affect economic outcomes (which NPCs
  // players encounter, what quests become available, what loot they can access).
  // Using Math.random() here is predictable and violates the project security policy.
  function secureRandom() {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / 0x100000000;
  }

  // BUG FIX: Cryptographically-secure integer in [0, max) replacing Math.floor(Math.random() * max).
  function secureRandIndex(max) {
    if (max <= 0) return 0;
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return Math.floor((arr[0] / 0x100000000) * max);
  }

  const npcSpawnModule = {
    npcs: [],
    loaded: false,
    enrichmentManifest: null,
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

        const enrichmentManifest = await this.loadEnrichmentManifest();

        for (const npcFile of index) {
          if (npcFile === 'enrichment.generated.json') continue;
          try {
            const res = await fetch(`/data/npc/${npcFile}`);
            if (!res.ok) {
              console.warn(`[npcSpawn] failed to fetch ${npcFile}: ${res.status}`);
              continue;
            }
            const npc = this.applyEnrichment(await res.json(), enrichmentManifest);
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
                  if (!npc.armatureBase && npc.appearance && secureRandom() < 0.25) {
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

    async loadEnrichmentManifest() {
      if (this.enrichmentManifest !== null) {
        return this.enrichmentManifest;
      }

      try {
        const response = await fetch('/data/npc/enrichment.generated.json');
        if (!response.ok) {
          this.enrichmentManifest = {};
          return this.enrichmentManifest;
        }

        const json = await response.json();
        this.enrichmentManifest = json && json.npcs && typeof json.npcs === 'object'
          ? json.npcs
          : {};
      } catch (error) {
        console.warn('[npcSpawn] failed to load enrichment manifest:', error && error.message ? error.message : error);
        this.enrichmentManifest = {};
      }

      return this.enrichmentManifest;
    },

    applyEnrichment(npc, manifest) {
      if (!npc || !npc.id) {
        return npc;
      }

      const overlay = manifest && manifest[npc.id];
      if (!overlay || typeof overlay !== 'object') {
        return npc;
      }

      return this.deepMerge(npc, overlay);
    },

    deepMerge(base, overlay) {
      if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
        return overlay;
      }

      const result = {
        ...(base && typeof base === 'object' ? base : {})
      };

      Object.keys(overlay).forEach((key) => {
        const value = overlay[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = this.deepMerge(result[key], value);
          return;
        }
        result[key] = Array.isArray(value) ? value.slice() : value;
      });

      return result;
    },

    extractDialogLines(npc) {
      if (!npc) return [];

      const lines = [];

      if (Array.isArray(npc.dialogPool)) {
        lines.push(...npc.dialogPool);
      }

      if (Array.isArray(npc.dialog)) {
        lines.push(...npc.dialog);
      } else if (npc.dialog && typeof npc.dialog === 'object') {
        if (Array.isArray(npc.dialog.idle)) {
          lines.push(...npc.dialog.idle);
        }
        if (Array.isArray(npc.dialog.approach)) {
          lines.push(...npc.dialog.approach);
        }
        if (Array.isArray(npc.dialog.gossip)) {
          lines.push(...npc.dialog.gossip);
        }
      }

      return lines.filter(line => typeof line === 'string' && line.trim());
    },

    // Get current spawn chance based on time of day (higher at night)
    getCurrentSpawnChance() {
      try {
        const worldmap = Game.modules.worldmap;
        if (worldmap && worldmap.gs && Game.modules.world?.weather) {
          const worldState = worldmap.gs.worldState || worldmap.gs;
          const gameTime = Game.modules.world.weather.getCurrentTime(worldState);
          if (gameTime.isNight) {
            return this.spawnChance * 1.5; // 50% increase at night
          }
        }
      } catch (e) {
        console.warn("[npcSpawn] Failed to get game time for spawn chance:", e.message);
      }
      return this.spawnChance; // Default chance
    },

    // Check if an NPC should spawn at this location
    checkForNPCEncounter(location) {
      if (!this.loaded || !location || !location.id) return null;

      // Get current spawn chance (higher at night)
      const currentSpawnChance = this.getCurrentSpawnChance();

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

      // BUG FIX: use secure RNG — NPC spawn/selection affects economic outcomes
      if (secureRandom() > currentSpawnChance) return null;

      // Pick random NPC from matching ones using secure RNG
      const npc = matchingNPCs[secureRandIndex(matchingNPCs.length)];
      
      console.log(`[npcSpawn] NPC encounter: ${npc.name} at ${location.name}`);
      
      return {
        type: "npc",
        npc: npc,
        location: location
      };
    },

    // Trigger NPC to seek out player
    triggerNPCApproach(npc, _location) {
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
      const dialogArray = this.extractDialogLines(npc);
      const dialog = dialogArray.length > 0
        ? dialogArray[secureRandIndex(dialogArray.length)]
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
