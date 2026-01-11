async function fetchPlayerNFTs(wallet) {
  try {
    const url = `${window.BACKEND_URL}/api/player-nfts?wallet=${wallet}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.ok) return [];
    return json.nfts;
  } catch (err) {
    console.error("Failed to load NFTs:", err);
    return [];
  }
}
async function loadItemsWithNFTs(wallet) {
  const baseItems = await loadBaseItems(); // your existing items
  const nftItems = await fetchPlayerNFTs(wallet);

  const mappedNFTs = nftItems.map(nft => ({
    id: nft.mint,
    name: nft.name,
    type: "nft",
    image: nft.image,
    attributes: nft.attributes,
    source: "devnet"
  }));

  return [...baseItems, ...mappedNFTs];
}
if (item.type === "nft") {
  html += `
    <div class="item nft-item">
      <img src="${item.image}" class="item-image" />
      <div class="item-name">${item.name}</div>
      <div class="item-meta">NFT • Devnet</div>
    </div>
  `;
}
