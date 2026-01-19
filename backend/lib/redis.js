// backend/routes/wallet.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const redis = require("../lib/redis");

// Per-route limiter (sensitive: balance / inventory / mutation)
const walletLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 10,
  message: { ok: false, error: "Too many wallet requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

async function getState() {
  const [capsStr, nftsStr] = await Promise.all([
    redis.get("afw:caps"),
    redis.get("afw:nfts"),
  ]);

  let nfts = [];
  if (nftsStr) {
    try {
      nfts = JSON.parse(nftsStr);
      if (!Array.isArray(nfts)) nfts = [];
    } catch {
      nfts = [];
    }
  }

  return {
    caps: capsStr ? Number(capsStr) || 0 : 0,
    nfts,
  };
}

async function saveState(state) {
  await Promise.all([
    redis.set("afw:caps", String(state.caps)),
    redis.set("afw:nfts", JSON.stringify(state.nfts)),
  ]);
}

const rarityCaps = {
  common: 10,
  uncommon: 25,
  rare: 50,
  epic: 100,
  legendary: 250,
  fizz: 777,
};

const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary", "fizz"];

// Scrap NFT → caps
router.post("/scrap-nft", walletLimiter, async (req, res) => {
  try {
    const { mint } = req.body;

    if (!mint || typeof mint !== "string" || mint.length > 128) {
      return res.status(400).json({ ok: false, error: "Missing or invalid mint" });
    }

    const state = await getState();
    const nft = state.nfts.find((n) => n.mint === mint);

    if (!nft) {
      return res.status(400).json({ ok: false, error: "NFT not owned" });
    }

    state.nfts = state.nfts.filter((n) => n.mint !== mint);

    const capsAwarded = rarityCaps[nft.rarity] || rarityCaps.common;
    state.caps += capsAwarded;

    await saveState(state);

    return res.json({
      ok: true,
      caps: capsAwarded,
      totalCaps: state.caps,
    });
  } catch (err) {
    console.error("SCRAP ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Fuse NFT → higher rarity
router.post("/fuse", walletLimiter, async (req, res) => {
  try {
    const { mint } = req.body;

    if (!mint || typeof mint !== "string" || mint.length > 128) {
      return res.status(400).json({ ok: false, error: "Missing or invalid mint" });
    }

    const state = await getState();
    const baseNFT = state.nfts.find((n) => n.mint === mint);

    if (!baseNFT) {
      return res.status(400).json({ ok: false, error: "NFT not owned" });
    }

    state.nfts = state.nfts.filter((n) => n.mint !== mint);

    const currentIndex = rarityOrder.indexOf(baseNFT.rarity || "common");
    const newRarity = rarityOrder[Math.min(currentIndex + 1, rarityOrder.length - 1)];

    const newNFT = {
      name: `Fused ${baseNFT.name || "Item"}`,
      mint: "FUSED-" + Math.random().toString(36).slice(2),
      rarity: newRarity,
      image: baseNFT.image,
      description: `A fused evolution of ${baseNFT.name || "this item"}.`,
      slot: baseNFT.slot || "weapon",
      special: baseNFT.special || {},
    };

    state.nfts.push(newNFT);
    await saveState(state);

    return res.json({
      ok: true,
      newItem: newNFT,
    });
  } catch (err) {
    console.error("FUSION ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// Stubbed transfer (kept minimal, but validated + limited)
router.post("/transfer-fizz", walletLimiter, async (req, res) => {
  try {
    const { from, to, amount } = req.body;

    if (
      !from ||
      !to ||
      typeof from !== "string" ||
      typeof to !== "string" ||
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({ ok: false, error: "Missing or invalid fields" });
    }

    // TODO: implement real transfer logic with proper auth + on-chain checks
    return res.json({ ok: true });
  } catch (err) {
    console.error("TRANSFER ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
