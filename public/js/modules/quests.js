// quests.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Unified Quest Module (Resurrected)
// ------------------------------------------------------------

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // ============================================================
  // STARTER GEAR - Items players begin with
  // The jumpsuit is already equipped (player wakes up wearing it)
  // ============================================================
  const STARTER_GEAR = [
    { id: "vault77_sidearm", name: "Security Sidearm", type: "weapon", equipped: false },
    { id: "vault77_jumpsuit", name: "Wasteland Jumpsuit", type: "armor", equipped: true },
    { id: "stimpak", name: "Stimpak", type: "consumable", quantity: 3 },
    { id: "dirty_water", name: "Dirty Water", type: "consumable", quantity: 2 },
    { id: "bobby_pin", name: "Bobby Pin", type: "tool", quantity: 5 },
    { id: "ammo_9mm", name: "9mm Rounds", type: "ammo", quantity: 24 }
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
      triggerType: "npc",           // Delivered by NPC courier
      triggerNpc: "courier_pip",    // The courier NPC who delivers this quest
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
    // Saitama learning/side placeholder (client-side note). Full details provided by server when revealed.
    saitama_learning: {
      id: 'saitama_learning',
      name: 'Saitama Echo (Learning Quest)',
      type: 'learning',
      triggerType: 'manual',
      description: 'A side-quest that teaches crypto safety through an investigation into a token scam.',
      rewards: { xp: 150, caps: 200 }
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
        this.loadAvailableQuests();
        this.giveStarterGear(); // This checks its own flag
        return;
      }
      sessionStorage.setItem(initKey, "true");
      
      this.gs = gameState || window.gameState || window.DATA || {};
      if (!this.gs.quests) this.gs.quests = {};
      if (!this.gs.player) this.gs.player = { xp: 0, caps: 0 };
      if (!this.gs.inventory) this.gs.inventory = { weapons: [], armor: [], consumables: [], ammo: [], tools: [], questItems: [] };
      
      // Load saved available quests
      this.loadAvailableQuests();
      
      // Give starter gear on first init (checks localStorage internally)
      this.giveStarterGear();
      
      // Auto-trigger the wake_up quest courier ONLY on first load (new players)
      // Check localStorage to avoid retriggering for returning players
      const wakeUpKey = "afc_wake_up_triggered";
      if (!localStorage.getItem(wakeUpKey)) {
        const triggered = this.triggerNPCQuestDelivery("wake_up");
        if (triggered) {
          localStorage.setItem(wakeUpKey, "true");
        }
      }
      
      // Re-show notifications for any available quests that were persisted
      // Use sessionStorage to track shown notifications (once per browser session)
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
            // If marked as equipped (jumpsuit), set it on the player
            if (item.equipped) {
              Game.player.equipped.armor = invItem;
              console.log("[quests] Player starts with equipped armor:", invItem.name);
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
          Game.player.equipped = equipped;
          console.log("[quests] Restored equipped items for returning player:", equipped);
        } else {
          // No saved equipped items - give them the default jumpsuit
          // This handles the edge case where flag was set but equipped wasn't saved
          const jumpsuit = STARTER_GEAR.find(item => item.type === "armor" && item.equipped);
          if (jumpsuit && !Game.player.equipped.armor) {
            Game.player.equipped.armor = {
              id: jumpsuit.id,
              name: jumpsuit.name,
              type: jumpsuit.type,
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

      // Request quest reveal from server (if present). If not, start locally.
      try {
        const wallet = window.PLAYER_WALLET || null;
        const res = await fetch(`/api/quests-store/reveal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet, questId })
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
    async startLearningQuest(questId) {
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
        modal.innerHTML = `
          <h2 style="color:#ffaa00">${lore.scammer_stories && lore.scammer_stories[0] ? lore.scammer_stories[0].title : 'Saitama Echo'}</h2>
          <p>${lore.scammer_stories && lore.scammer_stories[0] ? lore.scammer_stories[0].body : 'Investigate the token and learn to be cautious.'}</p>
          <h3 style="color:#00ff41">Tutorial: Wallet Basics</h3>
          <ol>${(lore.tutorials && lore.tutorials.crypto_101 && lore.tutorials.crypto_101.steps || []).map(s => `<li>${s}</li>`).join('')}</ol>
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
      this.showQuestToast(quest.name, offer.message);
    },
    
    // Simple toast notification for quest offers
    showQuestToast(questName, message) {
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
      
      toast.innerHTML = `
        <div style="font-size: 14px; color: #ffaa00; margin-bottom: 6px;">📜 NEW QUEST AVAILABLE</div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">${questName}</div>
        <div style="font-size: 13px; opacity: 0.85;">${message}</div>
        <div style="margin-top: 8px; font-size: 12px; color: #aaa;">Check QUESTS tab to accept</div>
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

    startQuest(questId) {
      const q = QUESTS_DB[questId];
      if (!q) {
        console.warn("[quests] Unknown quest:", questId);
        return false;
      }

      const st = this.ensureQuestState(questId);
      if (st.state === "completed") return false;

      st.state = "active";
      st.currentStepIndex = 0;

      // Initialize objective states for objective-based quests
      if (q.type === "objectives" && q.objectives) {
        Object.keys(q.objectives).forEach(obj => {
          st.objectives[obj] = false;
        });
      }

      console.log("[quests] Quest started:", questId);
      return true;
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

      // Check if all objectives are done
      const allDone = q.order.every(obj => st.objectives[obj]);
      if (allDone) {
        this.completeQuest(questId);
      }

      return true;
    },

    completeQuest(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);

      st.state = "completed";

      const r = q.rewards || {};
      if (this.gs.player) {
        this.gs.player.xp = (this.gs.player.xp || 0) + (r.xp || 0);
        this.gs.player.caps = (this.gs.player.caps || 0) + (r.caps || 0);
      }
      
      // Give item rewards and sync with inventory systems
      if (r.items && Array.isArray(r.items)) {
        r.items.forEach(itemId => {
          // Look up item definition from loaded items database
          let itemDef = null;
          if (window.Game && window.Game.player && window.Game.player.items) {
            itemDef = window.Game.player.items.find(i => i.id === itemId);
          }
          
          // Create item object with full metadata if available
          const itemObj = itemDef ? { ...itemDef, quantity: 1 } : { id: itemId, name: itemId, type: "questItem", quantity: 1 };
          
          // Add to quest module inventory
          if (!this.gs.inventory.questItems) this.gs.inventory.questItems = [];
          this.gs.inventory.questItems.push(itemObj);
          
          // Add to Game.player.inventory (main inventory system)
          if (window.Game && window.Game.player) {
            if (!window.Game.player.inventory) window.Game.player.inventory = [];
            // Check if item already exists
            const existing = window.Game.player.inventory.find(i => i.id === itemId);
            if (existing && existing.quantity !== undefined) {
              existing.quantity += 1;
            } else if (!existing) {
              window.Game.player.inventory.push(itemObj);
            }
          }
          
          // Legacy sync with main.js PLAYER inventory (if it exists)
          if (window.PLAYER && Array.isArray(window.PLAYER.inventory)) {
            if (!window.PLAYER.inventory.includes(itemId)) {
              window.PLAYER.inventory.push(itemId);
            }
          }
          
          console.log("[quests] Rewarded item:", itemObj);
        });
      }
      
      // Sync XP and caps with main.js PLAYER state
      if (window.PLAYER) {
        if (r.xp) {
          window.PLAYER.xp = (window.PLAYER.xp || 0) + r.xp;
        }
        if (r.caps) {
          window.PLAYER.caps = (window.PLAYER.caps || 0) + r.caps;
        }
      }

      console.log("[quests] Quest completed:", questId);
      
      // Trigger inventory UI refresh
      if (window.Game && window.Game.hooks && window.Game.hooks.onInventoryUpdated) {
        window.Game.hooks.onInventoryUpdated();
      }
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

      // Item requirement
      if (req.item) {
        const inv = this.gs.inventory;
        const hasItem =
          inv.questItems.some(i => i.id === req.item) ||
          inv.consumables.some(i => i.id === req.item) ||
          inv.weapons.some(i => i.id === req.item) ||
          inv.ammo.some(i => i.id === req.item);

        if (!hasItem) return false;
      }

      // Location requirement
      if (req.location) {
        const nearby = Game.modules.worldmap.getNearbyPOIs(500);
        const atLoc = nearby.some(n => n.poi.id === req.location);
        if (!atLoc) return false;
      }

      return true;
    },

    advanceQuest(questId) {
      const q = QUESTS_DB[questId];
      const st = this.ensureQuestState(questId);
      if (!q || st.state !== "active") return false;

      if (!this.checkStepCompletion(questId)) return false;

      st.currentStepIndex++;

      // Quest complete
      if (st.currentStepIndex >= q.steps.length) {
        st.state = "completed";

        const r = q.rewards || {};
        this.gs.player.xp += r.xp || 0;
        this.gs.player.caps += r.caps || 0;

        // Give item rewards and sync with main.js PLAYER inventory
        (r.items || []).forEach(itemId => {
          // Add to quest module inventory
          if (!this.gs.inventory.questItems) this.gs.inventory.questItems = [];
          this.gs.inventory.questItems.push({ id: itemId, name: itemId, quantity: 1 });
          
          // Sync with main.js PLAYER inventory
          if (window.PLAYER && Array.isArray(window.PLAYER.inventory)) {
            if (!window.PLAYER.inventory.includes(itemId)) {
              window.PLAYER.inventory.push(itemId);
            }
          }
        });
        
        // Sync XP and caps with main.js PLAYER state
        if (window.PLAYER) {
          window.PLAYER.xp = (window.PLAYER.xp || 0) + (r.xp || 0);
          window.PLAYER.caps = (window.PLAYER.caps || 0) + (r.caps || 0);
        }

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
      const container = document.getElementById("tab-quests");
      if (!container) return;

      container.innerHTML = "";

      Object.values(QUESTS_DB).forEach(q => {
        const st = this.ensureQuestState(q.id);

        const div = document.createElement("div");
        div.className = "quest-entry";

        div.innerHTML = `
          <h3>${q.name}</h3>
          <p>${q.description}</p>
          <p>Status: <strong>${st.state}</strong></p>
        `;

        if (st.state === "active") {
          const step = this.getCurrentStep(q.id);
          if (step) {
            div.innerHTML += `
              <p>Current Step: ${step.description}</p>
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
          questDiv.innerHTML = `
            <h3 style="color: #ffaa00;">${q.name}</h3>
            <p>${q.offer.message}</p>
            <p><em>${q.description}</em></p>
            <div class="quest-actions" style="margin-top: 8px;">
              <button class="pipboy-button-small quest-accept-btn" data-quest-id="${q.id}">ACCEPT</button>
              <button class="pipboy-button-small quest-decline-btn" data-quest-id="${q.id}" style="margin-left: 8px; opacity: 0.7;">DECLINE</button>
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
