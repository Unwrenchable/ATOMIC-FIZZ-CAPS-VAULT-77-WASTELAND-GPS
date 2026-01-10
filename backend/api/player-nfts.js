// backend/api/nfts.js

const express = require("express");
const router = express.Router();
const { fetchNFTsForWallet } = require("../lib/nfts");

router.get("/", async (req, res) => {
  try {
    const wallet = req.query.wallet;

    if (!wallet) {
      return res.status(400).json({ error: "Missing wallet parameter" });
    }

    const nfts = await fetchNFTsForWallet(wallet);

    res.json({
      ok: true,
      wallet,
      count: nfts.length,
      nfts
    });

  } catch (err) {
    console.error("[api/nfts] error:", err);
    res.status(500).json({
      ok: false,
      error: err.message || "Failed to fetch NFTs"
    });
  }
});

module.exports = router;
