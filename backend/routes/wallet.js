const express = require("express");
const router = express.Router();
const redis = require("../redis");

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
  const amt = Number(amount) || 0;
  PLAYER_DATA.caps += amt;
  return PLAYER_DATA.caps;
}

/*
  CAPS reward table
*/
const rarityCaps = {
  common: 10,
  uncommon: 25,
  rare: 50,
  epic: 100,
  legendary: 250,
  fizz: 777
};

/*
  Rarity evolution order
*/
const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary", "fizz"];

/* ------------------------------------------------------------
   SCRAP NFT → CAPS
-------------------------------------------------------------*/
router.post("/scrap-nft", async (req, res) => {
  try {
    const { mint } = req.body;

    if (!mint || typeof mint !== "string") {
      return res.status(400).json({ ok: false, error: "Missing or invalid mint" });
    }

    const nft = PLAYER_DATA.nfts.find(n => n.mint === mint);
    if (!nft) {
      return res.status(400).json({ ok: false, error: "NFT not owned" });
    }

    // Remove NFT
    PLAYER_DATA.nfts = PLAYER_DATA.nfts.filter(n => n.mint !== mint);

    // Award CAPS
    const capsAwarded = rarityCaps[nft.rarity] || rarityCaps.common;
    const totalCaps = awardCaps(capsAwarded);

    return res.json({
      ok: true,
      caps: capsAwarded,
      totalCaps
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

    if (!mint || typeof mint !== "string") {
      return res.status(400).json({ ok: false, error: "Missing or invalid mint" });
    }

    const baseNFT = PLAYER_DATA.nfts.find(n => n.mint === mint);
    if (!baseNFT) {
      return res.status(400).json({ ok: false, error: "NFT not owned" });
    }

    // Remove base NFT
    PLAYER_DATA.nfts = PLAYER_DATA.nfts.filter(n => n.mint !== mint);

    // Evolve rarity
    const currentIndex = rarityOrder.indexOf(baseNFT.rarity || "common");
    const newRarity = rarityOrder[Math.min(currentIndex + 1, rarityOrder.length - 1)];

    // Create new NFT
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

    if (!from || !to || typeof amount !== "number") {
      return res.status(400).json({ ok: false, error: "Missing or invalid fields" });
    }

    // TODO: integrate Solana token transfer here
    return res.json({ ok: true });

  } catch (err) {
    console.error("TRANSFER ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
