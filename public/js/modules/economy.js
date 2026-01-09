// economy.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Unified Economy Backbone
// Shared pricing logic for:
// - merchants.js
// - scavenger exchange
// - faction shops
// - ghost/anomaly merchants
// - world-state scarcity
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const economy = {
    loaded: false,
    gs: null,

    init(gameState) {
      this.gs = gameState;
      this.loaded = true;
    },

    // --------------------------------------------------------
    // Base rarity multipliers
    // --------------------------------------------------------
    rarityMultipliers: {
      common: 1.0,
      uncommon: 1.6,
      rare: 2.4,
      epic: 4.0,
      legendary: 7.5,
      ghost: 10.0 // for ghost merchant items
    },

    // --------------------------------------------------------
    // World scarcity modifiers
    // --------------------------------------------------------
    getScarcityModifier() {
      const world = Game.modules.world;
      if (!world || !world.state || !world.state.economy) return 1.0;

      const scarcity = world.state.economy.scarcity || "normal";

      switch (scarcity) {
        case "high": return 1.25;
        case "low": return 0.85;
        default: return 1.0;
      }
    },

    // --------------------------------------------------------
    // Faction reputation modifier
    // --------------------------------------------------------
    getReputationModifier(factionId) {
      const factions = Game.modules.factions;
      const world = Game.modules.world;

      if (!factions || !world || !factionId) return 1.0;

      const rep = factions.getReputation(world.state, factionId);
      const score = rep.score || 0;

      if (score >= 75) return 0.80; // 20% cheaper
      if (score >= 40) return 0.90;
      if (score <= -75) return 1.30; // 30% more expensive
      if (score <= -40) return 1.15;

      return 1.0;
    },

    // --------------------------------------------------------
    // Weather / anomaly modifier
    // --------------------------------------------------------
    getWeatherModifier() {
      const world = Game.modules.world;
      if (!world || !world.weather || !world.weather.current) return 1.0;

      const type = world.weather.current.type;

      if (type === "rad_storm") return 1.15;
      if (type === "acid_rain") return 1.10;

      return 1.0;
    },

    // --------------------------------------------------------
    // Time-of-day modifier (night markets, ghost merchants)
    // --------------------------------------------------------
    getTimeModifier() {
      const world = Game.modules.world;
      if (!world || !world.timeOfDay) return 1.0;

      if (world.timeOfDay === "night") return 0.95; // slight discount at night
      return 1.0;
    },

    // --------------------------------------------------------
    // Final price calculation
    // --------------------------------------------------------
    calculateBuyPrice(item, merchant) {
      if (!item) return 0;

      const base = item.baseValue || 10;
      const rarity = item.rarity || "common";

      const rarityMod = this.rarityMultipliers[rarity] || 1.0;
      const scarcityMod = this.getScarcityModifier();
      const repMod = this.getReputationModifier(merchant.factionId);
      const weatherMod = this.getWeatherModifier();
      const timeMod = this.getTimeModifier();

      const merchantMod = merchant && merchant.priceModifiers
        ? merchant.priceModifiers.buy
        : 1.0;

      return Math.floor(
        base *
        rarityMod *
        scarcityMod *
        repMod *
        weatherMod *
        timeMod *
        merchantMod
      );
    },

    calculateSellPrice(item, merchant) {
      if (!item) return 0;

      const base = item.baseValue || 10;
      const rarity = item.rarity || "common";

      const rarityMod = this.rarityMultipliers[rarity] || 1.0;
      const scarcityMod = this.getScarcityModifier();
      const repMod = this.getReputationModifier(merchant.factionId);
      const weatherMod = this.getWeatherModifier();
      const timeMod = this.getTimeModifier();

      const merchantMod = merchant && merchant.priceModifiers
        ? merchant.priceModifiers.sell
        : 1.0;

      return Math.floor(
        base *
        rarityMod *
        scarcityMod *
        repMod *
        weatherMod *
        timeMod *
        merchantMod *
        0.5 // merchants buy at half value by default
      );
    }
  };

  Game.modules.economy = economy;
})();
