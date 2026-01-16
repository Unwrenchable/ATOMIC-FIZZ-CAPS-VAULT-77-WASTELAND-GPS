const express = require("express");
const router = express.Router();

/*
  TEMP PLAYER DATA STORE
  Replace with Redis / Postgres / Mongo later.
*/
let PLAYER_DATA = {
  caps: 0,
  nfts: [] // { name, mint, rarity, image, description, slot, special }
};

/*
  Award CAPS to the player
*/
function awardCaps(amount) {
  PLAYER_DATA.caps += amount;
  return PLAYER_DATA.caps;
}

/* ------------------------------------------------------------
   SCRAP NFT → CAPS
-------------------------------------------------------------*/
router.post("/scrap-nft", async (req, res) => {
  try {
    const { mint } = req.body;

    if (!mint) {
      return res.status(400).json({ ok: false, error: "Missing mint" });
    }

    const nft = PLAYER_DATA.nfts.find(n => n.mint === mint);
    if (!nft) {
      return res.status(400).json({ ok: false, error: "NFT not owned" });
    }

    // Remove NFT from inventory
    PLAYER_DATA.nfts = PLAYER_DATA.nfts.filter(n => n.mint !== mint);

    // Award CAPS based on rarity
    const rarityCaps = {
      common: 10,
      uncommon: 25,
      rare: 50,
      epic: 100,
      legendary: 250,
      fizz: 777
    };

    const capsAwarded = rarityCaps[nft.rarity] || 10;
    const newTotal = awardCaps(capsAwarded);

    return res.json({
      ok: true,
      caps: capsAwarded,
      totalCaps: newTotal
    });

  } catch (err) {
    console.error("SCRAP ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ------------------------------------------------------------
   FUSION → NEW NFT
-------------------------------------------------------------*/
router.post("/fuse", async (req, res) => {
  try {
    const { mint } = req.body;

    if (!mint) {
      return res.status(400).json({ ok: false, error: "Missing mint" });
    }

    const baseNFT = PLAYER_DATA.nfts.find(n => n.mint === mint);
    if (!baseNFT) {
      return res.status(400).json({ ok: false, error: "NFT not owned" });
    }

    // Remove base NFT
    PLAYER_DATA.nfts = PLAYER_DATA.nfts.filter(n => n.mint !== mint);

    // Rarity evolution
    const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary", "fizz"];
    const currentIndex = rarityOrder.indexOf(baseNFT.rarity || "common");
    const newRarity = rarityOrder[Math.min(currentIndex + 1, rarityOrder.length - 1)];

    // Create new fused NFT
    const newNFT = {
      name: `Fused ${baseNFT.name}`,
      mint: "FUSED-" + Math.random().toString(36).slice(2),
      rarity: newRarity,
      image: baseNFT.image,
      description: `A fused evolution of ${baseNFT.name}.`,
      slot: baseNFT.slot || "weapon",
      special: baseNFT.special || {}
    };

    PLAYER_DATA.nfts.push(newNFT);

    return res.json({
      ok: true,
      newItem: newNFT
    });

  } catch (err) {
    console.error("FUSION ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/* ------------------------------------------------------------
   FIZZ TRANSFER (stub for Solana integration)
-------------------------------------------------------------*/
router.post("/transfer-fizz", async (req, res) => {
  try {
    const { from, to, amount } = req.body;

    if (!from || !to || !amount) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    // TODO: integrate Solana token transfer here
    return res.json({ ok: true });

  } catch (err) {
    console.error("TRANSFER ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
