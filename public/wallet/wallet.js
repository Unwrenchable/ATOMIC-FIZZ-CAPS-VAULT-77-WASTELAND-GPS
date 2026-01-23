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
// ------------------------------------------------------------
// CHUNK 4 — MULTICHAIN NATIVE BALANCE FETCHERS
// ------------------------------------------------------------
(function () {
  "use strict";

  // ------------------------------
  // EVM CHAINS (Polygon, BNB, AVAX)
  // ------------------------------
  async function fetchEvmBalance(rpc, address) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getBalance",
          params: [address, "latest"]
        })
      });

      const json = await res.json();
      if (!json.result) return 0;

      return parseInt(json.result, 16) / 1e18;
    } catch (e) {
      console.warn("[AFW] EVM balance fetch failed:", e);
      return 0;
    }
  }

  // ------------------------------
  // SUI
  // ------------------------------
  async function fetchSuiBalance(rpc, address) {
    try {
      const res = await fetch(`${rpc}/balances/${address}`);
      const json = await res.json();
      const sui = json.totalBalance || 0;
      return sui / 1e9;
    } catch (e) {
      console.warn("[AFW] SUI balance fetch failed:", e);
      return 0;
    }
  }

  // ------------------------------
  // APTOS
  // ------------------------------
  async function fetchAptosBalance(rpc, address) {
    try {
      const res = await fetch(`${rpc}/accounts/${address}/resources`);
      const json = await res.json();

      const coinStore = json.find(r =>
        r.type.includes("0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>")
      );

      if (!coinStore) return 0;

      return parseInt(coinStore.data.coin.value, 10) / 1e8;
    } catch (e) {
      console.warn("[AFW] APT balance fetch failed:", e);
      return 0;
    }
  }

  // ------------------------------
  // BITCOIN (UTXO SCAN)
  // ------------------------------
  async function fetchBitcoinBalance(rpc, address) {
    try {
      const res = await fetch(`${rpc}/address/${address}`);
      const json = await res.json();
      const sats = json.chain_stats.funded_txo_sum - json.chain_stats.spent_txo_sum;
      return sats / 1e8;
    } catch (e) {
      console.warn("[AFW] BTC balance fetch failed:", e);
      return 0;
    }
  }

  // ------------------------------------------------------------
  // PATCH INTO MULTICHAIN REFRESH
  // ------------------------------------------------------------
  const oldRefresh = window.refreshOnChain;

  window.refreshOnChain = async function patchedRefresh(pubkey) {
    await oldRefresh(pubkey);

    if (!window.chains || !window.chains.length) return;

    for (const chain of window.chains) {
      const el = document.getElementById(`chain-${chain.chain}`);
      if (!el) continue;

      let bal = "—";

      try {
        switch (chain.type) {
          case "evm":
            bal = await fetchEvmBalance(chain.rpc, pubkey);
            break;

          case "move":
            if (chain.chain === "sui") bal = await fetchSuiBalance(chain.rpc, pubkey);
            if (chain.chain === "aptos") bal = await fetchAptosBalance(chain.rpc, pubkey);
            break;

          case "utxo":
            bal = await fetchBitcoinBalance(chain.rpc, pubkey);
            break;

          default:
            bal = "—";
        }
      } catch (e) {
        console.warn(`[AFW] Balance fetch failed for ${chain.chain}:`, e);
      }

      el.textContent = typeof bal === "number" ? bal.toFixed(4) : "—";
    }
  };

  console.log("[AFW] Chunk 4 (Multichain Balance Fetchers) Loaded");
})();
// ------------------------------------------------------------
// CHUNK 5 — PARTNER TOKEN BALANCE FETCHERS
// ------------------------------------------------------------
(function () {
  "use strict";

  // ------------------------------------------------------------
  // SPL TOKEN BALANCE (SOLANA)
  // ------------------------------------------------------------
  async function fetchSplBalance(pubkey, mint) {
    try {
      const rpc = window.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            pubkey,
            { mint },
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
      console.warn("[AFW] SPL balance fetch failed:", e);
      return 0;
    }
  }

  // ------------------------------------------------------------
  // ERC‑20 BALANCE (ETH, POLYGON, BNB, AVAX, BASE)
  // ------------------------------------------------------------
  async function fetchErc20Balance(rpc, address, contract) {
    try {
      const data = "0x70a08231000000000000000000000000" + address.slice(2);

      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [
            {
              to: contract,
              data
            },
            "latest"
          ]
        })
      });

      const json = await res.json();
      if (!json.result) return 0;

      return parseInt(json.result, 16) / 1e18;
    } catch (e) {
      console.warn("[AFW] ERC20 balance fetch failed:", e);
      return 0;
    }
  }

  // ------------------------------------------------------------
  // MOVE TOKENS (SUI / APTOS)
  // ------------------------------------------------------------
  async function fetchMoveTokenBalance(chain, rpc, address, tokenType) {
    try {
      if (chain === "sui") {
        const res = await fetch(`${rpc}/balances/${address}`);
        const json = await res.json();
        const entry = json.balances?.find(b => b.coinType === tokenType);
        if (!entry) return 0;
        return entry.totalBalance / 1e9;
      }

      if (chain === "aptos") {
        const res = await fetch(`${rpc}/accounts/${address}/resources`);
        const json = await res.json();
        const store = json.find(r => r.type.includes(tokenType));
        if (!store) return 0;
        return parseInt(store.data.coin.value, 10) / 1e8;
      }

      return 0;
    } catch (e) {
      console.warn("[AFW] MOVE token balance failed:", e);
      return 0;
    }
  }

  // ------------------------------------------------------------
  // PATCH INTO refreshOnChain
  // ------------------------------------------------------------
  const oldRefresh = window.refreshOnChain;

  window.refreshOnChain = async function patchedRefresh(pubkey) {
    await oldRefresh(pubkey);

    if (!window.partnerTokens || !window.partnerTokens.length) return;

    for (const token of window.partnerTokens) {
      const el = document.getElementById(`pt-${token.symbol}`);
      if (!el) continue;

      let bal = "—";

      try {
        switch (token.chain) {
          case "solana":
            bal = await fetchSplBalance(pubkey, token.mint);
            break;

          case "ethereum":
          case "polygon":
          case "bnb":
          case "avalanche":
          case "base":
            const chain = window.chains.find(c => c.chain === token.chain);
            if (chain) {
              bal = await fetchErc20Balance(chain.rpc, pubkey, token.contract);
            }
            break;

          case "sui":
          case "aptos":
            const moveChain = window.chains.find(c => c.chain === token.chain);
            if (moveChain) {
              bal = await fetchMoveTokenBalance(
                token.chain,
                moveChain.rpc,
                pubkey,
                token.tokenType || token.contract
              );
            }
            break;

          default:
            bal = "—";
        }
      } catch (e) {
        console.warn(`[AFW] Partner token fetch failed for ${token.symbol}:`, e);
      }

      el.textContent = typeof bal === "number" ? bal.toFixed(4) : "—";
    }
  };

  console.log("[AFW] Chunk 5 (Partner Token Balance Fetchers) Loaded");
})();
// ------------------------------------------------------------
// CHUNK 6 — CROSS‑CHAIN SWAP UI + SWAP ENGINE
// ------------------------------------------------------------
(function () {
  "use strict";

  // ------------------------------------------------------------
  // SWAP ENGINE (BACKEND-POWERED)
  // ------------------------------------------------------------
  async function performSwap({ fromChain, toChain, fromToken, toToken, amount, wallet }) {
    const base = (window.BACKEND_URL || window.location.origin).replace(/\/+$/, "");

    try {
      const res = await fetch(`${base}/api/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromChain,
          toChain,
          fromToken,
          toToken,
          amount,
          wallet
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        return { ok: false, error: data.error || `HTTP ${res.status}` };
      }

      return { ok: true, tx: data.tx };
    } catch (e) {
      console.warn("[AFW] Swap failed:", e);
      return { ok: false, error: "Network error" };
    }
  }

  // ------------------------------------------------------------
  // SWAP UI RENDER
  // ------------------------------------------------------------
  function renderSwapUI() {
    const panel = document.getElementById("swap-panel");
    if (!panel) return;

    panel.innerHTML = `
      <div class="swap-section">
        <div class="swap-label">FROM</div>
        <select id="swap-from-token" class="pipboy-select"></select>
        <input id="swap-from-amount" class="pipboy-input" placeholder="Amount">
      </div>

      <div class="swap-section">
        <div class="swap-label">TO</div>
        <select id="swap-to-token" class="pipboy-select"></select>
      </div>

      <button id="swap-execute" class="pipboy-button">EXECUTE SWAP</button>
      <div id="swap-status" class="pipboy-status"></div>
    `;

    populateSwapTokenLists();
    wireSwapButton();
  }

  // ------------------------------------------------------------
  // POPULATE TOKEN LISTS
  // ------------------------------------------------------------
  function populateSwapTokenLists() {
    const fromSel = document.getElementById("swap-from-token");
    const toSel = document.getElementById("swap-to-token");
    if (!fromSel || !toSel) return;

    const tokens = [];

    // Native tokens from chains.json
    if (window.chains) {
      for (const c of window.chains) {
        tokens.push({
          label: `${c.nativeName} (${c.nativeSymbol})`,
          chain: c.chain,
          symbol: c.nativeSymbol,
          type: "native"
        });
      }
    }

    // Partner tokens from partner_tokens.json
    if (window.partnerTokens) {
      for (const t of window.partnerTokens) {
        tokens.push({
          label: `${t.name} (${t.symbol})`,
          chain: t.chain,
          symbol: t.symbol,
          type: "partner",
          mint: t.mint || null,
          contract: t.contract || null
        });
      }
    }

    tokens.forEach(t => {
      const opt1 = document.createElement("option");
      opt1.value = JSON.stringify(t);
      opt1.textContent = t.label;
      fromSel.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = JSON.stringify(t);
      opt2.textContent = t.label;
      toSel.appendChild(opt2);
    });
  }

  // ------------------------------------------------------------
  // SWAP BUTTON LOGIC
  // ------------------------------------------------------------
  function wireSwapButton() {
    const btn = document.getElementById("swap-execute");
    const status = document.getElementById("swap-status");

    if (!btn || !status) return;

    btn.addEventListener("click", async () => {
      const wallet = window.PLAYER_WALLET;
      if (!wallet) {
        status.textContent = "Connect wallet first.";
        return;
      }

      const fromToken = JSON.parse(document.getElementById("swap-from-token").value);
      const toToken = JSON.parse(document.getElementById("swap-to-token").value);
      const amountStr = document.getElementById("swap-from-amount").value.trim();

      if (!amountStr || isNaN(parseFloat(amountStr))) {
        status.textContent = "Enter a valid amount.";
        return;
      }

      const amount = parseFloat(amountStr);

      status.textContent = "Executing swap…";

      const result = await performSwap({
        fromChain: fromToken.chain,
        toChain: toToken.chain,
        fromToken: fromToken.symbol,
        toToken: toToken.symbol,
        amount,
        wallet
      });

      if (!result.ok) {
        status.textContent = `Swap failed: ${result.error}`;
        return;
      }

      status.textContent = `Swap complete. TX: ${result.tx}`;
      await window.refreshOnChain(wallet);
    });
  }

  // ------------------------------------------------------------
  // PATCH INTO INIT
  // ------------------------------------------------------------
  const oldInit = window.initWallet;

  window.initWallet = function patchedInitWallet() {
    if (typeof oldInit === "function") oldInit();
    renderSwapUI();
    console.log("[AFW] Chunk 6 (Cross‑Chain Swap UI) Loaded");
  };

})();
// ------------------------------------------------------------
// CHUNK 7 — CROSS‑CHAIN PERKS ENGINE
// ------------------------------------------------------------
(function () {
  "use strict";

  // ------------------------------------------------------------
  // PERK STATE (GLOBAL, SAFE)
  // ------------------------------------------------------------
  window.FIZZ_PERKS = {
    bonk_raiders: false,
    shiba_nomads: false,
    wif_wanderer: false,
    pepe_cult: false,
    floki_vikings: false,
    btc_relic_hunter: false,
    avax_frostlands: false,
    polygon_neon: false,
    sui_constructs: false,
    aptos_vaults: false
  };

  // ------------------------------------------------------------
  // PERK CHECKS
  // ------------------------------------------------------------
  function evaluatePerks(pubkey) {
    if (!window.partnerTokens || !window.chains) return;

    const perks = window.FIZZ_PERKS;

    // Reset each time
    for (const k in perks) perks[k] = false;

    // Partner token perks
    for (const token of window.partnerTokens) {
      const el = document.getElementById(`pt-${token.symbol}`);
      if (!el) continue;

      const bal = parseFloat(el.textContent);
      if (!isFinite(bal) || bal <= 0) continue;

      switch (token.symbol.toUpperCase()) {
        case "BONK":
          perks.bonk_raiders = true;
          break;
        case "SHIB":
          perks.shiba_nomads = true;
          break;
        case "WIF":
          perks.wif_wanderer = true;
          break;
        case "PEPE":
          perks.pepe_cult = true;
          break;
        case "FLOKI":
          perks.floki_vikings = true;
          break;
      }
    }

    // Chain-native perks
    for (const chain of window.chains) {
      const el = document.getElementById(`chain-${chain.chain}`);
      if (!el) continue;

      const bal = parseFloat(el.textContent);
      if (!isFinite(bal) || bal <= 0) continue;

      switch (chain.chain) {
        case "bitcoin":
          perks.btc_relic_hunter = true;
          break;
        case "avalanche":
          perks.avax_frostlands = true;
          break;
        case "polygon":
          perks.polygon_neon = true;
          break;
        case "sui":
          perks.sui_constructs = true;
          break;
        case "aptos":
          perks.aptos_vaults = true;
          break;
      }
    }

    // Push perks into Pip‑Boy / Overseer if available
    if (typeof window.updatePipBoyPerks === "function") {
      window.updatePipBoyPerks(perks);
    }
    if (typeof window.updateOverseerPerks === "function") {
      window.updateOverseerPerks(perks);
    }

    console.log("[AFW] Perks evaluated:", perks);
  }

  // ------------------------------------------------------------
  // PATCH INTO refreshOnChain
  // ------------------------------------------------------------
  const oldRefresh = window.refreshOnChain;

  window.refreshOnChain = async function patchedRefresh(pubkey) {
    await oldRefresh(pubkey);
    evaluatePerks(pubkey);
  };

  console.log("[AFW] Chunk 7 (Cross‑Chain Perks Engine) Loaded");
})();
// ------------------------------------------------------------
// CHUNK 8 — RADIO INTEGRATION (FIZZMASTER REX REACTIVITY)
// ------------------------------------------------------------
(function () {
  "use strict";

  // ------------------------------------------------------------
  // RADIO HOOKS
  // ------------------------------------------------------------
  // Your radio engine can override this.
  if (!window.FIZZ_RADIO) {
    window.FIZZ_RADIO = {
      speak: (line) => console.log("[Rex]", line)
    };
  }

  // ------------------------------------------------------------
  // RADIO LINES (LORE-FRIENDLY)
  // ------------------------------------------------------------
  const RADIO_LINES = {
    bonk_raiders: [
      "Heard BONK Raiders been spotted near the Strip. If you're packin' BONK, they might just let you pass.",
      "BONK Raiders respect strength… or stupidity. Hard to tell which."
    ],
    shiba_nomads: [
      "Shiba Nomads are wanderin' again. Folks say they follow the scent of loyalty.",
      "If you see a caravan with red banners, that's the Shiba Nomads. Good traders, better fighters."
    ],
    wif_wanderer: [
      "Some say the Hat Wanderer walks between worlds. Others say he's just lost.",
      "If you're carryin' WIF, keep an eye out. The Wanderer tips his hat to his own."
    ],
    pepe_cult: [
      "Pepe shrines popped up overnight again. Don't stare too long… they stare back.",
      "The Pepe Cult leaves caches in the weirdest places. Check behind vending machines."
    ],
    floki_vikings: [
      "Floki Vikings carved runes into the old Hoover Dam. Bold move.",
      "If you hear chanting in the frost, that's Floki business. Best not interrupt."
    ],
    btc_relic_hunter: [
      "Old‑world relic hunters say Bitcoin was the first digital gold. Now it's just rare as hell.",
      "If you're holdin' BTC, you're basically carryin' a pre‑war artifact."
    ],
    avax_frostlands: [
      "Cold winds from the Frostlands blow strange whispers. Avalanche folk say it's the mountain thinkin'.",
      "AVAX explorers swear the snow glows blue at night. I say they're drinkin' radiator fluid."
    ],
    polygon_neon: [
      "Neon Grid flickers again. Must be Polygon tech hummin' under the ruins.",
      "If you see purple light in the dust, that's the Grid. Don't touch the cables."
    ],
    sui_constructs: [
      "Sui Constructs roam the wasteland. Metal bones, Move‑coded minds.",
      "If a Construct scans you, stand still. They hate sudden movement."
    ],
    aptos_vaults: [
      "Aptos Vaults open only for those who carry the right coin. Or so the legends say.",
      "Vault divers claim the walls shift when you're not lookin'. Creepy stuff."
    ]
  };

  // ------------------------------------------------------------
  // STATE TO PREVENT SPAM
  // ------------------------------------------------------------
  const lastSaid = {};

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ------------------------------------------------------------
  // RADIO REACTION ENGINE
  // ------------------------------------------------------------
  function reactToPerks(perks) {
    for (const key in perks) {
      if (!perks[key]) continue; // perk not active
      if (!RADIO_LINES[key]) continue; // no lines for this perk

      // Prevent repeating the same perk line too often
      const now = Date.now();
      if (lastSaid[key] && now - lastSaid[key] < 60000) continue; // 60s cooldown

      lastSaid[key] = now;

      const line = pickRandom(RADIO_LINES[key]);
      window.FIZZ_RADIO.speak(line);
    }
  }

  // ------------------------------------------------------------
  // PATCH INTO refreshOnChain
  // ------------------------------------------------------------
  const oldRefresh = window.refreshOnChain;

  window.refreshOnChain = async function patchedRefresh(pubkey) {
    await oldRefresh(pubkey);

    if (window.FIZZ_PERKS) {
      reactToPerks(window.FIZZ_PERKS);
    }
  };

  console.log("[AFW] Chunk 8 (Radio Integration) Loaded");
})();
// ------------------------------------------------------------
// CHUNK 8 — RADIO INTEGRATION (FIZZMASTER REX REACTIVITY)
// ------------------------------------------------------------
(function () {
  "use strict";

  // ------------------------------------------------------------
  // RADIO HOOKS
  // ------------------------------------------------------------
  // Your radio engine can override this.
  if (!window.FIZZ_RADIO) {
    window.FIZZ_RADIO = {
      speak: (line) => console.log("[Rex]", line)
    };
  }

  // ------------------------------------------------------------
  // RADIO LINES (LORE-FRIENDLY)
  // ------------------------------------------------------------
  const RADIO_LINES = {
    bonk_raiders: [
      "Heard BONK Raiders been spotted near the Strip. If you're packin' BONK, they might just let you pass.",
      "BONK Raiders respect strength… or stupidity. Hard to tell which."
    ],
    shiba_nomads: [
      "Shiba Nomads are wanderin' again. Folks say they follow the scent of loyalty.",
      "If you see a caravan with red banners, that's the Shiba Nomads. Good traders, better fighters."
    ],
    wif_wanderer: [
      "Some say the Hat Wanderer walks between worlds. Others say he's just lost.",
      "If you're carryin' WIF, keep an eye out. The Wanderer tips his hat to his own."
    ],
    pepe_cult: [
      "Pepe shrines popped up overnight again. Don't stare too long… they stare back.",
      "The Pepe Cult leaves caches in the weirdest places. Check behind vending machines."
    ],
    floki_vikings: [
      "Floki Vikings carved runes into the old Hoover Dam. Bold move.",
      "If you hear chanting in the frost, that's Floki business. Best not interrupt."
    ],
    btc_relic_hunter: [
      "Old‑world relic hunters say Bitcoin was the first digital gold. Now it's just rare as hell.",
      "If you're holdin' BTC, you're basically carryin' a pre‑war artifact."
    ],
    avax_frostlands: [
      "Cold winds from the Frostlands blow strange whispers. Avalanche folk say it's the mountain thinkin'.",
      "AVAX explorers swear the snow glows blue at night. I say they're drinkin' radiator fluid."
    ],
    polygon_neon: [
      "Neon Grid flickers again. Must be Polygon tech hummin' under the ruins.",
      "If you see purple light in the dust, that's the Grid. Don't touch the cables."
    ],
    sui_constructs: [
      "Sui Constructs roam the wasteland. Metal bones, Move‑coded minds.",
      "If a Construct scans you, stand still. They hate sudden movement."
    ],
    aptos_vaults: [
      "Aptos Vaults open only for those who carry the right coin. Or so the legends say.",
      "Vault divers claim the walls shift when you're not lookin'. Creepy stuff."
    ]
  };

  // ------------------------------------------------------------
  // STATE TO PREVENT SPAM
  // ------------------------------------------------------------
  const lastSaid = {};

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ------------------------------------------------------------
  // RADIO REACTION ENGINE
  // ------------------------------------------------------------
  function reactToPerks(perks) {
    for (const key in perks) {
      if (!perks[key]) continue; // perk not active
      if (!RADIO_LINES[key]) continue; // no lines for this perk

      // Prevent repeating the same perk line too often
      const now = Date.now();
      if (lastSaid[key] && now - lastSaid[key] < 60000) continue; // 60s cooldown

      lastSaid[key] = now;

      const line = pickRandom(RADIO_LINES[key]);
      window.FIZZ_RADIO.speak(line);
    }
  }

  // ------------------------------------------------------------
  // PATCH INTO refreshOnChain
  // ------------------------------------------------------------
  const oldRefresh = window.refreshOnChain;

  window.refreshOnChain = async function patchedRefresh(pubkey) {
    await oldRefresh(pubkey);

    if (window.FIZZ_PERKS) {
      reactToPerks(window.FIZZ_PERKS);
    }
  };

  console.log("[AFW] Chunk 8 (Radio Integration) Loaded");
})();
// ------------------------------------------------------------
// CHUNK 9 — QUEST + ENCOUNTER HOOKS
// ------------------------------------------------------------
(function () {
  "use strict";

  // ------------------------------------------------------------
  // GLOBAL QUEST STATE (SAFE)
  // ------------------------------------------------------------
  if (!window.FIZZ_QUESTS) {
    window.FIZZ_QUESTS = {
      bonk_raid_intro: false,
      shiba_caravan_intro: false,
      wif_wanderer_sighting: false,
      pepe_cache_discovered: false,
      floki_rune_event: false,
      btc_relic_signal: false,
      avax_frostlands_ping: false,
      polygon_neon_distortion: false,
      sui_construct_scan: false,
      aptos_vault_echo: false
    };
  }

  // ------------------------------------------------------------
  // QUEST TRIGGERS BASED ON PERKS
  // ------------------------------------------------------------
  function evaluateQuestTriggers(perks) {
    const q = window.FIZZ_QUESTS;

    if (perks.bonk_raiders && !q.bonk_raid_intro) {
      q.bonk_raid_intro = true;
      triggerQuestEvent("BONK_RAID_INTRO", "BONK Raiders spotted near the Mojave Outskirts.");
    }

    if (perks.shiba_nomads && !q.shiba_caravan_intro) {
      q.shiba_caravan_intro = true;
      triggerQuestEvent("SHIBA_CARAVAN", "A Shiba Nomad caravan is approaching from the east.");
    }

    if (perks.wif_wanderer && !q.wif_wanderer_sighting) {
      q.wif_wanderer_sighting = true;
      triggerQuestEvent("WIF_WANDERER", "A mysterious hat-wearing traveler was seen near the Strip.");
    }

    if (perks.pepe_cult && !q.pepe_cache_discovered) {
      q.pepe_cache_discovered = true;
      triggerQuestEvent("PEPE_CACHE", "A strange Pepe cache has appeared behind an old vending machine.");
    }

    if (perks.floki_vikings && !q.floki_rune_event) {
      q.floki_rune_event = true;
      triggerQuestEvent("FLOKI_RUNE", "Runes carved by Floki Vikings were found near Hoover Dam.");
    }

    if (perks.btc_relic_hunter && !q.btc_relic_signal) {
      q.btc_relic_signal = true;
      triggerQuestEvent("BTC_RELIC", "A pre-war relic signal is broadcasting faintly from the mountains.");
    }

    if (perks.avax_frostlands && !q.avax_frostlands_ping) {
      q.avax_frostlands_ping = true;
      triggerQuestEvent("AVAX_FROST", "Cold winds from the Frostlands carry a strange whisper.");
    }

    if (perks.polygon_neon && !q.polygon_neon_distortion) {
      q.polygon_neon_distortion = true;
      triggerQuestEvent("POLYGON_NEON", "A neon distortion flickers near the ruins of the old freeway.");
    }

    if (perks.sui_constructs && !q.sui_construct_scan) {
      q.sui_construct_scan = true;
      triggerQuestEvent("SUI_SCAN", "A Sui Construct scanned a traveler near the Basin.");
    }

    if (perks.aptos_vaults && !q.aptos_vault_echo) {
      q.aptos_vault_echo = true;
      triggerQuestEvent("APTOS_VAULT", "A deep metallic echo resonates from an Aptos Vault.");
    }
  }

  // ------------------------------------------------------------
  // QUEST EVENT DISPATCHER
  // ------------------------------------------------------------
  function triggerQuestEvent(code, message) {
    console.log("[QUEST EVENT]", code, message);

    // Pip‑Boy UI hook
    if (typeof window.updatePipBoyQuestLog === "function") {
      window.updatePipBoyQuestLog({ code, message, time: Date.now() });
    }

    // Overseer AI hook
    if (typeof window.overseerOnQuestEvent === "function") {
      window.overseerOnQuestEvent(code, message);
    }

    // World simulation hook
    if (typeof window.worldOnQuestEvent === "function") {
      window.worldOnQuestEvent(code, message);
    }

    // Radio reaction
    if (window.FIZZ_RADIO && typeof window.FIZZ_RADIO.speak === "function") {
      window.FIZZ_RADIO.speak(message);
    }
  }

  // ------------------------------------------------------------
  // PATCH INTO refreshOnChain
  // ------------------------------------------------------------
  const oldRefresh = window.refreshOnChain;

  window.refreshOnChain = async function patchedRefresh(pubkey) {
    await oldRefresh(pubkey);

    if (window.FIZZ_PERKS) {
      evaluateQuestTriggers(window.FIZZ_PERKS);
    }
  };

  console.log("[AFW] Chunk 9 (Quest + Encounter Hooks) Loaded");
})();
