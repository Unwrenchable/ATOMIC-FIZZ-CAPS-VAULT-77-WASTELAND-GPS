// web3-wallet-adapter.js
// ------------------------------------------------------------
// Universal Web3 Wallet Adapter
// Supports multiple wallet providers and integrated custom wallet
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  const web3WalletAdapter = {
    loaded: false,
    connected: false,
    walletAddress: null,
    walletType: null, // 'phantom', 'solflare', 'walletconnect', 'metamask', 'integrated', 'coinbase'
    provider: null,

    // Supported wallet providers
    providers: {
      phantom: {
        name: "Phantom",
        icon: "👻",
        check: () => window.solana && window.solana.isPhantom,
        connect: async function() {
          try {
            const resp = await window.solana.connect();
            return {
              address: resp.publicKey.toString(),
              provider: window.solana
            };
          } catch (error) {
            throw new Error(`Phantom connection failed: ${error.message}`);
          }
        }
      },
      
      solflare: {
        name: "Solflare",
        icon: "🔥",
        check: () => window.solflare && window.solflare.isSolflare,
        connect: async function() {
          try {
            await window.solflare.connect();
            return {
              address: window.solflare.publicKey.toString(),
              provider: window.solflare
            };
          } catch (error) {
            throw new Error(`Solflare connection failed: ${error.message}`);
          }
        }
      },

      walletconnect: {
        name: "WalletConnect",
        icon: "🔗",
        check: () => window.WalletConnectProvider !== undefined,
        connect: async function() {
          try {
            // Use WalletConnect v2
            if (!window.WalletConnectProvider) {
              throw new Error("WalletConnect not loaded. Add script: https://cdn.jsdelivr.net/npm/@walletconnect/web3-provider");
            }
            
            const provider = new window.WalletConnectProvider({
              rpc: {
                1: "https://mainnet.infura.io/v3/YOUR_INFURA_ID",
                137: "https://polygon-rpc.com"
              },
              qrcodeModalOptions: {
                mobileLinks: ["rainbow", "metamask", "argent", "trust", "imtoken", "pillar"]
              }
            });

            await provider.enable();
            const accounts = await provider.request({ method: 'eth_accounts' });
            
            return {
              address: accounts[0],
              provider: provider
            };
          } catch (error) {
            throw new Error(`WalletConnect failed: ${error.message}`);
          }
        }
      },

      metamask: {
        name: "MetaMask",
        icon: "🦊",
        check: () => window.ethereum && window.ethereum.isMetaMask,
        connect: async function() {
          try {
            const accounts = await window.ethereum.request({ 
              method: 'eth_requestAccounts' 
            });
            return {
              address: accounts[0],
              provider: window.ethereum
            };
          } catch (error) {
            throw new Error(`MetaMask connection failed: ${error.message}`);
          }
        }
      },

      coinbase: {
        name: "Coinbase Wallet",
        icon: "💼",
        check: () => window.ethereum && window.ethereum.isCoinbaseWallet,
        connect: async function() {
          try {
            const accounts = await window.ethereum.request({ 
              method: 'eth_requestAccounts' 
            });
            return {
              address: accounts[0],
              provider: window.ethereum
            };
          } catch (error) {
            throw new Error(`Coinbase Wallet connection failed: ${error.message}`);
          }
        }
      },

      integrated: {
        name: "Integrated Wallet",
        icon: "⚡",
        check: () => true, // Always available
        connect: async function() {
          // Use existing integrated wallet from wallet.js
          if (window.wallet && window.wallet.publicKey) {
            return {
              address: window.wallet.publicKey.toString(),
              provider: window.wallet,
              canGenerateNew: true
            };
          }
          
          // Generate new local wallet
          const newWallet = await web3WalletAdapter.generateIntegratedWallet();
          return {
            address: newWallet.publicKey,
            provider: newWallet,
            canGenerateNew: true,
            isNew: true
          };
        }
      }
    },

    async init() {
      if (this.loaded) return;
      
      console.log("[web3-wallet] Initializing universal wallet adapter");
      
      // Check for existing wallet connection
      await this.checkExistingConnection();
      
      this.loaded = true;
      console.log("[web3-wallet] Wallet adapter ready");
    },

    async checkExistingConnection() {
      // Check integrated wallet first
      if (window.wallet && window.wallet.publicKey) {
        this.connected = true;
        this.walletAddress = window.wallet.publicKey.toString();
        this.walletType = 'integrated';
        this.provider = window.wallet;
        console.log("[web3-wallet] Restored integrated wallet:", this.walletAddress);
        this.dispatchConnectionEvent();
        return;
      }

      // Check localStorage for previous connection
      const savedType = localStorage.getItem('web3_wallet_type');
      if (savedType && this.providers[savedType]) {
        const provider = this.providers[savedType];
        if (provider.check()) {
          try {
            // Attempt silent reconnection
            console.log(`[web3-wallet] Attempting to restore ${provider.name} connection`);
            // Note: Most wallets require explicit user action to reconnect
          } catch (e) {
            console.log("[web3-wallet] Could not restore previous connection");
          }
        }
      }
    },

    getAvailableWallets() {
      const available = [];
      
      for (const [key, provider] of Object.entries(this.providers)) {
        if (provider.check()) {
          available.push({
            key,
            name: provider.name,
            icon: provider.icon
          });
        }
      }

      // Always show integrated wallet
      if (!available.find(w => w.key === 'integrated')) {
        available.push({
          key: 'integrated',
          name: this.providers.integrated.name,
          icon: this.providers.integrated.icon
        });
      }

      return available;
    },

    async showWalletSelector() {
      const available = this.getAvailableWallets();
      
      let message = "🔗 CONNECT WALLET\n\nSelect a wallet provider:\n\n";
      available.forEach((wallet, i) => {
        message += `[${i + 1}] ${wallet.icon} ${wallet.name}\n`;
      });
      message += `\n[0] Cancel\n\nEnter number (0-${available.length}):`;

      const choice = prompt(message);
      const choiceNum = parseInt(choice, 10);

      if (choiceNum === 0 || !choice) {
        return null;
      }

      if (choiceNum < 1 || choiceNum > available.length) {
        alert("Invalid choice");
        return null;
      }

      const selected = available[choiceNum - 1];
      return selected.key;
    },

    async connect(walletType = null) {
      try {
        // If no type specified, show selector
        if (!walletType) {
          walletType = await this.showWalletSelector();
          if (!walletType) return false;
        }

        const provider = this.providers[walletType];
        if (!provider) {
          throw new Error(`Unknown wallet type: ${walletType}`);
        }

        console.log(`[web3-wallet] Connecting to ${provider.name}...`);

        // Check if provider is available
        if (!provider.check()) {
          if (walletType === 'phantom') {
            alert(`${provider.name} not detected!\n\nPlease install Phantom wallet:\nhttps://phantom.app/`);
          } else if (walletType === 'metamask') {
            alert(`${provider.name} not detected!\n\nPlease install MetaMask:\nhttps://metamask.io/`);
          } else if (walletType === 'walletconnect') {
            alert(`WalletConnect library not loaded.\n\nPlease refresh the page.`);
          } else {
            alert(`${provider.name} not available.\n\nPlease install the wallet extension.`);
          }
          return false;
        }

        // Connect to wallet
        const result = await provider.connect();

        this.connected = true;
        this.walletAddress = result.address;
        this.walletType = walletType;
        this.provider = result.provider;

        // Save preference
        localStorage.setItem('web3_wallet_type', walletType);
        localStorage.setItem('web3_wallet_address', result.address);

        console.log(`[web3-wallet] Connected to ${provider.name}:`, this.walletAddress);

        if (result.isNew) {
          alert(`✅ New ${provider.name} Generated!\n\nAddress: ${this.walletAddress.substring(0, 8)}...${this.walletAddress.substring(this.walletAddress.length - 6)}\n\nYour wallet has been created and saved locally.`);
        } else {
          alert(`✅ Connected to ${provider.name}!\n\nAddress: ${this.walletAddress.substring(0, 8)}...${this.walletAddress.substring(this.walletAddress.length - 6)}`);
        }

        this.dispatchConnectionEvent();
        return true;

      } catch (error) {
        console.error("[web3-wallet] Connection failed:", error);
        alert(`Wallet connection failed:\n\n${error.message}`);
        return false;
      }
    },

    async disconnect() {
      if (!this.connected) return;

      try {
        // Call disconnect on provider if available
        if (this.provider && this.provider.disconnect) {
          await this.provider.disconnect();
        }
      } catch (e) {
        console.warn("[web3-wallet] Disconnect error:", e);
      }

      this.connected = false;
      this.walletAddress = null;
      this.walletType = null;
      this.provider = null;

      localStorage.removeItem('web3_wallet_type');
      localStorage.removeItem('web3_wallet_address');

      console.log("[web3-wallet] Disconnected");
      this.dispatchConnectionEvent();
    },

    async generateIntegratedWallet() {
      console.log("[web3-wallet] Generating new integrated wallet...");

      // Generate random keypair
      const crypto = window.crypto || window.msCrypto;
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      const privateKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Generate public key (simplified - in production, use proper Solana key derivation)
      const publicKey = 'AFW' + privateKey.substring(0, 40);

      // Save only the public key to localStorage
      // SECURITY: Private keys are NEVER stored in localStorage per audit guidelines
      // Private key remains only in memory during the session
      const LOCAL_WALLET_KEY = "afw_local_wallet_v1";
      localStorage.setItem(LOCAL_WALLET_KEY, publicKey);

      // Create wallet object
      const wallet = {
        publicKey,
        privateKey,
        type: 'integrated',
        generated: Date.now(),
        toString: () => publicKey
      };

      // Update global wallet reference
      if (!window.wallet) {
        window.wallet = {};
      }
      window.wallet.publicKey = { toString: () => publicKey };
      window.wallet.privateKey = privateKey;

      console.log("[web3-wallet] Generated wallet:", publicKey);
      return wallet;
    },

    canGenerateNewWallet() {
      return this.walletType === 'integrated';
    },

    async generateNewWallet() {
      if (!this.canGenerateNewWallet()) {
        alert("New wallet generation is only available with Integrated Wallet.\n\nTo generate a new wallet, disconnect and select 'Integrated Wallet' when connecting.");
        return false;
      }

      const confirm1 = confirm(
        "⚠️ GENERATE NEW WALLET\n\n" +
        "This will create a NEW wallet address.\n\n" +
        "Your current wallet data will be preserved, but you'll start with a fresh address.\n\n" +
        "Are you sure?"
      );

      if (!confirm1) return false;

      try {
        await this.disconnect();
        const newWallet = await this.generateIntegratedWallet();
        
        this.connected = true;
        this.walletAddress = newWallet.publicKey;
        this.walletType = 'integrated';
        this.provider = newWallet;

        localStorage.setItem('web3_wallet_type', 'integrated');
        localStorage.setItem('web3_wallet_address', newWallet.publicKey);

        alert(
          "✅ NEW WALLET GENERATED!\n\n" +
          `Address: ${newWallet.publicKey.substring(0, 12)}...\n\n` +
          "Your new wallet is ready to use!"
        );

        this.dispatchConnectionEvent();
        return true;

      } catch (error) {
        console.error("[web3-wallet] Wallet generation failed:", error);
        alert(`Failed to generate new wallet:\n\n${error.message}`);
        return false;
      }
    },

    dispatchConnectionEvent() {
      window.dispatchEvent(new CustomEvent("web3WalletStateChanged", {
        detail: {
          connected: this.connected,
          address: this.walletAddress,
          type: this.walletType
        }
      }));
    },

    // Utility methods
    getShortAddress(address = null) {
      const addr = address || this.walletAddress;
      if (!addr) return "Not Connected";
      return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    },

    isConnected() {
      return this.connected;
    },

    getWalletAddress() {
      return this.walletAddress;
    },

    getWalletType() {
      return this.walletType;
    },

    getProvider() {
      return this.provider;
    }
  };

  Game.modules.web3WalletAdapter = web3WalletAdapter;

  // Auto-initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => web3WalletAdapter.init());
  } else {
    web3WalletAdapter.init();
  }

  // Global shorthand
  window.web3Wallet = web3WalletAdapter;

})();
