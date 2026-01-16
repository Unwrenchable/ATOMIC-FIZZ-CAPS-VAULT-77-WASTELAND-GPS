const express = require("express");
const router = express.Router();
const redis = require("../redis");

/*
  Redis-backed state helpers
*/
async function getState() {
  const [capsStr, nftsStr] = await Promise.all([
    redis.get("afw:caps"),
    redis.get("afw:nfts"),
  ]);

  return {
    caps: capsStr ? Number(capsStr) : 0,
    nfts: nftsStr ? JSON.parse(nftsStr) : []
  };
}

async function saveState(state) {
  await Promise.all([
    redis.set("afw:caps", String(state.caps)),
    redis.set("afw:nfts", JSON.stringify(state.nfts))
  ]);
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

    const state = await getState();
    const nft = state.nfts.find(n => n.mint === mint);

    if (!nft) {
      return res.status(400).json({ ok: false, error: "NFT not owned" });
    }

    // Remove NFT
    state.nfts = state.nfts.filter(n => n.mint !== mint);

    // Award CAPS
    const capsAwarded = rarityCaps[nft.rarity] || rarityCaps.common;
    state.caps += capsAwarded;

    await saveState(state);

    return res.json({
      ok: true,
      caps: capsAwarded,
      totalCaps: state.caps
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

    const state = await getState();
    const baseNFT = state.nfts.find(n => n.mint === mint);

    if (!baseNFT) {
      return res.status(400).json({ ok: false, error: "NFT not owned" });
    }

    // Remove base NFT
    state.nfts = state.nfts.filter(n => n.mint !== mint);

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

    state.nfts.push(newNFT);
    await saveState(state);

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
