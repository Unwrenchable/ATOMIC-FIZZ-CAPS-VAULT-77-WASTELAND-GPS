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

    const capsEl = document.getElementById("afw-caps");
    const lvlEl = document.getElementById("afw-level");
    const xpEl = document.getElementById("afw-xp");
    const itemsEl = document.getElementById("afw-items");

    if (capsEl) capsEl.textContent = PLAYER.caps;
    if (lvlEl) lvlEl.textContent = PLAYER.level;
    if (xpEl) xpEl.textContent = `${PLAYER.xp} / ${needed}`;

    if (!itemsEl) return;

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
  // NFT DISPLAY (RARITY + MODAL SUPPORT)
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
      .map((nft, i) => {
        const name = nft.name || "Unnamed NFT";
        const mint = nft.mint || "Unknown Mint";
        const img = nft.image || null;
        const rarity = (nft.rarity || "common").toLowerCase();

        return `
          <div class="entry nft-entry rarity-${rarity}" data-nft-index="${i}">
            ${img ? `<img src="${img}" class="nft-thumb">` : ""}
            <div class="nft-info">
              <strong>${name}</strong><br>
              <span class="mono small">${mint}</span>
            </div>
          </div>
        `;
      })
      .join("");

    document.querySelectorAll(".nft-entry").forEach(el => {
      el.addEventListener("click", () => {
        const index = parseInt(el.dataset.nftIndex, 10);
        const NFT_STATE = window.NFT_STATE || { list: [] };
        const list = NFT_STATE.list || [];
        const nft = list[index];
        if (nft) openNFTModal(nft);
      });
    });
  }

  // ------------------------------------------------------------
  // NFT DETAIL MODAL + ACTIONS
  // ------------------------------------------------------------
  function openNFTModal(nft) {
    const modal = document.getElementById("nft-modal");
    const body = document.getElementById("nft-modal-body");
    if (!modal || !body) return;

    const name = nft.name || "Unnamed NFT";
    const mint = nft.mint || "Unknown Mint";
    const img = nft.image || null;
    const rarity = (nft.rarity || "common").toLowerCase();
    const desc = nft.description || nft.lore || "No description available.";

    body.innerHTML = `
      ${img ? `<img src="${img}">` : ""}
      <div class="nft-name rarity-${rarity}">${name}</div>
      <div class="nft-mint mono small">${mint}</div>
      <div class="nft-desc">${desc}</div>
    `;

    modal.classList.remove("hidden");

    const equipBtn = document.getElementById("nft-equip");
    const scrapBtn = document.getElementById("nft-scrap");
    const fuseBtn = document.getElementById("nft-fuse");

    if (equipBtn) equipBtn.onclick = () => equipNFT(nft);
    if (scrapBtn) scrapBtn.onclick = () => scrapNFT(nft);
    if (fuseBtn) fuseBtn.onclick = () => fuseNFT(nft);
  }

  function closeNFTModal() {
    const modal = document.getElementById("nft-modal");
    if (modal) modal.classList.add("hidden");
  }

  // EQUIP → Pip-Boy
  function equipNFT(nft) {
    if (typeof window.updatePipBoyEquipment !== "function") {
      alert("Pip-Boy not connected.");
      return;
    }
    window.updatePipBoyEquipment(nft);
    alert(`${nft.name || "Item"} equipped.`);
    closeNFTModal();
  }

  // SCRAP → CAPS
  async function scrapNFT(nft) {
    const base = (window.BACKEND_URL || window.location.origin).replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/api/scrap-nft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: nft.mint })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        alert("Scrap failed.");
        return;
      }

      const caps = data.caps || 0;
      if (typeof window.updatePipBoyCaps === "function") {
        window.updatePipBoyCaps(caps);
      }
      alert(`Scrapped for ${caps} CAPS.`);
      closeNFTModal();
      renderNFTs();
    } catch (e) {
      safeWarn("[AFW] scrapNFT failed:", e);
      alert("Scrap failed (network error).");
    }
  }

  // FUSION → backend
  function fuseNFT(nft) {
    const modal = document.getElementById("fusion-modal");
    const body = document.getElementById("fusion-body");
    if (!modal || !body) {
      alert("Fusion UI not available.");
      return;
    }

    body.innerHTML = `
      <p>Select another NFT in a future step to fuse with <strong>${nft.name || "this item"}</strong>.</p>
      <p class="muted small">For now, this will call /api/fuse with a single mint.</p>
    `;

    modal.classList.remove("hidden");

    const startBtn = document.getElementById("fusion-start");
    if (startBtn) {
      startBtn.onclick = () => startFusion(nft);
    }
  }

  async function startFusion(nft) {
    const base = (window.BACKEND_URL || window.location.origin).replace(/\/+$/, "");
    try {
      const res = await fetch(`${base}/api/fuse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: nft.mint })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        alert("Fusion failed.");
        return;
      }

      alert(`Fusion complete: ${data.newItem?.name || "New Item"}`);
      closeNFTModal();
      const fusionModal = document.getElementById("fusion-modal");
      if (fusionModal) fusionModal.classList.add("hidden");
      renderNFTs();
    } catch (e) {
      safeWarn("[AFW] startFusion failed:", e);
      alert("Fusion failed (network error).");
    }
  }

  // ------------------------------------------------------------
  // REFRESH ON-CHAIN DATA
  // ------------------------------------------------------------
  async function refreshOnChain(pubkey) {
    const addrEl = document.getElementById("afw-address");
    if (addrEl) {
      addrEl.textContent = `WALLET: ${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
    }

    const [sol, fizz] = await Promise.all([
      fetchSolBalance(pubkey),
      fetchFizzBalance(pubkey)
    ]);

    const solEl = document.getElementById("afw-sol");
    const fizzEl = document.getElementById("afw-fizz");
    if (solEl) solEl.textContent = sol.toFixed(3);
    if (fizzEl) fizzEl.textContent = fizz;

    if (typeof window.updatePipBoyWalletState === "function") {
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
    const modalClose = document.getElementById("nft-modal-close");
    const fusionClose = document.getElementById("fusion-close");

    if (modalClose) {
      modalClose.addEventListener("click", closeNFTModal);
    }
    if (fusionClose) {
      fusionClose.addEventListener("click", () => {
        const fm = document.getElementById("fusion-modal");
        if (fm) fm.classList.add("hidden");
      });
    }

    // Phantom connect
    if (connectBtn) {
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
    }

    // Local wallet mode
    if (localBtn) {
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
    }

    // Trade UI shell
    if (tradeBtn) {
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
    }

    if (window.PLAYER_WALLET) {
      refreshOnChain(window.PLAYER_WALLET);
    }

    renderWastelandStats();
    renderNFTs();

    safeLog("[AFW] Wallet app initialized");
  }

  window.addEventListener("DOMContentLoaded", initWallet);
})();
(function () {
    // ------------------------------------------------------------
// MULTICHAIN + PARTNER TOKEN EXPANSION (CHUNK 3)
// ------------------------------------------------------------

(function () {
  "use strict";

  let partnerTokens = [];
  let chains = [];
  let currentWalletPublicKey = null;

  // ------------------------------------------------------------
  // LOAD PARTNER TOKENS
  // ------------------------------------------------------------
  async function loadPartnerTokens() {
    try {
      const res = await fetch("/data/partner_tokens.json");
      partnerTokens = await res.json();
      renderPartnerTokens();
    } catch (e) {
      console.warn("[AFW] Failed to load partner tokens:", e);
    }
  }

  // ------------------------------------------------------------
  // LOAD CHAINS
  // ------------------------------------------------------------
  async function loadChains() {
    try {
      const res = await fetch("/data/chains.json");
      chains = await res.json();
      renderChains();
    } catch (e) {
      console.warn("[AFW] Failed to load chains:", e);
    }
  }

  // ------------------------------------------------------------
  // RENDER PARTNER TOKENS
  // ------------------------------------------------------------
  function renderPartnerTokens() {
    const container = document.getElementById("partner-tokens");
    if (!container) return;

    if (!partnerTokens.length) {
      container.innerHTML = `<p class="muted">No partner tokens configured.</p>`;
      return;
    }

    container.innerHTML = partnerTokens
      .map(t => `
        <div class="data-row">
          <div class="data-label">${t.name} (${t.symbol})</div>
          <div class="data-value" id="pt-${t.symbol}">—</div>
        </div>
      `)
      .join("");
  }

  // ------------------------------------------------------------
  // RENDER CHAINS
  // ------------------------------------------------------------
  function renderChains() {
    const container = document.getElementById("chain-list");
    if (!container) return;

    if (!chains.length) {
      container.innerHTML = `<p class="muted">No chains configured.</p>`;
      return;
    }

    container.innerHTML = chains
      .map(c => `
        <div class="data-row">
          <div class="data-label">${c.nativeName} (${c.nativeSymbol})</div>
          <div class="data-value" id="chain-${c.chain}">—</div>
        </div>
      `)
      .join("");
  }

  // ------------------------------------------------------------
  // MOONPAY BUY USDC
  // ------------------------------------------------------------
  function openMoonPayForUSDC() {
    const pubkey = window.PLAYER_WALLET;
    if (!pubkey) {
      alert("Connect your wallet first.");
      return;
    }

    const baseUrl = "https://buy.moonpay.com";
    const params = new URLSearchParams({
      currencyCode: "usdc_sol",
      walletAddress: pubkey
    });

    window.open(`${baseUrl}?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  // ------------------------------------------------------------
  // MULTICHAIN BALANCE REFRESH (SAFE STUBS)
  // ------------------------------------------------------------
  async function refreshMultichainBalances(pubkey) {
    if (!pubkey) return;

    // Placeholder — safe, no breakage
    chains.forEach(c => {
      const el = document.getElementById(`chain-${c.chain}`);
      if (el) el.textContent = "—";
    });

    partnerTokens.forEach(t => {
      const el = document.getElementById(`pt-${t.symbol}`);
      if (el) el.textContent = "—";
    });
  }

  // ------------------------------------------------------------
  // PATCH INTO EXISTING INIT
  // ------------------------------------------------------------
  const oldInit = window.initWallet;

  window.initWallet = function patchedInitWallet() {
    if (typeof oldInit === "function") oldInit();

    // Load registries
    loadPartnerTokens();
    loadChains();

    // Wire MoonPay button
    const buyBtn = document.getElementById("buy-usdc-button");
    if (buyBtn) buyBtn.addEventListener("click", openMoonPayForUSDC);

    // Patch refresh
    const oldRefresh = window.refreshOnChain;
    window.refreshOnChain = async function patchedRefresh(pubkey) {
      await oldRefresh(pubkey);
      await refreshMultichainBalances(pubkey);
    };

    console.log("[AFW] Multichain + Partner Token Expansion Loaded");
  };

})();

})();
