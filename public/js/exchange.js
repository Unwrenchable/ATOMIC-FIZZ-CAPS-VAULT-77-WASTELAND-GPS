(function () {
  "use strict";

  const connectBtn = document.getElementById("connectWalletBtn");
  const walletAddrEl = document.getElementById("walletAddr");
  const listNftBtn = document.getElementById("listNftBtn");
  const nftSelector = document.getElementById("nftSelector");
  const nftGrid = document.getElementById("nftGrid");
  const tradeList = document.getElementById("tradeList");

  const authClient = window.AuthClient ? new window.AuthClient() : null;
  let connectedWallet = null;
  let connectedProvider = null;

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

  function getWalletAdapter() {
    return window.Game && window.Game.modules && window.Game.modules.web3WalletAdapter
      ? window.Game.modules.web3WalletAdapter
      : null;
  }

  function safeImageUrl(url) {
    if (!url || typeof url !== "string") return "/favicon.png";
    const allowedOrigins = [
      "https://arweave.net/",
      "https://ipfs.io/",
      "https://gateway.pinata.cloud/",
      "https://nftstorage.link/",
      "https://shdw-drive.genesysgo.net/",
    ];
    return allowedOrigins.some((origin) => url.startsWith(origin)) ? url : "/favicon.png";
  }

  function getConnectedProvider() {
    if (connectedProvider) return connectedProvider;
    const adapter = getWalletAdapter();
    if (adapter && adapter.getProvider) {
      const provider = adapter.getProvider();
      if (provider) return provider;
    }
    if (window.solana && window.solana.isPhantom) return window.solana;
    return null;
  }

  function decodeBase64(base64) {
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function ensureAuthenticated() {
    if (!authClient) {
      throw new Error("Authentication client unavailable.");
    }
    const provider = getConnectedProvider();
    if (!provider || !provider.publicKey) {
      throw new Error("Connect a Solana wallet first.");
    }
    if (!authClient.getSessionId() || !authClient.isAuthenticated()) {
      await authClient.login(provider);
    }
    return authClient;
  }

  async function authedFetch(url, options) {
    const client = await ensureAuthenticated();
    let response = await client.authedFetch(url, options);
    if (response.status === 401) {
      client.clearSession();
      await client.login(getConnectedProvider());
      response = await client.authedFetch(url, options);
    }
    return response;
  }

  async function sendSerializedTransaction(serializedTx) {
    const provider = getConnectedProvider();
    if (!provider) {
      throw new Error("Connect Phantom before signing.");
    }
    const tx = solanaWeb3.Transaction.from(decodeBase64(serializedTx));
    if (typeof provider.signAndSendTransaction === "function") {
      const sent = await provider.signAndSendTransaction(tx);
      return sent.signature;
    }
    throw new Error("This wallet cannot send Solana transactions on the exchange.");
  }

  function setWalletUi() {
    if (!connectedWallet) return;
    listNftBtn.disabled = false;
    listNftBtn.style.background = "#00cc33";
    listNftBtn.style.color = "black";
    listNftBtn.style.cursor = "pointer";
    listNftBtn.style.opacity = "1";
    walletAddrEl.textContent = `Connected: ${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`;
    connectBtn.disabled = true;
  }

  async function connectWallet() {
    const adapter = getWalletAdapter();
    if (adapter) {
      const success = await adapter.connect();
      if (!success) throw new Error("Wallet connection failed.");
      connectedWallet = adapter.walletAddress;
      connectedProvider = adapter.getProvider ? adapter.getProvider() : null;
      setWalletUi();
      return;
    }

    if (!window.solana || !window.solana.isPhantom) {
      throw new Error("Phantom wallet not found. Install Phantom and try again.");
    }

    await window.solana.connect();
    connectedWallet = window.solana.publicKey.toBase58();
    connectedProvider = window.solana;
    setWalletUi();
  }

  function renderNftPicker(nfts) {
    nftGrid.innerHTML = "";
    if (!Array.isArray(nfts) || nfts.length === 0) {
      nftGrid.innerHTML = "<p>No trade-ready NFTs found in your connected wallet.</p>";
      nftSelector.classList.remove("hidden");
      return;
    }

    nfts.forEach((nft) => {
      const card = document.createElement("div");
      card.className = "nft-card";

      const img = document.createElement("img");
      img.alt = nft.name || "NFT";
      img.src = safeImageUrl(nft.image);

      const label = document.createElement("p");
      label.textContent = nft.name || nft.mint || "Unknown NFT";

      card.appendChild(img);
      card.appendChild(label);
      card.addEventListener("click", () => prepareListing(nft));
      nftGrid.appendChild(card);
    });

    nftSelector.classList.remove("hidden");
  }

  async function loadPlayerNfts() {
    const res = await authedFetch("/api/player-nfts");
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Failed to load your NFTs.");
    }
    renderNftPicker(data.nfts);
  }

  async function prepareListing(nft) {
    const priceStr = prompt(`Price in FIZZ for ${nft.name || nft.mint}?`, "1");
    if (!priceStr) return;
    const desc = prompt("Description (optional):", "") || "";

    const prepareRes = await authedFetch("/api/exchange/post-nft/prepare", {
      method: "POST",
      body: JSON.stringify({
        nftMint: nft.mint,
        priceFizz: priceStr,
        description: desc,
      }),
    });
    const prepareData = await prepareRes.json();
    if (!prepareRes.ok || !prepareData.ok) {
      throw new Error(prepareData.error || "Could not prepare NFT listing.");
    }

    const escrowSignature = await sendSerializedTransaction(prepareData.serializedTx);
    const confirmRes = await authedFetch("/api/exchange/post-nft/confirm", {
      method: "POST",
      body: JSON.stringify({
        tradeId: prepareData.tradeId,
        escrowSignature,
      }),
    });
    const confirmData = await confirmRes.json();
    if (!confirmRes.ok || !confirmData.ok) {
      throw new Error(confirmData.error || "NFT escrow confirmation failed.");
    }

    alert(`NFT listed on the exchange. Trade ID: ${prepareData.tradeId}`);
    nftSelector.classList.add("hidden");
    await loadTrades();
  }

  async function buyTrade(tradeId) {
    const prepareRes = await authedFetch("/api/exchange/buy-trade", {
      method: "POST",
      body: JSON.stringify({ tradeId }),
    });
    const prepareData = await prepareRes.json();
    if (!prepareRes.ok || !prepareData.ok) {
      throw new Error(prepareData.error || "Could not prepare purchase.");
    }

    if (!prepareData.serializedTx) {
      alert(prepareData.message || "Trade reserved.");
      await loadTrades();
      return;
    }

    const paymentSignature = await sendSerializedTransaction(prepareData.serializedTx);
    const confirmRes = await authedFetch("/api/exchange/buy-trade/confirm", {
      method: "POST",
      body: JSON.stringify({
        tradeId,
        paymentSignature,
      }),
    });
    const confirmData = await confirmRes.json();
    if (!confirmRes.ok || !confirmData.ok) {
      throw new Error(confirmData.error || "Purchase settlement failed.");
    }

    alert(`Purchase complete. Settlement: ${confirmData.settlementSignature.slice(0, 8)}...`);
    await loadTrades();
  }

  async function loadTrades() {
    tradeList.innerHTML = '<div class="trade-card"><h3>Loading trades...</h3></div>';
    try {
      const res = await fetch("/api/exchange/trades");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const trades = await res.json();

      tradeList.innerHTML = "";
      if (!Array.isArray(trades) || trades.length === 0) {
        tradeList.innerHTML =
          '<div class="trade-card"><h3>No active trades yet. Be the first wastelander to post!</h3></div>';
        return;
      }

      trades.forEach((trade) => {
        const card = document.createElement("div");
        card.className = "trade-card";

        const titleText =
          trade.type === "nft"
            ? `NFT: ${trade.nftMint ? `${trade.nftMint.slice(0, 8)}...` : "Unknown"}`
            : trade.offer;
        const expires =
          trade.posted && trade.durationDays
            ? new Date(Number(trade.posted) + trade.durationDays * 86400000).toLocaleString()
            : "Unknown";

        card.innerHTML = `
          <h3>${escapeHtml(titleText)}</h3>
          <p class="price">${escapeHtml(trade.priceFizz)} FIZZ</p>
          <p>${escapeHtml(trade.description || "No description")}</p>
          <p>Seller: ${escapeHtml(trade.seller ? `${trade.seller.slice(0, 6)}...${trade.seller.slice(-4)}` : "?")}</p>
          <p>Expires: ${escapeHtml(expires)}</p>
          <button class="buy-btn">${trade.seed ? "Demo Listing" : trade.type === "nft" ? "Buy with Phantom" : "Reserve"}</button>
        `;

        const buyBtn = card.querySelector(".buy-btn");
        if (trade.seed) {
          buyBtn.disabled = true;
          buyBtn.style.opacity = "0.55";
          buyBtn.style.cursor = "not-allowed";
          tradeList.appendChild(card);
          return;
        }

        buyBtn.addEventListener("click", async () => {
          try {
            if (!connectedWallet) {
              await connectWallet();
            }
            await buyTrade(trade.id);
          } catch (err) {
            console.error("[exchange] buy error:", err);
            alert(err.message || "Trade failed.");
          }
        });
        tradeList.appendChild(card);
      });
    } catch (err) {
      console.error("[exchange] load trades failed:", err);
      tradeList.innerHTML =
        '<div class="trade-card"><h3>⚠ Could not load trades. Check your connection and try again.</h3></div>';
    }
  }

  connectBtn.addEventListener("click", async () => {
    try {
      await connectWallet();
      await ensureAuthenticated();
      await loadTrades();
    } catch (err) {
      console.error("[exchange] wallet connect error:", err);
      alert(err.message || "Wallet connection failed.");
    }
  });

  listNftBtn.addEventListener("click", async () => {
    try {
      if (!connectedWallet) {
        await connectWallet();
      }
      await loadPlayerNfts();
    } catch (err) {
      console.error("[exchange] load player NFTs error:", err);
      alert(err.message || "Could not load your NFTs.");
    }
  });

  document.getElementById("newTradeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      if (!connectedWallet) {
        await connectWallet();
      }
      const res = await authedFetch("/api/exchange/post-trade", {
        method: "POST",
        body: JSON.stringify({
          offer: document.getElementById("offerItem").value.trim(),
          priceFizz: document.getElementById("price").value,
          description: document.getElementById("description").value.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not post trade.");
      }
      alert(`Trade posted. ID: ${data.tradeId}`);
      event.target.reset();
      await loadTrades();
    } catch (err) {
      console.error("[exchange] post trade error:", err);
      alert(err.message || "Network error — could not post trade.");
    }
  });

  loadTrades();
})();
