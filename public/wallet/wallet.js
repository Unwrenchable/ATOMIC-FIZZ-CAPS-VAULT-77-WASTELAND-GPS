(function () {
  "use strict";

  // ------------------------------------------------------------
  // SAFE LOGGING
  // ------------------------------------------------------------
  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }

  // ------------------------------------------------------------
  // CONSTANTS
  // ------------------------------------------------------------
  const SOL_DECIMALS = 9;
  const FIZZ_MINT = "59AWm25fgvCBDuSFXthjT4wyrW455qgdZ67zaqVkEgPV";
  const LOCAL_WALLET_KEY = "afw_local_wallet_v1";

  // ------------------------------------------------------------
  // BOOT OVERLAY
  // ------------------------------------------------------------
  function hideBootOverlay() {
    const overlay = document.getElementById("boot-overlay");
    if (overlay) overlay.classList.add("hidden");
  }

  // ------------------------------------------------------------
  // LOCAL WALLET MODE
  // ------------------------------------------------------------
  function generateLocalKeypair() {
    const rand = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(rand).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function loadLocalWallet() {
    try { return localStorage.getItem(LOCAL_WALLET_KEY) || null; } catch { return null; }
  }

  function saveLocalWallet(pubkey) {
    try { localStorage.setItem(LOCAL_WALLET_KEY, pubkey); } catch {}
  }

  // ------------------------------------------------------------
  // ON-CHAIN BALANCES
  // ------------------------------------------------------------
  async function fetchSolBalance(pubkey) {
    try {
      const rpc = window.SOLANA_RPC || "https://api.devnet.solana.com";
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBalance",
          params: [pubkey]
        })
      });
      const json = await res.json();
      const lamports = json.result?.value || 0;
      return lamports / Math.pow(10, SOL_DECIMALS);
    } catch (e) {
      safeWarn("[AFW] getBalance failed:", e);
      return 0;
    }
  }

  async function fetchFizzBalance(pubkey) {
    if (!FIZZ_MINT) return 0;
    try {
      const rpc = window.SOLANA_RPC || "https://api.devnet.solana.com";
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            pubkey,
            { mint: FIZZ_MINT },
            { encoding: "jsonParsed" }
          ]
        })
      });
      const json = await res.json();
      const accounts = json.result?.value || [];
      if (!accounts.length) return 0;
      const info = accounts[0].account.data.parsed.info.tokenAmount;
      return parseInt(info.amount, 10) / Math.pow(10, info.decimals);
    } catch (e) {
      safeWarn("[AFW] getTokenAccountsByOwner failed:", e);
      return 0;
    }
  }

  // ------------------------------------------------------------
  // WASTELAND STATS
  // ------------------------------------------------------------
  function renderWastelandStats() {
    const PLAYER = window.PLAYER || { caps: 0, xp: 0, level: 1, inventory: [] };
    const needed = PLAYER.level * 100;

    document.getElementById("afw-caps").textContent = PLAYER.caps;
    document.getElementById("afw-level").textContent = PLAYER.level;
    document.getElementById("afw-xp").textContent = `${PLAYER.xp} / ${needed}`;

    const itemsEl = document.getElementById("afw-items");
    if (!PLAYER.inventory.length) {
      itemsEl.innerHTML = `<p class="muted">No items yet — explore the Mojave.</p>`;
      return;
    }

    const resolveItemById =
      window.resolveItemById ||
      function (id) {
        const items = (window.DATA && window.DATA.mintables) || [];
        return (
          items.find(
            i => i && (i.id === id || i.slug === id || i.mintableId === id)
          ) || { name: id, description: "" }
        );
      };

    itemsEl.innerHTML = PLAYER.inventory
      .slice(0, 10)
      .map(id => {
        const item = resolveItemById(id);
        return `
          <div class="entry">
            <strong>${item.name}</strong><br>
            <span>${item.description || ""}</span>
          </div>
        `;
      })
      .join("");
  }

  // ------------------------------------------------------------
  // NFT DISPLAY (WITH RARITY SUPPORT)
  // ------------------------------------------------------------
  function renderNFTs() {
    const nftsEl = document.getElementById("afw-nfts");
    if (!nftsEl) return;

    const NFT_STATE = window.NFT_STATE || { list: [] };
    const list = NFT_STATE.list || [];

    if (!list.length) {
      nftsEl.innerHTML = `<p class="muted">No Atomic Fizz NFTs detected.</p>`;
      return;
    }

    nftsEl.innerHTML = list
      .slice(0, 20)
      .map(nft => {
        const name = nft.name || "Unnamed NFT";
        const mint = nft.mint || "Unknown Mint";
        const img = nft.image || null;
        const rarity = (nft.rarity || "common").toLowerCase();

        return `
          <div class="entry nft-entry rarity-${rarity}">
            ${img ? `<img src="${img}" class="nft-thumb">` : ""}
            <div class="nft-info">
              <strong>${name}</strong><br>
              <span class="mono small">${mint}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // ------------------------------------------------------------
  // REFRESH ON-CHAIN DATA
  // ------------------------------------------------------------
  async function refreshOnChain(pubkey) {
    document.getElementById("afw-address").textContent =
      `WALLET: ${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;

    const [sol, fizz] = await Promise.all([
      fetchSolBalance(pubkey),
      fetchFizzBalance(pubkey)
    ]);

    document.getElementById("afw-sol").textContent = sol.toFixed(3);
    document.getElementById("afw-fizz").textContent = fizz;

    // Pip-Boy bridge
    if (window.updatePipBoyWalletState) {
      window.updatePipBoyWalletState(pubkey);
    }
  }

  // ------------------------------------------------------------
  // INIT WALLET APP
  // ------------------------------------------------------------
  function initWallet() {
    hideBootOverlay();

    const connectBtn = document.getElementById("afw-connect");
    const localBtn = document.getElementById("afw-local");
    const tradeBtn = document.getElementById("afw-trade-send");

    // Phantom connect
    connectBtn.addEventListener("click", async () => {
      try {
        if (typeof window.connectWallet === "function") {
          await window.connectWallet();
        }
        const pubkey = window.PLAYER_WALLET;
        if (!pubkey) {
          alert("Wallet not connected.");
          return;
        }
        await refreshOnChain(pubkey);
        renderWastelandStats();
        renderNFTs();
      } catch (e) {
        safeWarn("[AFW] connect failed:", e);
      }
    });

    // Local wallet mode
    localBtn.addEventListener("click", async () => {
      let pubkey = loadLocalWallet();
      if (!pubkey) {
        pubkey = generateLocalKeypair();
        saveLocalWallet(pubkey);
        alert("New Atomic Fizz local wallet created.");
      }
      window.PLAYER_WALLET = pubkey;
      await refreshOnChain(pubkey);
      renderWastelandStats();
      renderNFTs();
    });

    // Trade UI shell
    tradeBtn.addEventListener("click", async () => {
      const to = document.getElementById("afw-trade-to").value.trim();
      const amtStr = document.getElementById("afw-trade-amount").value.trim();
      const status = document.getElementById("afw-trade-status");

      const from = window.PLAYER_WALLET;
      if (!from) {
        status.textContent = "Connect a wallet first.";
        return;
      }
      if (!to || !amtStr) {
        status.textContent = "Enter recipient and amount.";
        return;
      }

      const amount = parseFloat(amtStr);
      if (!Number.isFinite(amount) || amount <= 0) {
        status.textContent = "Enter a valid positive amount.";
        return;
      }

      status.textContent = "Submitting FIZZ transfer…";

      try {
        const base = (window.BACKEND_URL || window.location.origin).replace(/\/+$/, "");
        const res = await fetch(`${base}/api/transfer-fizz`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from, to, amount })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || data.ok === false) {
          status.textContent = `Transfer failed: ${data.error || `HTTP ${res.status}`}`;
          return;
        }

        status.textContent = "Transfer complete.";
        await refreshOnChain(from);
      } catch (e) {
        safeWarn("[AFW] transfer-fizz failed:", e);
        status.textContent = "Transfer failed (network error).";
      }
    });

    // Auto-load if already connected
    if (window.PLAYER_WALLET) {
      refreshOnChain(window.PLAYER_WALLET);
    }

    renderWastelandStats();
    renderNFTs();

    safeLog("[AFW] Wallet app initialized");
  }

  window.addEventListener("DOMContentLoaded", initWallet);
})();
