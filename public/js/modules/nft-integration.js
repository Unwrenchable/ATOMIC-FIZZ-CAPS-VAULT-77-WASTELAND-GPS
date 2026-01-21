// nft-integration.js
// ------------------------------------------------------------
// NFT System Integration for Atomic Fizz Caps
// Handles wallet connection, NFT checking, minting, and utility NFT usage
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const nftIntegration = {
    loaded: false,
    categories: null,
    walletConnected: false,
    walletAddress: null,
    ownedNFTs: {},

    async init() {
      if (this.loaded) return;
      try {
        // Load NFT categories
        const res = await fetch("/data/nft_categories.json");
        if (!res.ok) {
          console.error("[nft-integration] Failed to load NFT categories:", res.status);
          return;
        }
        this.categories = await res.json();
        this.loaded = true;
        console.log("[nft-integration] NFT system initialized");
        
        // Check for existing wallet connection
        this.checkWalletConnection();
        
        // Initialize REBUILD SPECIAL button
        this.initRebuildSpecialButton();
      } catch (e) {
        console.error("[nft-integration] Error initializing NFT system:", e);
      }
    },

    async checkWalletConnection() {
      // Check if wallet is already connected via existing wallet.js
      if (window.wallet && window.wallet.connected) {
        this.walletConnected = true;
        this.walletAddress = window.wallet.publicKey?.toString();
        console.log("[nft-integration] Wallet connected:", this.walletAddress);
        await this.refreshOwnedNFTs();
      }
    },

    async connectWallet() {
      // Use existing wallet connection system
      if (window.wallet && window.wallet.connect) {
        try {
          await window.wallet.connect();
          this.walletConnected = true;
          this.walletAddress = window.wallet.publicKey?.toString();
          console.log("[nft-integration] Wallet connected:", this.walletAddress);
          await this.refreshOwnedNFTs();
          return true;
        } catch (e) {
          console.error("[nft-integration] Wallet connection failed:", e);
          return false;
        }
      } else {
        console.warn("[nft-integration] No wallet provider found");
        alert("Please install Phantom or MetaMask wallet to use NFT features");
        return false;
      }
    },

    async refreshOwnedNFTs() {
      if (!this.walletConnected || !this.walletAddress) {
        console.log("[nft-integration] No wallet connected, skipping NFT refresh");
        return;
      }

      // TODO: Implement actual blockchain NFT fetching
      // For now, simulate checking for NFTs
      console.log("[nft-integration] Checking NFTs for wallet:", this.walletAddress);
      
      // Simulate checking rebuild_special_token
      // In production, this would query Solana blockchain for NFTs owned by wallet
      this.ownedNFTs = {
        rebuild_special_token: 0, // Count of tokens owned
        fast_travel_pass: 0,
        // ... other NFTs
      };

      // Temporary: Check localStorage for debugging/testing
      const storedNFTs = localStorage.getItem(`nfts_${this.walletAddress}`);
      if (storedNFTs) {
        try {
          this.ownedNFTs = JSON.parse(storedNFTs);
        } catch (e) {
          console.error("[nft-integration] Error parsing stored NFTs:", e);
        }
      }

      console.log("[nft-integration] Owned NFTs:", this.ownedNFTs);
      this.updateUI();
    },

    hasNFT(nftId) {
      return (this.ownedNFTs[nftId] || 0) > 0;
    },

    getNFTCount(nftId) {
      return this.ownedNFTs[nftId] || 0;
    },

    async consumeNFT(nftId) {
      if (!this.hasNFT(nftId)) {
        console.error("[nft-integration] Cannot consume NFT - not owned:", nftId);
        return false;
      }

      // Decrement count
      this.ownedNFTs[nftId] = (this.ownedNFTs[nftId] || 1) - 1;
      
      // Save to localStorage for testing
      if (this.walletAddress) {
        localStorage.setItem(`nfts_${this.walletAddress}`, JSON.stringify(this.ownedNFTs));
      }

      // TODO: In production, burn or mark NFT as used on blockchain
      console.log("[nft-integration] Consumed NFT:", nftId);
      
      this.updateUI();
      return true;
    },

    async mintNFT(nftId, costCaps, costFizz) {
      if (!this.walletConnected) {
        alert("Please connect your wallet to mint NFTs");
        await this.connectWallet();
        return false;
      }

      // Check if player has enough currency
      const player = window.PLAYER || Game.state?.player;
      if (!player) {
        console.error("[nft-integration] No player state found");
        return false;
      }

      const hasCaps = (player.caps || 0) >= costCaps;
      const hasFizz = (player.fizzTokens || 0) >= costFizz;

      if (!hasCaps || !hasFizz) {
        alert(`Insufficient funds!\nRequired: ${costCaps} caps + ${costFizz} Fizz\nYou have: ${player.caps || 0} caps + ${player.fizzTokens || 0} Fizz`);
        return false;
      }

      // Confirm purchase
      const confirmMsg = `Mint ${nftId} as NFT to your wallet?\n\nCost: ${costCaps} caps + ${costFizz} Fizz\nWallet: ${this.walletAddress}\n\nThis NFT will be tradeable.`;
      if (!confirm(confirmMsg)) {
        return false;
      }

      // Deduct currency
      player.caps -= costCaps;
      player.fizzTokens = (player.fizzTokens || 0) - costFizz;

      // TODO: Actual blockchain minting
      // For now, simulate by adding to owned NFTs
      this.ownedNFTs[nftId] = (this.ownedNFTs[nftId] || 0) + 1;
      
      // Save to localStorage
      if (this.walletAddress) {
        localStorage.setItem(`nfts_${this.walletAddress}`, JSON.stringify(this.ownedNFTs));
      }

      console.log("[nft-integration] Minted NFT:", nftId);
      alert(`Successfully minted ${nftId}!\n\nThe NFT has been added to your wallet and can be traded with other players.`);
      
      this.updateUI();
      return true;
    },

    initRebuildSpecialButton() {
      const btn = document.getElementById("respecBtn");
      if (!btn) {
        console.log("[nft-integration] REBUILD SPECIAL button not found (may not be on current screen)");
        return;
      }

      // Remove existing click handlers
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      // Add click handler
      newBtn.addEventListener("click", () => this.handleRebuildSpecialClick());

      // Update button state
      this.updateRebuildSpecialButton();
    },

    updateRebuildSpecialButton() {
      const btn = document.getElementById("respecBtn");
      if (!btn) return;

      const hasToken = this.hasNFT("rebuild_special_token");
      const tokenCount = this.getNFTCount("rebuild_special_token");

      if (hasToken) {
        btn.textContent = `REBUILD SPECIAL (${tokenCount} TOKEN${tokenCount !== 1 ? 'S' : ''} AVAILABLE)`;
        btn.classList.remove("disabled");
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      } else {
        btn.textContent = "REBUILD SPECIAL (REQUIRES TOKEN)";
        btn.classList.add("disabled");
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
      }
    },

    async handleRebuildSpecialClick() {
      const hasToken = this.hasNFT("rebuild_special_token");

      if (!hasToken) {
        // No token - open Scavenger Exchange to purchase
        const purchase = confirm(
          "REBUILD SPECIAL requires a Vault-Tec Respec Token.\n\n" +
          "Purchase options:\n" +
          "• Buy from merchant: 8,000 caps (consumable only)\n" +
          "• Mint as NFT: 5,000 caps + 500 Fizz (tradeable)\n\n" +
          "Would you like to go to the Scavenger Exchange?"
        );

        if (purchase) {
          this.openScavengerExchange("rebuild_special_token");
        }
        return;
      }

      // Has token - confirm respec
      const player = window.PLAYER || Game.state?.player;
      if (!player) {
        alert("Error: Player state not found");
        return;
      }

      const confirmRespec = confirm(
        "⚠️ REBUILD SPECIAL ⚠️\n\n" +
        "This will:\n" +
        "• Reset all your SPECIAL points\n" +
        "• Consume 1 Respec Token from your wallet\n" +
        "• Start a 7-day cooldown\n\n" +
        "Current SPECIAL:\n" +
        `S: ${player.special?.strength || 1}\n` +
        `P: ${player.special?.perception || 1}\n` +
        `E: ${player.special?.endurance || 1}\n` +
        `C: ${player.special?.charisma || 1}\n` +
        `I: ${player.special?.intelligence || 1}\n` +
        `A: ${player.special?.agility || 1}\n` +
        `L: ${player.special?.luck || 1}\n\n` +
        "Are you sure?"
      );

      if (!confirmRespec) {
        return;
      }

      // Consume token
      const consumed = await this.consumeNFT("rebuild_special_token");
      if (!consumed) {
        alert("Error: Failed to consume token");
        return;
      }

      // Reset SPECIAL (implementation depends on your SPECIAL system)
      if (window.Game.modules.special && window.Game.modules.special.resetPoints) {
        Game.modules.special.resetPoints();
      } else {
        // Fallback: reset to base values and give points
        const baseSpecial = {
          strength: 1,
          perception: 1,
          endurance: 1,
          charisma: 1,
          intelligence: 1,
          agility: 1,
          luck: 1
        };
        player.special = baseSpecial;
        player.specialPoints = 21; // 7 base + 21 to allocate = 28 total
      }

      // Set cooldown
      player.respecCooldownUntil = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

      alert(
        "✅ SPECIAL REBUILD COMPLETE\n\n" +
        "Your SPECIAL points have been reset.\n" +
        "You now have unallocated points to redistribute.\n\n" +
        "Cooldown: 7 days"
      );

      // Refresh UI
      this.updateRebuildSpecialButton();
      
      // Trigger any SPECIAL UI updates
      if (window.Game.modules.special && window.Game.modules.special.refreshUI) {
        Game.modules.special.refreshUI();
      }
    },

    openScavengerExchange(highlightNFT = null) {
      console.log("[nft-integration] Opening Scavenger Exchange, highlight:", highlightNFT);
      
      // TODO: Implement full Scavenger Exchange UI
      // For now, show simplified purchase dialog
      if (highlightNFT === "rebuild_special_token") {
        this.showRebuildTokenPurchaseDialog();
      } else {
        alert("Scavenger Exchange UI coming soon!\n\nFor now, use the simplified purchase dialogs.");
      }
    },

    async showRebuildTokenPurchaseDialog() {
      const player = window.PLAYER || Game.state?.player;
      if (!player) {
        alert("Error: Player state not found");
        return;
      }

      const choice = prompt(
        "VAULT-TEC SPECIAL RESPEC TOKEN\n\n" +
        `Your caps: ${player.caps || 0}\n` +
        `Your Fizz: ${player.fizzTokens || 0}\n\n` +
        "Purchase options:\n" +
        "[1] Buy consumable (8,000 caps) - Cannot be traded\n" +
        "[2] Mint as NFT (5,000 caps + 500 Fizz) - Tradeable\n" +
        "[3] Cancel\n\n" +
        "Enter 1, 2, or 3:"
      );

      if (choice === "1") {
        // Buy consumable
        if ((player.caps || 0) < 8000) {
          alert("Insufficient caps! You need 8,000 caps.");
          return;
        }
        if (confirm("Purchase consumable Respec Token for 8,000 caps?")) {
          player.caps -= 8000;
          // Add to inventory (not wallet)
          player.respecTokens = (player.respecTokens || 0) + 1;
          // Also add to NFT system for UI consistency
          this.ownedNFTs.rebuild_special_token = (this.ownedNFTs.rebuild_special_token || 0) + 1;
          alert("Purchased Respec Token! (Consumable, not tradeable)");
          this.updateUI();
        }
      } else if (choice === "2") {
        // Mint as NFT
        await this.mintNFT("rebuild_special_token", 5000, 500);
      }
    },

    updateUI() {
      // Update any UI elements that depend on NFT ownership
      this.updateRebuildSpecialButton();
      
      // Dispatch event for other systems to react to
      window.dispatchEvent(new CustomEvent("nftStateChanged", {
        detail: { ownedNFTs: this.ownedNFTs }
      }));
    }
  };

  Game.modules.nftIntegration = nftIntegration;

  // Auto-initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => nftIntegration.init());
  } else {
    nftIntegration.init();
  }
})();
