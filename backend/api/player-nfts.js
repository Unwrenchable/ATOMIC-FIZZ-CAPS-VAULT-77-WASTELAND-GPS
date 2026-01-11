// backend/api/player-nfts.js

const express = require("express");
const router = express.Router();
const { fetchNFTsForWallet } = require("../lib/nfts");

router.get("/", async (req, res) => {
  try {
    const wallet = req.query.wallet;

    if (!wallet) {
      return res.status(400).json({ ok: false, error: "Missing wallet parameter" });
    }

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
      error: err.message || "Failed to fetch player NFTs"
    });
  }
});

module.exports = router;
