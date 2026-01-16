(function () {
  "use strict";

  function safeLog(...args) {
    try { console.log(...args); } catch (e) {}
  }
  function safeWarn(...args) {
    try { console.warn(...args); } catch (e) {}
  }

  const SOL_DECIMALS = 9;
  const FIZZ_MINT = null; // set to your SPL mint address when ready

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
    const capsEl = document.getElementById("afw-caps");
    const xpEl = document.getElementById("afw-xp");
    const lvlEl = document.getElementById("afw-level");
    const itemsEl = document.getElementById("afw-items");

    const PLAYER = window.PLAYER || {
      caps: 0,
      xp: 0,
      level: 1,
      inventory: []
    };

    const needed = PLAYER.level * 100;

    if (capsEl) capsEl.textContent = PLAYER.caps || 0;
    if (lvlEl) lvlEl.textContent = PLAYER.level || 1;
    if (xpEl) xpEl.textContent = `${PLAYER.xp || 0} / ${needed}`;

    if (itemsEl) {
      const inv = PLAYER.inventory || [];
      if (!inv.length) {
        itemsEl.innerHTML = `<p class="muted">No items yet — explore the Mojave.</p>`;
      } else {
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

        const html = inv
          .slice(0, 10)
          .map(id => {
            const item = resolveItemById(id);
            const name = item.name || id;
            const desc = item.description || "";
            return `
              <div class="pip-entry">
                <strong>${name}</strong><br>
                <span>${desc}</span>
              </div>
            `;
          })
          .join("");

        itemsEl.innerHTML = html;
      }
    }
  }

  function renderNFTs() {
    const nftsEl = document.getElementById("afw-nfts");
    if (!nftsEl) return;

    const NFT_STATE = window.NFT_STATE || { list: [] };
    const list = NFT_STATE.list || [];

    if (!list.length) {
      nftsEl.innerHTML = `<p class="muted">No NFTs detected.</p>`;
      return;
    }

    const html = list
      .slice(0, 10)
      .map(nft => {
        const name = nft.name || "Unnamed NFT";
        const mint = nft.mint || nft.id || "Unknown mint";
        return `
          <div class="pip-entry pip-entry-nft">
            <strong>${name}</strong><br>
            <span class="pip-nft-mint">${mint}</span>
          </div>
        `;
      })
      .join("");

    nftsEl.innerHTML = html;
  }

  async function refreshOnChain(pubkey) {
    const addrEl = document.getElementById("afw-address");
    const solEl = document.getElementById("afw-sol");
    const fizzEl = document.getElementById("afw-fizz");

    if (addrEl) addrEl.textContent = `WALLET: ${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;

    const [sol, fizz] = await Promise.all([
      fetchSolBalance(pubkey),
      fetchFizzBalance(pubkey)
    ]);

    if (solEl) solEl.textContent = sol.toFixed(3);
    if (fizzEl) fizzEl.textContent = fizz.toString();
  }

  function initAtomicFizzWallet() {
    const panel = document.getElementById("panel-wallet");
    if (!panel) {
      safeWarn("[AFW] panel-wallet not found");
      return;
    }

    // Load panel HTML
    fetch("/pipboy/panel-wallet.html")
      .then(r => r.text())
      .then(html => {
        panel.innerHTML = html;

        const connectBtn = document.getElementById("afw-connect");
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

        // If already connected, auto-populate
        if (window.PLAYER_WALLET) {
          refreshOnChain(window.PLAYER_WALLET);
        }
        renderWastelandStats();
        renderNFTs();

        safeLog("[AFW] Wallet panel initialized");
      })
      .catch(e => safeWarn("[AFW] Failed to load panel-wallet.html:", e));
  }

  // Initialize when Pip-Boy is ready
  window.addEventListener("pipboyReady", () => {
    initAtomicFizzWallet();
  });
})();
