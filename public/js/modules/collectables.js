// collectibles.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Collectibles Module
// Tracks lore, magazines, posters, trophies, junk sets
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const collectiblesModule = {
    gs: null,
    collected: {}, // { itemId: true }

    init(gameState) {
      this.gs = gameState;
      if (!this.gs.collectibles) this.gs.collectibles = {};
      this.collected = this.gs.collectibles;
    },

    // --------------------------------------------------------
    // Mark collectible as found
    // --------------------------------------------------------
    add(item) {
      if (!item || !item.id) return;

      this.collected[item.id] = true;

      // Trigger bonuses or events
      this.applyCollectibleEffects(item);
      this.checkSetCompletion(item);
    },

    // --------------------------------------------------------
    // Check if player has a collectible
    // --------------------------------------------------------
    has(itemId) {
      return !!this.collected[itemId];
    },

    // --------------------------------------------------------
    // Apply bonuses (like Fallout magazines)
    // --------------------------------------------------------
    applyCollectibleEffects(item) {
      if (!item.tags) return;

      const world = Game.modules.world;
      const inventory = Game.modules.inventory;

      // Example: magazines give stat bonuses
      if (item.tags.includes("magazine")) {
        if (!this.gs.bonuses) this.gs.bonuses = {};
        this.gs.bonuses[item.id] = {
          buffPerception: item.baseStats.buffPerception || 0,
          buffEndurance: item.baseStats.buffEndurance || 0,
          buffLuck: item.baseStats.buffLuck || 0
        };
      }

      // Example: posters reveal map markers
      if (item.tags.includes("poster") && Game.modules.worldmap) {
        // Could reveal POIs or reduce fog of war
      }

      // Example: trophies trigger events
      if (item.tags.includes("trophy") && Game.modules.events) {
        Game.modules.events.trigger("trophyFound", { item });
      }
    },

    // --------------------------------------------------------
    // Set completion logic (e.g., all Vault posters)
    // --------------------------------------------------------
    checkSetCompletion(item) {
      if (!item.tags) return;

      const mint = Game.modules.mintables;
      const events = Game.modules.events;

      // Example: all "vault" posters
      if (item.tags.includes("vault")) {
        const allVaultPosters = mint.filter(i => i.tags && i.tags.includes("vault"));
        const allCollected = allVaultPosters.every(i => this.has(i.id));

        if (allCollected && events) {
          events.trigger("collectibleSetComplete", {
            set: "vault_posters",
            items: allVaultPosters
          });
        }
      }
    },

    // --------------------------------------------------------
    // List all collected items
    // --------------------------------------------------------
    listCollected() {
      const mint = Game.modules.mintables;
      return Object.keys(this.collected)
        .map(id => mint.getById(id))
        .filter(Boolean);
    }
  };

  Game.modules.collectibles = collectiblesModule;
})();
