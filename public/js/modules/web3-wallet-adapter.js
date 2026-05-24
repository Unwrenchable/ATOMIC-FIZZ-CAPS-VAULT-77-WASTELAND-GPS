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

  // Constants
  // Timeout for Phantom provider injection in in-app browser
  // 3000ms chosen based on testing - typically injects within 100-500ms but allowing
  // extra time for slower devices/connections while keeping user wait reasonable
  const PHANTOM_PROVIDER_TIMEOUT = 3000;
  const INTEGRATED_WALLET_STORAGE_KEY = "afw_local_wallet_v2";

  function createIntegratedWalletProvider(publicKey) {
    return {
      publicKey,
      sign: async (message) => {
        console.warn('[web3-wallet] Local wallet signing is for demo only. Use Phantom for real transactions.');
        if (!message) throw new Error('Message required for signing');
        const encoder = new TextEncoder();
        const payload = message instanceof Uint8Array ? message : encoder.encode(String(message));
        const combined = new Uint8Array(payload.length + publicKey.length);
        combined.set(payload, 0);
        combined.set(encoder.encode(publicKey), payload.length);
        const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
        return new Uint8Array(hashBuffer);
      },
      type: 'integrated',
      toString: () => publicKey,
      isLocalWallet: true,
    };
  }

  /**
   * Wait for Phantom provider to be injected into the page.
   * 
   * In Phantom's in-app browser, the provider object (window.solana or window.phantom.solana)
   * is injected asynchronously after the page loads. This function polls for the provider
   * to become available, waiting up to the specified timeout period.
   * 
   * @param {number} timeoutMs - Maximum time to wait for provider in milliseconds
   * @returns {Promise<Object|null>} Phantom provider object if found, null if timeout
   */
  async function waitForPhantomProvider(timeoutMs = PHANTOM_PROVIDER_TIMEOUT) {
    // Check if already available
    if (window.solana?.isPhantom) return window.solana;
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    
    // Wait for provider to inject
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = 100;
      
      function pollForProvider() {
        if (window.solana?.isPhantom) {
          resolve(window.solana);
          return;
        }
        if (window.phantom?.solana?.isPhantom) {
          resolve(window.phantom.solana);
          return;
        }
        if (Date.now() - startTime < timeoutMs) {
          setTimeout(pollForProvider, checkInterval);
        } else {
          resolve(null);
        }
      }
      pollForProvider();
    });
  }

  /**
   * Show a non-blocking Pip-Boy styled confirmation dialog.
   * Returns a Promise that resolves to true (OK) or false (Cancel).
   * Falls back to native confirm() if DOM is not available.
   *
   * @param {string} message - Message text to display
   * @param {string} [okLabel='OK']
   * @param {string} [cancelLabel='CANCEL']
   * @returns {Promise<boolean>}
   */
  function pipboyConfirm(message, okLabel, cancelLabel) {
    okLabel = okLabel || 'OK';
    cancelLabel = cancelLabel || 'CANCEL';

    // Fall back to native confirm if document is unavailable
    if (typeof document === 'undefined') {
      return Promise.resolve(confirm(message));
    }

    return new Promise(function (resolve) {
      const overlay = document.createElement('div');
      overlay.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:999999',
        'display:flex', 'align-items:center', 'justify-content:center',
        'background:rgba(0,10,0,0.85)', 'font-family:"Courier New",monospace',
        'padding:env(safe-area-inset-top,0) env(safe-area-inset-right,0)',
        'padding-bottom:env(safe-area-inset-bottom,0)',
        'box-sizing:border-box'
      ].join(';');

      const box = document.createElement('div');
      box.style.cssText = [
        'background:#001900', 'border:2px solid #00ff66',
        'border-radius:8px', 'padding:1.5rem 1.25rem',
        'max-width:min(90vw,420px)', 'width:100%',
        'box-shadow:0 0 24px rgba(0,255,102,0.35)',
        'color:#00ff66', 'text-shadow:0 0 6px #00ff66',
        'font-size:0.95rem', 'line-height:1.5',
        'white-space:pre-wrap', 'word-break:break-word'
      ].join(';');

      const msgEl = document.createElement('p');
      msgEl.style.cssText = 'margin:0 0 1.25rem';
      msgEl.textContent = message;

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:0.75rem;justify-content:flex-end';

      function makeBtn(label, primary) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.cssText = [
          'font-family:"Courier New",monospace', 'font-size:0.9rem',
          'cursor:pointer', 'border-radius:4px',
          'min-height:44px', 'min-width:80px',
          'padding:0.5rem 1rem', 'touch-action:manipulation',
          primary
            ? 'background:#00ff66;color:#001900;border:2px solid #00ff66'
            : 'background:transparent;color:#00ff66;border:2px solid #00ff66'
        ].join(';');
        return btn;
      }

      const cancelBtn = makeBtn(cancelLabel, false);
      const okBtn = makeBtn(okLabel, true);

      function cleanup(result) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(result);
      }

      cancelBtn.addEventListener('click', function () { cleanup(false); });
      okBtn.addEventListener('click', function () { cleanup(true); });

      // Also dismiss on overlay backdrop click
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) cleanup(false);
      });

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(okBtn);
      box.appendChild(msgEl);
      box.appendChild(btnRow);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Focus OK button for keyboard/assistive-tech users
      okBtn.focus();
    });
  }

  const web3WalletAdapter = {
    loaded: false,
    connected: false,
    walletAddress: null,
    walletType: null, // 'phantom', 'solflare', 'walletconnect', 'metamask', 'integrated', 'coinbase'
    provider: null,
    connectionAttempts: 0,
    maxConnectionAttempts: 3,
    // Tracks provider objects that already have our event listeners attached.
    // WeakSet avoids mutating the third-party provider object and prevents memory leaks.
    _listenersAttached: new WeakSet(),
    // Auth integration settings
    authEnabled: false,
    authInstance: null,

    // Enable authentication integration with backend
    enableAuth(apiBase = null) {
      this.authEnabled = true;
      if (!this.authInstance) {
        // Try to use existing AuthClient class if available
        if (window.AuthClient) {
          this.authInstance = new window.AuthClient({ apiBase });
        } else {
          console.warn('[web3-wallet] AuthClient not available for auth integration');
          this.authEnabled = false;
        }
      }
      return this.authEnabled;
    },

    // Disable authentication integration
    disableAuth() {
      this.authEnabled = false;
      this.authInstance = null;
    },

    // Helper functions for wallet detection
    _isMetaMaskInstalled() {
      if (!window.ethereum) return false;
      // If multiple providers exist, check the array
      if (window.ethereum.providers?.length) {
        return window.ethereum.providers.some(p => p.isMetaMask);
      }
      // Single provider case
      return window.ethereum.isMetaMask === true;
    },

    _isCoinbaseInstalled() {
      if (!window.ethereum) return false;
      // If multiple providers exist, check the array
      if (window.ethereum.providers?.length) {
        return window.ethereum.providers.some(p => p.isCoinbaseWallet);
      }
      // Single provider case
      return window.ethereum.isCoinbaseWallet === true;
    },

    /**
     * Detect if the user is on a mobile device.
     * Prefers the modern navigator.userAgentData API, falls back to
     * touch-capability detection, then UA string matching.
     * @returns {boolean}
     */
    _isMobileDevice() {
      // Modern API (Chromium 90+): structured UA client hints
      if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
        return navigator.userAgentData.mobile;
      }
      // Feature detection: touch capability is a reliable mobile indicator
      if ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) {
        return true;
      }
      // Legacy UA string fallback
      return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent || '');
    },

    /**
     * Generate a Phantom universal-link / deeplink to open the game inside
     * Phantom's in-app browser on mobile.
     * Only uses origin + pathname to avoid leaking / forwarding user-controlled
     * query params and hash fragments through the deeplink.
     * Reference: https://docs.phantom.app/phantom-deeplinks/provider-methods/connect
     * @returns {string} deeplink URL
     */
    _buildPhantomDeeplink() {
      // Intentionally exclude query string and hash: they may contain user-controlled
      // data that could be exploited within Phantom's in-app browser context.
      const safePath = window.location.origin + window.location.pathname;
      const encodedUrl = encodeURIComponent(safePath);
      // Uses the HTTPS universal-link scheme (https://phantom.app/ul/browse/...)
      // which works on both iOS and Android and gracefully falls back to the
      // App Store / Play Store when Phantom is not installed.
      return `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodeURIComponent(window.location.origin)}`;
    },

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
            const provider = await waitForPhantomProvider();
            
            if (!provider) {
              // Check if we're in Phantom's in-app browser via user agent
              // Note: User agent detection is not 100% reliable but provides better UX
              // Phantom's in-app browser typically includes "Phantom" in the UA string
              const userAgent = navigator.userAgent || "";
              const isPhantomBrowser = userAgent.toLowerCase().includes("phantom");

              if (isPhantomBrowser) {
                throw new Error('Phantom wallet is loading. Please try again in a moment.');
              } else if (web3WalletAdapter._isMobileDevice()) {
                // On mobile: redirect to Phantom's in-app browser via universal link.
                // Use pipboyConfirm (non-blocking, mobile-friendly) instead of native confirm().
                const deeplink = web3WalletAdapter._buildPhantomDeeplink();
                const confirmed = await pipboyConfirm(
                  'Phantom wallet not detected in your browser.\n\n' +
                  'Tap OPEN PHANTOM to launch this site inside the Phantom app\'s built-in browser so you can connect your wallet.\n\n' +
                  '(Install Phantom from your app store if you haven\'t already.)',
                  'OPEN PHANTOM',
                  'CANCEL'
                );
                if (confirmed) {
                  window.location.href = deeplink;
                }
                throw new Error('Redirecting to Phantom app. If nothing happened, install Phantom from your app store.');
              } else {
                // Desktop: Offer to open Phantom install page
                const shouldInstall = confirm(
                  'Phantom wallet not detected!\n\n' +
                  'Phantom is a browser extension wallet for Solana.\n\n' +
                  'Would you like to open the Phantom website to install it?'
                );
                if (shouldInstall) {
                  window.open('https://phantom.app', '_blank');
                }
                throw new Error('Phantom wallet not installed. Please install it from https://phantom.app and refresh this page.');
              }
            }
            
            const resp = await provider.connect();
            const address = resp.publicKey.toString();
            if (!securityUtils.isValidSolanaAddress(address)) {
              throw new Error('Invalid wallet address received');
            }
            // Attach listeners so state stays in sync after connecting
            web3WalletAdapter._attachPhantomListeners(provider);
            return {
              address: securityUtils.sanitizeAddress(address),
              provider: provider
            };
          } catch (error) {
            // Code 4001 = user rejected the connection request — not an error worth alarming
            if (error.code === 4001 || (error.message && error.message.toLowerCase().includes('user rejected'))) {
              throw new Error('Connection cancelled. Tap Connect again when ready.');
            }
            throw new Error(`Phantom connection failed: ${error.message}`, { cause: error });
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
            // Check if Solflare is installed
            if (!window.solflare || !window.solflare.isSolflare) {
              const shouldInstall = confirm(
                'Solflare wallet not detected!\n\n' +
                'Solflare is a browser extension wallet for Solana.\n\n' +
                'Would you like to open the Solflare website to install it?'
              );
              if (shouldInstall) {
                window.open('https://solflare.com/', '_blank');
              }
              throw new Error('Solflare not installed. Please install it from https://solflare.com and refresh this page.');
            }
            
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
            throw new Error(`Solflare connection failed: ${error.message}`, { cause: error });
          }
        }
      },

      walletconnect: {
        name: "WalletConnect",
        icon: "🔗",
        chain: "multi",
        check: () => true, // Always show as available option
        connect: async function() {
          if (!securityUtils.rateLimit('walletconnect_connect', 2000)) {
            throw new Error('Please wait before trying again');
          }
          try {
            // Check if WalletConnect library is loaded
            if (!window.WalletConnectProvider) {
              // Guide user to install or refresh
              const userChoice = confirm(
                "WalletConnect library is not loaded.\n\n" +
                "Please refresh the page to load WalletConnect.\n\n" +
                "Click OK to refresh now, or Cancel to try a different wallet."
              );
              if (userChoice) {
                window.location.reload();
              }
              throw new Error("WalletConnect library not loaded");
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
            throw new Error(`WalletConnect failed: ${error.message}`, { cause: error });
          }
        }
      },

      metamask: {
        name: "MetaMask",
        icon: "🦊",
        chain: "evm",
        check: () => web3WalletAdapter._isMetaMaskInstalled(),
        connect: async function() {
          if (!securityUtils.rateLimit('metamask_connect', 2000)) {
            throw new Error('Please wait before trying again');
          }
          try {
            // Check if MetaMask is installed
            if (!web3WalletAdapter._isMetaMaskInstalled()) {
              const shouldInstall = confirm(
                'MetaMask wallet not detected!\n\n' +
                'MetaMask is a browser extension wallet for Ethereum and other EVM chains.\n\n' +
                'Would you like to open the MetaMask website to install it?'
              );
              if (shouldInstall) {
                window.open('https://metamask.io/download/', '_blank');
              }
              throw new Error('MetaMask not installed. Please install it from https://metamask.io and refresh this page.');
            }
            
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
            throw new Error(`MetaMask connection failed: ${error.message}`, { cause: error });
          }
        }
      },

      coinbase: {
        name: "Coinbase Wallet",
        icon: "💼",
        chain: "evm",
        check: () => web3WalletAdapter._isCoinbaseInstalled(),
        connect: async function() {
          if (!securityUtils.rateLimit('coinbase_connect', 2000)) {
            throw new Error('Please wait before trying again');
          }
          try {
            // Check if Coinbase Wallet is installed
            if (!web3WalletAdapter._isCoinbaseInstalled()) {
              const shouldInstall = confirm(
                'Coinbase Wallet not detected!\n\n' +
                'Coinbase Wallet is a browser extension wallet for Ethereum and other EVM chains.\n\n' +
                'Would you like to open the Coinbase Wallet website to install it?'
              );
              if (shouldInstall) {
                window.open('https://www.coinbase.com/wallet', '_blank');
              }
              throw new Error('Coinbase Wallet not installed. Please install it from https://www.coinbase.com/wallet and refresh this page.');
            }
            
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
            throw new Error(`Coinbase Wallet connection failed: ${error.message}`, { cause: error });
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
      
      // Enable auth integration if AuthClient is available
      if (window.AuthClient) {
        this.enableAuth(window.API_BASE);
        console.log("[web3-wallet] Auth integration enabled");
      }
      
      // Check for existing wallet connection
      await this.checkExistingConnection();

      // Bind Phantom provider events so account switches and
      // user-initiated disconnects are reflected immediately in the game.
      this._bindPhantomEvents();
      
      this.loaded = true;
      console.log("[web3-wallet] Wallet adapter ready");
    },

    /**
     * Attach accountChanged and disconnect listeners to the Phantom provider
     * (window.solana or window.phantom.solana) once it is available.
     * Called from init() — safe to call even when Phantom is not installed.
     */
    _bindPhantomEvents() {
      const phantom = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null);
      if (!phantom) return;

      // Phantom fires 'accountChanged' when the user switches accounts inside
      // the extension.  New public key may be null if the user disconnects all
      // accounts.
      phantom.on('accountChanged', (publicKey) => {
        if (publicKey) {
          const newAddress = publicKey.toString();
          if (securityUtils.isValidSolanaAddress(newAddress)) {
            this.walletAddress = securityUtils.sanitizeAddress(newAddress);
            console.log('[web3-wallet] Phantom account changed to:', this.getShortAddress());
            this._showConnectToast(`⬡ Account switched: ${this.getShortAddress()}`);
            this.dispatchConnectionEvent();
          }
        } else {
          // User disconnected all accounts via the extension UI
          console.log('[web3-wallet] Phantom account disconnected via extension');
          this._handleExternalDisconnect();
        }
      });

      // Phantom fires 'disconnect' when the user removes site permissions
      phantom.on('disconnect', () => {
        console.log('[web3-wallet] Phantom disconnected via extension');
        this._handleExternalDisconnect();
      });
    },

    /**
     * Handle a disconnect initiated externally (e.g. user removes the site
     * from Phantom's trusted-sites list or switches away from all accounts).
     * Clears local state and notifies the rest of the game UI.
     */
    _handleExternalDisconnect() {
      if (this.walletType !== 'phantom') return;
      this.connected = false;
      this.walletAddress = null;
      this.walletType = null;
      this.provider = null;
      try {
        localStorage.removeItem('web3_wallet_type');
        localStorage.removeItem('web3_wallet_hash');
      } catch (_) { /* ignore */ }
      this._showConnectToast('Phantom wallet disconnected. Reconnect to continue.', true);
      this.dispatchConnectionEvent();
    },

    async checkExistingConnection() {
      try {
        if (!window.wallet || !window.wallet.publicKey) {
          const encoded = localStorage.getItem(INTEGRATED_WALLET_STORAGE_KEY);
          if (encoded) {
            const restoredPublicKey = atob(encoded);
            if (securityUtils.isValidIntegratedAddress(restoredPublicKey)) {
              const restoredWallet = createIntegratedWalletProvider(restoredPublicKey);
              window.wallet = {
                publicKey: {
                  toString: () => restoredPublicKey,
                  toBase58: () => restoredPublicKey,
                },
                sign: restoredWallet.sign,
                isLocalWallet: true,
              };
            }
          }
        }
      } catch (restoreErr) {
        console.warn('[web3-wallet] Could not restore integrated wallet from storage:', restoreErr);
      }

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

        if (savedType === 'phantom') {
          // For Phantom, attempt a silent trusted reconnect.
          // connect({ onlyIfTrusted: true }) succeeds without a popup if the
          // user previously approved this site; it rejects silently otherwise.
          try {
            const phantomProvider = await waitForPhantomProvider(1500);
            if (phantomProvider) {
              const resp = await phantomProvider.connect({ onlyIfTrusted: true });
              const address = resp.publicKey.toString();
              if (securityUtils.isValidSolanaAddress(address)) {
                this.connected = true;
                this.walletAddress = securityUtils.sanitizeAddress(address);
                this.walletType = 'phantom';
                this.provider = phantomProvider;
                console.log('[web3-wallet] Silently restored Phantom connection:', this.getShortAddress());
                this.dispatchConnectionEvent();
                return;
              }
            }
          } catch (e) {
            // onlyIfTrusted rejects when the site is not pre-approved — this is
            // expected on a fresh visit; clear the stale preference.
            console.log('[web3-wallet] Phantom silent reconnect skipped:', e.message);
            try { localStorage.removeItem('web3_wallet_type'); } catch (_) { /* ignore */ }
          }
        } else if (provider.check()) {
          try {
            // Attempt silent reconnection for other wallets
            console.log(`[web3-wallet] Attempting to restore ${provider.name} connection`);
            // Note: Most wallets require explicit user action to reconnect
          } catch (e) {
            console.log("[web3-wallet] Could not restore previous connection");
          }
        }
      }
    },

    // Attach Phantom-specific event listeners to stay in sync with wallet state.
    // Uses a WeakSet to avoid mutating the provider object and prevent duplicate registration.
    _attachPhantomListeners(phantomProvider) {
      if (!phantomProvider || this._listenersAttached.has(phantomProvider)) return;
      this._listenersAttached.add(phantomProvider);

      phantomProvider.on('accountChanged', (publicKey) => {
        if (publicKey) {
          const newAddress = publicKey.toString();
          if (securityUtils.isValidSolanaAddress(newAddress)) {
            this.walletAddress = securityUtils.sanitizeAddress(newAddress);
            console.log("[web3-wallet] Phantom account changed:", this.getShortAddress());
            this.dispatchConnectionEvent();
          }
        } else {
          // Phantom signals the connected account was removed — treat as disconnect
          console.log("[web3-wallet] Phantom account removed — disconnecting");
          this.connected = false;
          this.walletAddress = null;
          this.walletType = null;
          this.provider = null;
          this.dispatchConnectionEvent();
        }
      });

      phantomProvider.on('disconnect', () => {
        console.log("[web3-wallet] Phantom disconnect event received");
        this.connected = false;
        this.walletAddress = null;
        this.walletType = null;
        this.provider = null;
        try {
          localStorage.removeItem('web3_wallet_type');
          localStorage.removeItem('web3_wallet_hash');
        } catch (storageErr) {
          console.warn('[web3-wallet] Could not clear wallet preferences on disconnect:', storageErr);
        }
        this.dispatchConnectionEvent();
      });
    },

    getAvailableWallets() {
      const available = [];
      
      // Always show these popular wallets as options
      const alwaysShow = ['phantom', 'walletconnect', 'integrated'];
      
      for (const [key, provider] of Object.entries(this.providers)) {
        // Always show popular wallets, or show if detected
        if (alwaysShow.includes(key) || provider.check()) {
          available.push({
            key,
            name: provider.name,
            icon: provider.icon,
            detected: provider.check()
          });
        }
      }

      return available;
    },

    // ============================================================
    // POCKET-BOY WALLET SELECTOR MODAL
    // Replaces the native browser prompt() with a proper modal.
    // ============================================================
    async showWalletSelector() {
      const available = this.getAvailableWallets();

      return new Promise((resolve) => {
        // Remove any stale modal
        const stale = document.getElementById('walletSelectorModal');
        if (stale) stale.remove();

        const modal = document.createElement('div');
        modal.id = 'walletSelectorModal';
        modal.style.cssText = [
          'position:fixed', 'inset:0', 'z-index:99999',
          'display:flex', 'align-items:center', 'justify-content:center',
          'background:rgba(0,0,0,0.88)',
          'font-family:"Consolas","Courier New",monospace'
        ].join(';');

        const walletRows = available.map(w => {
          const detected = w.detected
            ? '<span style="color:#00ff41;font-size:11px;">✓ DETECTED</span>'
            : '<span style="color:#ff6600;font-size:11px;">⚠ NOT INSTALLED</span>';
          return `
            <button data-wallet="${w.key}" style="
              display:flex;align-items:center;gap:12px;width:100%;
              background:rgba(0,255,65,0.06);border:1px solid rgba(0,255,65,0.3);
              color:#00ff41;padding:10px 14px;margin-bottom:8px;cursor:pointer;
              font-family:inherit;font-size:14px;letter-spacing:0.08em;
              transition:background 0.15s;text-align:left;
            ">
              <span style="font-size:22px;line-height:1;">${w.icon}</span>
              <span style="flex:1;">${w.name}</span>
              ${detected}
            </button>`;
        }).join('');

        modal.innerHTML = `
          <div style="
            background:#020d02;border:2px solid #00ff41;
            box-shadow:0 0 30px rgba(0,255,65,0.25);
            padding:24px 28px;max-width:380px;width:90%;
            position:relative;
          ">
            <div style="text-align:center;margin-bottom:18px;">
              <div style="color:#00ff41;font-size:18px;letter-spacing:0.15em;font-weight:bold;">⬡ CONNECT WALLET ⬡</div>
              <div style="color:#008822;font-size:11px;letter-spacing:0.1em;margin-top:4px;">VAULT-TEC AUTHENTICATION TERMINAL</div>
            </div>
            <div id="walletOptionsList">${walletRows}</div>
            <button id="walletSelectorCancel" style="
              width:100%;background:transparent;border:1px solid rgba(255,100,0,0.4);
              color:#ff6600;padding:8px;cursor:pointer;font-family:inherit;
              font-size:12px;letter-spacing:0.1em;margin-top:4px;
            ">✕ CANCEL</button>
            <div style="color:#004400;font-size:10px;text-align:center;margin-top:12px;letter-spacing:0.06em;">
              ✓ DETECTED = wallet extension found &nbsp;|&nbsp; ⚠ = will prompt to install
            </div>
          </div>`;

        document.body.appendChild(modal);

        // Hover highlight
        modal.querySelectorAll('[data-wallet]').forEach(btn => {
          btn.addEventListener('mouseover', () => { btn.style.background = 'rgba(0,255,65,0.14)'; });
          btn.addEventListener('mouseout', () => { btn.style.background = 'rgba(0,255,65,0.06)'; });
          btn.addEventListener('click', () => {
            modal.remove();
            resolve(btn.dataset.wallet);
          });
        });

        document.getElementById('walletSelectorCancel').addEventListener('click', () => {
          modal.remove();
          resolve(null);
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
          if (e.target === modal) { modal.remove(); resolve(null); }
        });

        // Close on Escape
        const onKey = (e) => {
          if (e.key === 'Escape') { modal.remove(); resolve(null); document.removeEventListener('keydown', onKey); }
        };
        document.addEventListener('keydown', onKey);
      });
    },

    // ============================================================
    // SHOW INLINE STATUS TOAST (replaces alert() for connect result)
    // ============================================================
    _showConnectToast(message, isError = false) {
      const existing = document.getElementById('walletConnectToast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'walletConnectToast';
      toast.style.cssText = [
        'position:fixed', 'bottom:calc(24px + env(safe-area-inset-bottom, 0px))', 'left:50%',
        'transform:translateX(-50%)',
        'z-index:99998',
        `background:${isError ? '#1a0000' : '#011501'}`,
        `border:1px solid ${isError ? '#ff4444' : '#00ff41'}`,
        `color:${isError ? '#ff6666' : '#00ff41'}`,
        'padding:10px 20px', 'font-family:"Consolas","Courier New",monospace',
        'font-size:13px', 'letter-spacing:0.08em',
        'box-shadow:0 0 16px rgba(0,255,65,0.2)',
        'max-width:90vw', 'text-align:center',
        'pointer-events:none',
      ].join(';');
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
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
          if (!walletType) {
            // Cancelled by the user — not a real attempt, don't count it
            this.connectionAttempts = Math.max(0, this.connectionAttempts - 1);
            return false;
          }
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
              this._showConnectToast(`MetaMask not detected. Install from metamask.io then refresh.`, true);
            } else if (walletType === 'walletconnect') {
              this._showConnectToast(`WalletConnect library not loaded. Please refresh the page.`, true);
            } else {
              this._showConnectToast(`${provider.name} not available. Install the wallet extension.`, true);
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
          this._showConnectToast(`⬡ New ${provider.name} created — ${this.getShortAddress()} — local wallet only`);
        } else {
          this._showConnectToast(`⬡ Connected: ${provider.name} — ${this.getShortAddress()}`);
        }

        // Perform backend authentication if enabled (only for Solana wallets for now)
        if (this.authEnabled && this.authInstance && this.provider && 
            (walletType === 'phantom' || walletType === 'solflare')) {
          try {
            console.log('[web3-wallet] Performing backend authentication...');
            // Create a wallet object that wraps the provider's signMessage method
            const walletForAuth = {
              publicKey: {
                toBase58: () => this.walletAddress
              },
              signMessage: async (message, encoding) => {
                // Handle different wallet types
                if (walletType === 'integrated') {
                  // Integrated wallet uses sign method
                  if (this.provider.sign) {
                    return await this.provider.sign(message);
                  }
                } else {
                  // Solana wallets use signMessage
                  if (this.provider.signMessage) {
                    return await this.provider.signMessage(message, encoding);
                  }
                }
                
                throw new Error(`Provider for ${walletType} does not support message signing`);
              }
            };

            await this.authInstance.login(walletForAuth);
            console.log('[web3-wallet] Backend authentication successful');
            this._showConnectToast(`⬡ Authenticated with Vault-77 — Session active`);
          } catch (authError) {
            console.error('[web3-wallet] Backend authentication failed:', authError);
            // Don't disconnect the wallet, but show auth failure
            this._showConnectToast(`Wallet connected but authentication failed: ${authError.message}`, true);
            // Continue with wallet connection even if auth fails
          }
        }

        this.dispatchConnectionEvent();
        return true;

      } catch (error) {
        console.error("[web3-wallet] Connection failed:", error);
        // User cancellation is not a security-relevant failure — don't penalise the counter
        const isUserCancellation = error.code === 4001 || (error.message && (
          error.message.includes('cancelled') ||
          error.message.includes('rejected') ||
          error.message.includes('Redirecting to Phantom')
        ));
        if (isUserCancellation) {
          this.connectionAttempts = Math.max(0, this.connectionAttempts - 1);
        }
        this._showConnectToast(`Connection failed: ${error.message}`, true);
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
        const LOCAL_WALLET_KEY = INTEGRATED_WALLET_STORAGE_KEY; // v2 for enhanced security
        
        // Encrypt the reference before storing (basic obfuscation)
        const encodedPubKey = btoa(publicKey);
        localStorage.setItem(LOCAL_WALLET_KEY, encodedPubKey);

        // Create wallet object (actual signing would require proper Solana keypair)
        // Note: This is a LOCAL wallet for testing/demo purposes only
        // For real transactions, users should connect Phantom or other secure wallets
        const wallet = {
          ...createIntegratedWalletProvider(publicKey),
          generated: Date.now(),
        };

        // Update global wallet reference (without exposing private key)
        if (!window.wallet) {
          window.wallet = {};
        }
        window.wallet.publicKey = {
          toString: () => publicKey,
          toBase58: () => publicKey,
        };
        window.wallet.sign = wallet.sign;
        window.wallet.isLocalWallet = true;

        console.log("[web3-wallet] Generated local wallet:", publicKey.substring(0, 12) + '...');
        return wallet;
        
      } catch (error) {
        console.error("[web3-wallet] Wallet generation failed:", error);
        throw new Error('Failed to generate secure wallet. Please try again.', { cause: error });
      }
    },

    canGenerateNewWallet() {
      return this.walletType === 'integrated';
    },

    async generateNewWallet() {
      if (!this.canGenerateNewWallet()) {
        this._showConnectToast('New wallet generation only available with Fizz Caps Wallet.', true);
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

        this._showConnectToast(`⬡ New wallet generated — ${this.getShortAddress()}`);

        this.dispatchConnectionEvent();
        return true;

      } catch (error) {
        console.error("[web3-wallet] Wallet generation failed:", error);
        this._showConnectToast(`Failed to generate new wallet: ${error.message}`, true);
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
