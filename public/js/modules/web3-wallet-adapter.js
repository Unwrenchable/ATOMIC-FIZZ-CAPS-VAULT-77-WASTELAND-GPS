// web3-wallet-adapter.js
// ------------------------------------------------------------
// Universal Web3 Wallet Adapter
// Supports multiple wallet providers and integrated custom wallet
// Security-hardened for crypto game operations (Fizz Caps economy)
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Security utilities
  const securityUtils = {
    // Sanitize wallet address to prevent XSS - preserves valid address characters
    sanitizeAddress(address) {
      if (!address || typeof address !== 'string') return null;
      // Base58 characters: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
      // EVM addresses also need 0x prefix and hex chars
      // Allow only safe characters for both address types
      const cleaned = address.replace(/[^a-zA-Z0-9]/g, '');
      // If it was an EVM address (started with 0x), preserve that
      if (address.toLowerCase().startsWith('0x')) {
        return '0x' + cleaned.slice(2); // Remove potential double 0x
      }
      return cleaned;
    },

    // Validate Solana address format (base58, 32-44 chars)
    isValidSolanaAddress(address) {
      if (!address || typeof address !== 'string') return false;
      // Base58 alphabet excludes 0, O, I, l to avoid confusion
      const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      return base58Regex.test(address);
    },

    // Validate EVM address format (0x + 40 hex chars)
    isValidEvmAddress(address) {
      if (!address || typeof address !== 'string') return false;
      const evmRegex = /^0x[a-fA-F0-9]{40}$/;
      return evmRegex.test(address);
    },

    // Validate integrated wallet address (our custom format)
    isValidIntegratedAddress(address) {
      if (!address || typeof address !== 'string') return false;
      // Our integrated wallets start with 'Fz' and are 44 chars
      return /^Fz[1-9A-HJ-NP-Za-km-z]{42}$/.test(address);
    },

    // Rate limit function calls
    rateLimit: (function() {
      const calls = new Map();
      return function(key, limitMs = 1000) {
        const now = Date.now();
        const lastCall = calls.get(key) || 0;
        if (now - lastCall < limitMs) {
          return false;
        }
        calls.set(key, now);
        return true;
      };
    })(),

    // Secure random bytes generation
    getSecureRandomBytes(length) {
      const crypto = window.crypto || window.msCrypto;
      if (!crypto || !crypto.getRandomValues) {
        throw new Error('Secure random generation not available');
      }
      return crypto.getRandomValues(new Uint8Array(length));
    }
  };

  const web3WalletAdapter = {
    loaded: false,
    connected: false,
    walletAddress: null,
    walletType: null, // 'phantom', 'solflare', 'walletconnect', 'metamask', 'integrated', 'coinbase'
    provider: null,
    connectionAttempts: 0,
    maxConnectionAttempts: 3,

    // Supported wallet providers
    providers: {
      phantom: {
        name: "Phantom",
        icon: "👻",
        chain: "solana",
        check: () => (window.solana && window.solana.isPhantom) || (window.phantom?.solana?.isPhantom),
        connect: async function() {
          if (!securityUtils.rateLimit('phantom_connect', 2000)) {
            throw new Error('Please wait before trying again');
          }
          try {
            // Wait for Phantom provider to inject (handles in-app browser timing)
            let provider = (window.solana?.isPhantom) ? window.solana : window.phantom?.solana;
            
            // If not immediately available, wait up to 3 seconds for injection
            if (!provider) {
              provider = await new Promise((resolve) => {
                const startTime = Date.now();
                const checkInterval = 100;
                
                function check() {
                  if (window.solana?.isPhantom) {
                    resolve(window.solana);
                    return;
                  }
                  if (window.phantom?.solana?.isPhantom) {
                    resolve(window.phantom.solana);
                    return;
                  }
                  if (Date.now() - startTime < 3000) {
                    setTimeout(check, checkInterval);
                  } else {
                    resolve(null);
                  }
                }
                check();
              });
            }
            
            if (!provider) {
              // Check if we're in Phantom's in-app browser
              const userAgent = navigator.userAgent || "";
              const isPhantomBrowser = userAgent.toLowerCase().includes("phantom");
              
              if (isPhantomBrowser) {
                throw new Error('Phantom wallet is loading. Please try again in a moment.');
              } else {
                throw new Error('Phantom wallet not found. Please install Phantom from https://phantom.app');
              }
            }
            
            const resp = await provider.connect();
            const address = resp.publicKey.toString();
            if (!securityUtils.isValidSolanaAddress(address)) {
              throw new Error('Invalid wallet address received');
            }
            return {
              address: securityUtils.sanitizeAddress(address),
              provider: provider
            };
          } catch (error) {
            throw new Error(`Phantom connection failed: ${error.message}`);
          }
        }
      },
      
      solflare: {
        name: "Solflare",
        icon: "🔥",
        chain: "solana",
        check: () => window.solflare && window.solflare.isSolflare,
        connect: async function() {
          if (!securityUtils.rateLimit('solflare_connect', 2000)) {
            throw new Error('Please wait before trying again');
          }
          try {
            await window.solflare.connect();
            const address = window.solflare.publicKey.toString();
            if (!securityUtils.isValidSolanaAddress(address)) {
              throw new Error('Invalid wallet address received');
            }
            return {
              address: securityUtils.sanitizeAddress(address),
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
        chain: "multi",
        check: () => window.WalletConnectProvider !== undefined,
        connect: async function() {
          if (!securityUtils.rateLimit('walletconnect_connect', 2000)) {
            throw new Error('Please wait before trying again');
          }
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
            const address = accounts[0];
            
            if (!securityUtils.isValidEvmAddress(address)) {
              throw new Error('Invalid wallet address received');
            }
            
            return {
              address: securityUtils.sanitizeAddress(address),
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
        chain: "evm",
        check: () => window.ethereum && window.ethereum.isMetaMask,
        connect: async function() {
          if (!securityUtils.rateLimit('metamask_connect', 2000)) {
            throw new Error('Please wait before trying again');
          }
          try {
            const accounts = await window.ethereum.request({ 
              method: 'eth_requestAccounts' 
            });
            const address = accounts[0];
            
            if (!securityUtils.isValidEvmAddress(address)) {
              throw new Error('Invalid wallet address received');
            }
            
            return {
              address: securityUtils.sanitizeAddress(address),
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
        chain: "evm",
        check: () => window.ethereum && window.ethereum.isCoinbaseWallet,
        connect: async function() {
          if (!securityUtils.rateLimit('coinbase_connect', 2000)) {
            throw new Error('Please wait before trying again');
          }
          try {
            const accounts = await window.ethereum.request({ 
              method: 'eth_requestAccounts' 
            });
            const address = accounts[0];
            
            if (!securityUtils.isValidEvmAddress(address)) {
              throw new Error('Invalid wallet address received');
            }
            
            return {
              address: securityUtils.sanitizeAddress(address),
              provider: window.ethereum
            };
          } catch (error) {
            throw new Error(`Coinbase Wallet connection failed: ${error.message}`);
          }
        }
      },

      integrated: {
        name: "Fizz Caps Wallet",
        icon: "⚡",
        chain: "solana",
        check: () => true, // Always available
        connect: async function() {
          if (!securityUtils.rateLimit('integrated_connect', 1000)) {
            throw new Error('Please wait before trying again');
          }
          // Use existing integrated wallet from wallet.js
          if (window.wallet && window.wallet.publicKey) {
            const address = window.wallet.publicKey.toString();
            return {
              address: securityUtils.sanitizeAddress(address),
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
        // Rate limit connection attempts
        if (!securityUtils.rateLimit('wallet_connect_global', 1000)) {
          throw new Error('Please wait before trying again');
        }

        // Track connection attempts for security
        this.connectionAttempts++;
        if (this.connectionAttempts > this.maxConnectionAttempts) {
          console.warn('[web3-wallet] Too many connection attempts');
          setTimeout(() => { this.connectionAttempts = 0; }, 30000);
          throw new Error('Too many connection attempts. Please wait 30 seconds.');
        }

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

        // For Phantom, try to connect even if check() returns false initially
        // (handles in-app browser timing where provider injects after page load)
        if (walletType === 'phantom') {
          // Skip the check() for Phantom - the connect() method will wait for provider
          // This handles the in-app browser case where provider isn't immediately available
        } else {
          // Check if provider is available for other wallets
          if (!provider.check()) {
            if (walletType === 'metamask') {
              alert(`${provider.name} not detected!\n\nPlease install MetaMask:\nhttps://metamask.io/`);
            } else if (walletType === 'walletconnect') {
              alert(`WalletConnect library not loaded.\n\nPlease refresh the page.`);
            } else {
              alert(`${provider.name} not available.\n\nPlease install the wallet extension.`);
            }
            return false;
          }
        }

        // Connect to wallet
        const result = await provider.connect();

        // Validate the address was returned and sanitized
        if (!result.address) {
          throw new Error('No wallet address received');
        }

        this.connected = true;
        this.walletAddress = result.address;
        this.walletType = walletType;
        this.provider = result.provider;
        this.connectionAttempts = 0; // Reset on success

        // Save preference (only wallet type, not sensitive data)
        try {
          localStorage.setItem('web3_wallet_type', walletType);
          // Store a hash of the address for verification, not the address itself
          const addrHash = await this.hashAddress(result.address);
          localStorage.setItem('web3_wallet_hash', addrHash);
        } catch (e) {
          console.warn('[web3-wallet] Could not save wallet preference');
        }

        console.log(`[web3-wallet] Connected to ${provider.name}:`, this.getShortAddress());

        if (result.isNew) {
          alert(`✅ New ${provider.name} Generated!\n\nAddress: ${this.getShortAddress()}\n\nYour wallet has been created and saved locally.\n\n⚠️ IMPORTANT: This is a local wallet. For real transactions, connect an external wallet like Phantom.`);
        } else {
          alert(`✅ Connected to ${provider.name}!\n\nAddress: ${this.getShortAddress()}`);
        }

        this.dispatchConnectionEvent();
        return true;

      } catch (error) {
        console.error("[web3-wallet] Connection failed:", error);
        alert(`Wallet connection failed:\n\n${error.message}`);
        return false;
      }
    },

    async hashAddress(address) {
      // Create a simple hash of the address for verification
      const encoder = new TextEncoder();
      const data = encoder.encode(address);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
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

      // Clear stored preferences securely
      try {
        localStorage.removeItem('web3_wallet_type');
        localStorage.removeItem('web3_wallet_hash');
        // Also remove legacy keys
        localStorage.removeItem('web3_wallet_address');
      } catch (e) {
        console.warn('[web3-wallet] Could not clear wallet preferences');
      }

      console.log("[web3-wallet] Disconnected");
      this.dispatchConnectionEvent();
    },

    async generateIntegratedWallet() {
      console.log("[web3-wallet] Generating new integrated Fizz Caps wallet...");

      try {
        // Base58 alphabet (excludes 0, O, I, l to avoid confusion)
        const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
        const ALPHABET_SIZE = BASE58_ALPHABET.length; // 58
        
        // Generate unbiased random selection for each character
        // Using rejection sampling to avoid modulo bias
        function getUnbiasedRandomIndex() {
          const randomBytes = securityUtils.getSecureRandomBytes(1);
          const value = randomBytes[0];
          // Reject values that would cause bias (256 is not evenly divisible by 58)
          // Max unbiased value: 58 * 4 = 232
          const maxUnbiased = Math.floor(256 / ALPHABET_SIZE) * ALPHABET_SIZE;
          if (value >= maxUnbiased) {
            // Rejection: try again with new random byte
            return getUnbiasedRandomIndex();
          }
          return value % ALPHABET_SIZE;
        }
        
        // Generate a valid base58 public key starting with 'Fz' (for Fizz)
        let publicKey = 'Fz'; // Our wallet prefix (valid base58 chars)
        for (let i = 0; i < 42; i++) {
          publicKey += BASE58_ALPHABET[getUnbiasedRandomIndex()];
        }

        // Save only the public key to localStorage
        // SECURITY: Private keys are NEVER stored in localStorage per audit guidelines
        // Private key remains only in memory during the session
        const LOCAL_WALLET_KEY = "afw_local_wallet_v2"; // v2 for enhanced security
        
        // Encrypt the reference before storing (basic obfuscation)
        const encodedPubKey = btoa(publicKey);
        localStorage.setItem(LOCAL_WALLET_KEY, encodedPubKey);

        // Create wallet object (actual signing would require proper Solana keypair)
        // Note: This is a LOCAL wallet for testing/demo purposes only
        // For real transactions, users should connect Phantom or other secure wallets
        const wallet = {
          publicKey,
          // Signing is mocked for local wallet - real signing requires proper keypair
          sign: async (message) => {
            console.warn('[web3-wallet] Local wallet signing is for demo only. Use Phantom for real transactions.');
            if (!message) throw new Error('Message required for signing');
            // This creates a deterministic hash, NOT a real signature
            // Real implementation would use tweetnacl or @solana/web3.js
            const encoder = new TextEncoder();
            const data = encoder.encode(message + publicKey);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          },
          type: 'integrated',
          generated: Date.now(),
          toString: () => publicKey,
          isLocalWallet: true // Flag to indicate this is a demo wallet
        };

        // Update global wallet reference (without exposing private key)
        if (!window.wallet) {
          window.wallet = {};
        }
        window.wallet.publicKey = { toString: () => publicKey };
        window.wallet.sign = wallet.sign;
        window.wallet.isLocalWallet = true;

        console.log("[web3-wallet] Generated local wallet:", publicKey.substring(0, 12) + '...');
        return wallet;
        
      } catch (error) {
        console.error("[web3-wallet] Wallet generation failed:", error);
        throw new Error('Failed to generate secure wallet. Please try again.');
      }
    },

    canGenerateNewWallet() {
      return this.walletType === 'integrated';
    },

    async generateNewWallet() {
      if (!this.canGenerateNewWallet()) {
        alert("New wallet generation is only available with Fizz Caps Wallet.\n\nTo generate a new wallet, disconnect and select 'Fizz Caps Wallet' when connecting.");
        return false;
      }

      const confirm1 = confirm(
        "⚠️ GENERATE NEW WALLET\n\n" +
        "This will create a NEW wallet address.\n\n" +
        "Your current wallet data will be preserved, but you'll start with a fresh address.\n\n" +
        "⚠️ WARNING: This is a local wallet for testing. For real transactions, use Phantom or another secure wallet.\n\n" +
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

        try {
          localStorage.setItem('web3_wallet_type', 'integrated');
          const addrHash = await this.hashAddress(newWallet.publicKey);
          localStorage.setItem('web3_wallet_hash', addrHash);
        } catch (e) {
          console.warn('[web3-wallet] Could not save wallet preference');
        }

        alert(
          "✅ NEW WALLET GENERATED!\n\n" +
          `Address: ${this.getShortAddress()}\n\n` +
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
