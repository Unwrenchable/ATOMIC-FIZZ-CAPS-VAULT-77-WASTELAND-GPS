// bridge-portal.js
// ------------------------------------------------------------
// Cross-Chain Bridge Portal
// Opens bridge.html for Wormhole cross-chain token transfers
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const bridgePortal = {
    loaded: false,
    walletWindow: null,
    isOpen: false,

    async init() {
      if (this.loaded) return;

      console.log("[bridge-portal] Initializing cross-chain bridge");

      // Setup bridge button click handler
      const bridgeBtn = document.getElementById('openBridgeTerminal');
      if (bridgeBtn) {
        // Remove disabled state - bridge is ready to use
        bridgeBtn.disabled = false;
        bridgeBtn.style.opacity = '1';
        bridgeBtn.style.cursor = 'pointer';
        bridgeBtn.textContent = '🌀 OPEN BRIDGE';

        bridgeBtn.addEventListener('click', () => this.openBridge());
      }

      this.loaded = true;
      console.log("[bridge-portal] Bridge portal ready");
    },

    openBridge() {
      console.log("[bridge-portal] Opening cross-chain bridge portal");

      // Check if wallet is connected
      if (!window.web3Wallet || !window.web3Wallet.isConnected()) {
        const connect = confirm(
          "🌀 WORMHOLE BRIDGE\n\n" +
          "Cross-chain bridge requires wallet connection.\n\n" +
          "Connect wallet now?"
        );

        if (connect && window.web3Wallet) {
          window.web3Wallet.connect().then(success => {
            if (success) {
              this.openWalletWindow();
            }
          });
        }
        return;
      }

      this.openWalletWindow();
    },

    openWalletWindow() {
      // Calculate centered position
      const width = 800;
      const height = 900;
      const left = (screen.width / 2) - (width / 2);
      const top = (screen.height / 2) - (height / 2);

      // Open bridge interface in new window
      this.walletWindow = window.open(
        '/bridge.html',
        'AtomicFizzBridge',
        `width=${width},height=${height},left=${left},top=${top},` +
        `resizable=yes,scrollbars=yes,status=yes,toolbar=no,menubar=no,location=no`
      );

      if (this.walletWindow) {
        this.isOpen = true;
        console.log("[bridge-portal] Bridge window opened");

        // Pass wallet connection info to child window
        this.walletWindow.addEventListener('load', () => {
          this.syncWalletData();
        });

        // Check if window is closed
        const checkClosed = setInterval(() => {
          if (this.walletWindow && this.walletWindow.closed) {
            this.isOpen = false;
            console.log("[bridge-portal] Bridge window closed");
            clearInterval(checkClosed);
          }
        }, 1000);

        // Show notification
        if (window.Game.modules.notifications) {
          Game.modules.notifications.show({
            title: "Bridge Portal Opened",
            message: "Cross-chain bridge interface loaded. Bridge your tokens across chains.",
            icon: "🌀",
            duration: 5000
          });
        }
      } else {
        alert(
          "⚠️ Popup Blocked\n\n" +
          "Please allow popups for this site to use the bridge portal.\n\n" +
          "The bridge interface will open in a new window."
        );
      }
    },

    syncWalletData() {
      if (!this.walletWindow || !window.web3Wallet) return;

      // Send wallet connection data to child window
      const walletData = {
        connected: window.web3Wallet.isConnected(),
        address: window.web3Wallet.getWalletAddress(),
        type: window.web3Wallet.getWalletType(),
        player: window.PLAYER || null,
        nfts: window.Game.modules.nftIntegration?.ownedNFTs || {}
      };

      try {
        this.walletWindow.postMessage({
          type: 'WALLET_SYNC',
          data: walletData
        }, window.location.origin);

        console.log("[bridge-portal] Wallet data synced to child window");
      } catch (e) {
        console.warn("[bridge-portal] Failed to sync wallet data:", e);
      }
    },

    closeBridge() {
      if (this.walletWindow && !this.walletWindow.closed) {
        this.walletWindow.close();
        this.isOpen = false;
      }
    },

    isBridgeOpen() {
      return this.isOpen && this.walletWindow && !this.walletWindow.closed;
    }
  };

  Game.modules.bridgePortal = bridgePortal;

  // Auto-initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bridgePortal.init());
  } else {
    bridgePortal.init();
  }

  // Global shorthand
  window.bridgePortal = bridgePortal;

})();
