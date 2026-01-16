(function () {
  "use strict";

  function safeLog(...args) { try { console.log(...args); } catch (e) {} }
  function safeWarn(...args) { try { console.warn(...args); } catch (e) {} }

  const SOL_DECIMALS = 9;
  const FIZZ_MINT = "59AWm25fgvCBDuSFXthjT4wyrW455qgdZ67zaqVkEgPV";

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

  function renderNFTs() {
    const nftsEl = document.getElementById("afw-nfts");
    const NFT_STATE = window.NFT_STATE || { list: [] };
    const list = NFT_STATE.list || [];

    if (!list.length) {
      nftsEl.innerHTML = `<p class="muted">No NFTs detected.</p>`;
      return;
    }

    nftsEl.innerHTML = list
      .slice(0, 10)
      .map(nft => {
        return `
          <div class="entry">
            <strong>${nft.name || "Unnamed NFT"}</strong><br>
            <span class="mono small">${nft.mint}</span>
          </div>
        `;
      })
      .join("");
  }

  async function refreshOnChain(pubkey) {
    document.getElementById("afw-address").textContent =
      `WALLET: ${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;

    const [sol, fizz] = await Promise.all([
      fetchSolBalance(pubkey),
      fetchFizzBalance(pubkey)
    ]);

    document.getElementById("afw-sol").textContent = sol.toFixed(3);
    document.getElementById("afw-fizz").textContent = fizz;
  }

  function initWallet() {
    const connectBtn = document.getElementById("afw-connect");

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

    // Auto-load if already connected
    if (window.PLAYER_WALLET) {
      refreshOnChain(window.PLAYER_WALLET);
    }

    renderWastelandStats();
    renderNFTs();
  }

  window.addEventListener("DOMContentLoaded", initWallet);
})();
