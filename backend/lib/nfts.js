// backend/lib/nfts.js

const fetch = require("node-fetch");

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const RPC = `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

async function fetchNFTsForWallet(wallet) {
  if (!HELIUS_API_KEY) {
    throw new Error("Missing HELIUS_API_KEY");
  }

  const url = `${RPC}`;
  const body = {
    jsonrpc: "2.0",
    id: "nft-fetch",
    method: "getAssetsByOwner",
    params: {
      ownerAddress: wallet,
      page: 1,
      limit: 1000,
      displayOptions: {
        showUnverifiedCollections: true,
        showCollectionMetadata: true
      }
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const json = await res.json();

  if (!json?.result?.items) {
    return [];
  }

  return json.result.items.map((nft) => ({
    mint: nft.id,
    name: nft.content?.metadata?.name || "Unknown NFT",
    image: nft.content?.links?.image || null,
    attributes: nft.content?.metadata?.attributes || [],
    collection: nft.grouping || [],
    raw: nft
  }));
}

module.exports = {
  fetchNFTsForWallet
};
