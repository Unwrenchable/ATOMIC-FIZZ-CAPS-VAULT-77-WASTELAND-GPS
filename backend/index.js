// backend/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const walletRoutes = require("./routes/wallet");

const app = express();
const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "https://www.atomicfizzcaps.xyz";

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// serve wallet UI from /wallet
app.use(
  "/wallet",
  express.static(path.join(__dirname, "..", "public", "wallet"))
);

// wallet API
app.use("/api", walletRoutes);

// health check
app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy" });
});

app.listen(PORT, () => {
  console.log(`Atomic Fizz Wallet backend running on port ${PORT}`);
});


// backend/redis.js
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on("connect", () => console.log("[redis] connected"));
redis.on("error", (err) => console.error("[redis] error", err));

module.exports = redis;


// backend/routes/wallet.js
const express = require("express");
const router = express.Router();
const redis = require("../redis");

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

const rarityCaps = {
  common: 10,
  uncommon: 25,
  rare: 50,
  epic: 100,
  legendary: 250,
  fizz: 777
};

const rarityOrder = ["common", "uncommon", "rare", "epic", "legendary", "fizz"];

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

    state.nfts = state.nfts.filter(n => n.mint !== mint);

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

    state.nfts = state.nfts.filter(n => n.mint !== mint);

    const currentIndex = rarityOrder.indexOf(baseNFT.rarity || "common");
    const newRarity = rarityOrder[Math.min(currentIndex + 1, rarityOrder.length - 1)];

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

router.post("/transfer-fizz", async (req, res) => {
  try {
    const { from, to, amount } = req.body;

    if (!from || !to || typeof amount !== "number") {
      return res.status(400).json({ ok: false, error: "Missing or invalid fields" });
    }

    return res.json({ ok: true });

  } catch (err) {
    console.error("TRANSFER ERROR:", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
