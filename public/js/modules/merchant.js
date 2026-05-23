// public/js/modules/merchant.js
// ------------------------------------------------------------
// NPC Merchant Shop UI Module
// Handles buying/selling items with karma-based pricing
// ------------------------------------------------------------

(function() {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const merchant = {
    currentNPC: null,
    shopData: null,
    isOpen: false,

    // Karma price modifiers (from karma_system.json)
    karmaModifiers: {
      veryEvil: 3.0,    // 300% markup
      evil: 2.0,        // 200% markup
      bad: 1.5,         // 150% markup
      neutral: 1.0,     // normal price
      good: 0.8,        // 20% discount
      veryGood: 0.7     // 30% discount
    },

    init() {
      console.log("[merchant] Initialized");
    },

    // Open shop for an NPC
    openShop(npcId, shopData) {
      if (this.isOpen) {
        console.warn("[merchant] Shop already open");
        return;
      }

      this.currentNPC = npcId;
      this.shopData = shopData || this.getDefaultShopData(npcId);
      this.isOpen = true;

      this.renderShop();
      this.showOverlay();
    },

    // Close shop
    closeShop() {
      if (!this.isOpen) return;

      this.hideOverlay();
      this.currentNPC = null;
      this.shopData = null;
      this.isOpen = false;
    },

    // Get default shop data if none provided
    getDefaultShopData(npcId) {
      // Default shop inventory - could be loaded from NPC data
      return {
        inventory: [
          { id: "ammo_9mm", quantity: 50 },
          { id: "ammo_556", quantity: 30 },
          { id: "stimpack", quantity: 10 },
          { id: "radaway", quantity: 5 },
          { id: "fusion_cell", quantity: 20 }
        ]
      };
    },

    // Get karma modifier for current player
    getKarmaModifier() {
      const karma = Game.player?.karma || 0;

      if (karma <= -750) return this.karmaModifiers.veryEvil;
      if (karma <= -500) return this.karmaModifiers.evil;
      if (karma <= -250) return this.karmaModifiers.bad;
      if (karma >= 500) return this.karmaModifiers.veryGood;
      if (karma >= 250) return this.karmaModifiers.good;

      return this.karmaModifiers.neutral;
    },

    // Get item price with karma modifier
    getItemPrice(item, isBuying = true) {
      if (!item || !item.value) return 0;

      const basePrice = item.value;
      const modifier = this.getKarmaModifier();

      if (isBuying) {
        // Buying from NPC - player pays more if evil, less if good
        return Math.round(basePrice * modifier);
      } else {
        // Selling to NPC - player gets half price
        return Math.round(basePrice * 0.5);
      }
    },

    // Render the shop UI
    renderShop() {
      const overlay = document.getElementById("merchantOverlay");
      if (!overlay) {
        console.error("[merchant] Merchant overlay not found");
        return;
      }

      const content = overlay.querySelector(".merchant-content");
      if (!content) return;

      // Get player caps
      const playerCaps = Game.player?.caps || 0;

      // Build HTML
      let html = `
        <div class="merchant-header">
          <div class="merchant-title">${this.shopData.name || "Merchant Shop"}</div>
          <div class="merchant-caps">Your Caps: ${playerCaps}</div>
        </div>

        <div class="merchant-tabs">
          <button class="merchant-tab active" data-tab="buy">BUY</button>
          <button class="merchant-tab" data-tab="sell">SELL</button>
        </div>

        <div class="merchant-tab-content">
          <div id="merchant-buy-tab" class="merchant-tab-panel active">
            ${this.renderBuyTab()}
          </div>
          <div id="merchant-sell-tab" class="merchant-tab-panel">
            ${this.renderSellTab()}
          </div>
        </div>

        <div class="merchant-actions">
          <button id="merchant-close-btn" class="pipboy-button-small">CLOSE SHOP</button>
        </div>
      `;

      content.innerHTML = html;

      // Wire events
      this.wireEvents();
    },

    // Render buy tab
    renderBuyTab() {
      if (!this.shopData || !this.shopData.inventory) {
        return "<div class='merchant-empty'>No items for sale</div>";
      }

      let html = "<div class='merchant-items'>";

      this.shopData.inventory.forEach(shopItem => {
        const item = this.getItemData(shopItem.id);
        if (!item) return;

        const price = this.getItemPrice(item, true);
        const canAfford = (Game.player?.caps || 0) >= price;
        const modifier = this.getKarmaModifier();
        const priceClass = modifier > 1 ? "expensive" : modifier < 1 ? "discounted" : "";

        html += `
          <div class="merchant-item">
            <div class="merchant-item-info">
              <div class="merchant-item-name">${item.name}</div>
              <div class="merchant-item-desc">${item.description || ""}</div>
              <div class="merchant-item-price ${priceClass}">${price} caps</div>
            </div>
            <button class="merchant-buy-btn pipboy-button-small ${canAfford ? "" : "disabled"}"
                    data-item-id="${item.id}"
                    data-price="${price}"
                    ${canAfford ? "" : "disabled"}>
              BUY
            </button>
          </div>
        `;
      });

      html += "</div>";
      return html;
    },

    // Render sell tab
    renderSellTab() {
      const inventory = Game.player?.inventory || [];
      const sellableItems = inventory.filter(item =>
        item.type !== "quest" && item.type !== "questItem"
      );

      if (sellableItems.length === 0) {
        return "<div class='merchant-empty'>No items to sell</div>";
      }

      let html = "<div class='merchant-items'>";

      sellableItems.forEach(item => {
        const price = this.getItemPrice(item, false);
        const quantity = item.quantity || 1;

        html += `
          <div class="merchant-item">
            <div class="merchant-item-info">
              <div class="merchant-item-name">${item.name} ${quantity > 1 ? `×${quantity}` : ""}</div>
              <div class="merchant-item-desc">${item.description || ""}</div>
              <div class="merchant-item-price">${price} caps each</div>
            </div>
            <button class="merchant-sell-btn pipboy-button-small"
                    data-item-id="${item.id}"
                    data-price="${price}"
                    data-quantity="${quantity}">
              SELL
            </button>
          </div>
        `;
      });

      html += "</div>";
      return html;
    },

    // Get item data by ID
    getItemData(itemId) {
      // Try to find in loaded item data
      if (window.Game?.items) {
        return window.Game.items.find(i => i.id === itemId);
      }

      // Fallback - could load from items.json
      // For now, return a basic item
      return {
        id: itemId,
        name: itemId.replace(/_/g, " ").toUpperCase(),
        value: 10,
        description: "An item"
      };
    },

    // Wire event handlers
    wireEvents() {
      const overlay = document.getElementById("merchantOverlay");

      // Tab switching
      overlay.querySelectorAll(".merchant-tab").forEach(tab => {
        tab.addEventListener("click", (e) => {
          const tabName = e.target.dataset.tab;
          this.switchTab(tabName);
        });
      });

      // Buy buttons
      overlay.querySelectorAll(".merchant-buy-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const itemId = e.target.dataset.itemId;
          const price = parseInt(e.target.dataset.price);
          this.buyItem(itemId, price);
        });
      });

      // Sell buttons
      overlay.querySelectorAll(".merchant-sell-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const itemId = e.target.dataset.itemId;
          const price = parseInt(e.target.dataset.price);
          const quantity = parseInt(e.target.dataset.quantity);
          this.sellItem(itemId, price, quantity);
        });
      });

      // Close button
      const closeBtn = document.getElementById("merchant-close-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.closeShop());
      }

      // ESC key to close
      this.escHandler = (e) => {
        if (e.key === "Escape" && this.isOpen) {
          this.closeShop();
        }
      };
      document.addEventListener("keydown", this.escHandler);
    },

    // Switch tabs
    switchTab(tabName) {
      const overlay = document.getElementById("merchantOverlay");

      // Update tab buttons
      overlay.querySelectorAll(".merchant-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === tabName);
      });

      // Update tab content
      overlay.querySelectorAll(".merchant-tab-panel").forEach(panel => {
        panel.classList.toggle("active", panel.id === `merchant-${tabName}-tab`);
      });
    },

    // Buy item
    buyItem(itemId, price) {
      const playerCaps = Game.player?.caps || 0;
      if (playerCaps < price) {
        this.showMessage("Not enough caps!");
        return;
      }

      // Confirm purchase
      if (!confirm(`Buy ${this.getItemData(itemId).name} for ${price} caps?`)) {
        return;
      }

      // Deduct caps
      if (Game.modules?.PlayerState?.awardCaps) {
        Game.modules.PlayerState.awardCaps(-price);
      } else if (Game.player) {
        Game.player.caps -= price;
      }

      // Add item to inventory
      const item = this.getItemData(itemId);
      if (Game.modules?.PlayerState?.addItem) {
        Game.modules.PlayerState.addItem(item);
      }

      // Update UI
      this.renderShop();
      this.showMessage(`Purchased ${item.name}!`);
    },

    // Sell item
    sellItem(itemId, price, quantity) {
      // Confirm sale
      const item = this.getItemData(itemId);
      if (!confirm(`Sell ${item.name} for ${price} caps?`)) {
        return;
      }

      // Remove item from inventory
      if (Game.modules?.PlayerState?.removeItem) {
        Game.modules.PlayerState.removeItem(itemId, 1);
      }

      // Add caps
      if (Game.modules?.PlayerState?.awardCaps) {
        Game.modules.PlayerState.awardCaps(price);
      } else if (Game.player) {
        Game.player.caps += price;
      }

      // Update UI
      this.renderShop();
      this.showMessage(`Sold ${item.name} for ${price} caps!`);
    },

    // Show message
    showMessage(text) {
      // Could implement a toast notification system
      console.log("[merchant]", text);
      alert(text); // Simple for now
    },

    // Show overlay
    showOverlay() {
      const overlay = document.getElementById("merchantOverlay");
      if (overlay) {
        overlay.classList.remove("hidden");
      }
    },

    // Hide overlay
    hideOverlay() {
      const overlay = document.getElementById("merchantOverlay");
      if (overlay) {
        overlay.classList.add("hidden");
      }

      // Remove ESC handler
      if (this.escHandler) {
        document.removeEventListener("keydown", this.escHandler);
        this.escHandler = null;
      }
    }
  };

  // Register module
  Game.modules.merchant = merchant;

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => merchant.init());
  } else {
    merchant.init();
  }

})();