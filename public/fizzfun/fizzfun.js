// ============================================================
// FIZZ.FUN TOKEN LAUNCHPAD - STANDALONE VERSION
// Vault-Tec Approved Token Launch Protocol
// ============================================================
(function () {
  "use strict";

  console.log("[Fizz.fun] Standalone Token Launchpad Loading...");

  // ------------------------------------------------------------
  // CONSTANTS - Matching backend fizz-fun.js
  // ⚠️ WARNING: These constants are duplicated from backend/api/fizz-fun.js
  // for client-side calculations. Keep in sync manually or consider moving to
  // a shared config file (e.g., /shared/fizz-constants.js) that both
  // frontend and backend can import to maintain single source of truth.
  // TODO [MEDIUM]: Create shared constants file to prevent sync issues
  // ------------------------------------------------------------
  const GRADUATION_SOL = 85_000_000_000; // 85 SOL in lamports (bonding curve graduation threshold)
  const VIRTUAL_SOL = 30_000_000_000; // 30 SOL virtual liquidity (constant product AMM)

  // ------------------------------------------------------------
  // MODULE STATE
  // ------------------------------------------------------------
  // Debounce timer for quote updates (module-scoped to prevent naming conflicts)
  let quoteDebounceTimer = null;

  // ------------------------------------------------------------
  // UTILITY FUNCTIONS
  // ------------------------------------------------------------
  function safeLog(...args) {
    if (console && console.log) {
      console.log(...args);
    }
  }

  function safeWarn(...args) {
    if (console && console.warn) {
      console.warn(...args);
    }
  }

  // ------------------------------------------------------------
  // TOAST NOTIFICATIONS
  // ------------------------------------------------------------
  function showToast(message, type = "success", duration = 3000) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("removing");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ------------------------------------------------------------
  // BOOT SEQUENCE
  // ------------------------------------------------------------
  function initBootSequence() {
    const bootOverlay = document.getElementById("boot-overlay");
    const mainApp = document.getElementById("fizzfun-app");

    if (bootOverlay && mainApp) {
      mainApp.style.display = "none";
      
      setTimeout(() => {
        bootOverlay.style.animation = "boot-fadeout 1s forwards";
        setTimeout(() => {
          bootOverlay.style.display = "none";
          mainApp.style.display = "block";
          mainApp.style.animation = "fadeIn 1s ease-in";
        }, 1000);
      }, 2000);
    }
  }

  // ------------------------------------------------------------
  // WALLET CONNECTION
  // ------------------------------------------------------------
  const WalletManager = {
    isConnected: false,
    address: null,

    async connectPhantom() {
      try {
        if (window.solana && window.solana.isPhantom) {
          const response = await window.solana.connect();
          this.address = response.publicKey.toString();
          this.isConnected = true;
          this.updateUI();
          showToast("Phantom vault link established!", "success");
          FizzFun.onWalletConnect(this.address);
          return this.address;
        } else {
          showToast("Phantom not detected. Install it, wastelander.", "error");
          window.open("https://phantom.app/", "_blank");
        }
      } catch (err) {
        safeWarn("[Wallet] Phantom connection failed:", err);
        showToast("Failed to link Phantom vault", "error");
      }
    },

    disconnect() {
      this.isConnected = false;
      this.address = null;
      this.updateUI();
      showToast("Vault link severed", "warning");
    },

    updateUI() {
      const statusDot = document.getElementById("status-dot");
      const addressEl = document.getElementById("wallet-address");
      const connectBtn = document.getElementById("connect-wallet-btn");

      if (this.isConnected && this.address) {
        const shortAddr = `${this.address.slice(0, 4)}...${this.address.slice(-4)}`;
        if (statusDot) {
          statusDot.className = "status-dot connected";
        }
        if (addressEl) {
          addressEl.textContent = `VAULT LINK: ${shortAddr}`;
        }
        if (connectBtn) {
          connectBtn.textContent = "\u26a1 SEVER LINK";
          connectBtn.onclick = () => this.disconnect();
        }
      } else {
        if (statusDot) {
          statusDot.className = "status-dot disconnected";
        }
        if (addressEl) {
          addressEl.textContent = "VAULT LINK: OFFLINE";
        }
        if (connectBtn) {
          connectBtn.textContent = "\u26a1 LINK WALLET";
          connectBtn.onclick = () => this.connectPhantom();
        }
      }
    }
  };

  // ------------------------------------------------------------
  // FIZZ.FUN API INTEGRATION
  // ------------------------------------------------------------
  const FizzFun = {
    currentAction: "buy", // buy or sell
    selectedToken: null,
    
    async checkAccess(wallet) {
      try {
        const apiBase = window.BACKEND_URL || window.API_BASE || "";
        const res = await fetch(`${apiBase}/api/fizz-fun/access/${wallet}`);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        this.renderAccessStatus(data);
        return data;
      } catch (err) {
        safeWarn("[Fizz.fun] Access check failed:", err);
        showToast("Failed to check Fizz.fun access", "error");
        return null;
      }
    },

    renderAccessStatus(data) {
      const loading = document.getElementById("fizz-loading");
      const info = document.getElementById("fizz-access-info");
      const message = document.getElementById("fizz-access-message");
      
      if (loading) loading.style.display = "none";
      if (info) info.style.display = "block";

      const tierEl = document.getElementById("fizz-tier");
      const capsEl = document.getElementById("fizz-caps-balance");
      const canLaunchEl = document.getElementById("fizz-can-launch");
      const feeEl = document.getElementById("fizz-launch-fee");
      const feeRow = document.getElementById("fizz-launch-fee-row");
      const launchSection = document.getElementById("fizz-launch-section");

      if (tierEl) {
        tierEl.textContent = data.tier.toUpperCase();
        tierEl.className = `tier-badge ${data.tier}`;
      }
      if (capsEl) capsEl.textContent = data.capsBalance.toLocaleString();
      if (canLaunchEl) {
        canLaunchEl.textContent = data.canLaunch ? "YES" : "NO";
        canLaunchEl.style.color = data.canLaunch ? "var(--pipboy-green)" : "#ff6666";
      }
      if (feeEl && data.canLaunch) {
        feeEl.textContent = `${data.launchFee} CAPS`;
        if (feeRow) feeRow.style.display = "flex";
      }
      if (message) message.textContent = data.message;

      // Show/hide launch form
      if (launchSection) {
        launchSection.style.display = data.canLaunch ? "block" : "none";
      }
    },

    async fetchTokens(sort = "volume", limit = 50) {
      try {
        const apiBase = window.BACKEND_URL || window.API_BASE || "";
        const res = await fetch(`${apiBase}/api/fizz-fun/tokens?sort=${sort}&limit=${limit}`);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        this.renderTokenList(data.tokens);
        return data;
      } catch (err) {
        safeWarn("[Fizz.fun] Fetch tokens failed:", err);
        showToast("Failed to load tokens", "error");
        return null;
      }
    },

    renderTokenList(tokens) {
      const container = document.getElementById("fizz-token-list");
      if (!container) return;

      if (!tokens || tokens.length === 0) {
        container.innerHTML = '<p class="muted small">No tokens deployed yet. Be the first wasteland entrepreneur.</p>';
        return;
      }

      container.innerHTML = tokens.map((token) => {
        const progress = Math.min((token.solReserve / GRADUATION_SOL) * 100, 100);
        const price = token.solReserve > 0 
          ? ((token.solReserve + VIRTUAL_SOL) / token.tokenReserve).toFixed(9)
          : "0.000000000";
        
        return `
          <div class="token-card" data-mint="${token.mint}">
            <div class="token-symbol">${token.symbol || "TKN"}</div>
            <div class="token-name">${token.name || "Token"}</div>
            <div class="token-stats">
              <div class="token-stat-row">
                <span>Price:</span>
                <span>${price} SOL</span>
              </div>
              <div class="token-stat-row">
                <span>Reserve:</span>
                <span>${(token.solReserve / 1e9).toFixed(2)} SOL</span>
              </div>
              <div class="token-stat-row">
                <span>Status:</span>
                <span>${token.graduated ? "🎓 GRADUATED" : "📈 BONDING"}</span>
              </div>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${progress}%"></div>
              <div class="progress-text">${progress.toFixed(1)}% to Graduation</div>
            </div>
          </div>
        `;
      }).join("");

      // Add click handlers
      container.querySelectorAll(".token-card").forEach((card) => {
        card.addEventListener("click", () => {
          const mint = card.getAttribute("data-mint");
          this.selectToken(mint);
        });
      });
    },

    async selectToken(mint) {
      try {
        const apiBase = window.BACKEND_URL || window.API_BASE || "";
        const res = await fetch(`${apiBase}/api/fizz-fun/token/${mint}`);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        this.selectedToken = data;
        this.renderTradePanel(data);
        
        // Scroll to trade section
        const tradeSection = document.getElementById("fizz-trade-section");
        if (tradeSection) {
          tradeSection.style.display = "block";
          tradeSection.scrollIntoView({ behavior: "smooth" });
        }
      } catch (err) {
        safeWarn("[Fizz.fun] Select token failed:", err);
        showToast("Failed to load token details", "error");
      }
    },

    renderTradePanel(token) {
      const symbolEl = document.getElementById("fizz-selected-symbol");
      const infoEl = document.getElementById("fizz-selected-info");

      if (symbolEl) symbolEl.textContent = token.symbol;
      if (infoEl) {
        infoEl.innerHTML = `
          <div class="token-details">
            <div class="data-row">
              <span class="data-label">NAME:</span>
              <span class="data-value">${token.name}</span>
            </div>
            <div class="data-row">
              <span class="data-label">PRICE:</span>
              <span class="data-value">${token.priceFormatted}</span>
            </div>
            <div class="data-row">
              <span class="data-label">MARKET CAP:</span>
              <span class="data-value">${token.marketCapFormatted}</span>
            </div>
            <div class="data-row">
              <span class="data-label">PROGRESS:</span>
              <span class="data-value">${token.graduationProgress.toFixed(1)}%</span>
            </div>
            <div class="data-row">
              <span class="data-label">STATUS:</span>
              <span class="data-value">${token.graduated ? "🎓 GRADUATED" : "📈 BONDING"}</span>
            </div>
          </div>
        `;
      }
    },

    async getQuote() {
      if (!this.selectedToken) {
        showToast("No token selected", "warning");
        return;
      }

      const amountInput = document.getElementById("fizz-trade-amount");
      const amount = parseFloat(amountInput.value || 0);
      
      if (amount <= 0) {
        showToast("Enter a valid amount", "warning");
        return;
      }

      try {
        const apiBase = window.BACKEND_URL || window.API_BASE || "";
        let url;
        
        if (this.currentAction === "buy") {
          url = `${apiBase}/api/fizz-fun/quote/buy?mint=${this.selectedToken.mint}&solAmount=${amount}`;
        } else {
          url = `${apiBase}/api/fizz-fun/quote/sell?mint=${this.selectedToken.mint}&tokenAmount=${amount}`;
        }

        const res = await fetch(url);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        this.renderQuote(data);
      } catch (err) {
        safeWarn("[Fizz.fun] Get quote failed:", err);
        showToast("Failed to get quote", "error");
      }
    },

    renderQuote(quote) {
      const quoteEl = document.getElementById("fizz-quote");
      if (!quoteEl) return;

      quoteEl.style.display = "block";
      
      if (this.currentAction === "buy") {
        quoteEl.innerHTML = `
          <div class="data-row">
            <span>You Pay:</span>
            <span>${quote.solAmount} SOL</span>
          </div>
          <div class="data-row">
            <span>Fee (1%):</span>
            <span>${quote.fee.toFixed(6)} SOL</span>
          </div>
          <div class="data-row">
            <span>You Receive:</span>
            <span class="balance-value">${quote.tokensOut.toFixed(2)} ${this.selectedToken.symbol}</span>
          </div>
          <div class="data-row">
            <span>Price Impact:</span>
            <span>${quote.priceImpact.toFixed(2)}%</span>
          </div>
          <div class="data-row">
            <span>New Price:</span>
            <span>${(quote.newPrice * 1e9).toFixed(9)} SOL</span>
          </div>
        `;
      } else {
        quoteEl.innerHTML = `
          <div class="data-row">
            <span>You Sell:</span>
            <span>${quote.tokenAmount} ${this.selectedToken.symbol}</span>
          </div>
          <div class="data-row">
            <span>Gross Return:</span>
            <span>${quote.solOutGross.toFixed(6)} SOL</span>
          </div>
          <div class="data-row">
            <span>Fee (1%):</span>
            <span>${quote.fee.toFixed(6)} SOL</span>
          </div>
          <div class="data-row">
            <span>You Receive:</span>
            <span class="balance-value">${quote.solOut.toFixed(6)} SOL</span>
          </div>
          <div class="data-row">
            <span>Price Impact:</span>
            <span>${quote.priceImpact.toFixed(2)}%</span>
          </div>
        `;
      }
    },

    executeTrade() {
      // Validation checks
      if (!this.selectedToken) {
        showToast("Please select a token first", "warning");
        return;
      }
      
      if (!WalletManager.isConnected) {
        showToast("Please connect your wallet first", "warning");
        return;
      }
      
      const amountInput = document.getElementById("fizz-trade-amount");
      const amount = parseFloat(amountInput?.value || 0);
      
      if (amount <= 0) {
        showToast("Please enter a valid amount", "warning");
        return;
      }
      
      showToast("Trade execution requires on-chain program deployment.", "warning");
      // TODO [HIGH PRIORITY - Phase 2]: Implement on-chain trade execution
      // Timeline: After Solana program deployment to devnet
      // Steps:
      // 1. Get connected wallet (Phantom or local)
      // 2. Build transaction using Fizz.fun program
      // 3. Call appropriate instruction (buy_token or sell_token)
      // 4. Sign transaction with wallet
      // 5. Send and confirm transaction
      // 6. Update UI with transaction status
      // 7. Refresh token data and user balances
    },

    async launchToken() {
      const nameInput = document.getElementById("fizz-launch-name");
      const symbolInput = document.getElementById("fizz-launch-symbol");
      const uriInput = document.getElementById("fizz-launch-uri");
      const statusEl = document.getElementById("fizz-launch-status");

      const name = nameInput?.value.trim();
      const symbol = symbolInput?.value.trim().toUpperCase();
      const uri = uriInput?.value.trim();

      if (!name || !symbol || !uri) {
        showToast("Fill in all fields", "warning");
        return;
      }

      if (statusEl) statusEl.textContent = "Launching token...";

      try {
        showToast("Token deployment requires Solana program to go live.", "warning");
        // TODO [HIGH PRIORITY - Phase 2]: Implement on-chain token launch
        // Timeline: After Solana program deployment to devnet
        // Dependencies: Requires CAPS token deployed and program authority setup
        // Steps:
        // 1. Get connected wallet and verify CAPS balance
        // 2. Build create_token transaction with program
        // 3. Include name, symbol, uri parameters
        // 4. Burn required CAPS fee (tier-based)
        // 5. Sign transaction with wallet
        // 6. Send and confirm transaction
        // 7. Get new token mint address from logs
        // 8. Refresh token list to show new token
        // 9. Clear form and show success message
        
        if (statusEl) statusEl.textContent = "On-chain program pending deployment.";
      } catch (err) {
        safeWarn("[Fizz.fun] Launch failed:", err);
        showToast("Launch failed", "error");
        if (statusEl) statusEl.textContent = `Error: ${err.message}`;
      }
    },

    async loadStats() {
      try {
        const apiBase = window.BACKEND_URL || window.API_BASE || "";
        const res = await fetch(`${apiBase}/api/fizz-fun/stats`);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        
        const tokensEl = document.getElementById("fizz-stat-tokens");
        const volumeEl = document.getElementById("fizz-stat-volume");
        const capsEl = document.getElementById("fizz-stat-caps");

        if (tokensEl) tokensEl.textContent = data.totalTokensLaunched.toLocaleString();
        if (volumeEl) volumeEl.textContent = `${data.totalVolumeSol.toFixed(2)} SOL`;
        if (capsEl) capsEl.textContent = data.totalCapsBurned.toLocaleString();
      } catch (err) {
        safeWarn("[Fizz.fun] Load stats failed:", err);
      }
    },

    onWalletConnect(address) {
      safeLog("[Fizz.fun] Wallet connected:", address);
      this.checkAccess(address);
      this.fetchTokens();
      this.loadStats();
    }
  };

  // ------------------------------------------------------------
  // EVENT LISTENERS
  // ------------------------------------------------------------
  
  function initEventListeners() {
    // Sort buttons
    const sortVolume = document.getElementById("fizz-sort-volume");
    const sortNewest = document.getElementById("fizz-sort-newest");
    const sortGraduating = document.getElementById("fizz-sort-graduating");
    const refresh = document.getElementById("fizz-refresh");

    if (sortVolume) sortVolume.addEventListener("click", () => FizzFun.fetchTokens("volume"));
    if (sortNewest) sortNewest.addEventListener("click", () => FizzFun.fetchTokens("newest"));
    if (sortGraduating) sortGraduating.addEventListener("click", () => FizzFun.fetchTokens("graduating"));
    if (refresh) refresh.addEventListener("click", () => {
      FizzFun.fetchTokens();
      FizzFun.loadStats();
      showToast("Caps ledger refreshed!", "success");
    });

    // Trade action buttons
    const buyBtn = document.getElementById("fizz-action-buy");
    const sellBtn = document.getElementById("fizz-action-sell");

    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        FizzFun.currentAction = "buy";
        buyBtn.classList.add("active");
        if (sellBtn) sellBtn.classList.remove("active");
        const label = document.getElementById("fizz-input-label");
        if (label) label.textContent = "SOL AMOUNT";
      });
    }

    if (sellBtn) {
      sellBtn.addEventListener("click", () => {
        FizzFun.currentAction = "sell";
        sellBtn.classList.add("active");
        if (buyBtn) buyBtn.classList.remove("active");
        const label = document.getElementById("fizz-input-label");
        if (label) label.textContent = "TOKEN AMOUNT";
      });
    }

    // Amount input - get quote on change
    const amountInput = document.getElementById("fizz-trade-amount");
    if (amountInput) {
      amountInput.addEventListener("input", () => {
        clearTimeout(quoteDebounceTimer);
        quoteDebounceTimer = setTimeout(() => FizzFun.getQuote(), 500);
      });
    }

    // Execute trade
    const executeBtn = document.getElementById("fizz-execute-trade");
    if (executeBtn) {
      executeBtn.addEventListener("click", () => FizzFun.executeTrade());
    }

    // Launch token
    const launchBtn = document.getElementById("fizz-execute-launch");
    if (launchBtn) {
      launchBtn.addEventListener("click", () => FizzFun.launchToken());
    }

    // Buy USDC button
    const buyUsdcBtn = document.getElementById("buy-usdc-button");
    if (buyUsdcBtn) {
      buyUsdcBtn.addEventListener("click", () => {
        showToast("MoonPay integration pending.", "warning");
      });
    }

    // Connect wallet button
    const connectBtn = document.getElementById("connect-wallet-btn");
    if (connectBtn) {
      connectBtn.addEventListener("click", () => {
        WalletManager.connectPhantom();
      });
    }
  }

  // ------------------------------------------------------------
  // INITIALIZATION
  // ------------------------------------------------------------
  function init() {
    safeLog("[Fizz.fun] Initializing standalone launchpad...");
    
    // Initialize boot sequence
    initBootSequence();
    
    // Initialize wallet UI
    WalletManager.updateUI();
    
    // Initialize event listeners
    initEventListeners();
    
    // Load initial data (without wallet)
    FizzFun.fetchTokens();
    FizzFun.loadStats();
    
    safeLog("[Fizz.fun] ✅ Launchpad Loaded!");
  }

  // Wait for DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose for debugging
  window.FizzFun = FizzFun;
  window.WalletManager = WalletManager;
  window.showToast = showToast;
})();
