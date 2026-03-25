// backend/api/player-nfts.js

const express = require("express");
const router = express.Router();
const { fetchNFTsForWallet } = require("../lib/nfts");
const { authMiddleware } = require("../lib/auth");

// BUG-003 FIX: added authMiddleware — previously any unauthenticated caller
// could enumerate any wallet's on-chain NFT holdings via the ?wallet= query param.
// Wallet is now sourced from the verified session (req.player.wallet) to prevent IDOR.
router.get("/", authMiddleware, async (req, res) => {
  try {
    const wallet = req.player.wallet;

    // Fetch NFTs from devnet via Helius
    const chainNFTs = await fetchNFTsForWallet(wallet);

    // OPTIONAL: merge with off-chain inventory later
    // const player = await getPlayerProfile(wallet);
    // const merged = mergeInventory(chainNFTs, player.inventory);

    res.json({
      ok: true,
      wallet,
      count: chainNFTs.length,
      nfts: chainNFTs
    });

  } catch (err) {
    console.error("[api/player-nfts] error:", err);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch player NFTs"
    });
  }
});

module.exports = router;
