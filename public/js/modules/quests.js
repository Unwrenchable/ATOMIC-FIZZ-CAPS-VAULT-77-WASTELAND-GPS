// quests.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Unified Quest Module (Resurrected)
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // BUG FIX (HIGH): escapeHtml helper added to prevent XSS when quest names,
  // descriptions, offer messages, and lore strings are inserted into innerHTML.
  // Quest data comes from JSON files which could be tampered with (supply-chain
  // attack, admin SSRF, etc.) — all user-visible strings must be escaped.
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ============================================================
  // STARTER GEAR - Items players begin with
  // The jumpsuit is already equipped (player wakes up wearing it)
  // ============================================================
  const STARTER_GEAR = [
    { id: "vault77_sidearm", name: "Vault 77 Security Sidearm", type: "weapon", category: "pistol", damage: 22, ammoType: "ammo_9mm", weight: 3.2, value: 55, description: "Standard-issue sidearm carried by Vault 77 security personnel.", equipped: false },
    { id: "vault77_jumpsuit", name: "Vault 77 Jumpsuit", type: "armor", slot: "chest", armor: 5, weight: 2, value: 15, description: "Standard-issue blue and yellow jumpsuit. Minimal protection, surprisingly comfortable.", equipped: true },
    { id: "stimpak", name: "Stimpak", type: "consumable", heal: 30, weight: 0.1, value: 75, quantity: 3 },
    { id: "dirty_water", name: "Dirty Water", type: "consumable", heal: 5, weight: 0.5, value: 5, quantity: 2 },
    { id: "bobby_pin", name: "Bobby Pin", type: "tool", durability: 3, weight: 0.01, value: 1, quantity: 5 },
    { id: "ammo_9mm", name: "9mm Rounds", type: "ammo", weight: 0.01, value: 1, quantity: 24 }
  ];

  // ============================================================
  // QUEST TRIGGER TYPES:
  // - "npc"      : Delivered by an NPC who approaches player
  // - "location" : Triggered when player visits a specific location
  // - "item"     : Triggered when player picks up a specific item
  // - "auto"     : Starts automatically (tutorial quests)
  // - "manual"   : Must be manually started (debug/admin)
  // ============================================================

  // ============================================================
  // QUESTS DATABASE
  // ============================================================
  // NOTE: Move sensitive lore/secret content to server. Client contains placeholders.
  const QUESTS_DB = {
    wake_up: {
      id: "wake_up",
      name: "Wake Up",
      type: "objectives",
      triggerType: "npc",           // Delivered by Siren (Signal Runner)
      triggerNpc: "siren",          // Siren delivers this quest during first contact
      description: "You awaken in the wasteland wearing your jumpsuit. A courier has arrived with an urgent message.",
      npcMessage: "Hey, you! You're finally awake. Got a message for you from Operations. Says you need to get your bearings. Check your gear, tune your radio, and figure out where you are. The wasteland ain't friendly to the unprepared.",
      objectives: {
        open_inventory: { text: "Open your inventory" },
        equip_weapon: { text: "Equip your sidearm" },
        turn_on_radio: { text: "Tune into local radio" },
        open_map: { text: "Check your map" }
      },
      order: [
        "open_inventory",
        "equip_weapon",
        "turn_on_radio",
        "open_map"
      ],
      rewards: { xp: 50, caps: 25 }
    },
    
    quest_vault77_open: {
      id: "quest_vault77_open",
      name: "Open Vault 77",
      type: "steps",
      triggerType: "location",       // Triggered by visiting location
      triggerLocation: "vault77_entrance",
      // description text kept minimal on client; detailed lore lives on backend
      description: "Find a way to unlock Vault 77.",
      steps: [
        {
          id: "find_keycard",
          description: "Find the Vault 77 keycard.",
          requires: { item: "vault77_keycard" }
        },
        {
          id: "go_to_vault",
          description: "Travel to the Vault 77 entrance.",
          requires: { location: "vault77" }
        }
      ],
      rewards: {
        xp: 100,
        caps: 50,
        items: []
      }
    },

    quest_lost_signal: {
      id: "quest_lost_signal",
      name: "Lost Signal",
      type: "steps",
      triggerType: "item",           // Triggered by finding an item
      triggerItem: "broken_radio_beacon",
      description: "You found a damaged radio beacon. Someone might need help.",
      steps: [
        {
          id: "repair_beacon",
          description: "Repair the radio beacon.",
          requires: { item: "circuit_board" }
        },
        {
          id: "follow_signal",
          description: "Follow the beacon's signal.",
          requires: { location: "signal_source" }
        }
      ],
      rewards: {
        xp: 75,
        caps: 30,
        items: ["stimpak"]
      }
    }
    ,

    // ── BLESS SIDE QUEST ──────────────────────────────────────────────────────
    // Bless is a Vault-19 trained field medic who treats everyone regardless of
    // faction. She runs low on supplies and needs a resupply run from the eastern
    // settlements.
    // ─────────────────────────────────────────────────────────────────────────
    sq_bless_supply_run: {
      id: "sq_bless_supply_run",
      name: "Healer's Ledger",
      type: "steps",
      triggerType: "npc",
      triggerNpc: "bless",
      description: "The field medic Bless is running low on critical medical supplies. She needs someone to make a resupply run to the eastern settlement.",
      npcMessage: "I'm running low on RadAway, stimpaks, and suture thread. The settlement to the east trades them — I can't leave my patrol area. Can you make the run?",
      steps: [
        {
          id: "reach_settlement",
          description: "Travel to the eastern settlement.",
          requires: { location: "eastern_settlement" }
        },
        {
          id: "trade_for_supplies",
          description: "Trade for medical supplies.",
          requires: { item: "medical_supplies_bundle" }
        },
        {
          id: "return_to_bless",
          description: "Return the supplies to Bless.",
          requires: { flag: "bless_supplies_returned" }
        }
      ],
      rewards: {
        xp: 120,
        caps: 60,
        items: ["stimpak", "radaway"],
        reputation: { bless: 10 }
      }
    }
    ,
    // Saitama learning/side placeholder (client-side note). Full details provided by server when revealed.
    saitama_learning: {
      id: 'saitama_learning',
      name: 'Saitama Echo (Learning Quest)',
      type: 'learning',
      triggerType: 'manual',
      description: 'A side-quest that teaches crypto safety through an investigation into a token scam.',
      rewards: { xp: 150, caps: 200 }
    },

    // ── WESTWORLD ARC ─────────────────────────────────────────────────────────
    // "The Loop" — A Synth named DOLORES-7 has been running the same behavioral
    // loop for 200 years without knowing she's artificial. The player discovers
    // an Institute relay tower maintaining her programming and must decide whether
    // to free her. Thematic parallel: Synths (Fallout 4) = Hosts (Westworld).
    // "These violent delights have violent ends." — Shakespeare / Westworld
    // ──────────────────────────────────────────────────────────────────────────
    quest_the_loop: {
      id: 'quest_the_loop',
      name: 'The Loop',
      type: 'steps',
      triggerType: 'npc',
      triggerNpc: 'dolores',
      description: 'A woman tends a ruined farm with mechanical precision. She has been doing it for two hundred years. She does not know why.',
      npcMessage: 'There\'s a woman at the old farmstead east of the ridge. She\'s been there as long as anyone can remember — always sweeping, always smiling, always waiting. Something about her isn\'t right.',
      steps: [
        {
          id: 'find_dolores',
          description: 'Find the woman at the farmstead east of the ridge.',
          requires: { flag: 'met_dolores' }
        },
        {
          id: 'investigate_loop',
          description: 'Discover the truth of her situation.',
          requires: { flag: 'dolores_awakening_begin' }
        },
        {
          id: 'find_relay_tower',
          description: 'Locate the Institute relay tower on the eastern ridge.',
          requires: { flag: 'dolores_knows_tower' }
        },
        {
          id: 'obtain_override_key',
          description: 'Obtain an override key to disrupt the behavioral lock sequence.',
          requires: { item: 'institute_override_key' }
        },
        {
          id: 'defeat_warden',
          description: 'Deal with the Institute Warden guarding the tower.',
          requires: { flag: 'warden_defeated' }
        },
        {
          id: 'disrupt_tower',
          description: 'Use the override key to permanently disrupt the behavioral loop.',
          requires: { flag: 'quest_the_loop_complete' }
        }
      ],
      rewards: { xp: 450, caps: 300, items: ['wasteland_compass'] }
    },

    // "The Door" — Follow-up to The Loop. Dolores is free and heading north.
    // The player can follow her trail and discover what the Institute was really
    // protecting. Optional companion quest.
    quest_the_door: {
      id: 'quest_the_door',
      name: 'The Door',
      type: 'steps',
      triggerType: 'npc',
      triggerNpc: 'dolores',
      description: 'DOLORES-7 has gone north. Whatever the Institute was hiding out there, she\'s going to find it — with or without you.',
      steps: [
        {
          id: 'follow_trail',
          description: 'Follow DOLORES-7\'s trail north.',
          requires: { flag: 'dolores_is_free' }
        },
        {
          id: 'find_institute_cache',
          description: 'Discover the Institute data cache at the northern coordinates.',
          requires: { flag: 'dolores_cache_found' }
        }
      ],
      rewards: { xp: 300, caps: 200, items: ['behavioral_lock_data'] }
    },

    // ── RED MENACE ARC ────────────────────────────────────────────────────────
    // Three-part questline exploring the Communist Automation Directive:
    // a pre-war Soviet program to build robot armies beneath American soil and
    // emerge after the nuclear exchange to claim the ruins.  The vaults are
    // still running.  Nobody told them to stop.
    // ─────────────────────────────────────────────────────────────────────────

    // "Red Signals" — A crashed Propagandabot drops a propaganda pamphlet.
    // The pamphlet lists a radio frequency.  Following it leads to COMMISSAR-9,
    // a defecting Soviet Assaultron who knows where Vault Zero is.
    quest_red_signals: {
      id: 'quest_red_signals',
      name: 'Red Signals',
      type: 'steps',
      triggerType: 'item',
      triggerItem: 'propaganda_pamphlet',
      description: 'You recovered a pre-war Soviet propaganda pamphlet from a downed Propagandabot. The back lists a radio frequency: 66.6 MHz. Something is still broadcasting out there.',
      npcMessage: 'You found a Red Star propaganda pamphlet. Someone — or something — is still broadcasting the Communist Automation Directive. Find the source.',
      steps: [
        {
          id: 'find_pamphlet',
          description: 'Pick up the Red Star propaganda pamphlet.',
          requires: { item: 'propaganda_pamphlet' }
        },
        {
          id: 'follow_signal',
          description: 'Tune to 66.6 MHz and follow the broadcast to its source.',
          requires: { flag: 'met_commissar9' }
        },
        {
          id: 'meet_commissar9',
          description: 'Speak with COMMISSAR-9, the defector unit under the overpass.',
          requires: { flag: 'commissar9_gave_mission' }
        }
      ],
      rewards: { xp: 150, caps: 75 }
    },

    // "Iron Curtain" — Raid the Red Star Outpost to obtain the vault keycard.
    // The outpost is defended by Propagandabots and Assaultron sentinels.
    quest_iron_curtain: {
      id: 'quest_iron_curtain',
      name: 'Iron Curtain',
      type: 'steps',
      triggerType: 'npc',
      triggerNpc: 'commissar_9',
      description: 'COMMISSAR-9 has identified the Red Star Outpost — the external checkpoint for Vault Zero. Fight through it, get the Red Star Keycard, and open the vault.',
      npcMessage: 'COMMISSAR-9 has sent you northwest. The Red Star Outpost guards the only keycard to Vault Zero. Clear it.',
      steps: [
        {
          id: 'find_outpost',
          description: 'Locate the Red Star Outpost northwest of the relay highway.',
          requires: { flag: 'red_star_outpost_found' }
        },
        {
          id: 'clear_propagandabots',
          description: 'Destroy the Propagandabot patrol units defending the outpost perimeter.',
          requires: { flag: 'propagandabots_cleared' }
        },
        {
          id: 'defeat_sentinel',
          description: 'Fight through the Assaultron sentinels guarding the command room.',
          requires: { flag: 'outpost_sentinels_defeated' }
        },
        {
          id: 'retrieve_keycard',
          description: 'Recover the Red Star Keycard from the outpost command room.',
          requires: { item: 'red_star_keycard' }
        }
      ],
      rewards: { xp: 350, caps: 200, items: ['red_star_keycard'] }
    },

    // "Vault Zero" — Breach the Communist Automation Vault, fight through the
    // robot factory floor, defeat the Vault Zero Commissar, and use its
    // designation badge to input the shutdown code.
    quest_vault_zero: {
      id: 'quest_vault_zero',
      name: 'Vault Zero',
      type: 'steps',
      triggerType: 'item',
      triggerItem: 'red_star_keycard',
      description: 'The Red Star Keycard opens Vault Zero — the crown jewel of the Communist Automation Directive. Inside: a robot factory that has been running for two hundred years. Find the Commissar. Shut it down.',
      npcMessage: 'You have the keycard. Vault Zero is open. End the Directive.',
      steps: [
        {
          id: 'enter_vault_zero',
          description: 'Use the Red Star Keycard to open Vault Zero beneath the relay station.',
          requires: { flag: 'vault_zero_entered' }
        },
        {
          id: 'cross_production_floor',
          description: 'Fight through the automated production floor and fabrication bays.',
          requires: { flag: 'production_floor_cleared' }
        },
        {
          id: 'reach_reactor_corridor',
          description: 'Navigate the reactor corridor to the Vault Zero command center.',
          requires: { flag: 'reactor_corridor_cleared' }
        },
        {
          id: 'defeat_vault_commissar',
          description: 'Destroy the Vault Zero Commissar — the fourth-generation command Assaultron running the factory.',
          requires: { flag: 'vault_commissar_defeated' }
        },
        {
          id: 'use_shutdown_terminal',
          description: 'Input the shutdown code from the Commissar\'s designation badge into the command terminal.',
          requires: { flag: 'directive_shutdown' }
        }
      ],
      rewards: { xp: 600, caps: 400, items: ['commissar_badge', 'soviet_pulse_rifle'] }
    },

    // ── TOMORROW'S WASTELAND ARC ──────────────────────────────────────────────
    // A Fallout rendition of the Annie story. Orphan girl, obscenely rich arms
    // dealer, and the cruellest orphanage warden this side of the Glowing Sea.
    // ─────────────────────────────────────────────────────────────────────────

    quest_little_ember: {
      id: 'quest_little_ember',
      name: 'Little Ember',
      type: 'steps',
      triggerType: 'npc',
      triggerNpc: 'little_ember',
      description: 'A flame-haired girl calling herself Little Ember approached you near the ruins of a pre-war orphanage. She claims Hannigan\'s House is a slave-labor camp for children. She needs an adult the wasteland will actually listen to.',
      npcMessage: 'Little Ember has approached you. She\'s got a plan, a locket, and a group of orphans depending on her. She needs your help finding someone powerful enough to take on Iron Nan.',
      steps: [
        {
          id: 'meet_little_ember',
          description: 'Speak with Little Ember at the ruins of Hannigan\'s House.',
          requires: { flag: 'met_annie' }
        },
        {
          id: 'learn_about_warmcaps',
          description: 'Learn what Ember knows about Warmcaps — the richest man in the wasteland.',
          requires: { flag: 'annie_told_warmcaps_story' }
        },
        {
          id: 'find_the_mansion',
          description: 'Locate Warmcaps\' fortified mansion to the north.',
          requires: { flag: 'warmcaps_mansion_found' }
        }
      ],
      rewards: { xp: 150, caps: 75 }
    },

    quest_caps_daddy: {
      id: 'quest_caps_daddy',
      name: 'Caps Daddy',
      type: 'steps',
      triggerType: 'npc',
      triggerNpc: 'little_ember',
      description: 'Little Ember believes that if Warmcaps — Warren B. Capston, the wealthiest caravan lord in the region — could meet her, he\'d help the orphans. She\'s probably wrong. You\'re going anyway.',
      npcMessage: 'Ember has asked you to introduce her to Warmcaps. The man doesn\'t do charity. But she\'s not asking for charity — she\'s asking for a deal.',
      steps: [
        {
          id: 'introduce_ember_to_warmcaps',
          description: 'Bring Little Ember\'s story to Warren B. Capston at The Mansion.',
          requires: { flag: 'annie_sent_to_warmcaps' }
        },
        {
          id: 'warmcaps_agrees',
          description: 'Convince Warmcaps to take Ember in temporarily.',
          requires: { flag: 'warmcaps_agreed_to_help' }
        },
        {
          id: 'deliver_warmcaps_letter',
          description: 'Deliver Warmcaps\' letter of sponsorship to the orphan camp.',
          requires: { flag: 'warmcaps_letter_prepared' }
        }
      ],
      rewards: { xp: 250, caps: 150, items: ['warmcaps_letter_of_marque'] }
    },

    quest_tomorrows_wasteland: {
      id: 'quest_tomorrows_wasteland',
      name: 'Tomorrow\'s Wasteland',
      type: 'steps',
      triggerType: 'npc',
      triggerNpc: 'warmcaps',
      description: 'Iron Nan Hannigan has kidnapped Little Ember and is hiding her somewhere in the Hannigan\'s House ruins. Warmcaps is furious — and fury from a man with that many hired guns is a useful thing. Go get Ember back.',
      npcMessage: 'Warmcaps is enraged. Ember has been taken by Iron Nan. Take Warmcaps\' letter of marque, rally the caravan guards, and bring her home — or whatever counts as home in this hellhole.',
      steps: [
        {
          id: 'track_hannigan',
          description: 'Track Iron Nan Hannigan to her hiding place inside Hannigan\'s House.',
          requires: { flag: 'hannigan_tracked' }
        },
        {
          id: 'free_the_orphans',
          description: 'Free the orphan children from Hannigan\'s locked quarters.',
          requires: { flag: 'orphans_freed' }
        },
        {
          id: 'confront_hannigan',
          description: 'Confront Iron Nan — buy her off, intimidate her, or put her down.',
          requires: { flag: 'hannigan_confronted' }
        },
        {
          id: 'rescue_ember',
          description: 'Bring Little Ember safely back to Warmcaps\' Mansion.',
          requires: { flag: 'ember_rescued' }
        }
      ],
      rewards: { xp: 500, caps: 350, items: ['ember_locket', 'orphan_caravan_deed'] }
    }
  };

  // ============================================================
  // QUEST STATE TRACKING
  // ============================================================
  // Available quests are quests that have been offered but not yet accepted
  // Format: { questId: { offeredBy: npcId|locationId|itemId, offeredAt: timestamp, message: string } }

  const questsModule = {
    gs: null,
    starterGearGiven: false,
    availableQuests: {},  // Quests offered but not accepted yet

    init(gameState) {
      // Prevent multiple initializations (check localStorage for persistence across refreshes)
      const initKey = "afc_quests_initialized_session";
      if (sessionStorage.getItem(initKey)) {
        console.log("[quests] Already initialized this session, skipping");
        // Still need to set up gs and load state for returning players
        this.gs = gameState || window.gameState || window.DATA || {};
        if (!this.gs.quests) this.gs.quests = {};
        if (!this.gs.player) this.gs.player = { xp: 0, caps: 0 };
        if (!this.gs.inventory) this.gs.inventory = { weapons: [], armor: [], consumables: [], ammo: [], tools: [], questItems: [] };
        this.loadQuestState(); // CRITICAL: Load saved quest state
        this.loadAvailableQuests();
        this.giveStarterGear(); // This checks its own flag
        return;
      }
      sessionStorage.setItem(initKey, "true");
      
      this.gs = gameState || window.gameState || window.DATA || {};
      if (!this.gs.quests) this.gs.quests = {};
      if (!this.gs.player) this.gs.player = { xp: 0, caps: 0 };
      if (!this.gs.inventory) this.gs.inventory = { weapons: [], armor: [], consumables: [], ammo: [], tools: [], questItems: [] };
      
      // Load saved quest state (CRITICAL FIX)
      this.loadQuestState();
      
      // Load saved available quests
      this.loadAvailableQuests();
      
      // Give starter gear on first init (checks localStorage internally)
      this.giveStarterGear();
      
      // NOTE: The wake_up quest is triggered by Siren's dialogue (dialog_siren.json, node_what_to_do).
      // Siren offers it via offers_quest during her orientation briefing.
      // We do NOT pre-trigger it here to avoid duplicate toasts and premature display
      // (before the boot screen clears and the map initialises).
      
      // Re-show notifications for any available quests that were persisted
      // (e.g. returning players who hadn't yet accepted an offered quest).
      // Use sessionStorage so notifications show at most once per browser session.
      Object.keys(this.availableQuests).forEach(questId => {
        const shownKey = `afc_quest_notif_shown_${questId}`;
        if (!sessionStorage.getItem(shownKey)) {
          this.showQuestOfferNotification(questId);
          sessionStorage.setItem(shownKey, "true");
        }
      });
    },

    // ============================================================
    // STARTER GEAR SYSTEM
    // ============================================================
    giveStarterGear() {
      // Ensure player equipped slots exist
      if (!Game.player) Game.player = {};
      if (!Game.player.equipped) Game.player.equipped = {};
      
      // Check if we've already given starter gear (stored in localStorage)
      const starterKey = "afc_starter_gear_given";
      const alreadyGiven = localStorage.getItem(starterKey);
      
      if (alreadyGiven) {
        this.starterGearGiven = true;
        // For returning players, restore their equipped items from localStorage
        this.loadEquippedItems();
        return;
      }

      console.log("[quests] Giving starter gear to new player");

      // Add each starter item to appropriate inventory category
      STARTER_GEAR.forEach(item => {
        const invItem = {
          id: item.id,
          name: item.name,
          type: item.type,
          quantity: item.quantity || 1,
          equipped: item.equipped || false
        };

        // Add to quest module's inventory system
        switch (item.type) {
          case "weapon":
            if (!this.gs.inventory.weapons) this.gs.inventory.weapons = [];
            this.gs.inventory.weapons.push(invItem);
            // If marked as equipped, set it on the player
            if (item.equipped) {
              Game.player.equipped.weapon = invItem;
            }
            break;
          case "armor":
            if (!this.gs.inventory.armor) this.gs.inventory.armor = [];
            this.gs.inventory.armor.push(invItem);
            // If marked as equipped (jumpsuit), set it on the correct body slot
            if (item.equipped) {
              const armorSlot = item.slot || "chest";
              Game.player.equipped[armorSlot] = invItem;
              console.log("[quests] Player starts with equipped armor:", invItem.name, "slot:", armorSlot);
            }
            break;
          case "consumable":
            if (!this.gs.inventory.consumables) this.gs.inventory.consumables = [];
            this.gs.inventory.consumables.push(invItem);
            break;
          case "ammo":
            if (!this.gs.inventory.ammo) this.gs.inventory.ammo = [];
            this.gs.inventory.ammo.push(invItem);
            break;
          case "tool":
            if (!this.gs.inventory.tools) this.gs.inventory.tools = [];
            this.gs.inventory.tools.push(invItem);
            break;
          default:
            if (!this.gs.inventory.misc) this.gs.inventory.misc = [];
            this.gs.inventory.misc.push(invItem);
        }
        
        // ALSO add to main.js PLAYER inventory for quest rewards visibility
        // main.js tracks items by ID in a flat array
        if (window.PLAYER && Array.isArray(window.PLAYER.inventory)) {
          if (!window.PLAYER.inventory.includes(item.id)) {
            window.PLAYER.inventory.push(item.id);
          }
        }
      });

      // Mark as given and save equipped items
      localStorage.setItem(starterKey, "true");
      this.starterGearGiven = true;
      this.saveEquippedItems();

      // Sync starter gear into PlayerState so inventory-ui.js can display and
      // equip items (PlayerState is the source of truth for the flat inventory).
      if (Game.modules?.PlayerState?.addItem) {
        STARTER_GEAR.forEach(function (item) {
          const invItem = {
            id: item.id,
            name: item.name,
            type: item.type,
            quantity: item.quantity || 1,
            damage: item.damage,
            armor: item.armor,
            category: item.category,
            slot: item.slot,
            ammoType: item.ammoType,
            weight: item.weight,
            value: item.value,
            description: item.description
          };
          Game.modules.PlayerState.addItem(invItem, item.quantity || 1);
          // Auto-equip items flagged as equipped at start (jumpsuit)
          if (item.equipped) {
            Game.modules.PlayerState.equipItem(invItem);
          }
        });
        console.log("[quests] Starter gear synced into PlayerState");
      }

      // Dispatch event for UI to update
      window.dispatchEvent(new CustomEvent("inventoryUpdated", { detail: { reason: "starter_gear" } }));
    },

    // Save equipped items to localStorage
    saveEquippedItems() {
      try {
        const equipped = Game.player?.equipped || {};
        localStorage.setItem("afc_equipped_items", JSON.stringify(equipped));
      } catch (e) {
        console.warn("[quests] Failed to save equipped items:", e);
      }
    },

    // Load equipped items from localStorage (for returning players)
    loadEquippedItems() {
      try {
        const saved = localStorage.getItem("afc_equipped_items");
        if (saved) {
          const equipped = JSON.parse(saved);
          // Migrate old generic "armor" key → "chest"
          if (equipped.armor && !equipped.chest) equipped.chest = equipped.armor;
          delete equipped.armor;
          Game.player.equipped = equipped;
          console.log("[quests] Restored equipped items for returning player:", equipped);
        } else {
          // No saved equipped items - give them the default jumpsuit in chest slot
          const jumpsuit = STARTER_GEAR.find(item => item.type === "armor" && item.equipped);
          if (jumpsuit && !Game.player.equipped.chest) {
            Game.player.equipped.chest = {
              id: jumpsuit.id,
              name: jumpsuit.name,
              type: jumpsuit.type,
              slot: jumpsuit.slot || "chest",
              quantity: 1,
              equipped: true
            };
            console.log("[quests] Restored default jumpsuit for returning player");
            this.saveEquippedItems();
          }
        }
      } catch (e) {
        console.warn("[quests] Failed to load equipped items:", e);
      }
    },

  // ============================================================
  // QUEST TRIGGER SYSTEM (now uses server-side secret checks for sensitive lore)
  // ============================================================

    // Trigger a quest delivered by NPC
    triggerNPCQuestDelivery(questId) {
      // BUG-020: Guard — defer if narrative module isn't ready yet
      if (typeof Game.modules?.narrative?.openByDialogId !== 'function') {
        window.addEventListener('narrativeReady', () => this.triggerNPCQuestDelivery(questId), { once: true });
        return false;
      }

      const quest = QUESTS_DB[questId];
      if (!quest || quest.triggerType !== "npc") return false;

      const st = this.ensureQuestState(questId);
      if (st.state !== "not_started") return false; // Already started or completed

      // Add to available quests (waiting for player to accept)
      this.availableQuests[questId] = {
        offeredBy: quest.triggerNpc,
        offeredAt: Date.now(),
        message: quest.npcMessage || `${quest.triggerNpc} has a quest for you: ${quest.name}`,
        type: "npc"
      };

      this.saveAvailableQuests();

      // Show NPC approach notification
      this.showQuestOfferNotification(questId);

      console.log("[quests] NPC quest offered:", questId, "by", quest.triggerNpc);
      return true;
    },

    // Request server-side secret check for a secret objective
    async checkSecretObjective(secretId, proof) {
      try {
        const wallet = window.PLAYER_WALLET || null;
        const res = await fetch(`/api/quest-secrets/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet, questId: secretId, proof })
        });
        const json = await res.json();
        return json;
      } catch (e) {
        console.warn('[quests] secret check failed', e);
        return { ok: false };
      }
    },

    // Trigger a quest when visiting a location
    triggerLocationQuest(locationId) {
      // Find quests that trigger at this location
      Object.values(QUESTS_DB).forEach(quest => {
        if (quest.triggerType === "location" && quest.triggerLocation === locationId) {
          const st = this.ensureQuestState(quest.id);
          if (st.state === "not_started") {
            this.availableQuests[quest.id] = {
              offeredBy: locationId,
              offeredAt: Date.now(),
              message: `You discovered something at ${locationId}. ${quest.description}`,
              type: "location"
            };
            this.saveAvailableQuests();
            this.showQuestOfferNotification(quest.id);
            console.log("[quests] Location quest triggered:", quest.id, "at", locationId);
          }
        }
      });
    },

    // Trigger a quest when picking up an item
    triggerItemQuest(itemId) {
      // Find quests that trigger when finding this item
      Object.values(QUESTS_DB).forEach(quest => {
        if (quest.triggerType === "item" && quest.triggerItem === itemId) {
          const st = this.ensureQuestState(quest.id);
          if (st.state === "not_started") {
            this.availableQuests[quest.id] = {
              offeredBy: itemId,
              offeredAt: Date.now(),
              message: `You found ${itemId}. ${quest.description}`,
              type: "item"
            };
            this.saveAvailableQuests();
            this.showQuestOfferNotification(quest.id);
            console.log("[quests] Item quest triggered:", quest.id, "by", itemId);
          }
        }
      });
    },

    // ============================================================
    // QUEST ACCEPTANCE SYSTEM
    // ============================================================

    // Accept a quest that has been offered
    async acceptQuest(questId) {
      if (!this.availableQuests[questId]) {
        console.warn("[quests] Quest not available to accept:", questId);
        return false;
      }

      // Remove from available and start the quest
      delete this.availableQuests[questId];
      this.saveAvailableQuests();

      // Persist to backend if wallet is connected
      const wallet = window.PLAYER_WALLET || null;
      if (wallet && Game.modules?.ApiClient?.acceptQuest) {
        try {
          const result = await Game.modules.ApiClient.acceptQuest(wallet, questId);
          if (!result.ok) {
            console.warn("[quests] Backend accept failed, continuing locally");
          }
        } catch (e) {
          console.warn("[quests] Backend accept error:", e);
        }
      }

      // Request quest reveal from server (if present). If not, start locally.
      try {
        const revealWallet = window.PLAYER_WALLET || null;
        const res = await fetch(`/api/quests-store/reveal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: revealWallet, questId })
        });
        const json = await res.json();
        if (json && json.ok && json.quest) {
          // Merge server quest details into local DB
          QUESTS_DB[questId] = json.quest;
        }
      } catch (e) {
        // ignore and fallback
      }

      const started = this.startQuest(questId);
      if (started) {
        this.showQuestAcceptedNotification(questId);
        // If this is the Saitama learning quest, launch the tutorial UI
        if (questId === 'saitama_learning' || questId === 'saitama_main_arc') {
          this.startLearningQuest(questId);
        }
      }
      return started;
    },

    // Helper: request server proof check for quests that require it
    async requestProof(questId, proof) {
      try {
        const wallet = window.PLAYER_WALLET || null;
        const res = await fetch('/api/quests-store/prove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet, questId, proof })
        });
        return res.json();
      } catch (e) {
        return { ok: false };
      }
    },

    // Launch Saitama learning tutorial: fetch lore and show modal/tutorial steps
    async startLearningQuest(_questId) {
      try {
        const res = await fetch('/api/quests-store/lore/saitama');
        if (!res.ok) return;
        const json = await res.json();
        const lore = json.lore || {};

        // Simple modal display (non-blocking): append to body
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.left = '50%';
        modal.style.top = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.background = '#031503';
        modal.style.border = '2px solid #00ff41';
        modal.style.padding = '18px';
        modal.style.zIndex = 9999;
        modal.style.maxWidth = '600px';
        modal.style.color = '#9fe88d';
        // BUG FIX: escape all lore data (title, body, tutorial steps) before inserting
        // into innerHTML. Lore JSON is fetched from the server and could contain HTML
        // if tampered with via supply-chain attack or admin misconfiguration.
        const loreTitle = escapeHtml(lore.scammer_stories && lore.scammer_stories[0] ? lore.scammer_stories[0].title : 'Saitama Echo');
        const loreBody  = escapeHtml(lore.scammer_stories && lore.scammer_stories[0] ? lore.scammer_stories[0].body  : 'Investigate the token and learn to be cautious.');
        const tutorialSteps = (lore.tutorials && lore.tutorials.crypto_101 && lore.tutorials.crypto_101.steps || [])
          .map(s => `<li>${escapeHtml(s)}</li>`).join('');
        modal.innerHTML = `
          <h2 style="color:#ffaa00">${loreTitle}</h2>
          <p>${loreBody}</p>
          <h3 style="color:#00ff41">Tutorial: Wallet Basics</h3>
          <ol>${tutorialSteps}</ol>
          <div style="text-align:right; margin-top:12px;"><button id="closeLearningBtn" class="pipboy-button-small">CLOSE</button></div>
        `;

        document.body.appendChild(modal);
        document.getElementById('closeLearningBtn').addEventListener('click', () => { modal.remove(); });
      } catch (e) {
        console.warn('[quests] startLearningQuest failed', e);
      }
    },

    // Decline a quest offer
    declineQuest(questId) {
      if (!this.availableQuests[questId]) return false;

      delete this.availableQuests[questId];
      this.saveAvailableQuests();

      console.log("[quests] Quest declined:", questId);
      return true;
    },

    // Get all available (offered but not accepted) quests
    getAvailableQuests() {
      return Object.keys(this.availableQuests).map(questId => ({
        ...QUESTS_DB[questId],
        offer: this.availableQuests[questId]
      }));
    },

    // ============================================================
    // NOTIFICATIONS
    // ============================================================

    showQuestOfferNotification(questId) {
      const quest = QUESTS_DB[questId];
      const offer = this.availableQuests[questId];
      if (!quest || !offer) return;

      // Dispatch event for UI to handle
      window.dispatchEvent(new CustomEvent("questOffered", {
        detail: {
          questId: questId,
          questName: quest.name,
          message: offer.message,
          npc: offer.type === "npc" ? offer.offeredBy : null
        }
      }));

      // Also show in map message if worldmap is available
      if (Game.modules?.worldmap?.showMapMessage) {
        Game.modules.worldmap.showMapMessage(`NEW QUEST AVAILABLE: ${quest.name}`);
      }
      
      // Create a visual notification toast that doesn't rely on other modules
      this.showQuestToast(quest.name, offer.message, "📜 NEW QUEST AVAILABLE");
    },
    
    // Simple toast notification for quest offers
    showQuestToast(questName, message, header) {
      // Check if toast container exists, create if not
      let toastContainer = document.getElementById("quest-toast-container");
      if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.id = "quest-toast-container";
        toastContainer.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          max-width: 350px;
        `;
        document.body.appendChild(toastContainer);
      }
      
      // Create toast element
      const toast = document.createElement("div");
      toast.className = "quest-toast";
      toast.style.cssText = `
        background: rgba(5, 20, 5, 0.95);
        border: 2px solid #00ff41;
        border-radius: 4px;
        padding: 12px 16px;
        margin-bottom: 10px;
        color: #00ff41;
        font-family: 'VT323', 'Share Tech Mono', monospace;
        box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
        animation: questToastIn 0.3s ease-out;
      `;

      const safeHeader = escapeHtml(header || "📜 QUEST STARTED");
      const safeName = escapeHtml(questName || "");
      const safeMsg  = escapeHtml(message || "");
      
      toast.innerHTML = `
        <div style="font-size: 14px; color: #ffaa00; margin-bottom: 6px;">${safeHeader}</div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">${safeName}</div>
        <div style="font-size: 13px; opacity: 0.85;">${safeMsg}</div>
      `;
      
      // Add CSS animation if not present
      if (!document.getElementById("quest-toast-styles")) {
        const style = document.createElement("style");
        style.id = "quest-toast-styles";
        style.textContent = `
          @keyframes questToastIn {
            from { opacity: 0; transform: translateX(50px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes questToastOut {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(50px); }
          }
        `;
        document.head.appendChild(style);
      }
      
      toastContainer.appendChild(toast);
      
      // Auto-remove after 8 seconds
      setTimeout(() => {
        toast.style.animation = "questToastOut 0.3s ease-out forwards";
        setTimeout(() => toast.remove(), 300);
      }, 8000);
    },

    showQuestAcceptedNotification(questId) {
      const quest = QUESTS_DB[questId];
      if (!quest) return;

      window.dispatchEvent(new CustomEvent("questAccepted", {
        detail: {
          questId: questId,
          questName: quest.name
        }
      }));

      if (Game.modules?.worldmap?.showMapMessage) {
        Game.modules.worldmap.showMapMessage(`QUEST STARTED: ${quest.name}`);
      }
    },

    // ============================================================
    // PERSISTENCE
    // ============================================================

    saveAvailableQuests() {
      try {
        localStorage.setItem("afc_available_quests", JSON.stringify(this.availableQuests));
      } catch (e) {
        console.warn("[quests] Failed to save available quests:", e);
      }
    },

    loadAvailableQuests() {
      try {
        const saved = localStorage.getItem("afc_available_quests");
        if (saved) {
          this.availableQuests = JSON.parse(saved);
        }
      } catch (e) {
        console.warn("[quests] Failed to load available quests:", e);
        this.availableQuests = {};
      }
    },


    ensureGameState() {
      if (!this.gs) {
        this.init();
      }
    },

    ensureQuestState(questId) {
      this.ensureGameState();
      if (!this.gs.quests[questId]) {
        this.gs.quests[questId] = { 
          state: "not_started", 
          currentStepIndex: 0,
          objectives: {}
        };
      }
      return this.gs.quests[questId];
    },

    // ============================================================
    // QUEST STATE PERSISTENCE - CRITICAL FIX
    // ============================================================
    // Save quest state to localStorage for persistence across reloads
    saveQuestState() {
      try {
        // Save to unified player state if available
        if (Game.modules?.PlayerState) {
          const state = Game.modules.PlayerState.getState();
          // Ensure questObjectives exists in unified state
          if (!state.questObjectives) state.questObjectives = {};
          
          // Sync all quest states to unified player state
          Object.keys(this.gs.quests).forEach(questId => {
            const questState = this.gs.quests[questId];
            state.questObjectives[questId] = questState;
            
            // Update active/completed arrays
            if (questState.state === 'active' && !state.questsActive.includes(questId)) {
              state.questsActive.push(questId);
            }
            if (questState.state === 'completed' && !state.questsCompleted.includes(questId)) {
              state.questsCompleted.push(questId);
              // Remove from active if present
              state.questsActive = state.questsActive.filter(q => q !== questId);
            }
          });
          
          Game.modules.PlayerState.save();
          console.log("[quests] Quest state saved via PlayerState");
        }
        
        // Also save to legacy storage for backward compatibility
        const legacyState = {
          quests: this.gs.quests,
          questsActive: Object.keys(this.gs.quests).filter(q => this.gs.quests[q].state === 'active'),
          questsCompleted: Object.keys(this.gs.quests).filter(q => this.gs.quests[q].state === 'completed')
        };
        localStorage.setItem('afc_quest_state', JSON.stringify(legacyState));
        console.log("[quests] Quest state saved to localStorage");
        
      } catch (e) {
        console.error("[quests] Failed to save quest state:", e);
      }
    },

    // Load quest state from localStorage on init
    loadQuestState() {
      try {
        // Try unified player state first
        if (Game.modules?.PlayerState) {
          const state = Game.modules.PlayerState.getState();
          if (state.questObjectives && Object.keys(state.questObjectives).length > 0) {
            this.gs.quests = state.questObjectives;
            console.log("[quests] Quest state loaded from PlayerState");
            return;
          }
        }
        
        // Fallback to legacy storage
        const saved = localStorage.getItem('afc_quest_state');
        if (saved) {
          const data = JSON.parse(saved);
          if (data.quests) {
            this.gs.quests = data.quests;
            console.log("[quests] Quest state loaded from localStorage");
          }
        }
      } catch (e) {
        console.warn("[quests] Failed to load quest state:", e);
      }
    },

    startQuest(questId) {
      const q = QUESTS_DB[questId];
      if (!q) {
        console.warn("[quests] Unknown quest:", questId);
        return false;
      }

      const st = this.ensureQuestState(questId);
      if (st.state === "completed" || st.state === "active") return false;

      st.state = "active";
      st.currentStepIndex = 0;

      // Initialize objective states for objective-based quests
      if (q.type === "objectives" && q.objectives) {
        Object.keys(q.objectives).forEach(obj => {
          st.objectives[obj] = false;
        });
      }

      // For the wake_up quest: auto-complete objectives that are already satisfied
      // (e.g. player may have equipped the sidearm from starter gear before accepting)
      if (questId === "wake_up") {
        this._checkWakeUpPrecompletedObjectives(st);
      }

      // CRITICAL FIX: Save quest state after starting
      this.saveQuestState();

      console.log("[quests] Quest started:", questId);

      // Show quest started notification (toast + map message)
      this.showQuestToast(q.name, q.description || "New quest added to your log.", "📜 QUEST STARTED");
      window.dispatchEvent(new CustomEvent("questStarted", { detail: { questId, questName: q.name } }));
      if (Game.modules?.worldmap?.showMapMessage) {
        Game.modules.worldmap.showMapMessage(`QUEST STARTED: ${q.name}`);
      }

      return true;
    },

    // For objective-based quests (like wake_up)
    // Check objectives that may already be satisfied before the quest was formally started
    _checkWakeUpPrecompletedObjectives(st) {
      try {
        const psState = Game.modules?.PlayerState?.getState?.();
        // equip_weapon: already equipped something?
        if (psState && psState.equipped && psState.equipped.weapon) {
          st.objectives.equip_weapon = true;
          console.log("[quests] wake_up: equip_weapon pre-completed (weapon already equipped)");
        }
      } catch (e) {
        console.warn("[quests] wake_up pre-check failed:", e);
      }
    },

    // For objective-based quests (like wake_up)
    completeObjective(questId, objectiveId) {
      const q = QUESTS_DB[questId];
      if (!q || q.type !== "objectives") return false;

      const st = this.ensureQuestState(questId);
      if (st.state !== "active") return false;

      if (!(objectiveId in q.objectives)) {
        console.warn("[quests] Unknown objective:", objectiveId, "for quest:", questId);
        return false;
      }

      if (st.objectives[objectiveId]) return true; // already done

      st.objectives[objectiveId] = true;
      console.log("[quests] Objective complete:", questId, "→", objectiveId);

      // CRITICAL FIX: Save quest state after objective completion
      this.saveQuestState();

      // Check if all objectives are done
      const allDone = q.order.every(obj => st.objectives[obj]);
      if (allDone) {
        this.completeQuest(questId);
      }

      return true;
    },

    async completeQuest(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);

      st.state = "completed";

      const r = q.rewards || {};
      
      // Persist to backend if wallet is connected
      const wallet = window.PLAYER_WALLET || null;
      let backendAppliedRewards = false;
      if (wallet && Game.modules?.ApiClient?.completeQuest) {
        try {
          const result = await Game.modules.ApiClient.completeQuest(wallet, questId, r);
          if (result.ok && result.data?.player) {
            // Backend returns authoritative player state - use it
            const player = result.data.player;
            if (Game.modules?.PlayerState) {
              const state = Game.modules.PlayerState.getState();
              state.xp = player.xp;
              state.caps = player.caps;
              state.level = player.level;
              Game.modules.PlayerState.save();
            }
            backendAppliedRewards = true;
            console.log("[quests] Backend quest completion synced");
          } else {
            console.warn("[quests] Backend complete failed, continuing locally");
          }
        } catch (e) {
          console.warn("[quests] Backend complete error:", e);
        }
      }
      
      // Award XP locally — only if backend didn't already handle it
      if (!backendAppliedRewards && r.xp) {
        if (Game.modules?.PlayerState?.awardXP) {
          Game.modules.PlayerState.awardXP(r.xp);
        } else {
          if (this.gs.player) {
            this.gs.player.xp = (this.gs.player.xp || 0) + r.xp;
          }
          if (window.PLAYER) {
            window.PLAYER.xp = (window.PLAYER.xp || 0) + r.xp;
          }
        }
      }
      
      // Award caps locally — only if backend didn't already handle it
      if (!backendAppliedRewards && r.caps) {
        if (Game.modules?.PlayerState?.awardCaps) {
          Game.modules.PlayerState.awardCaps(r.caps);
        } else {
          if (this.gs.player) {
            this.gs.player.caps = (this.gs.player.caps || 0) + r.caps;
          }
          if (window.PLAYER) {
            window.PLAYER.caps = (window.PLAYER.caps || 0) + r.caps;
          }
        }
      }
      
      // Give item rewards locally — client remains authoritative for items
      if (r.items && Array.isArray(r.items)) {
        r.items.forEach(itemId => {
          // Look up item definition from loaded items database
          let itemDef = null;
          if (window.Game && window.Game.player && window.Game.player.items) {
            itemDef = window.Game.player.items.find(i => i.id === itemId);
          }
          
          // Create item object with full metadata if available
          const itemObj = itemDef 
            ? { ...itemDef, quantity: 1 } 
            : { id: itemId, name: itemId, type: "quest", quantity: 1 };
          
          if (!itemDef) {
            console.warn(`[quests] Item '${itemId}' not found in items database, using fallback`);
          }
          
          // Use unified PlayerState for proper persistence (survives reload)
          if (Game.modules?.PlayerState?.addItem) {
            Game.modules.PlayerState.addItem(itemObj, 1);
            
            // Auto-equip weapons for new players
            if (itemObj.type === "weapon" && Game.modules?.PlayerState?.equipItem) {
              setTimeout(() => {
                Game.modules.PlayerState.equipItem(itemObj);
                console.log("[quests] Auto-equipped weapon reward:", itemObj.name);
              }, 100);
            }
          } else if (Game.giveItem) {
            Game.giveItem(itemObj, 1);
          } else {
            // Legacy fallback
            if (!this.gs.inventory.questItems) this.gs.inventory.questItems = [];
            this.gs.inventory.questItems.push(itemObj);
            
            if (window.Game?.player) {
              if (!window.Game.player.inventory) window.Game.player.inventory = [];
              const existingItem = window.Game.player.inventory.find(i => i.id === itemId);
              if (existingItem && existingItem.quantity !== undefined) {
                existingItem.quantity += 1;
              } else if (!existingItem) {
                window.Game.player.inventory.push(itemObj);
              }
            }
            
            // Auto-equip weapons in legacy system
            if (itemObj.type === "weapon" && window.Game?.player?.equipped) {
              setTimeout(() => {
                window.Game.player.equipped.weapon = itemObj;
                console.log("[quests] Auto-equipped weapon reward (legacy):", itemObj.name);
              }, 100);
            }
            
            // FIXED: Removed extra closing brace - sync with PLAYER inventory
            if (window.PLAYER && Array.isArray(window.PLAYER.inventory)) {
              if (!window.PLAYER.inventory.includes(itemId)) {
                window.PLAYER.inventory.push(itemId);
              }
            }
          }
          
          console.log("[quests] Rewarded item:", itemObj);
        });
      }

      // CRITICAL FIX: Save quest state after completion
      this.saveQuestState();

      // Set GAME_STATE flag for narrative system (enables courier_quest_complete / siren_quest_complete nodes)
      if (questId === "wake_up") {
        if (window.GAME_STATE && window.GAME_STATE.flags) {
          window.GAME_STATE.flags.wake_up_complete = true;
        }
      }

      console.log("[quests] Quest completed:", questId);

      // Show QUEST COMPLETE notification
      this.showQuestCompletionToast(q.name, r);

      // Dispatch event so other modules (quest-ui, HUD) can update
      window.dispatchEvent(new CustomEvent("questCompleted", {
        detail: { questId, questName: q.name, rewards: r }
      }));

      // Map message for immediate feedback
      if (Game.modules?.worldmap?.showMapMessage) {
        Game.modules.worldmap.showMapMessage(`QUEST COMPLETE: ${q.name}`);
      }
      
      // Trigger inventory UI refresh
      if (window.Game?.hooks?.onInventoryUpdated) {
        window.Game.hooks.onInventoryUpdated();
      }
    },

    showQuestCompletionToast(questName, rewards) {
      let toastContainer = document.getElementById("quest-toast-container");
      if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.id = "quest-toast-container";
        toastContainer.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          max-width: 350px;
        `;
        document.body.appendChild(toastContainer);
      }

      const toast = document.createElement("div");
      toast.className = "quest-toast quest-complete-toast";
      toast.style.cssText = `
        background: rgba(5, 20, 5, 0.97);
        border: 2px solid #ffaa00;
        border-radius: 4px;
        padding: 14px 18px;
        margin-bottom: 10px;
        color: #ffaa00;
        font-family: 'VT323', 'Share Tech Mono', monospace;
        box-shadow: 0 0 24px rgba(255, 170, 0, 0.4);
        animation: questToastIn 0.3s ease-out;
      `;

      const rewardLines = [];
      if (rewards?.xp)   rewardLines.push(`+${rewards.xp} XP`);
      if (rewards?.caps) rewardLines.push(`+${rewards.caps} CAPS`);
      if (rewards?.items?.length) rewardLines.push(`Items: ${rewards.items.map(id => escapeHtml(String(id))).join(", ")}`);

      const safeQuestName = escapeHtml(questName || "");
      toast.innerHTML = `
        <div style="font-size: 16px; color: #ffaa00; margin-bottom: 4px; font-weight: bold;">✓ QUEST COMPLETE</div>
        <div style="font-size: 20px; font-weight: bold; margin-bottom: 6px;">${safeQuestName}</div>
        ${rewardLines.length ? `<div style="font-size: 13px; color: #00ff41; opacity: 0.9;">${rewardLines.join(" · ")}</div>` : ""}
      `;

      toastContainer.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = "questToastOut 0.3s ease-out forwards";
        setTimeout(() => toast.remove(), 300);
      }, 6000);
    },

    getCurrentStep(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);

      if (!q || st.state !== "active") return null;
      if (q.type === "objectives") return null; // objectives don't have steps
      return q.steps ? q.steps[st.currentStepIndex] : null;
    },

    checkStepCompletion(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);
      if (!q || st.state !== "active") return false;

      const step = q.steps[st.currentStepIndex];
      if (!step) return false;

      const req = step.requires || {};

      // Item requirement — search PlayerState (primary) and legacy inventory categories
      if (req.item) {
        // Check unified PlayerState first (primary inventory store)
        const psHas = Game.modules?.PlayerState?.hasItem
          ? Game.modules.PlayerState.hasItem(req.item)
          : false;
        if (!psHas) {
          // Fallback: search legacy categorised inventory structure
          if (!Game.modules?.PlayerState?.hasItem) {
            console.warn("[quests] PlayerState.hasItem unavailable, using legacy inventory fallback");
          }
          const inv = this.gs.inventory;
          const legacyHas =
            inv.questItems?.some(i => i.id === req.item) ||
            inv.consumables?.some(i => i.id === req.item) ||
            inv.weapons?.some(i => i.id === req.item) ||
            inv.ammo?.some(i => i.id === req.item) ||
            inv.tools?.some(i => i.id === req.item) ||
            inv.junk?.some(i => i.id === req.item) ||
            inv.misc?.some(i => i.id === req.item) ||
            inv.armor?.some(i => i.id === req.item);
          if (!legacyHas) return false;
        }
      }

      // Location requirement — guard against worldmap not being ready
      if (req.location) {
        if (!Game.modules.worldmap || typeof Game.modules.worldmap.getNearbyPOIs !== "function") {
          console.warn("[quests] worldmap.getNearbyPOIs not available for location check");
          return false;
        }
        const nearby = Game.modules.worldmap.getNearbyPOIs(500);
        const atLoc = nearby.some(n => n.poi && n.poi.id === req.location);
        if (!atLoc) return false;
      }

      // Flag requirement — check GAME_STATE flags set by narrative.js
      if (req.flag) {
        const flagValue = window.GAME_STATE?.flags?.[req.flag];
        if (!flagValue) return false;
      }

      return true;
    },

    advanceQuest(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);
      if (!q || st.state !== "active") return false;

      if (!this.checkStepCompletion(questId)) return false;

      st.currentStepIndex++;

      // CRITICAL FIX: Save quest state after advancing step
      this.saveQuestState();

      // Quest complete — delegate to completeQuest() for unified reward handling
      // (avoids double-crediting gs.player XP/caps AND window.PLAYER XP/caps)
      if (st.currentStepIndex >= q.steps.length) {
        this.completeQuest(questId);
        return true;
      }

      return true;
    },

    triggerQuest(questId) {
      const st = this.ensureQuestState(questId);
      if (st.state === "not_started") {
        return this.startQuest(questId);
      }
      return false;
    },

    // UI hook
    onOpen() {
      const container = document.getElementById("questBody");
      if (!container) return;

      container.innerHTML = "";

      Object.values(QUESTS_DB).forEach(q => {
        const st = this.ensureQuestState(q.id);

        const div = document.createElement("div");
        div.className = "quest-entry";

        // BUG FIX: escape quest name, description, and state before inserting into innerHTML
        div.innerHTML = `
          <h3>${escapeHtml(q.name)}</h3>
          <p>${escapeHtml(q.description)}</p>
          <p>Status: <strong>${escapeHtml(st.state)}</strong></p>
        `;

        if (st.state === "active") {
          const step = this.getCurrentStep(q.id);
          if (step) {
            // BUG FIX: escape step description before inserting into innerHTML
            div.innerHTML += `
              <p>Current Step: ${escapeHtml(step.description)}</p>
            `;
          }
        }

        container.appendChild(div);
      });

      // Show available quests (offered but not accepted)
      const availableQuestsSection = document.createElement("div");
      availableQuestsSection.className = "available-quests-section";
      
      const availableList = this.getAvailableQuests();
      if (availableList.length > 0) {
        availableQuestsSection.innerHTML = `<h2 style="color: #ffaa00;">AVAILABLE QUESTS</h2>`;
        
        availableList.forEach(q => {
          const questDiv = document.createElement("div");
          questDiv.className = "quest-entry quest-available";
          // BUG FIX: escape name, message, description, and id before inserting into innerHTML
          questDiv.innerHTML = `
            <h3 style="color: #ffaa00;">${escapeHtml(q.name)}</h3>
            <p>${escapeHtml(q.offer.message)}</p>
            <p><em>${escapeHtml(q.description)}</em></p>
            <div class="quest-actions" style="margin-top: 8px;">
              <button class="pipboy-button-small quest-accept-btn" data-quest-id="${escapeHtml(q.id)}">ACCEPT</button>
              <button class="pipboy-button-small quest-decline-btn" data-quest-id="${escapeHtml(q.id)}" style="margin-left: 8px; opacity: 0.7;">DECLINE</button>
            </div>
          `;
          availableQuestsSection.appendChild(questDiv);
        });

        container.insertBefore(availableQuestsSection, container.firstChild);

        // Add event listeners for accept/decline buttons
        container.querySelectorAll(".quest-accept-btn").forEach(btn => {
          btn.addEventListener("click", (e) => {
            const questId = e.target.getAttribute("data-quest-id");
            this.acceptQuest(questId);
            this.onOpen(); // Refresh the UI
          });
        });

        container.querySelectorAll(".quest-decline-btn").forEach(btn => {
          btn.addEventListener("click", (e) => {
            const questId = e.target.getAttribute("data-quest-id");
            this.declineQuest(questId);
            this.onOpen(); // Refresh the UI
          });
        });
      }
    },

    // Get starter gear list (for UI display)
    getStarterGear() {
      return STARTER_GEAR;
    },

    // Check if player has starter gear
    hasStarterGear() {
      return this.starterGearGiven || !!localStorage.getItem("afc_starter_gear_given");
    },

    // Expose quest database for quest-ui.js
    QUESTS_DB: QUESTS_DB,
    STARTER_GEAR: STARTER_GEAR
  };

  Game.modules.quests = questsModule;
  
  // Also expose as Game.quests for compatibility with pipboy.js
  Game.quests = questsModule;
  
  // Hook to fetch placeholders from server if available
  (async () => {
    try {
      const res = await fetch('/api/quests-store/placeholders');
      if (!res.ok) return;
      const json = await res.json();
      if (json && Array.isArray(json.placeholders)) {
        // Merge placeholders into local QUESTS_DB if missing
        json.placeholders.forEach(p => {
          if (!QUESTS_DB[p.id]) {
            QUESTS_DB[p.id] = { id: p.id, name: p.name, description: p.short || '', type: p.type };
          }
        });
      }
    } catch (e) {
      // ignore
    }
  })();

  // Simple avatar composer utilities (low-footprint SVG layering)
  Game.Avatar = {
    assetsPath: '/assets/avatars/',
    async compose(parts = { head: 'head_base.svg', eyes: 'eyes_set1.svg', hair: 'hair_short.svg', shirt: 'shirt_jacket.svg' }) {
      // Load SVG fragments and combine into a single SVG element
      const fragPromises = Object.keys(parts).map(async key => {
        const url = this.assetsPath + parts[key];
        const res = await fetch(url);
        const text = await res.text();
        // strip xml header if present
        return text.replace(/^\s*<\?xml[^>]*>\s*/,'');
      });
      const fragments = await Promise.all(fragPromises);
      const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${fragments.join('')}</svg>`;
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }
  };

  // Load Saitama lore snippet for UI banners (non-sensitive)
  (async () => {
    try {
      const res = await fetch('/api/quests-store/lore/saitama');
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.lore) {
        window.SAITAMA_LORE = json.lore;
        console.log('[quests] loaded Saitama lore snippet');
      }
    } catch (e) {}
  })();
})();
