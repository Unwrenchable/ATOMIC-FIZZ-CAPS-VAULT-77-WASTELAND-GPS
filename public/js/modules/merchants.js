// public/js/modules/merchants.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Merchant & Caravan System (Modular)
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const economy = Game.modules.economy || null;

  const merchantsModule = {
    loaded: false,
    gs: null,

    init(gameState) {
      this.gs = gameState;
      this.loaded = true;
    },

    // --------------------------------------------------------
    // Merchant Definition
    // --------------------------------------------------------
    getMerchantDefinition(merchantId) {
      const def = {
        id: merchantId,
        type: "caravan",
        factionId: null,
        baseMarkup: 1.25,
        baseMarkdown: 0.6,
        stockProfile: "general",
        tags: []
      };

      if (merchantId.endsWith("_caravan_merchant")) {
        def.type = "caravan";
        def.factionId = merchantId.replace("_caravan_merchant", "");
        def.tags.push("caravan", "faction");
      }

      if (merchantId.includes("_arms_")) def.stockProfile = "weapons";
      if (merchantId.includes("_med_")) def.stockProfile = "medical";
      if (merchantId.includes("_tech_")) def.stockProfile = "tech";

      if (merchantId.includes("anomaly") || merchantId.includes("ghost_merchant")) {
        def.type = "anomaly";
        def.stockProfile = "ghost";
        def.baseMarkup = 1.5;
        def.baseMarkdown = 0.5;
        def.tags.push("anomaly", "weird");
      }

      if (merchantId === "ghost_merchant_ultra_rare") {
        def.type = "ghost";
        def.stockProfile = "ghost";
        def.baseMarkup = 1.8;
        def.baseMarkdown = 0.4;
        def.tags.push("ghost", "ultra_rare", "anomaly");
      }

      return def;
    },

    // --------------------------------------------------------
    // Encounter Integration
    // --------------------------------------------------------
    createEncounterMerchant(encounter, options) {
      if (!this.loaded || !this.gs) return null;

      const world = Game.modules.world;
      const opts = options || {};

      const encounterId = encounter?.id || "unknown_encounter";
      const biome = encounter?.biome || world?.currentLocation?.biome || "wasteland";
      const weatherType = encounter?.weather || world?.weather?.current?.type || "clear";

      let merchantId = "neutral_caravan_merchant";

      if (encounter?.merchants?.length > 0) {
        merchantId = encounter.merchants[0].templateId || merchantId;
      } else if (encounter?.territoryFactionId) {
        merchantId = encounter.territoryFactionId + "_caravan_merchant";
      }

      const isAnomaly = this.shouldSpawnAnomalyMerchant(biome, weatherType, encounterId);
      if (isAnomaly) {
        merchantId = this.rollAnomalyMerchantId(merchantId, biome, weatherType, encounterId);
      }

      const merchantDef = this.getMerchantDefinition(merchantId);

      const merchant = {
        id: merchantId,
        name: this.generateMerchantName(merchantDef),
        type: merchantDef.type,
        factionId: merchantDef.factionId,
        biome,
        weatherType,
        encounterId,
        stockProfile: merchantDef.stockProfile,
        tags: merchantDef.tags.slice(),
        priceModifiers: {
          buy: merchantDef.baseMarkup,
          sell: merchantDef.baseMarkdown
        },
        reputation: this.getFactionReputation(merchantDef.factionId),
        inventory: [],
        flavor: this.buildMerchantFlavor(merchantDef)
      };

      merchant.inventory = this.generateStock(merchant);

      const events = Game.modules.events;
      if (events?.loaded) {
        events.trigger("onMerchantSpawn", {
          merchant,
          encounter,
          world,
          gameState: this.gs
        });
      }

      return merchant;
    },

    // --------------------------------------------------------
    // Anomaly / Ghost Logic
    // --------------------------------------------------------
    shouldSpawnAnomalyMerchant(biome, weatherType, encounterId) {
      let chance = 0.0;

      if (weatherType === "rad_storm") chance += 0.08;
      if (encounterId?.includes("anomaly")) chance += 0.07;
      if (biome === "desert") chance += 0.02;
      if (biome === "urban") chance += 0.03;

      return Math.random() < chance;
    },

    rollAnomalyMerchantId(baseMerchantId, biome, weatherType, encounterId) {
      const ghostChance = 0.001;
      const world = Game.modules.world;
      const isRadStorm = weatherType === "rad_storm";
      const isNight = world?.timeOfDay === "night";

      if (isRadStorm && isNight && Math.random() < ghostChance) {
        return "ghost_merchant_ultra_rare";
      }

      if (Math.random() < 0.5) return "anomaly_caravan_merchant";

      return baseMerchantId;
    },

    // --------------------------------------------------------
    // Reputation
    // --------------------------------------------------------
    getFactionReputation(factionId) {
      const factions = Game.modules.factions;
      const world = Game.modules.world;

      if (!factions || !world || !factionId) {
        return { standing: "neutral", score: 0 };
      }

      return factions.getReputation(world.state, factionId);
    },

    // --------------------------------------------------------
    // Stock Generation
    // --------------------------------------------------------
    generateStock(merchant) {
      const mintables = Game.modules.mintables;
      if (!mintables?.loaded) return [];

      const items = [];
      const profile = merchant.stockProfile || "general";
      const playerLevel = this.gs?.player?.level || 1;

      const baseCount = profile === "ghost" ? 6 : 10;
      const variance = 4;
      const count = this.rollInt(baseCount - variance, baseCount + variance);

      for (let i = 0; i < count; i++) {
        const rarity = this.rollRarity(profile, playerLevel, merchant);
        const item = this.rollItemFromMintables(rarity, profile, merchant);
        if (!item) continue;

        if (economy?.loaded) {
          item.buyPrice = economy.calculateBuyPrice(item, merchant);
          item.sellPrice = economy.calculateSellPrice(item, merchant);
        } else {
          const base = item.baseValue || 10;
          item.buyPrice = Math.floor(base * merchant.priceModifiers.buy);
          item.sellPrice = Math.floor(base * merchant.priceModifiers.sell * 0.5);
        }

        items.push(item);
      }

      return items;
    },

    rollRarity(profile, playerLevel, merchant) {
      const roll = Math.random();

      if (profile === "ghost" || merchant.type === "ghost") {
        if (roll < 0.50) return "uncommon";
        if (roll < 0.80) return "rare";
        if (roll < 0.97) return "epic";
        return "legendary";
      }

      if (playerLevel < 5) {
        if (roll < 0.65) return "common";
        if (roll < 0.9) return "uncommon";
        return "rare";
      }

      if (playerLevel < 15) {
        if (roll < 0.45) return "common";
        if (roll < 0.80) return "uncommon";
        if (roll < 0.95) return "rare";
        return "epic";
      }

      if (roll < 0.35) return "common";
      if (roll < 0.65) return "uncommon";
      if (roll < 0.90) return "rare";
      if (roll < 0.98) return "epic";
      return "legendary";
    },

    rollItemFromMintables(rarity, profile, merchant) {
      const mintables = Game.modules.mintables;
      if (!mintables?.getRandomByRarity) return null;

      const category = this.mapProfileToCategory(profile);
      const baseItem = mintables.getRandomByRarity(rarity, category);
      if (!baseItem) return null;

      return {
        id: baseItem.id,
        name: baseItem.name,
        rarity: baseItem.rarity || rarity,
        category: baseItem.category || category,
        baseValue: baseItem.value || 10,
        tags: (baseItem.tags || []).slice()
      };
    },

    mapProfileToCategory(profile) {
      switch (profile) {
        case "weapons": return "weapon";
        case "armor": return "armor";
        case "medical": return "aid";
        case "tech": return "tech";
        case "rare": return "rare";
        case "ghost": return "ghost";
        default: return "general";
      }
    },

    // --------------------------------------------------------
    // Flavor
    // --------------------------------------------------------
    generateMerchantName(def) {
      if (def.id === "ghost_merchant_ultra_rare") return "The Liminal Vendor";
      if (def.type === "anomaly") return "The Flickering Trader";
      if (def.type === "caravan") return "Caravan Quartermaster";
      return "Wasteland Merchant";
    },

    buildMerchantFlavor(def) {
      const flavor = { greeting: "", farewell: "", description: "" };

      if (def.id === "ghost_merchant_ultra_rare") {
        flavor.greeting = "[STATIC] You found me again... or is this the first time?";
        flavor.farewell = "When you look away, I was never here.";
        flavor.description = "A translucent figure flickers in and out of phase.";
        return flavor;
      }

      if (def.type === "anomaly") {
        flavor.greeting = "You shouldn’t be seeing me, but here we are.";
        flavor.farewell = "This place will forget I was ever here.";
        flavor.description = "An out-of-place trader, glitching in radstorm light.";
        return flavor;
      }

      if (def.type === "caravan") {
        flavor.greeting = "Another day, another stretch of blasted road. What do you need?";
        flavor.farewell = "If the radstorms don’t get me, we might meet again.";
        flavor.description = "A weather-beaten caravan crew with pack brahmin.";
        return flavor;
      }

      flavor.greeting = "You look like you’ve seen some things. Need supplies?";
      flavor.farewell = "Try not to die out there. Bad for repeat business.";
      flavor.description = "A lone trader with a mismatched collection of salvage.";
      return flavor;
    },

    // --------------------------------------------------------
    // Utility
    // --------------------------------------------------------
    rollInt(min, max) {
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    }
  };

  Game.modules.merchants = merchantsModule;
})();
